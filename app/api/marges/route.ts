// app/api/marges/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getTenantContext } from "@/lib/utils/tenant";
import Vente from "@/lib/models/Vente";
import Produit from "@/lib/models/Produit";
import MouvementArgent from "@/lib/models/MouvementArgent";

export async function GET(req: NextRequest) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    await connectDB();

    const { searchParams } = new URL(req.url);
    const mode   = searchParams.get("mode") ?? "jour";   // jour | semaine | mois | plage
    const debut  = searchParams.get("debut");
    const fin    = searchParams.get("fin");
    const boutiqueId = searchParams.get("boutique") || (ctx.boutiqueAssignee ?? null);

    // ── Calculer les bornes de dates ──────────────────────────────────────────
    const now = new Date();
    let dateDebut: Date, dateFin: Date;

    if (mode === "plage" && debut && fin) {
      dateDebut = new Date(debut + "T00:00:00");
      dateFin   = new Date(fin   + "T23:59:59");
    } else if (mode === "semaine") {
      // Lundi de la semaine courante
      const day = now.getDay() === 0 ? 6 : now.getDay() - 1;
      dateDebut = new Date(now); dateDebut.setDate(now.getDate() - day); dateDebut.setHours(0,0,0,0);
      dateFin   = new Date(now); dateFin.setHours(23,59,59,999);
    } else if (mode === "mois") {
      dateDebut = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFin   = new Date(now); dateFin.setHours(23,59,59,999);
    } else {
      // jour (défaut)
      dateDebut = new Date(now); dateDebut.setHours(0,0,0,0);
      dateFin   = new Date(now); dateFin.setHours(23,59,59,999);
    }

    // ── Requête ventes ────────────────────────────────────────────────────────
    const matchQuery: any = {
      tenantId: ctx.tenantId,
      statut:   "payee",
      createdAt: { $gte: dateDebut, $lte: dateFin },
    };
    if (boutiqueId) matchQuery.boutique = boutiqueId;

    const ventes = await Vente.find(matchQuery)
      .populate("boutique", "nom")
      .lean();

    // ── Charges d'exploitation (salaires, loyer, divers) ──────────────────────
    // Exclut volontairement categorieDepense "achat_marchandise" et le type
    // "achat_direct" : ce sont des achats de marchandise, déjà comptés dans le
    // coût d'achat (prixAchat) ci-dessous — les compter aussi ici doublerait
    // cette charge et fausserait la marge nette.
    const depQuery: any = {
      tenantId: ctx.tenantId,
      type: "depense",
      categorieDepense: { $in: ["salaire", "loyer", "divers"] },
      createdAt: { $gte: dateDebut, $lte: dateFin },
    };
    if (boutiqueId) depQuery.boutique = boutiqueId;

    const depenses = await MouvementArgent.find(depQuery)
      .select("montant boutique createdAt")
      .populate("boutique", "nom")
      .lean();

    // ── Récupérer tous les produits pour avoir prixAchat ──────────────────────
    const produitIds = [...new Set(
      ventes.flatMap((v: any) => v.lignes.map((l: any) => l.produit?.toString()))
    )].filter(Boolean);

    const produits = await Produit.find({
      _id: { $in: produitIds }, tenantId: ctx.tenantId,
    }).select("_id prixAchat nom").lean();

    const prixAchatMap = new Map(produits.map((p: any) => [p._id.toString(), p.prixAchat]));

    // ── Calculer marges par vente ─────────────────────────────────────────────
    let totalCA       = 0;
    let totalCoutAchat = 0;

    const ventesAvecMarge = ventes.map((v: any) => {
      let coutAchat = 0;
      v.lignes.forEach((l: any) => {
        const pa = (prixAchatMap.get(l.produit?.toString()) ?? 0) as number;
        coutAchat += pa * (l.quantite as number);
      });
      const montantTotalFCFA = v.montantTotal;
      const marge      = montantTotalFCFA - coutAchat;
      const tauxMarge  = montantTotalFCFA > 0 ? (marge / montantTotalFCFA) * 100 : 0;
      totalCA          += montantTotalFCFA;
      totalCoutAchat   += coutAchat;
      return { ...v, montantTotalFCFA, coutAchat, marge, tauxMarge };
    });

    // ── Grouper par produit ───────────────────────────────────────────────────
    const parProduit = new Map<string, { nom: string; qte: number; ca: number; cout: number; marge: number }>();
    ventes.forEach((v: any) => {
      v.lignes.forEach((l: any) => {
        const pid  = l.produit?.toString() ?? "inconnu";
        const pa   = Number(prixAchatMap.get(pid) ?? 0);
        const ca   = Number(l.sousTotal ?? 0);
        const qte  = Number(l.quantite ?? 0);
        const cout = pa * qte;
        const cur  = parProduit.get(pid) ?? { nom: l.nomProduit, qte: 0, ca: 0, cout: 0, marge: 0 };
        parProduit.set(pid, {
          nom:   l.nomProduit,
          qte:   cur.qte   + qte,
          ca:    cur.ca    + ca,
          cout:  cur.cout  + cout,
          marge: cur.marge + (ca - cout),
        });
      });
    });

    const produitsTries = [...parProduit.values()]
      .sort((a, b) => b.marge - a.marge)
      .map(p => ({ ...p, tauxMarge: p.ca > 0 ? (p.marge / p.ca) * 100 : 0 }));

    const topProduits = produitsTries.slice(0, 10);
    // Le vrai pire produit toutes ventes confondues, pas seulement le 10e du top —
    // topProduits.at(-1) ne serait que le 10e meilleur dès qu'il y a plus de 10 produits.
    const produitMoinsRentable = produitsTries.length > 0 ? produitsTries[produitsTries.length - 1] : null;

    // ── Grouper par boutique ──────────────────────────────────────────────────
    const parBoutique = new Map<string, { nom: string; ca: number; cout: number; marge: number; charges: number }>();
    ventesAvecMarge.forEach((v: any) => {
      const bid = (v.boutique as any)?._id?.toString() ?? "inconnu";
      const nom = (v.boutique as any)?.nom ?? "Inconnue";
      const cur = parBoutique.get(bid) ?? { nom, ca: 0, cout: 0, marge: 0, charges: 0 };
      parBoutique.set(bid, {
        nom,
        ca:      cur.ca      + v.montantTotalFCFA,
        cout:    cur.cout    + v.coutAchat,
        marge:   cur.marge   + v.marge,
        charges: cur.charges,
      });
    });
    let totalDepenses = 0;
    depenses.forEach((d: any) => {
      totalDepenses += d.montant;
      const bid = (d.boutique as any)?._id?.toString() ?? "inconnu";
      const nom = (d.boutique as any)?.nom ?? "Inconnue";
      const cur = parBoutique.get(bid) ?? { nom, ca: 0, cout: 0, marge: 0, charges: 0 };
      parBoutique.set(bid, { ...cur, charges: cur.charges + d.montant });
    });

    // ── Évolution journalière (graphique) ─────────────────────────────────────
    const parJour = new Map<string, { ca: number; cout: number; marge: number; charges: number }>();
    ventesAvecMarge.forEach((v: any) => {
      const jour = new Date(v.createdAt).toISOString().split("T")[0];
      const cur  = parJour.get(jour) ?? { ca: 0, cout: 0, marge: 0, charges: 0 };
      parJour.set(jour, {
        ca:      cur.ca      + v.montantTotalFCFA,
        cout:    cur.cout    + v.coutAchat,
        marge:   cur.marge   + v.marge,
        charges: cur.charges,
      });
    });
    depenses.forEach((d: any) => {
      const jour = new Date(d.createdAt).toISOString().split("T")[0];
      const cur  = parJour.get(jour) ?? { ca: 0, cout: 0, marge: 0, charges: 0 };
      parJour.set(jour, { ...cur, charges: cur.charges + d.montant });
    });

    const evolution = [...parJour.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => ({
        date,
        ca:           Math.round(d.ca),
        cout:         Math.round(d.cout),
        marge:        Math.round(d.marge),
        charges:      Math.round(d.charges),
        margeNette:   Math.round(d.marge - d.charges),
        tauxMarge:    d.ca > 0 ? Math.round((d.marge / d.ca) * 100) : 0,
      }));

    const totalMarge    = totalCA - totalCoutAchat;
    const tauxMarge     = totalCA > 0 ? (totalMarge / totalCA) * 100 : 0;
    const margeNette    = totalMarge - totalDepenses;
    const tauxMargeNette = totalCA > 0 ? (margeNette / totalCA) * 100 : 0;

    return NextResponse.json({
      success: true,
      stats: {
        totalCA:        Math.round(totalCA),
        totalCout:      Math.round(totalCoutAchat),
        totalMarge:     Math.round(totalMarge),
        tauxMarge:      Math.round(tauxMarge * 10) / 10,
        totalDepenses:  Math.round(totalDepenses),
        margeNette:     Math.round(margeNette),
        tauxMargeNette: Math.round(tauxMargeNette * 10) / 10,
        nbVentes:       ventes.length,
        dateDebut:      dateDebut.toISOString(),
        dateFin:        dateFin.toISOString(),
      },
      evolution,
      topProduits,
      produitMoinsRentable,
      parBoutique: [...parBoutique.values()].map(b => ({
        ...b,
        tauxMarge:      b.ca > 0 ? Math.round((b.marge / b.ca) * 100) : 0,
        margeNette:     b.marge - b.charges,
        tauxMargeNette: b.ca > 0 ? Math.round(((b.marge - b.charges) / b.ca) * 100) : 0,
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
