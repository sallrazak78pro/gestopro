// app/api/boutiques/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Boutique from "@/lib/models/Boutique";
import { getTenantContext } from "@/lib/utils/tenant";

export async function GET(req: NextRequest) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    await connectDB();
    const { searchParams } = new URL(req.url);
    const query: any = { tenantId: ctx.tenantId };
    // Par défaut on ne retourne que les actifs, sauf si includeInactif=1
    if (!searchParams.get("includeInactif")) query.actif = true;
    if (searchParams.get("type")) query.type = searchParams.get("type");
    const boutiques = await Boutique.find(query).sort({ estPrincipale: -1, type: -1, nom: 1 });
    return NextResponse.json({ success: true, data: boutiques });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    if (!["admin", "superadmin"].includes(ctx.role))
      return NextResponse.json({ success: false, message: "Permission insuffisante" }, { status: 403 });
    await connectDB();
    const body = await req.json();
    if (body.estPrincipale) {
      await Boutique.updateMany({ tenantId: ctx.tenantId }, { estPrincipale: false });
    }
    const boutique = await Boutique.create({ ...body, tenantId: ctx.tenantId });
    return NextResponse.json({ success: true, data: boutique }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
