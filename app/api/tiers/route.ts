// app/api/tiers/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import CompteTiers from "@/lib/models/CompteTiers";
import { getTenantContext, canAccessBoutique } from "@/lib/utils/tenant";

export async function GET(req: NextRequest) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    await connectDB();
    const { searchParams } = new URL(req.url);
    const query: any = { tenantId: ctx.tenantId, actif: true };
    if (ctx.boutiqueAssignee) query.boutique = ctx.boutiqueAssignee;
    else if (searchParams.get("boutique")) query.boutique = searchParams.get("boutique");
    if (searchParams.get("search")) {
      const s = searchParams.get("search");
      query.$or = [{ nom: { $regex: s, $options: "i" } }, { telephone: { $regex: s, $options: "i" } }];
    }
    const page  = parseInt(searchParams.get("page")  || "1");
    const limit = parseInt(searchParams.get("limit") || "25");
    const skip  = (page - 1) * limit;

    // Les stats portent sur tout l'ensemble filtré, pas seulement la page
    // affichée — sinon "Total des soldes"/"Comptes actifs" varient selon la page.
    const [tiers, total, tousLesSoldes] = await Promise.all([
      CompteTiers.find(query).populate("boutique","nom").sort({ nom: 1 }).skip(skip).limit(limit),
      CompteTiers.countDocuments(query),
      CompteTiers.find(query).select("solde"),
    ]);

    const totalSoldes = tousLesSoldes.reduce((s, t) => s + t.solde, 0);
    const nbActifs    = tousLesSoldes.filter(t => t.solde > 0).length;
    return NextResponse.json({
      success: true, data: tiers,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      stats: { totalSoldes, nbComptes: total, nbActifs },
    });
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
    const boutiqueId = ctx.boutiqueAssignee ?? body.boutique;
    if (!canAccessBoutique(ctx, boutiqueId))
      return NextResponse.json({ success: false, message: "Accès refusé à cette boutique." }, { status: 403 });
    const tiers = await CompteTiers.create({ nom: body.nom, telephone: body.telephone, description: body.description, boutique: boutiqueId, tenantId: ctx.tenantId, solde: 0 });
    return NextResponse.json({ success: true, data: tiers }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
