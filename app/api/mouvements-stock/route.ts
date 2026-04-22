// app/api/mouvements-stock/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import MouvementStock from "@/lib/models/MouvementStock";
import Stock from "@/lib/models/Stock";
import Produit from "@/lib/models/Produit";
import Boutique from "@/lib/models/Boutique";
import Tenant from "@/lib/models/Tenant";
import { getTenantContext } from "@/lib/utils/tenant";
import { randomUUID } from "crypto";

export async function GET(req: NextRequest) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    await connectDB();

    const tenant = await Tenant.findById(ctx.tenantId).lean() as any;
    if (tenant?.mouvementsActifs === false)
      return NextResponse.json({ success: false, message: "Mouvements désactivés." }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const query: any = { tenantId: ctx.tenantId };

    if (searchParams.get("boutique")) query.boutique = searchParams.get("boutique");
    if (searchParams.get("type"))     query.type     = searchParams.get("type");

    // Date filter
    const dateDebut = searchParams.get("dateDebut");
    const dateFin   = searchParams.get("dateFin");
    if (dateDebut || dateFin) {
      query.createdAt = {};
      if (dateDebut) query.createdAt.$gte = new Date(dateDebut);
      if (dateFin)   { const fin = new Date(dateFin); fin.setHours(23, 59, 59, 999); query.createdAt.$lte = fin; }
    }

    // Restrict caissier to their boutique
    if (ctx.boutiqueAssignee) query.boutique = ctx.boutiqueAssignee;

    const page  = parseInt(searchParams.get("page")  || "1");
    const limit = parseInt(searchParams.get("limit") || "25");
    const skip  = (page - 1) * limit;

    // La query stats ignore le filtre "type" → les KPIs montrent toujours
    // entrées ET sorties pour la période/boutique sélectionnée.
    const statsQuery: any = { ...query };
    delete statsQuery.type;

    const [mouvements, total, statsAgg] = await Promise.all([
      MouvementStock.find(query)
        .populate("boutique",        "nom type")
        .populate("lignes.produit",  "nom reference unite prixAchat")
        .populate("createdBy",       "nom")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      MouvementStock.countDocuments(query),
      // $sum: { $sum: "$lignes.montant" } recalcule depuis les lignes réelles,
      // ce qui fonctionne même si le champ montant top-level est mal typé en DB.
      MouvementStock.aggregate([
        { $match: statsQuery },
        { $group: {
          _id:          "$type",
          count:        { $sum: 1 },
          totalMontant: { $sum: { $sum: "$lignes.montant" } },
        }},
      ]),
    ]);

    const entrees = statsAgg.find((s: any) => s._id === "entree") ?? { count: 0, totalMontant: 0 };
    const sorties = statsAgg.find((s: any) => s._id === "sortie") ?? { count: 0, totalMontant: 0 };

    return NextResponse.json({
      success: true,
      data: mouvements,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      stats: {
        entrees: { count: entrees.count, totalMontant: entrees.totalMontant },
        sorties: { count: sorties.count, totalMontant: sorties.totalMontant },
        balance: entrees.totalMontant - sorties.totalMontant,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

// ── POST ─────────────────────────────────────────────────────────────────────
// Body: { sourceId, destId, lignes: [{ produitId, quantite }], motif }
//   sourceId = null  → réception fournisseur (pas de boutique source)
//   destId   = null  → perte / casse (pas de boutique dest)
//   both set         → transfert entre boutiques (2 docs liés par transfertRef)
export async function POST(req: NextRequest) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    if (!["superadmin", "admin", "gestionnaire", "caissier"].includes(ctx.role))
      return NextResponse.json({ success: false, message: "Permission insuffisante" }, { status: 403 });

    await connectDB();
    const body = await req.json();
    const { sourceId, destId, lignes, motif } = body;

    // ── Validation ────────────────────────────────────────────────────────
    if (!lignes || !Array.isArray(lignes) || lignes.length === 0)
      return NextResponse.json({ success: false, message: "Au moins une ligne produit est requise." }, { status: 400 });
    if (!sourceId && !destId)
      return NextResponse.json({ success: false, message: "Au moins une boutique (source ou destination) est requise." }, { status: 400 });
    for (const l of lignes) {
      if (!l.produitId || !l.quantite || l.quantite <= 0)
        return NextResponse.json({ success: false, message: "Chaque ligne doit avoir un produit et une quantité > 0." }, { status: 400 });
    }

    // ── Résoudre prix d'achat pour chaque ligne ───────────────────────────
    const lignesResolues: { produitId: string; quantite: number; prixUnitaire: number; montant: number }[] = [];
    for (const l of lignes) {
      const produit = await Produit.findOne({ _id: l.produitId, tenantId: ctx.tenantId }).lean() as any;
      if (!produit)
        return NextResponse.json({ success: false, message: `Produit introuvable : ${l.produitId}` }, { status: 404 });
      const prixUnitaire = produit.prixAchat ?? 0;
      lignesResolues.push({ produitId: l.produitId, quantite: l.quantite, prixUnitaire, montant: l.quantite * prixUnitaire });
    }

    // ── Vérification stock source (si boutique réelle) ─────────────────
    if (sourceId) {
      for (const l of lignesResolues) {
        const stock = await Stock.findOne({ produit: l.produitId, boutique: sourceId, tenantId: ctx.tenantId });
        if (!stock || stock.quantite < l.quantite) {
          const produit = await Produit.findById(l.produitId).lean() as any;
          return NextResponse.json({
            success: false,
            message: `Stock insuffisant pour « ${produit?.nom ?? l.produitId} » (disponible : ${stock?.quantite ?? 0})`,
          }, { status: 400 });
        }
      }
    }

    const montantTotal  = lignesResolues.reduce((s, l) => s + l.montant, 0);
    const isTransfer    = !!sourceId && !!destId;
    const transfertRef  = isTransfer ? randomUUID() : null;
    const year          = new Date().getFullYear();

    const makeRef = async () => {
      const n = await MouvementStock.countDocuments({ tenantId: ctx.tenantId });
      return `MV-${year}-${String(n + 1).padStart(4, "0")}`;
    };

    const buildLignes = () => lignesResolues.map(l => ({
      produit:      l.produitId,
      quantite:     l.quantite,
      prixUnitaire: l.prixUnitaire,
      montant:      l.montant,
    }));

    let firstMvt: any = null;

    // ── Jambe SORTIE (si source boutique) ────────────────────────────────
    if (sourceId) {
      firstMvt = await MouvementStock.create({
        tenantId:    ctx.tenantId,
        reference:   await makeRef(),
        boutique:    sourceId,
        type:        "sortie",
        lignes:      buildLignes(),
        montant:     montantTotal,
        motif:       motif || (isTransfer ? "Transfert" : "Sortie / Perte"),
        transfertRef,
        createdBy:   ctx.userId,
      });
      // Décrémenter le stock pour chaque ligne
      for (const l of lignesResolues) {
        await Stock.findOneAndUpdate(
          { produit: l.produitId, boutique: sourceId, tenantId: ctx.tenantId },
          { $inc: { quantite: -l.quantite } }
        );
      }
    }

    // ── Jambe ENTREE (si dest boutique) ──────────────────────────────────
    if (destId) {
      const entree = await MouvementStock.create({
        tenantId:    ctx.tenantId,
        reference:   await makeRef(),
        boutique:    destId,
        type:        "entree",
        lignes:      buildLignes(),
        montant:     montantTotal,
        motif:       motif || (isTransfer ? "Transfert" : "Réception fournisseur"),
        transfertRef,
        createdBy:   ctx.userId,
      });
      // Incrémenter le stock pour chaque ligne
      for (const l of lignesResolues) {
        await Stock.findOneAndUpdate(
          { produit: l.produitId, boutique: destId, tenantId: ctx.tenantId },
          { $inc: { quantite: +l.quantite }, $setOnInsert: { tenantId: ctx.tenantId } },
          { upsert: true }
        );
      }
      if (!firstMvt) firstMvt = entree;
    }

    const populated = await MouvementStock.findById(firstMvt._id)
      .populate("boutique",       "nom type")
      .populate("lignes.produit", "nom reference unite");

    return NextResponse.json({ success: true, data: populated }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
