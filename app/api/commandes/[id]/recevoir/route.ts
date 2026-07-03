// app/api/commandes/[id]/recevoir/route.ts
// Réceptionner tout ou partie d'une commande → met à jour le stock
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import CommandeFournisseur from "@/lib/models/CommandeFournisseur";
import Stock from "@/lib/models/Stock";
import MouvementStock from "@/lib/models/MouvementStock";
import Produit from "@/lib/models/Produit";
import Boutique from "@/lib/models/Boutique";
import Tenant from "@/lib/models/Tenant";
import { getTenantContext } from "@/lib/utils/tenant";
import { getTaux, fcfaVersDevise } from "@/lib/utils/devise";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    await connectDB();

    // receptions = [{ ligneIndex: number, quantiteRecue: number }]
    const { receptions, note } = await req.json();
    if (!receptions?.length)
      return NextResponse.json({ success: false, message: "Aucune réception fournie." }, { status: 400 });

    const commande = await CommandeFournisseur.findOne({ _id: (await params).id, tenantId: ctx.tenantId });
    if (!commande)
      return NextResponse.json({ success: false, message: "Commande introuvable." }, { status: 404 });
    if (commande.statut === "recue" || commande.statut === "annulee")
      return NextResponse.json({ success: false, message: "Commande déjà clôturée." }, { status: 400 });

    // La commande est toujours en FCFA — on convertit vers la devise de la
    // boutique destinataire si elle en utilise une autre (ex: dépôt FCFA → boutique USD).
    const [destBoutique, tenant] = await Promise.all([
      Boutique.findById(commande.destination).lean() as any,
      Tenant.findById(ctx.tenantId).lean() as any,
    ]);
    const deviseDest = destBoutique?.devise || "FCFA";
    const taux = getTaux(tenant, deviseDest);

    const lignesMouvement: { produit: any; quantite: number; prixUnitaire: number; montant: number }[] = [];

    for (const rec of receptions) {
      const ligne = commande.lignes[rec.ligneIndex];
      if (!ligne) continue;

      const qteRestante = ligne.quantiteCommandee - ligne.quantiteRecue;
      const qteARecevoir = Math.min(rec.quantiteRecue, qteRestante);
      if (qteARecevoir <= 0) continue;

      // Mettre à jour la ligne de commande
      commande.lignes[rec.ligneIndex].quantiteRecue += qteARecevoir;

      const prixAchatLocal = fcfaVersDevise(ligne.prixUnitaire, deviseDest, taux);

      // Mettre à jour le stock dans la destination (coût converti dans sa devise)
      const stock = await Stock.findOneAndUpdate(
        { produit: ligne.produit, boutique: commande.destination, tenantId: ctx.tenantId },
        { $inc: { quantite: qteARecevoir }, $set: { prixAchatLocal }, $setOnInsert: { tenantId: ctx.tenantId } },
        { upsert: true, new: true }
      );

      // Première entrée de ce produit dans cette boutique : proposer un prix
      // de vente converti (modifiable ensuite par le commerçant).
      if (stock.prixVente == null) {
        const produitRef = await Produit.findOne({ _id: ligne.produit, tenantId: ctx.tenantId }, "prixVente").lean() as any;
        const prixVenteSuggere = fcfaVersDevise(produitRef?.prixVente ?? 0, deviseDest, taux);
        await Stock.updateOne({ _id: stock._id }, { prixVente: prixVenteSuggere });
      }

      // Mettre à jour le prix d'achat de référence du produit (toujours en FCFA)
      await Produit.findOneAndUpdate(
        { _id: ligne.produit, tenantId: ctx.tenantId },
        { prixAchat: ligne.prixUnitaire }
      );

      lignesMouvement.push({
        produit: ligne.produit,
        quantite: qteARecevoir,
        prixUnitaire: ligne.prixUnitaire,
        montant: qteARecevoir * ligne.prixUnitaire,
      });
    }

    // Créer un mouvement de stock unique (entrée) pour cette réception
    if (lignesMouvement.length > 0) {
      const countMv = await MouvementStock.countDocuments({ tenantId: ctx.tenantId });
      const refMv = `MV-${new Date().getFullYear()}-${String(countMv + 1).padStart(4, "0")}`;
      await MouvementStock.create({
        tenantId:  ctx.tenantId,
        reference: refMv,
        boutique:  commande.destination,
        type:      "entree",
        lignes:    lignesMouvement,
        montant:   lignesMouvement.reduce((s, l) => s + l.montant, 0),
        motif:     `Réception commande ${commande.reference}${note ? ` — ${note}` : ""}`,
        createdBy: ctx.userId,
      });
    }

    // Recalculer le statut de la commande
    const toutRecu = commande.lignes.every(
      l => l.quantiteRecue >= l.quantiteCommandee
    );
    const partiellement = commande.lignes.some(l => l.quantiteRecue > 0);
    commande.statut = toutRecu ? "recue" : partiellement ? "recue_partiellement" : commande.statut;
    if (commande.statut === "recue" || partiellement) commande.dateReception = new Date();

    await commande.save();

    const populated = await CommandeFournisseur.findById(commande._id)
      .populate("fournisseur","nom").populate("destination","nom type");
    return NextResponse.json({ success: true, data: populated });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
