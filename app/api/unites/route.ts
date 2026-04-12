// app/api/unites/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Catalogue from "@/lib/models/Catalogue";
import { getTenantContext } from "@/lib/utils/tenant";

const DEFAULTS = [
  { valeur: "Pièce",   icone: "🔢" },
  { valeur: "Carton",  icone: "📦" },
  { valeur: "Kg",      icone: "⚖️" },
  { valeur: "Litre",   icone: "🧴" },
  { valeur: "Mètre",   icone: "📏" },
  { valeur: "Sachet",  icone: "🛍️" },
  { valeur: "Lot",     icone: "🗂️" },
  { valeur: "Boîte",   icone: "📫" },
  { valeur: "Palette", icone: "🏗️" },
];

export async function GET() {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    await connectDB();

    let unites = await Catalogue.find({ tenantId: ctx.tenantId, type: "unite", actif: true }).sort({ valeur: 1 });

    if (unites.length === 0) {
      try {
        await Catalogue.insertMany(
          DEFAULTS.map(d => ({ tenantId: ctx.tenantId, type: "unite", ...d, actif: true })),
          { ordered: false }
        );
      } catch (_) { /* ignorer les doublons */ }
      unites = await Catalogue.find({ tenantId: ctx.tenantId, type: "unite", actif: true }).sort({ valeur: 1 });
    }

    return NextResponse.json({ success: true, data: unites });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    await connectDB();
    const { valeur, icone } = await req.json();
    if (!valeur?.trim())
      return NextResponse.json({ success: false, message: "Le nom est requis." }, { status: 400 });

    const unite = await Catalogue.create({
      tenantId: ctx.tenantId,
      type: "unite",
      valeur: valeur.trim(),
      icone: icone || "🔢",
      actif: true,
    });
    return NextResponse.json({ success: true, data: unite }, { status: 201 });
  } catch (err: any) {
    if (err.code === 11000)
      return NextResponse.json({ success: false, message: "Cette unité existe déjà." }, { status: 400 });
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
