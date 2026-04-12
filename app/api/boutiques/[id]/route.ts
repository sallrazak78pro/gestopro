// app/api/boutiques/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Boutique from "@/lib/models/Boutique";
import { getTenantContext } from "@/lib/utils/tenant";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    await connectDB();
    const boutique = await Boutique.findOne({ _id: id, tenantId: ctx.tenantId });
    if (!boutique)
      return NextResponse.json({ success: false, message: "Boutique introuvable" }, { status: 404 });
    return NextResponse.json({ success: true, data: boutique });
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

    // Si on marque cette boutique comme principale, démarquer les autres
    if (body.estPrincipale) {
      await Boutique.updateMany(
        { tenantId: ctx.tenantId, _id: { $ne: id } },
        { estPrincipale: false }
      );
    }

    const boutique = await Boutique.findOneAndUpdate(
      { _id: id, tenantId: ctx.tenantId },
      body, { new: true, runValidators: true }
    );
    if (!boutique)
      return NextResponse.json({ success: false, message: "Boutique introuvable" }, { status: 404 });
    return NextResponse.json({ success: true, data: boutique });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    if (!["admin", "superadmin"].includes(ctx.role))
      return NextResponse.json({ success: false, message: "Permission insuffisante" }, { status: 403 });
    await connectDB();

    // Empêcher de supprimer la boutique principale
    const boutique = await Boutique.findOne({ _id: id, tenantId: ctx.tenantId });
    if (!boutique)
      return NextResponse.json({ success: false, message: "Boutique introuvable" }, { status: 404 });
    if (boutique.estPrincipale)
      return NextResponse.json({ success: false, message: "Impossible de désactiver la boutique principale." }, { status: 400 });

    await Boutique.findByIdAndUpdate(id, { actif: false });
    return NextResponse.json({ success: true, message: "Boutique désactivée." });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
