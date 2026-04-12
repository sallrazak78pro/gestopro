// app/api/parametres/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Tenant from "@/lib/models/Tenant";
import User from "@/lib/models/User";
import { getTenantContext } from "@/lib/utils/tenant";

// GET — infos du tenant + stats
export async function GET() {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    await connectDB();

    const tenant = await Tenant.findById(ctx.tenantId);
    if (!tenant)
      return NextResponse.json({ success: false, message: "Tenant introuvable" }, { status: 404 });

    const [nbUsers, nbBoutiques] = await Promise.all([
      User.countDocuments({ tenantId: ctx.tenantId, actif: true }),
      (await import("@/lib/models/Boutique")).default.countDocuments({ tenantId: ctx.tenantId, actif: true }),
    ]);

    return NextResponse.json({ success: true, data: tenant, meta: { nbUsers, nbBoutiques } });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

// PUT — mettre à jour les infos de l'entreprise
export async function PUT(req: NextRequest) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    if (!["admin", "superadmin"].includes(ctx.role))
      return NextResponse.json({ success: false, message: "Permission insuffisante" }, { status: 403 });
    await connectDB();

    const body = await req.json();
    const allowed = ["nom", "telephone", "ville", "pays", "email", "gestionStockStricte", "mouvementsActifs"];
    const update: any = {};
    allowed.forEach(k => { if (body[k] !== undefined) update[k] = body[k]; });

    const tenant = await Tenant.findByIdAndUpdate(ctx.tenantId, update, { new: true });
    return NextResponse.json({ success: true, data: tenant });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
