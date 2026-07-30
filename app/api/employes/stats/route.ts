// app/api/employes/stats/route.ts — Classement des ventes par employé
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Vente from "@/lib/models/Vente";
import Employe from "@/lib/models/Employe";
import { getTenantContext, requirePermission } from "@/lib/utils/tenant";

export async function GET(req: NextRequest) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    const denied = requirePermission(ctx, "employes", "view");
    if (denied) return denied;
    await connectDB();

    const { searchParams } = new URL(req.url);
    const debut = searchParams.get("debut");
    const fin   = searchParams.get("fin");
    const boutiqueId = ctx.boutiqueAssignee ?? searchParams.get("boutique");

    const query: any = { tenantId: ctx.tenantId, statut: "payee" };
    if (boutiqueId) query.boutique = boutiqueId;
    if (debut || fin) {
      query.createdAt = {};
      if (debut) query.createdAt.$gte = new Date(debut + "T00:00:00");
      if (fin)   query.createdAt.$lte = new Date(fin   + "T23:59:59");
    }

    const ventes = await Vente.find(query, "employe employeNom montantTotal").lean();

    // Regroupe par employé lié (fiche Employe) quand disponible, sinon par le
    // nom figé sur la vente — certaines ventes historiques n'ont pas de
    // référence liée mais gardent toujours employeNom.
    const parEmploye = new Map<string, { employeId: string | null; nom: string; nbVentes: number; totalCA: number }>();
    ventes.forEach((v: any) => {
      const key = v.employe ? v.employe.toString() : `nom:${v.employeNom || "Inconnu"}`;
      const cur = parEmploye.get(key) ?? {
        employeId: v.employe ? v.employe.toString() : null,
        nom: v.employeNom || "Inconnu",
        nbVentes: 0, totalCA: 0,
      };
      cur.nbVentes += 1;
      cur.totalCA  += v.montantTotal;
      parEmploye.set(key, cur);
    });

    // Enrichir avec poste/boutique pour les employés effectivement liés.
    const employeIds = [...parEmploye.values()].map(e => e.employeId).filter(Boolean) as string[];
    const fiches = await Employe.find({ _id: { $in: employeIds }, tenantId: ctx.tenantId })
      .populate("boutique", "nom").lean();
    const ficheMap = new Map(fiches.map((f: any) => [f._id.toString(), f]));

    const classement = [...parEmploye.values()]
      .map(e => {
        const fiche = e.employeId ? ficheMap.get(e.employeId) : null;
        return {
          employeId: e.employeId,
          nom: fiche ? `${(fiche as any).prenom} ${(fiche as any).nom}` : e.nom,
          poste: (fiche as any)?.poste ?? null,
          boutique: (fiche as any)?.boutique?.nom ?? null,
          nbVentes: e.nbVentes,
          totalCA: Math.round(e.totalCA),
          panierMoyen: e.nbVentes > 0 ? Math.round(e.totalCA / e.nbVentes) : 0,
        };
      })
      .sort((a, b) => b.totalCA - a.totalCA);

    return NextResponse.json({ success: true, data: classement });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
