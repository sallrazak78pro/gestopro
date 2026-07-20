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
import { calculerSoldesCaisseParBoutique } from "@/lib/utils/tresorerie";
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
          _id: { periode: { $cond: [{ $gte: ["$createdAt", debut] }, "current", "prev"] }, boutique: "$boutique" },
          total: { $sum: "$montantTotal" }, nb: { $sum: 1 },
        }},
      ]),
      // Dépenses + versements période + précédente
      // "depense" avec categorieDepense achat_marchandise et le type achat_direct
      // sont exclus : ce sont des achats de marchandise (COGS), pas des charges
      // d'exploitation — les compter ici fausserait le KPI Dépenses (cf. Marges).
      MouvementArgent.aggregate([
        { $match: { tenantId: tid, createdAt: { $gte: debutPrec, $lte: fin },
            $or: [
              { type: "depense", categorieDepense: { $in: ["salaire", "loyer", "divers"] } },
              { type: "versement_boutique" },
            ] } },
        { $group: {
          _id: {
            periode: { $cond: [{ $gte: ["$createdAt", debut] }, "current", "prev"] },
            type:    "$type",
            boutique: "$boutique",
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
    caRes.forEach((r: any) => {
      const periode = r._id.periode;
      if (!caMap[periode]) caMap[periode] = { total: 0, nb: 0 };
      caMap[periode].total += r.total;
      caMap[periode].nb    += r.nb;
    });
    const caPeriode = caMap.current?.total ?? 0;
    const caPrec    = caMap.prev?.total    ?? 0;
    const caNb      = caMap.current?.nb   ?? 0;
    const caEvolution = caPrec > 0 ? (((caPeriode - caPrec) / caPrec) * 100).toFixed(1) : null;

    // Parser dépenses + versements
    const dvMap: Record<string, Record<string, number>> = {};
    caDepVers.forEach((r: any) => {
      if (!dvMap[r._id.periode]) dvMap[r._id.periode] = {};
      dvMap[r._id.periode][r._id.type] = (dvMap[r._id.periode][r._id.type] ?? 0) + r.total;
    });
    const dep     = dvMap.current?.depense ?? 0;
    const depPrec = dvMap.prev?.depense    ?? 0;
    const vers     = dvMap.current?.versement_boutique ?? 0;
    const versPrec = dvMap.prev?.versement_boutique    ?? 0;
    const depEvolution  = depPrec  > 0 ? (((dep  - depPrec)  / depPrec)  * 100).toFixed(1) : null;
    const versEvolution = versPrec > 0 ? (((vers - versPrec) / versPrec) * 100).toFixed(1) : null;

    const masseSalariale = employeRes.reduce((s, e) => s + e.salaireBase, 0);

    // ── 2. Solde trésorerie global (formule centralisée) ───────
    // Additionne le solde de caisse réel (calculerSoldesCaisseParBoutique)
    // de chaque boutique visible — cohérent avec les soldes par boutique
    // affichés plus bas (mêmes règles de statut confirmé/en_attente/rejeté).
    const soldesGlobauxMap = await calculerSoldesCaisseParBoutique(ctx.tenantId, boutiqueIds);
    const soldeTresorerie  = Object.values(soldesGlobauxMap)
      .reduce((s, v) => s + v, 0);

    // ── 3. Alertes stock — 1 seule agrégation $lookup ──────────
    const alertesAgg = await Stock.aggregate([
      { $match: { tenantId: tid, boutique: { $in: boutiqueIds } } },
      { $group: { _id: "$produit", totalQte: { $sum: "$quantite" },
          stocks: { $push: { boutique: "$boutique", quantite: "$quantite" } } } },
      { $lookup: { from: "produits", localField: "_id", foreignField: "_id", as: "produit" } },
      { $unwind: "$produit" },
      { $match: { "produit.actif": true, "produit.suiviStock": { $ne: false }, $expr: { $lte: ["$totalQte", "$produit.seuilAlerte"] } } },
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
            ? { m: { $month: "$createdAt" }, a: { $year: "$createdAt" }, boutique: "$boutique" }
            : { j: { $dayOfMonth: "$createdAt" }, m: { $month: "$createdAt" }, a: { $year: "$createdAt" }, boutique: "$boutique" },
          total: { $sum: "$montantTotal" },
        }},
        { $sort: { "_id.a": 1, "_id.m": 1, "_id.j": 1 } },
      ]),
      MouvementArgent.aggregate([
        { $match: { tenantId: tid, type: "depense", categorieDepense: { $in: ["salaire", "loyer", "divers"] },
            createdAt: { $gte: debut, $lte: fin } } },
        { $group: {
          _id: afficherParMois
            ? { m: { $month: "$createdAt" }, a: { $year: "$createdAt" }, boutique: "$boutique" }
            : { j: { $dayOfMonth: "$createdAt" }, m: { $month: "$createdAt" }, a: { $year: "$createdAt" }, boutique: "$boutique" },
          total: { $sum: "$montant" },
        }},
      ]),
    ]);

    // Regroupement par jour/mois (chaque doc ci-dessus est encore scindé par
    // boutique à cause du group key ajouté plus haut)
    const consoliderParPeriode = (rows: any[]) => {
      const m = new Map<string, number>();
      rows.forEach((r: any) => {
        const key = afficherParMois ? `${r._id.a}-${r._id.m}` : `${r._id.a}-${r._id.m}-${r._id.j}`;
        m.set(key, (m.get(key) ?? 0) + r.total);
      });
      return m;
    };
    const graphVentesMap = consoliderParPeriode(graphVentes as any[]);
    const graphDepMap    = consoliderParPeriode(graphDep as any[]);

    const MOIS = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
    const graphData: any[] = [];

    if (afficherParMois) {
      const cur = new Date(debut.getFullYear(), debut.getMonth(), 1);
      while (cur <= fin) {
        const m = cur.getMonth() + 1, a = cur.getFullYear();
        const key = `${a}-${m}`;
        graphData.push({ label: `${MOIS[m-1]} ${a}`, ventes: graphVentesMap.get(key) ?? 0, depenses: graphDepMap.get(key) ?? 0 });
        cur.setMonth(cur.getMonth() + 1);
      }
    } else {
      for (let i = 0; i < nbJours; i++) {
        const d = new Date(debut); d.setDate(debut.getDate() + i);
        if (d > fin) break;
        const j = d.getDate(), m = d.getMonth() + 1, a = d.getFullYear();
        const key = `${a}-${m}-${j}`;
        graphData.push({
          label: d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
          ventes: graphVentesMap.get(key) ?? 0,
          depenses: graphDepMap.get(key) ?? 0,
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

    const ventesParBoutiqueFCFA = (ventesParBoutiqueRes as any[]).map(v => ({
      id: v._id?.toString(), total: v.total,
    }));
    const totalParBoutique = ventesParBoutiqueFCFA.reduce((s, v) => s + v.total, 0);
    const repartitionPDV = boutiquesAll
      .filter(b => b.type === "boutique")
      .map(b => {
        const found = ventesParBoutiqueFCFA.find(v => v.id === b._id.toString());
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

      // Soldes caisse par boutique — réutilise soldesGlobauxMap (déjà calculé
      // ci-dessus pour TOUTES les boutiques, un sur-ensemble) au lieu de
      // relancer les mêmes agrégations Vente/MouvementArgent une 2e fois.
      const boutiquesPrincipales = boutiquesAll.filter(b => b.type === "boutique");
      const boutiqueBids = boutiquesPrincipales.map(b => b._id);
      const soldesMap = soldesGlobauxMap;

      const [cmdRes, banqueRes, commandesEnCoursListe] = await Promise.all([
        CommandeFournisseur.aggregate([
          { $match: { tenantId: tid, statut: { $in: ["envoyee","recue_partiellement"] }, montantDu: { $gt: 0 } } },
          { $group: { _id: null, totalDu: { $sum: "$montantDu" }, nb: { $sum: 1 } } },
        ]),
        MouvementArgent.aggregate([
          { $match: { tenantId: tid, type: "versement_banque" } },
          { $group: { _id: { banque: "$banqueNom", boutique: "$boutique" }, total: { $sum: "$montant" } } },
          { $sort: { total: -1 } },
        ]),
        CommandeFournisseur.find({ tenantId: ctx.tenantId, statut: { $in: ["envoyee", "recue_partiellement"] } })
          .populate("fournisseur", "nom")
          .populate("destination", "nom")
          .sort({ dateCommande: -1 })
          .limit(6)
          .lean(),
      ]);

      const soldesCaisseRes = boutiquesPrincipales.map(b => ({
        nom: b.nom, solde: soldesMap[b._id.toString()] ?? 0, estPrincipale: b.estPrincipale,
      }));

      const soldeCaisseTotal = soldesCaisseRes.reduce((s, b) => s + b.solde, 0);

      // Reconsolider par banque (le group key ci-dessus inclut la boutique
      // pour rester cohérent avec les autres agrégations groupées par boutique)
      const detailBanqueMap = new Map<string, number>();
      (banqueRes as any[]).forEach((b: any) => {
        const nom = b._id.banque || "Banque";
        detailBanqueMap.set(nom, (detailBanqueMap.get(nom) ?? 0) + b.total);
      });
      const detailBanque = [...detailBanqueMap.entries()]
        .map(([banque, montant]) => ({ banque, montant: Math.round(montant) }))
        .sort((a, b) => b.montant - a.montant);
      const soldeBanqueTotal = detailBanque.reduce((s, b) => s + b.montant, 0);

      vueFinanciere = {
        valeurStock: Math.round(valeurStockTotal),
        valeurStockParBoutique: boutiquesAll.map(b => ({
          nom: b.nom,
          valeur: Math.round(valeurParBoutique[b._id.toString()] ?? 0),
          estPrincipale: b.estPrincipale,
        })).sort((a, b) => b.valeur - a.valeur),
        soldeCaisseTotal,
        soldesCaisseParBoutique: soldesCaisseRes,
        commandesEnCours: {
          totalDu: (cmdRes as any[])[0]?.totalDu ?? 0,
          nb: (cmdRes as any[])[0]?.nb ?? 0,
          liste: (commandesEnCoursListe as any[]).map(c => ({
            _id: c._id, reference: c.reference,
            fournisseur: (c.fournisseur as any)?.nom ?? "—",
            destination: (c.destination as any)?.nom ?? "—",
            montantTotal: c.montantTotal, montantPaye: c.montantPaye, montantDu: c.montantDu,
            qteCommandee: c.lignes.reduce((s: number, l: any) => s + l.quantiteCommandee, 0),
            qteRecue:     c.lignes.reduce((s: number, l: any) => s + l.quantiteRecue, 0),
            statut: c.statut, dateCommande: c.dateCommande,
          })),
        },
        soldeBanqueTotal: Math.round(soldeBanqueTotal),
        detailBanque,
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
