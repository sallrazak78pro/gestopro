// app/api/employes/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Employe from "@/lib/models/Employe";
import AvanceSalaire from "@/lib/models/AvanceSalaire";
import PaiementSalaire from "@/lib/models/PaiementSalaire";
import { getTenantContext } from "@/lib/utils/tenant";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    await connectDB();

    const employe = await Employe.findOne({ _id: id, tenantId: ctx.tenantId })
      .populate("boutique", "nom adresse")
      .populate("userId", "nom email role");
    if (!employe)
      return NextResponse.json({ success: false, message: "Employé introuvable" }, { status: 404 });

    // Avances en attente
    const avancesEnAttente = await AvanceSalaire.find({
      employe: id, tenantId: ctx.tenantId, statut: "en_attente",
    }).sort({ date: -1 });

    // Historique des paiements
    const paiements = await PaiementSalaire.find({ employe: id, tenantId: ctx.tenantId })
      .populate("boutiqueSource", "nom")
      .populate("createdBy", "nom")
      .sort({ annee: -1, mois: -1 })
      .limit(12);

    return NextResponse.json({ success: true, data: { employe, avancesEnAttente, paiements } });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    if (!["admin", "superadmin"].includes(ctx.role))
      return NextResponse.json({ success: false, message: "Permission insuffisante" }, { status: 403 });
    await connectDB();
    const body = await req.json();
    const employe = await Employe.findOneAndUpdate(
      { _id: id, tenantId: ctx.tenantId },
      body, { new: true, runValidators: true }
    ).populate("boutique", "nom");
    if (!employe)
      return NextResponse.json({ success: false, message: "Employé introuvable" }, { status: 404 });
    return NextResponse.json({ success: true, data: employe });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    if (!["admin", "superadmin"].includes(ctx.role))
      return NextResponse.json({ success: false, message: "Permission insuffisante" }, { status: 403 });
    await connectDB();
    await Employe.findOneAndUpdate({ _id: id, tenantId: ctx.tenantId }, { actif: false });
    return NextResponse.json({ success: true, message: "Employé désactivé." });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
