// app/api/tresorerie/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import MouvementArgent from "@/lib/models/MouvementArgent";
import { getTenantContext } from "@/lib/utils/tenant";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    await connectDB();
    const { id } = await params;
    const m = await MouvementArgent.findOne({ _id: id, tenantId: ctx.tenantId })
      .populate("boutique", "nom adresse")
      .populate("boutiqueDestination", "nom")
      .populate("tiers", "nom telephone solde")
      .populate("createdBy", "nom");
    if (!m) return NextResponse.json({ success: false, message: "Introuvable" }, { status: 404 });
    return NextResponse.json({ success: true, data: m });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
