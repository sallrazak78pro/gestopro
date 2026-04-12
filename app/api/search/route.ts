// app/api/search/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getTenantContext } from "@/lib/utils/tenant";
import Vente from "@/lib/models/Vente";
import Produit from "@/lib/models/Produit";
import Employe from "@/lib/models/Employe";
import CompteTiers from "@/lib/models/CompteTiers";
import Fournisseur from "@/lib/models/Fournisseur";

export async function GET(req: NextRequest) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    await connectDB();

    const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
    if (q.length < 2) return NextResponse.json({ success: true, data: [] });

    const regex = { $regex: q, $options: "i" };
    const tid   = ctx.tenantId;
    const limit = 5;

    const [ventes, produits, employes, tiers, fournisseurs] = await Promise.all([
      Vente.find({ tenantId: tid, $or: [{ reference: regex }, { client: regex }, { employeNom: regex }] })
        .select("reference client montantTotal statut createdAt").sort({ createdAt: -1 }).limit(limit).lean(),
      Produit.find({ tenantId: tid, $or: [{ nom: regex }, { reference: regex }] })
        .select("nom reference prixVente categorie").limit(limit).lean(),
      Employe.find({ tenantId: tid, $or: [{ nom: regex }, { prenom: regex }, { poste: regex }] })
        .select("nom prenom poste").limit(limit).lean(),
      CompteTiers.find({ tenantId: tid, $or: [{ nom: regex }, { telephone: regex }] })
        .select("nom type solde telephone").limit(limit).lean(),
      Fournisseur.find({ tenantId: tid, $or: [{ nom: regex }, { contact: regex }] })
        .select("nom contact telephone").limit(limit).lean(),
    ]);

    const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

    const results: any[] = [
      ...ventes.map((v: any) => ({
        type: "vente", icon: "🧾", label: `${v.reference} — ${v.client}`,
        sub: `${fmt(v.montantTotal)} F · ${v.statut}`, href: `/ventes/${v._id}`,
      })),
      ...produits.map((p: any) => ({
        type: "produit", icon: "📦", label: p.nom,
        sub: `${p.reference} · ${fmt(p.prixVente)} F`, href: `/stock`,
      })),
      ...employes.map((e: any) => ({
        type: "employe", icon: "👷", label: `${e.prenom} ${e.nom}`,
        sub: e.poste ?? "Employé", href: `/employes/${e._id}`,
      })),
      ...tiers.map((t: any) => ({
        type: "tiers", icon: "👥", label: t.nom,
        sub: `${t.type} · ${fmt(t.solde)} F`, href: `/tiers/${t._id}`,
      })),
      ...fournisseurs.map((f: any) => ({
        type: "fournisseur", icon: "🏭", label: f.nom,
        sub: f.telephone ?? "Fournisseur", href: `/fournisseurs/${f._id}`,
      })),
    ];

    return NextResponse.json({ success: true, data: results });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
