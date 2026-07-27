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
    // Le prix d'achat (prix de revient) ne doit être visible qu'à l'admin.
    const exclude = [
      searchParams.get("avecImage") ? null : "image",
      ["admin", "superadmin"].includes(ctx.role) ? null : "prixAchat",
    ].filter(Boolean).map(f => `-${f}`).join(" ");
    const produits = await Produit.find(query, exclude || undefined).sort({ nom: 1 }).lean();
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
    const isAdminRole = ["admin", "superadmin"].includes(ctx.role);
    // Le prix de revient est réservé à l'admin — un rôle non-admin qui crée
    // un produit ne le fixe pas ; l'admin le complètera plus tard.
    if (!isAdminRole) body.prixAchat = 0;
    const produit = await Produit.create({ ...body, tenantId: ctx.tenantId });
    const data = isAdminRole ? produit : (({ prixAchat, ...rest }) => rest)(produit.toObject());
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (err: any) {
    if (err.code === 11000)
      return NextResponse.json({ success: false, message: "Référence déjà utilisée" }, { status: 400 });
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
