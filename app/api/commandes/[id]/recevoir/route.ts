// app/api/commandes/[id]/recevoir/route.ts
// Réceptionner tout ou partie d'une commande → met à jour le stock
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import CommandeFournisseur from "@/lib/models/CommandeFournisseur";
import Stock from "@/lib/models/Stock";
import MouvementStock from "@/lib/models/MouvementStock";
import Produit from "@/lib/models/Produit";
import Boutique from "@/lib/models/Boutique";
import Tenant from "@/lib/models/Tenant";
import "@/lib/models/Fournisseur"; // enregistre le schéma Mongoose pour .populate("fournisseur")
import { getTenantContext } from "@/lib/utils/tenant";
import { getTaux, fcfaVersDevise } from "@/lib/utils/devise";
import { calculerCUMP } from "@/lib/utils/cump";
import { genererReference } from "@/lib/utils/reference";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    await connectDB();

    // receptions = [{ ligneIndex: number, quantiteRecue: number }]
    const { receptions, note, fraisLivraison } = await req.json();
    if (!receptions?.length)
      return NextResponse.json({ success: false, message: "Aucune réception fournie." }, { status: 400 });
    const frais = Math.max(0, fraisLivraison || 0); // FCFA — transport/douane/livraison, payés au fournisseur

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

    const lignesMouvement: {
      produit: any; quantite: number; prixUnitaire: number; montant: number;
      qteAvantBoutique: number; coutAvantBoutique: number;
      qteAvantTenant: number; coutAvantTenant: number;
    }[] = [];

    for (const rec of receptions) {
      const ligne = commande.lignes[rec.ligneIndex];
      if (!ligne) continue;

      const qteRestante = ligne.quantiteCommandee - ligne.quantiteRecue;
      const qteARecevoir = Math.min(rec.quantiteRecue, qteRestante);
      if (qteARecevoir <= 0) continue;

      // Mettre à jour la ligne de commande
      commande.lignes[rec.ligneIndex].quantiteRecue += qteARecevoir;

      // Capturer l'état AVANT réception, pour pouvoir calculer une moyenne
      // pondérée (CUMP) avec le stock déjà en place plutôt que d'écraser le coût.
      const [stockAvant, aggTenant, produitAvant] = await Promise.all([
        Stock.findOne({ produit: ligne.produit, boutique: commande.destination, tenantId: ctx.tenantId }).lean() as any,
        Stock.aggregate([
          { $match: {
            produit:  new mongoose.Types.ObjectId(ligne.produit.toString()),
            tenantId: new mongoose.Types.ObjectId(ctx.tenantId.toString()),
          } },
          { $group: { _id: null, total: { $sum: "$quantite" } } },
        ]),
        Produit.findOne({ _id: ligne.produit, tenantId: ctx.tenantId }, "prixAchat prixVente").lean() as any,
      ]);

      // Incrémenter le stock dans la destination (le coût réel — frais inclus —
      // est appliqué juste après, une fois le total de cette réception connu)
      await Stock.findOneAndUpdate(
        { produit: ligne.produit, boutique: commande.destination, tenantId: ctx.tenantId },
        { $inc: { quantite: qteARecevoir }, $setOnInsert: { tenantId: ctx.tenantId } },
        { upsert: true }
      );

      lignesMouvement.push({
        produit: ligne.produit,
        quantite: qteARecevoir,
        prixUnitaire: ligne.prixUnitaire,
        montant: qteARecevoir * ligne.prixUnitaire,
        qteAvantBoutique: stockAvant?.quantite ?? 0,
        coutAvantBoutique: stockAvant?.prixAchatLocal ?? 0,
        qteAvantTenant: aggTenant[0]?.total ?? 0,
        coutAvantTenant: produitAvant?.prixAchat ?? 0,
      });
    }

    // Les frais de livraison (transport/douane) sont répartis à parts égales
    // par unité physique reçue (pas au prorata de la valeur) — un colis lourd
    // et bon marché coûte autant à transporter qu'un colis léger et cher.
    const totalQteRecue = lignesMouvement.reduce((s, l) => s + l.quantite, 0);
    const fraisParUnite = totalQteRecue > 0 ? frais / totalQteRecue : 0;

    for (const l of lignesMouvement) {
      const coutCetArrivage = l.prixUnitaire + fraisParUnite;

      // CUMP tenant (FCFA) — moyenne pondérée avec le stock existant, toutes boutiques confondues
      const cumpTenant = calculerCUMP(l.qteAvantTenant, l.coutAvantTenant, l.quantite, coutCetArrivage);

      // CUMP boutique (devise locale) — moyenne pondérée avec le stock déjà présent dans CETTE boutique
      const coutCetArrivageLocal = fcfaVersDevise(coutCetArrivage, deviseDest, taux);
      const cumpBoutique = calculerCUMP(l.qteAvantBoutique, l.coutAvantBoutique, l.quantite, coutCetArrivageLocal);

      const stock = await Stock.findOneAndUpdate(
        { produit: l.produit, boutique: commande.destination, tenantId: ctx.tenantId },
        { prixAchatLocal: Math.round(cumpBoutique * 100) / 100 },
        { new: true }
      );

      // Première entrée de ce produit dans cette boutique : proposer un prix
      // de vente converti (modifiable ensuite par le commerçant).
      if (stock && stock.prixVente == null) {
        const produitRef = await Produit.findOne({ _id: l.produit, tenantId: ctx.tenantId }, "prixVente").lean() as any;
        const prixVenteSuggere = fcfaVersDevise(produitRef?.prixVente ?? 0, deviseDest, taux);
        await Stock.updateOne({ _id: stock._id }, { prixVente: prixVenteSuggere });
      }

      // Prix d'achat de référence du produit (CUMP FCFA, toutes boutiques confondues)
      await Produit.findOneAndUpdate(
        { _id: l.produit, tenantId: ctx.tenantId },
        { prixAchat: Math.round(cumpTenant) }
      );
    }

    // Les frais restent une info de référence (servent au prix de revient) —
    // ils ne touchent ni le montant dû au fournisseur, ni sa trésorerie.
    if (frais > 0 && lignesMouvement.length > 0) {
      commande.fraisLivraison = (commande.fraisLivraison || 0) + frais;
    }

    // Créer un mouvement de stock unique (entrée) pour cette réception
    if (lignesMouvement.length > 0) {
      const refMv = await genererReference(ctx.tenantId, `MV-${new Date().getFullYear()}`);
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
