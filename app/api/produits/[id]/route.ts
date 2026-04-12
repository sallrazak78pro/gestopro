// app/api/produits/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Produit from "@/lib/models/Produit";
import Stock from "@/lib/models/Stock";
import { getTenantContext } from "@/lib/utils/tenant";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    await connectDB();
    const produit = await Produit.findOne({ _id: id, tenantId: ctx.tenantId });
    if (!produit) return NextResponse.json({ success: false, message: "Produit introuvable" }, { status: 404 });
    const stocks = await Stock.find({ produit: id, tenantId: ctx.tenantId }).populate("boutique", "nom type");
    return NextResponse.json({ success: true, data: { produit, stocks } });
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
    const produit = await Produit.findOneAndUpdate(
      { _id: id, tenantId: ctx.tenantId },
      body, { new: true, runValidators: true }
    );
    if (!produit) return NextResponse.json({ success: false, message: "Produit introuvable" }, { status: 404 });
    return NextResponse.json({ success: true, data: produit });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    await connectDB();
    await Produit.findOneAndUpdate({ _id: id, tenantId: ctx.tenantId }, { actif: false });
    return NextResponse.json({ success: true, message: "Produit désactivé" });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
