// app/api/categories/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Catalogue from "@/lib/models/Catalogue";
import { getTenantContext } from "@/lib/utils/tenant";

const DEFAULTS = [
  { valeur: "Électronique",  icone: "📱" },
  { valeur: "Accessoires",   icone: "🎧" },
  { valeur: "Alimentation",  icone: "🛒" },
  { valeur: "Vêtements",     icone: "👗" },
  { valeur: "Informatique",  icone: "💻" },
  { valeur: "Téléphonie",    icone: "📞" },
  { valeur: "Maison",        icone: "🏠" },
  { valeur: "Beauté",        icone: "💄" },
  { valeur: "Santé",         icone: "💊" },
  { valeur: "Autre",         icone: "📦" },
];

// GET — liste des catégories du tenant
export async function GET() {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    await connectDB();

    let cats = await Catalogue.find({ tenantId: ctx.tenantId, type: "categorie", actif: true }).sort({ valeur: 1 });

    // Premier lancement : insérer les défauts en ignorant les doublons
    if (cats.length === 0) {
      try {
        await Catalogue.insertMany(
          DEFAULTS.map(d => ({ tenantId: ctx.tenantId, type: "categorie", ...d, actif: true })),
          { ordered: false } // continue même si un doublon existe
        );
      } catch (_) { /* ignorer les erreurs de doublon */ }
      cats = await Catalogue.find({ tenantId: ctx.tenantId, type: "categorie", actif: true }).sort({ valeur: 1 });
    }

    return NextResponse.json({ success: true, data: cats });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

// POST — créer une nouvelle catégorie
export async function POST(req: NextRequest) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    await connectDB();
    const { valeur, icone } = await req.json();
    if (!valeur?.trim())
      return NextResponse.json({ success: false, message: "Le nom est requis." }, { status: 400 });

    const cat = await Catalogue.create({
      tenantId: ctx.tenantId,
      type: "categorie",
      valeur: valeur.trim(),
      icone: icone || "📦",
      actif: true,
    });
    return NextResponse.json({ success: true, data: cat }, { status: 201 });
  } catch (err: any) {
    if (err.code === 11000)
      return NextResponse.json({ success: false, message: "Cette catégorie existe déjà." }, { status: 400 });
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
