// app/api/dashboard/route.ts — VERSION OPTIMISÉE
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Vente from "@/lib/models/Vente";
import Stock from "@/lib/models/Stock";
import Produit from "@/lib/models/Produit";
import Boutique from "@/lib/models/Boutique";
import MouvementArgent from "@/lib/models/MouvementArgent";
import SessionCaisse from "@/lib/models/SessionCaisse";
import Employe from "@/lib/models/Employe";
import CommandeFournisseur from "@/lib/models/CommandeFournisseur";
import { getTenantContext } from "@/lib/utils/tenant";
import mongoose from "mongoose";

export async function GET(req: NextRequest) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    await connectDB();

    const tid = new mongoose.Types.ObjectId(ctx.tenantId);
    const { searchParams } = new URL(req.url);
    const now = new Date();

    // ── Plage de dates ─────────────────────────────────────────
    const debutMois = new Date(now.getFullYear(), now.getMonth(), 1);
    const rawDebut  = searchParams.get("debut");
    const rawFin    = searchParams.get("fin");
    const debut = rawDebut ? new Date(rawDebut + "T00:00:00") : debutMois;
    const fin   = rawFin   ? new Date(rawFin   + "T23:59:59") : now;
    const dureeMs   = fin.getTime() - debut.getTime();
    const debutPrec = new Date(debut.getTime() - dureeMs - 1000);
    const finPrec   = new Date(debut.getTime() - 1000);

    const boutiqueFilter = ctx.boutiqueAssignee
      ? { boutique: new mongoose.Types.ObjectId(ctx.boutiqueAssignee) }
      : {};

    // ── Toutes les boutiques du tenant ─────────────────────────
    const boutiquesAll = await Boutique.find({ tenantId: ctx.tenantId, actif: true }).lean();
    const boutiqueIds  = ctx.boutiqueAssignee
      ? [new mongoose.Types.ObjectId(ctx.boutiqueAssignee)]
      : boutiquesAll.map(b => b._id);
    const boutiqueIdStrings = boutiqueIds.map(id => id.toString());

    // ── 1. CA + dépenses + versements (2 périodes en parallèle) ─
    const [caRes, caDepVers, sessionOuvRes, employeRes] = await Promise.all([
      // CA période + précédente
      Vente.aggregate([
        { $match: { tenantId: tid, statut: "payee", ...boutiqueFilter,
            createdAt: { $gte: debutPrec, $lte: fin } } },
        { $group: {
          _id: { periode: { $cond: [{ $gte: ["$createdAt", debut] }, "current", "prev"] } },
          total: { $sum: "$montantTotal" }, nb: { $sum: 1 },
        }},
      ]),
      // Dépenses + versements période + précédente
      MouvementArgent.aggregate([
        { $match: { tenantId: tid, createdAt: { $gte: debutPrec, $lte: fin },
            type: { $in: ["depense","achat_direct","versement_boutique"] } } },
        { $group: {
          _id: {
            periode: { $cond: [{ $gte: ["$createdAt", debut] }, "current", "prev"] },
            type:    "$type",
          },
          total: { $sum: "$montant" },
        }},
      ]),
      // Sessions ouvertes
      SessionCaisse.find({ tenantId: ctx.tenantId, statut: "ouverte",
        ...(ctx.boutiqueAssignee ? { boutique: ctx.boutiqueAssignee } : {}) })
        .populate("boutique", "nom").lean(),
      // Employés
      Employe.find({ tenantId: ctx.tenantId, actif: true,
        ...(ctx.boutiqueAssignee ? { boutique: ctx.boutiqueAssignee } : {}) }).lean(),
    ]);

    // Parser CA
    const caMap: Record<string, { total: number; nb: number }> = {};
    caRes.forEach((r: any) => { caMap[r._id.periode] = { total: r.total, nb: r.nb }; });
    const caPeriode = caMap.current?.total ?? 0;
    const caPrec    = caMap.prev?.total    ?? 0;
    const caNb      = caMap.current?.nb   ?? 0;
    const caEvolution = caPrec > 0 ? (((caPeriode - caPrec) / caPrec) * 100).toFixed(1) : null;

    // Parser dépenses + versements
    const dvMap: Record<string, Record<string, number>> = {};
    caDepVers.forEach((r: any) => {
      if (!dvMap[r._id.periode]) dvMap[r._id.periode] = {};
      dvMap[r._id.periode][r._id.type] = r.total;
    });
    const dep     = (dvMap.current?.depense ?? 0) + (dvMap.current?.achat_direct ?? 0);
    const depPrec = (dvMap.prev?.depense    ?? 0) + (dvMap.prev?.achat_direct    ?? 0);
    const vers     = dvMap.current?.versement_boutique ?? 0;
    const versPrec = dvMap.prev?.versement_boutique    ?? 0;
    const depEvolution  = depPrec  > 0 ? (((dep  - depPrec)  / depPrec)  * 100).toFixed(1) : null;
    const versEvolution = versPrec > 0 ? (((vers - versPrec) / versPrec) * 100).toFixed(1) : null;

    const masseSalariale = employeRes.reduce((s, e) => s + e.salaireBase, 0);

    // ── 2. Solde trésorerie global (agrégation unique) ─────────
    const [ventesSoldeRes, mvtSoldeRes] = await Promise.all([
      Vente.aggregate([
        { $match: { tenantId: tid, statut: "payee", ...boutiqueFilter } },
        { $group: { _id: null, total: { $sum: "$montantTotal" } } },
      ]),
      MouvementArgent.aggregate([
        { $match: { tenantId: tid } },
        { $group: { _id: "$type", total: { $sum: "$montant" } } },
      ]),
    ]);
    const totalVentesSolde = ventesSoldeRes[0]?.total ?? 0;
    const mvtMap: Record<string, number> = {};
    mvtSoldeRes.forEach((m: any) => { mvtMap[m._id] = m.total; });
    const totalEntreesMvt = (mvtMap.depot_tiers ?? 0) + (mvtMap.avance_caisse ?? 0);
    const totalSortiesMvt = ["versement_boutique","versement_banque","depense","achat_direct","remboursement","retrait_tiers"]
      .reduce((s, t) => s + (mvtMap[t] ?? 0), 0);
    const soldeTresorerie = totalVentesSolde + totalEntreesMvt - totalSortiesMvt;

    // ── 3. Alertes stock — 1 seule agrégation $lookup ──────────
    const alertesAgg = await Stock.aggregate([
      { $match: { tenantId: tid, boutique: { $in: boutiqueIds } } },
      { $group: { _id: "$produit", totalQte: { $sum: "$quantite" },
          stocks: { $push: { boutique: "$boutique", quantite: "$quantite" } } } },
      { $lookup: { from: "produits", localField: "_id", foreignField: "_id", as: "produit" } },
      { $unwind: "$produit" },
      { $match: { "produit.actif": true, $expr: { $lte: ["$totalQte", "$produit.seuilAlerte"] } } },
      { $project: {
          _id: "$produit._id",
          nom: "$produit.nom",
          reference: "$produit.reference",
          seuilAlerte: "$produit.seuilAlerte",
          totalQte: 1,
          stocks: 1,
        }},
      { $sort: { totalQte: 1 } },
    ]);

    // Enrichir avec les noms de boutiques
    const boutiqueNomMap: Record<string, string> = {};
    boutiquesAll.forEach(b => { boutiqueNomMap[b._id.toString()] = b.nom; });
    const alertesDetail = alertesAgg.map((a: any) => ({
      _id: a._id, nom: a.nom, reference: a.reference,
      seuilAlerte: a.seuilAlerte, totalQte: a.totalQte,
      stocks: a.stocks.map((s: any) => ({
        boutique: boutiqueNomMap[s.boutique.toString()] ?? "—",
        qte: s.quantite,
      })),
    }));
    const nbRuptures = alertesDetail.filter((a: any) => a.totalQte === 0).length;
    const nbAlertes  = alertesDetail.filter((a: any) => a.totalQte > 0).length;

    // ── 4. Graphique journalier / mensuel ──────────────────────
    const nbJours = Math.ceil(dureeMs / 86400000) + 1;
    const afficherParMois = nbJours > 60;

    const [graphVentes, graphDep] = await Promise.all([
      Vente.aggregate([
        { $match: { tenantId: tid, statut: "payee", createdAt: { $gte: debut, $lte: fin }, ...boutiqueFilter } },
        { $group: {
          _id: afficherParMois
            ? { m: { $month: "$createdAt" }, a: { $year: "$createdAt" } }
            : { j: { $dayOfMonth: "$createdAt" }, m: { $month: "$createdAt" }, a: { $year: "$createdAt" } },
          total: { $sum: "$montantTotal" },
        }},
        { $sort: { "_id.a": 1, "_id.m": 1, "_id.j": 1 } },
      ]),
      MouvementArgent.aggregate([
        { $match: { tenantId: tid, type: { $in: ["depense","achat_direct"] }, createdAt: { $gte: debut, $lte: fin } } },
        { $group: {
          _id: afficherParMois
            ? { m: { $month: "$createdAt" }, a: { $year: "$createdAt" } }
            : { j: { $dayOfMonth: "$createdAt" }, m: { $month: "$createdAt" }, a: { $year: "$createdAt" } },
          total: { $sum: "$montant" },
        }},
      ]),
    ]);

    const MOIS = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
    const graphData: any[] = [];

    if (afficherParMois) {
      const cur = new Date(debut.getFullYear(), debut.getMonth(), 1);
      while (cur <= fin) {
        const m = cur.getMonth() + 1, a = cur.getFullYear();
        const v = (graphVentes as any[]).find(x => x._id.m === m && x._id.a === a);
        const d = (graphDep    as any[]).find(x => x._id.m === m && x._id.a === a);
        graphData.push({ label: `${MOIS[m-1]} ${a}`, ventes: v?.total ?? 0, depenses: d?.total ?? 0 });
        cur.setMonth(cur.getMonth() + 1);
      }
    } else {
      for (let i = 0; i < nbJours; i++) {
        const d = new Date(debut); d.setDate(debut.getDate() + i);
        if (d > fin) break;
        const j = d.getDate(), m = d.getMonth() + 1, a = d.getFullYear();
        const vj = (graphVentes as any[]).find(x => x._id.j === j && x._id.m === m && x._id.a === a);
        const dj = (graphDep    as any[]).find(x => x._id.j === j && x._id.m === m && x._id.a === a);
        graphData.push({
          label: d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
          ventes: vj?.total ?? 0,
          depenses: dj?.total ?? 0,
        });
      }
    }

    // ── 5. Répartition + dernières ventes ─────────────────────
    const [ventesParBoutiqueRes, dernieresVentes] = await Promise.all([
      Vente.aggregate([
        { $match: { tenantId: tid, statut: "payee", createdAt: { $gte: debut, $lte: fin } } },
        { $group: { _id: "$boutique", total: { $sum: "$montantTotal" } } },
        { $sort: { total: -1 } },
      ]),
      Vente.find({ tenantId: ctx.tenantId, ...boutiqueFilter, createdAt: { $gte: debut, $lte: fin } })
        .populate("boutique", "nom").populate("employe", "nom prenom")
        .sort({ createdAt: -1 }).limit(8).lean(),
    ]);

    const totalParBoutique = (ventesParBoutiqueRes as any[]).reduce((s, v) => s + v.total, 0);
    const repartitionPDV = boutiquesAll
      .filter(b => b.type === "boutique")
      .map(b => {
        const found = (ventesParBoutiqueRes as any[]).find(v => v._id.toString() === b._id.toString());
        const val   = found?.total ?? 0;
        return { nom: b.nom, total: val, pct: totalParBoutique > 0 ? Math.round((val / totalParBoutique) * 100) : 0 };
      }).sort((a, b) => b.total - a.total);

    // ── 6. Vue financière globale (admin uniquement) ───────────
    let vueFinanciere = null;
    if (!ctx.boutiqueAssignee) {

      // Valeur stock — 1 seule agrégation $lookup
      const valeurStockAgg = await Stock.aggregate([
        { $match: { tenantId: tid } },
        { $lookup: { from: "produits", localField: "produit", foreignField: "_id", as: "p" } },
        { $unwind: "$p" },
        { $match: { "p.actif": true } },
        { $group: {
          _id: "$boutique",
          valeur: { $sum: { $multiply: ["$quantite", { $ifNull: ["$p.prixAchat", 0] }] } },
        }},
      ]);
      const valeurParBoutique: Record<string, number> = {};
      valeurStockAgg.forEach((v: any) => { valeurParBoutique[v._id.toString()] = v.valeur; });
      const valeurStockTotal = Object.values(valeurParBoutique).reduce((s, v) => s + v, 0);

      // Soldes caisse par boutique — agrégations parallèles groupées
      const boutiquesPrincipales = boutiquesAll.filter(b => b.type === "boutique");
      const boutiqueBids = boutiquesPrincipales.map(b => b._id);

      const [ventesParBoutiqueAll, sortiesParBoutique, entreesParBoutique, versRecusParBoutique,
             cmdRes, banqueRes] = await Promise.all([
        Vente.aggregate([
          { $match: { tenantId: tid, statut: "payee", boutique: { $in: boutiqueBids } } },
          { $group: { _id: "$boutique", total: { $sum: "$montantTotal" } } },
        ]),
        MouvementArgent.aggregate([
          { $match: { tenantId: tid, type: { $in: ["versement_boutique","versement_banque","depense","achat_direct","remboursement","retrait_tiers"] },
              boutique: { $in: boutiqueBids } } },
          { $group: { _id: "$boutique", total: { $sum: "$montant" } } },
        ]),
        MouvementArgent.aggregate([
          { $match: { tenantId: tid, type: { $in: ["depot_tiers","avance_caisse"] },
              boutique: { $in: boutiqueBids } } },
          { $group: { _id: "$boutique", total: { $sum: "$montant" } } },
        ]),
        MouvementArgent.aggregate([
          { $match: { tenantId: tid, type: "versement_boutique",
              boutiqueDestination: { $in: boutiqueBids } } },
          { $group: { _id: "$boutiqueDestination", total: { $sum: "$montant" } } },
        ]),
        CommandeFournisseur.aggregate([
          { $match: { tenantId: tid, statut: { $in: ["envoyee","recue_partiellement"] }, montantDu: { $gt: 0 } } },
          { $group: { _id: null, totalDu: { $sum: "$montantDu" }, nb: { $sum: 1 } } },
        ]),
        MouvementArgent.aggregate([
          { $match: { tenantId: tid, type: "versement_banque" } },
          { $group: { _id: "$banqueNom", total: { $sum: "$montant" } } },
          { $sort: { total: -1 } },
        ]),
      ]);

      // Construire les maps
      const toMap = (arr: any[]) => {
        const m: Record<string, number> = {};
        arr.forEach(r => { m[r._id.toString()] = r.total; });
        return m;
      };
      const ventesMap   = toMap(ventesParBoutiqueAll);
      const sortiesMap  = toMap(sortiesParBoutique);
      const entreesMap  = toMap(entreesParBoutique);
      const versRecusMap= toMap(versRecusParBoutique);

      const soldesCaisseRes = boutiquesPrincipales.map(b => {
        const bid = b._id.toString();
        const solde = (ventesMap[bid] ?? 0) + (entreesMap[bid] ?? 0) + (versRecusMap[bid] ?? 0) - (sortiesMap[bid] ?? 0);
        return { nom: b.nom, solde: Math.max(0, Math.round(solde)), estPrincipale: b.estPrincipale };
      });

      const soldeCaisseTotal = soldesCaisseRes.reduce((s, b) => s + b.solde, 0);
      const soldeBanqueTotal = (banqueRes as any[]).reduce((s: number, b: any) => s + b.total, 0);

      vueFinanciere = {
        valeurStock: Math.round(valeurStockTotal),
        valeurStockParBoutique: boutiquesAll.map(b => ({
          nom: b.nom,
          valeur: Math.round(valeurParBoutique[b._id.toString()] ?? 0),
          estPrincipale: b.estPrincipale,
        })).sort((a, b) => b.valeur - a.valeur),
        soldeCaisseTotal,
        soldesCaisseParBoutique: soldesCaisseRes,
        commandesEnCours: { totalDu: (cmdRes as any[])[0]?.totalDu ?? 0, nb: (cmdRes as any[])[0]?.nb ?? 0 },
        soldeBanqueTotal: Math.round(soldeBanqueTotal),
        detailBanque: (banqueRes as any[]).map(b => ({ banque: b._id || "Banque", montant: Math.round(b.total) })),
        totalActif: Math.round(valeurStockTotal + soldeCaisseTotal + soldeBanqueTotal),
      };
    }

    return NextResponse.json({
      success: true,
      data: {
        periode: { debut: debut.toISOString(), fin: fin.toISOString(), nbJours },
        kpis: {
          caPeriode, caNb, caEvolution,
          depenses: dep, depEvolution,
          versements: vers, versementsNb: 0, versEvolution,
          soldeTresorerie,
          nbAlertes: nbAlertes + nbRuptures, nbRuptures, nbAlertesSeulement: nbAlertes,
          masseSalariale, nbEmployes: employeRes.length,
        },
        vueFinanciere,
        graphData,
        repartitionPDV,
        dernieresVentes,
        alertesStock: alertesDetail.slice(0, 5),
        sessionsOuvertes: sessionOuvRes,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
