// app/api/tiers/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import CompteTiers from "@/lib/models/CompteTiers";
import MouvementArgent from "@/lib/models/MouvementArgent";
import { getTenantContext } from "@/lib/utils/tenant";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    await connectDB();
    const tiers = await CompteTiers.findOne({ _id: id, tenantId: ctx.tenantId }).populate("boutique","nom");
    if (!tiers) return NextResponse.json({ success: false, message: "Introuvable" }, { status: 404 });
    const historique = await MouvementArgent.find({ tiers: id, tenantId: ctx.tenantId }).populate("boutique","nom").populate("createdBy","nom").sort({ createdAt: -1 });
    return NextResponse.json({ success: true, data: { tiers, historique } });
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
    const tiers = await CompteTiers.findOneAndUpdate({ _id: id, tenantId: ctx.tenantId }, body, { new: true });
    if (!tiers) return NextResponse.json({ success: false, message: "Introuvable" }, { status: 404 });
    return NextResponse.json({ success: true, data: tiers });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
