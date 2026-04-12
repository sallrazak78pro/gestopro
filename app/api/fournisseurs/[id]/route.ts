// app/api/fournisseurs/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Fournisseur from "@/lib/models/Fournisseur";
import CommandeFournisseur from "@/lib/models/CommandeFournisseur";
import { getTenantContext } from "@/lib/utils/tenant";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    await connectDB();
    const f = await Fournisseur.findOne({ _id: id, tenantId: ctx.tenantId });
    if (!f) return NextResponse.json({ success: false, message: "Introuvable" }, { status: 404 });
    const commandes = await CommandeFournisseur.find({ fournisseur: id, tenantId: ctx.tenantId })
      .populate("destination", "nom type").sort({ createdAt: -1 }).limit(20);
    const stats = {
      totalCommandes: commandes.length,
      totalAchats: commandes.reduce((s,c) => s + c.montantTotal, 0),
      totalDu: commandes.reduce((s,c) => s + c.montantDu, 0),
    };
    return NextResponse.json({ success: true, data: { fournisseur: f, commandes, stats } });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    await connectDB();
    const body = await req.json();
    const f = await Fournisseur.findOneAndUpdate({ _id: id, tenantId: ctx.tenantId }, body, { new: true });
    if (!f) return NextResponse.json({ success: false, message: "Introuvable" }, { status: 404 });
    return NextResponse.json({ success: true, data: f });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    await connectDB();
    await Fournisseur.findOneAndUpdate({ _id: id, tenantId: ctx.tenantId }, { actif: false });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
