// app/api/tresorerie/rapport/route.ts — VERSION OPTIMISÉE
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Vente from "@/lib/models/Vente";
import MouvementArgent from "@/lib/models/MouvementArgent";
import Boutique from "@/lib/models/Boutique";
import SessionCaisse from "@/lib/models/SessionCaisse";
import Tenant from "@/lib/models/Tenant";
import { getTenantContext } from "@/lib/utils/tenant";
import { calculerSoldesCaisseParBoutique } from "@/lib/utils/tresorerie";
import { getTaux, deviseVersFCFA } from "@/lib/utils/devise";
import mongoose from "mongoose";

export async function GET() {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    await connectDB();

    const tid = new mongoose.Types.ObjectId(ctx.tenantId);
    const now = new Date();

    // ── Périodes ───────────────────────────────────────────────
    const debutSemaine  = new Date(now); debutSemaine.setDate(now.getDate() - now.getDay() + 1); debutSemaine.setHours(0,0,0,0);
    const debutSemPrec  = new Date(debutSemaine); debutSemPrec.setDate(debutSemaine.getDate() - 7);
    const finSemPrec    = new Date(debutSemaine); finSemPrec.setMilliseconds(-1);
    const debutMois     = new Date(now.getFullYear(), now.getMonth(), 1);
    const debutMoisPrec = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const finMoisPrec   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const boutiqueFilter = ctx.boutiqueAssignee
      ? { boutique: new mongoose.Types.ObjectId(ctx.boutiqueAssignee) } : {};

    // ── Devises : conversion FCFA nécessaire avant toute consolidation
    // multi-boutiques (voir /api/dashboard et /api/marges pour le même
    // correctif — les montants Vente/MouvementArgent sont dans la devise
    // locale de chaque boutique, pas nécessairement FCFA).
    const [boutiquesAllTenant, tenantDoc] = await Promise.all([
      Boutique.find({ tenantId: ctx.tenantId, actif: true }).select("devise").lean(),
      Tenant.findById(ctx.tenantId).select("tauxChange").lean(),
    ]);
    const boutiqueDeviseMap: Record<string, string> = {};
    boutiquesAllTenant.forEach((b: any) => { boutiqueDeviseMap[b._id.toString()] = b.devise || "FCFA"; });
    const versFCFA = (montant: number, boutiqueId: string | null | undefined) => {
      const devise = boutiqueDeviseMap[boutiqueId ?? ""] ?? "FCFA";
      return deviseVersFCFA(montant, devise, getTaux(tenantDoc as any, devise));
    };

    // ── 1. Comparaisons — tout en parallèle ────────────────────
    // Une seule agrégation par collection avec $facet pour les 4 périodes
    const [ventesComp, mvtComp, boutiques, sessionsActives, derniersVersements, versementsMois] = await Promise.all([

      // CA des 4 périodes en une seule requête
      Vente.aggregate([
        { $match: { tenantId: tid, statut: "payee", ...boutiqueFilter,
            createdAt: { $gte: debutSemPrec } } },
        { $group: {
          _id: {
            periode: { $switch: { branches: [
              { case: { $gte: ["$createdAt", debutSemaine] },  then: "semCour" },
              { case: { $gte: ["$createdAt", debutSemPrec] },  then: "semPrec" },
              { case: { $gte: ["$createdAt", debutMois] },     then: "moisCour" },
              { case: { $gte: ["$createdAt", debutMoisPrec] }, then: "moisPrec" },
            ], default: "other" }},
            boutique: "$boutique",
          },
          caVentes: { $sum: "$montantTotal" },
        }},
      ]),

      // Mouvements des 4 périodes
      MouvementArgent.aggregate([
        { $match: { tenantId: tid,
            type: { $in: ["versement_boutique","depense","achat_direct"] },
            createdAt: { $gte: debutMoisPrec } } },
        { $group: {
          _id: {
            periode: { $switch: { branches: [
              { case: { $gte: ["$createdAt", debutSemaine] },  then: "semCour" },
              { case: { $gte: ["$createdAt", debutSemPrec] },  then: "semPrec" },
              { case: { $gte: ["$createdAt", debutMois] },     then: "moisCour" },
              { case: { $gte: ["$createdAt", debutMoisPrec] }, then: "moisPrec" },
            ], default: "other" }},
            type: "$type",
            boutique: "$boutique",
          },
          total: { $sum: "$montant" },
        }},
      ]),

      // Boutiques
      Boutique.find({ tenantId: ctx.tenantId, type: "boutique", actif: true }).lean(),

      // Sessions actives (1 seule requête)
      SessionCaisse.find({ tenantId: ctx.tenantId, statut: "ouverte" }).lean(),

      // Dernier versement PAR boutique (agrégation groupée)
      MouvementArgent.aggregate([
        { $match: { tenantId: tid, type: "versement_boutique" } },
        { $sort: { createdAt: -1 } },
        { $group: { _id: "$boutique", montant: { $first: "$montant" }, date: { $first: "$createdAt" } } },
      ]),

      // Versements du mois
      MouvementArgent.find({ tenantId: ctx.tenantId, type: "versement_boutique",
          createdAt: { $gte: debutMois } })
        .populate("boutique", "nom estPrincipale devise")
        .populate("boutiqueDestination", "nom estPrincipale")
        .sort({ createdAt: -1 }).lean(),
    ]);

    // ── 2. Soldes par boutique — formule centralisée ───────────
    const boutiqueBids = boutiques.map(b => b._id);
    const soldesMap = await calculerSoldesCaisseParBoutique(ctx.tenantId, boutiqueBids);

    const dvMap: Record<string, Record<string, number> | undefined> = {};
    const sessionsActifMap: Record<string, boolean> = {};
    sessionsActives.forEach(s => { sessionsActifMap[s.boutique.toString()] = true; });
    const dernVersMap: Record<string, { montant: number; date: Date }> = {};
    derniersVersements.forEach((v: any) => {
      const bid = v._id.toString();
      dernVersMap[bid] = { montant: versFCFA(v.montant, bid), date: v.date };
    });

    // Parser comparaison (conversion FCFA par boutique avant consolidation)
    const ventesCompMap: Record<string, number> = {};
    ventesComp.forEach((r: any) => {
      const p = r._id.periode;
      ventesCompMap[p] = (ventesCompMap[p] ?? 0) + versFCFA(r.caVentes, r._id.boutique?.toString());
    });
    mvtComp.forEach((r: any) => {
      const p = r._id.periode;
      if (!dvMap[p]) dvMap[p] = {};
      dvMap[p][r._id.type] = (dvMap[p][r._id.type] ?? 0) + versFCFA(r.total, r._id.boutique?.toString());
    });

    function buildComp(periode: string) {
      return {
        caVentes:   ventesCompMap[periode]    ?? 0,
        versements: dvMap[periode]?.versement_boutique ?? 0,
        depenses:   (dvMap[periode]?.depense ?? 0) + (dvMap[periode]?.achat_direct ?? 0),
        soldeFinal: Math.max(0,
          (ventesCompMap[periode] ?? 0)
          - ((dvMap[periode]?.depense ?? 0) + (dvMap[periode]?.achat_direct ?? 0))
          - (dvMap[periode]?.versement_boutique ?? 0)),
      };
    }

    function evo(cur: number, prev: number) {
      if (prev === 0) return cur > 0 ? 100 : 0;
      return Math.round(((cur - prev) / prev) * 100);
    }

    const semCour = buildComp("semCour"), semPrec = buildComp("semPrec");
    const moisCour = buildComp("moisCour"), moisPrec = buildComp("moisPrec");

    const soldesParBoutique = boutiques.map(b => {
      const bid = b._id.toString();
      return {
        _id: b._id, nom: b.nom, estPrincipale: b.estPrincipale,
        solde: versFCFA(soldesMap[bid] ?? 0, bid),
        sessionActive: sessionsActifMap[bid] ?? false,
        dernierVersement: dernVersMap[bid] ?? null,
      };
    });

    const totalVersementsMois = versementsMois.reduce(
      (s: number, v: any) => s + versFCFA(v.montant, v.boutique?._id?.toString()), 0);

    return NextResponse.json({
      success: true,
      data: {
        comparaison: {
          semaine: {
            courant: semCour, precedent: semPrec,
            evolutions: { caVentes: evo(semCour.caVentes, semPrec.caVentes), versements: evo(semCour.versements, semPrec.versements), depenses: evo(semCour.depenses, semPrec.depenses), soldeFinal: evo(semCour.soldeFinal, semPrec.soldeFinal) },
          },
          mois: {
            courant: moisCour, precedent: moisPrec,
            evolutions: { caVentes: evo(moisCour.caVentes, moisPrec.caVentes), versements: evo(moisCour.versements, moisPrec.versements), depenses: evo(moisCour.depenses, moisPrec.depenses), soldeFinal: evo(moisCour.soldeFinal, moisPrec.soldeFinal) },
          },
        },
        soldesParBoutique,
        versementsMois: {
          liste: versementsMois,
          total: totalVersementsMois,
          nb: versementsMois.length,
          periode: `${debutMois.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} — aujourd'hui`,
        },
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
