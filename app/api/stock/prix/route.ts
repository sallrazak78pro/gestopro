// app/api/stock/prix/route.ts
// Modifier le prix de vente d'un produit pour une boutique donnée (dans sa devise)
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Stock from "@/lib/models/Stock";
import { getTenantContext } from "@/lib/utils/tenant";

export async function POST(req: NextRequest) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    if (!["superadmin", "admin", "gestionnaire"].includes(ctx.role))
      return NextResponse.json({ success: false, message: "Permission insuffisante" }, { status: 403 });
    await connectDB();
    const { produitId, boutiqueId, prixVente } = await req.json();
    if (prixVente == null || prixVente < 0)
      return NextResponse.json({ success: false, message: "Prix invalide" }, { status: 400 });

    const stock = await Stock.findOneAndUpdate(
      { produit: produitId, boutique: boutiqueId, tenantId: ctx.tenantId },
      { prixVente, tenantId: ctx.tenantId },
      { upsert: true, new: true }
    );
    return NextResponse.json({ success: true, data: stock });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
