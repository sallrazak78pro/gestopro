// app/api/stock/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Stock from "@/lib/models/Stock";
import Produit from "@/lib/models/Produit";
import Boutique from "@/lib/models/Boutique";
import { getTenantContext } from "@/lib/utils/tenant";

export async function GET(req: NextRequest) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    await connectDB();

    const { searchParams } = new URL(req.url);
    const alertesOnly = searchParams.get("alertes") === "true";

    // Si l'utilisateur a une boutique assignée, on ne montre que cette boutique
    const boutiqueQuery: any = { tenantId: ctx.tenantId, actif: true };
    if (ctx.boutiqueAssignee) {
      boutiqueQuery._id = ctx.boutiqueAssignee;
    } else if (searchParams.get("boutique")) {
      boutiqueQuery._id = searchParams.get("boutique");
    }

    const boutiques = await Boutique.find(boutiqueQuery).sort({ type: -1, nom: 1 });
    const boutiqueIds = boutiques.map(b => b._id.toString());

    const stocks = await Stock.find({
      tenantId: ctx.tenantId,
      boutique: { $in: boutiqueIds },
    }).populate("produit").populate("boutique", "nom type");

    const produits = await Produit.find({ tenantId: ctx.tenantId, actif: true }).sort({ nom: 1 });

    const vue = produits.map(produit => {
      const row: any = {
        _id: produit._id, reference: produit.reference, nom: produit.nom,
        categorie: produit.categorie, prixVente: produit.prixVente,
        seuilAlerte: produit.seuilAlerte, stocks: {}, total: 0, enAlerte: false,
      };
      boutiques.forEach(b => {
        const s = stocks.find(
          st => st.produit?._id?.toString() === produit._id.toString()
             && st.boutique?._id?.toString() === b._id.toString()
        );
        const qte = s?.quantite ?? 0;
        row.stocks[b._id.toString()] = qte;
        row.total += qte;
        if (qte > 0 && qte <= produit.seuilAlerte) row.enAlerte = true;
      });
      return row;
    });

    const result = alertesOnly ? vue.filter(r => r.enAlerte) : vue;
    return NextResponse.json({ success: true, data: result, boutiques });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
