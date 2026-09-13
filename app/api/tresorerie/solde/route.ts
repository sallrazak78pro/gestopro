// app/api/tresorerie/solde/route.ts
// Retourne le solde de caisse disponible d'une boutique
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getTenantContext, requirePermission } from "@/lib/utils/tenant";
import { calculerSoldeCaisse } from "@/lib/utils/tresorerie";

export async function GET(req: NextRequest) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    const denied = requirePermission(ctx, "tresorerie", "view");
    if (denied) return denied;
    await connectDB();

    const boutiqueId = new URL(req.url).searchParams.get("boutiqueId");
    if (!boutiqueId)
      return NextResponse.json({ success: false, message: "boutiqueId requis" }, { status: 400 });

    const { soldeCaisse, detail } = await calculerSoldeCaisse(ctx.tenantId, boutiqueId);

    return NextResponse.json({
      success: true,
      data: { soldeCaisse, detail },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
