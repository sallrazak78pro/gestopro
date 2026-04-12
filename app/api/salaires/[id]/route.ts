// app/api/salaires/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import PaiementSalaire from "@/lib/models/PaiementSalaire";
import AvanceSalaire from "@/lib/models/AvanceSalaire";
import { getTenantContext } from "@/lib/utils/tenant";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    await connectDB();

    const paiement = await PaiementSalaire.findOne({ _id: (await params).id, tenantId: ctx.tenantId })
      .populate("employe",       "nom prenom poste salaireBase dateEmbauche boutique")
      .populate({
        path: "employe",
        populate: { path: "boutique", select: "nom" },
      })
      .populate("boutique",      "nom")
      .populate("boutiqueSource","nom")
      .populate("createdBy",     "nom");

    if (!paiement)
      return NextResponse.json({ success: false, message: "Paiement introuvable" }, { status: 404 });

    // Charger le détail des avances déduites
    const avancesDetail = await AvanceSalaire.find({
      _id: { $in: paiement.avancesDeduits ?? [] },
    }).select("montant motif date createdAt");

    return NextResponse.json({
      success: true,
      data: {
        ...paiement.toObject(),
        avancesDeduitees: avancesDetail.map(a => ({
          montant: a.montant,
          motif:   a.motif,
          date:    a.createdAt ?? a.date,
        })),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
