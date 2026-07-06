// app/api/produits/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Produit from "@/lib/models/Produit";
import Stock from "@/lib/models/Stock";
import Boutique from "@/lib/models/Boutique";
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
    const projection = searchParams.get("avecImage") ? undefined : "-image";
    const produits = await Produit.find(query, projection).sort({ nom: 1 }).lean();

    // Si une boutique est précisée, on surcharge le prix de vente avec celui
    // propre à cette boutique (et sa devise) — sinon on garde le prix de
    // référence FCFA du produit tel quel (comportement inchangé).
    const boutiqueId = searchParams.get("boutiqueId");
    if (boutiqueId) {
      const boutique = await Boutique.findOne({ _id: boutiqueId, tenantId: ctx.tenantId }).lean() as any;
      const devise = boutique?.devise || "FCFA";
      const stocks = await Stock.find({
        tenantId: ctx.tenantId,
        boutique: boutiqueId,
        produit: { $in: produits.map((p: any) => p._id) },
      }).lean();
      const stockMap: Record<string, any> = {};
      stocks.forEach((s: any) => { stockMap[s.produit.toString()] = s; });

      const produitsAvecPrix = produits.map((p: any) => {
        const s = stockMap[p._id.toString()];
        return {
          ...p,
          devise,
          prixVente: s?.prixVente ?? (devise === "FCFA" ? p.prixVente : null),
        };
      });
      return NextResponse.json({ success: true, data: produitsAvecPrix });
    }

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
    const produit = await Produit.create({ ...body, tenantId: ctx.tenantId });
    return NextResponse.json({ success: true, data: produit }, { status: 201 });
  } catch (err: any) {
    if (err.code === 11000)
      return NextResponse.json({ success: false, message: "Référence déjà utilisée" }, { status: 400 });
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
