// app/api/fournisseurs/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Fournisseur from "@/lib/models/Fournisseur";
import { getTenantContext } from "@/lib/utils/tenant";

export async function GET(req: NextRequest) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    await connectDB();
    const { searchParams } = new URL(req.url);
    const query: any = { tenantId: ctx.tenantId };
    if (searchParams.get("search")) {
      const s = searchParams.get("search");
      query.$or = [{ nom:{$regex:s,$options:"i"} },{ contact:{$regex:s,$options:"i"} },{ telephone:{$regex:s,$options:"i"} }];
    }
    if (searchParams.get("actif") !== null && searchParams.get("actif") !== "")
      query.actif = searchParams.get("actif") === "true";
    const fournisseurs = await Fournisseur.find(query).sort({ nom: 1 });
    const totalDette = fournisseurs.reduce((s, f) => s + f.soldeCredit, 0);
    return NextResponse.json({ success: true, data: fournisseurs, stats: { totalDette, nbActifs: fournisseurs.filter(f=>f.actif).length } });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    if (!["admin","superadmin"].includes(ctx.role))
      return NextResponse.json({ success: false, message: "Permission insuffisante" }, { status: 403 });
    await connectDB();
    const body = await req.json();
    if (!body.nom?.trim())
      return NextResponse.json({ success: false, message: "Nom requis." }, { status: 400 });
    const f = await Fournisseur.create({ ...body, tenantId: ctx.tenantId, soldeCredit: 0 });
    return NextResponse.json({ success: true, data: f }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
