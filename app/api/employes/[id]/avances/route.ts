// app/api/employes/[id]/avances/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import AvanceSalaire from "@/lib/models/AvanceSalaire";
import Employe from "@/lib/models/Employe";
import MouvementArgent from "@/lib/models/MouvementArgent";
import { getTenantContext } from "@/lib/utils/tenant";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    await connectDB();
    const avances = await AvanceSalaire.find({ employe: id, tenantId: ctx.tenantId })
      .populate("createdBy", "nom")
      .sort({ date: -1 });
    return NextResponse.json({ success: true, data: avances });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    await connectDB();

    const { montant, motif, moisDeduction, anneeDeduction, boutiqueId } = await req.json();
    if (!montant || montant <= 0)
      return NextResponse.json({ success: false, message: "Montant invalide." }, { status: 400 });

    const employe = await Employe.findOne({ _id: id, tenantId: ctx.tenantId });
    if (!employe)
      return NextResponse.json({ success: false, message: "Employé introuvable." }, { status: 404 });

    // Créer l'avance
    const avance = await AvanceSalaire.create({
      tenantId: ctx.tenantId,
      employe: id,
      boutique: boutiqueId || employe.boutique,
      montant, motif: motif || "",
      date: new Date(),
      moisDeduction, anneeDeduction,
      statut: "en_attente",
      createdBy: ctx.userId,
    });

    // Créer une sortie de trésorerie automatiquement
    const count = await MouvementArgent.countDocuments({ tenantId: ctx.tenantId });
    const reference = `AVS-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;
    await MouvementArgent.create({
      tenantId: ctx.tenantId,
      reference,
      type: "depense",
      boutique: boutiqueId || employe.boutique,
      montant,
      categorieDepense: "salaire",
      motif: `Avance sur salaire — ${employe.prenom} ${employe.nom}${motif ? ` — ${motif}` : ""}`,
      createdBy: ctx.userId,
    });

    return NextResponse.json({ success: true, data: avance }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
