// app/api/commandes/[id]/recevoir/route.ts
// Réceptionner tout ou partie d'une commande → met à jour le stock
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import CommandeFournisseur from "@/lib/models/CommandeFournisseur";
import Stock from "@/lib/models/Stock";
import MouvementStock from "@/lib/models/MouvementStock";
import Produit from "@/lib/models/Produit";
import { getTenantContext } from "@/lib/utils/tenant";

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

    const countMv = await MouvementStock.countDocuments({ tenantId: ctx.tenantId });

    for (const rec of receptions) {
      const ligne = commande.lignes[rec.ligneIndex];
      if (!ligne) continue;

      const qteRestante = ligne.quantiteCommandee - ligne.quantiteRecue;
      const qteARecevoir = Math.min(rec.quantiteRecue, qteRestante);
      if (qteARecevoir <= 0) continue;

      // Mettre à jour la ligne de commande
      commande.lignes[rec.ligneIndex].quantiteRecue += qteARecevoir;

      // Mettre à jour le stock dans la destination
      await Stock.findOneAndUpdate(
        { produit: ligne.produit, boutique: commande.destination, tenantId: ctx.tenantId },
        { $inc: { quantite: qteARecevoir }, $setOnInsert: { tenantId: ctx.tenantId } },
        { upsert: true }
      );

      // Mettre à jour le prix d'achat du produit (dernier prix fournisseur)
      await Produit.findOneAndUpdate(
        { _id: ligne.produit, tenantId: ctx.tenantId },
        { prixAchat: ligne.prixUnitaire }
      );

      // Créer un mouvement de stock (entrée fournisseur)
      const refMv = `MV-${new Date().getFullYear()}-${String(countMv + rec.ligneIndex + 1).padStart(4,"0")}`;
      await MouvementStock.create({
        tenantId: ctx.tenantId,
        reference: refMv,
        type: "entree_fournisseur",
        produit: ligne.produit,
        source: null,
        destination: commande.destination,
        quantite: qteARecevoir,
        motif: `Réception commande ${commande.reference}${note ? ` — ${note}` : ""}`,
        statut: "livre",
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
