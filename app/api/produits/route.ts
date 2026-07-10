// app/api/produits/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Produit from "@/lib/models/Produit";
import { getTenantContext } from "@/lib/utils/tenant";
import { genererReference } from "@/lib/utils/reference";

export async function GET(req: NextRequest) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    await connectDB();
    const { searchParams } = new URL(req.url);
    const query: any = { tenantId: ctx.tenantId, actif: true };
    if (searchParams.get("search")) query.$or = [
      { nom:       { $regex: searchParams.get("search"), $options: "i" } },
      { reference: { $regex: searchParams.get("search"), $options: "i" } },
    ];
    if (searchParams.get("categorie")) query.categorie = searchParams.get("categorie");

    // L'image (base64) est lourde et rarement utile — exclue par défaut,
    // seule la vente au comptoir (miniature produit) la redemande explicitement.
    const projection = searchParams.get("avecImage") ? undefined : "-image";
    const produits = await Produit.find(query, projection).sort({ nom: 1 }).lean();
    return NextResponse.json({ success: true, data: produits });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    await connectDB();
    const body = await req.json();
    if (!body.reference) {
      body.reference = await genererReference(ctx.tenantId, "PRD");
    }
    const produit = await Produit.create({ ...body, tenantId: ctx.tenantId });
    return NextResponse.json({ success: true, data: produit }, { status: 201 });
  } catch (err: any) {
    if (err.code === 11000)
      return NextResponse.json({ success: false, message: "Référence déjà utilisée" }, { status: 400 });
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
