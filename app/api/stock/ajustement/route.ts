// app/api/stock/ajustement/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Stock from "@/lib/models/Stock";
import Produit from "@/lib/models/Produit";
import { getTenantContext, requirePermission } from "@/lib/utils/tenant";
import { logActivity, ACTIONS, MODULES } from "@/lib/utils/activity";

export async function POST(req: NextRequest) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    const denied = requirePermission(ctx, "stock", "edit");
    if (denied) return denied;
    await connectDB();
    const { produitId, boutiqueId, quantite } = await req.json();
    if (quantite < 0)
      return NextResponse.json({ success: false, message: "Quantité invalide" }, { status: 400 });
    const ancien = await Stock.findOne({ produit: produitId, boutique: boutiqueId, tenantId: ctx.tenantId }).lean() as any;
    const stock = await Stock.findOneAndUpdate(
      { produit: produitId, boutique: boutiqueId, tenantId: ctx.tenantId },
      { quantite, tenantId: ctx.tenantId },
      { upsert: true, new: true }
    );

    const produit = await Produit.findById(produitId).select("nom").lean() as any;
    await logActivity({
      tenantId: ctx.tenantId, userId: ctx.userId, userNom: ctx.userNom, role: ctx.role,
      action: ACTIONS.STOCK_AJUSTE, module: MODULES.STOCK,
      details: `Ajustement stock — ${produit?.nom ?? produitId} : ${ancien?.quantite ?? 0} → ${quantite}`,
      boutique: boutiqueId,
    });

    return NextResponse.json({ success: true, data: stock });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
