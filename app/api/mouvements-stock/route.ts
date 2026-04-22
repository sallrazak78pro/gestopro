// app/api/mouvements-stock/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import MouvementStock from "@/lib/models/MouvementStock";
import Stock from "@/lib/models/Stock";
import Produit from "@/lib/models/Produit";
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

    const [mouvements, total, statsAgg] = await Promise.all([
      MouvementStock.find(query)
        .populate("boutique", "nom type")
        .populate("produit",  "nom reference unite prixAchat")
        .populate("createdBy","nom")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      MouvementStock.countDocuments(query),
      MouvementStock.aggregate([
        { $match: query },
        { $group: {
          _id:            "$type",
          count:          { $sum: 1 },
          totalQuantite:  { $sum: "$quantite" },
          totalMontant:   { $sum: "$montant" },
        }},
      ]),
    ]);

    const entrees = statsAgg.find((s: any) => s._id === "entree") ?? { count: 0, totalQuantite: 0, totalMontant: 0 };
    const sorties = statsAgg.find((s: any) => s._id === "sortie") ?? { count: 0, totalQuantite: 0, totalMontant: 0 };

    return NextResponse.json({
      success: true,
      data: mouvements,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      stats: {
        entrees: { count: entrees.count, totalQuantite: entrees.totalQuantite, totalMontant: entrees.totalMontant },
        sorties: { count: sorties.count, totalQuantite: sorties.totalQuantite, totalMontant: sorties.totalMontant },
        balance: entrees.totalMontant - sorties.totalMontant,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    if (!["superadmin", "admin", "gestionnaire", "caissier"].includes(ctx.role))
      return NextResponse.json({ success: false, message: "Permission insuffisante" }, { status: 403 });

    await connectDB();
    const body = await req.json();
    const { type, boutiqueId, produitId, quantite, motif, boutiqueDestId } = body;

    if (!type || !boutiqueId || !produitId || !quantite || quantite <= 0)
      return NextResponse.json({ success: false, message: "Données manquantes" }, { status: 400 });

    // Fetch product price
    const produit = await Produit.findOne({ _id: produitId, tenantId: ctx.tenantId }).lean() as any;
    if (!produit) return NextResponse.json({ success: false, message: "Produit introuvable" }, { status: 404 });

    const prixUnitaire = produit.prixAchat ?? 0;
    const montant      = quantite * prixUnitaire;

    // For sortie: check stock availability
    if (type === "sortie") {
      const stock = await Stock.findOne({ produit: produitId, boutique: boutiqueId, tenantId: ctx.tenantId });
      if (!stock || stock.quantite < quantite)
        return NextResponse.json({
          success: false,
          message: `Stock insuffisant (disponible : ${stock?.quantite ?? 0})`,
        }, { status: 400 });
    }

    // Reference counter
    const count = await MouvementStock.countDocuments({ tenantId: ctx.tenantId });
    const makeRef = (n: number) => `MV-${new Date().getFullYear()}-${String(n).padStart(4, "0")}`;

    // Is this a transfer? (sortie + boutiqueDestId)
    const isTransfer = type === "sortie" && !!boutiqueDestId;
    const transfertRef = isTransfer ? randomUUID() : undefined;

    // Create the primary movement
    const mvt = await MouvementStock.create({
      tenantId: ctx.tenantId,
      reference: makeRef(count + 1),
      boutique: boutiqueId,
      type,
      produit: produitId,
      quantite,
      prixUnitaire,
      montant,
      motif: motif || "",
      transfertRef: transfertRef ?? null,
      createdBy: ctx.userId,
    });

    // Update stock for primary boutique
    if (type === "entree") {
      await Stock.findOneAndUpdate(
        { produit: produitId, boutique: boutiqueId, tenantId: ctx.tenantId },
        { $inc: { quantite: +quantite }, $setOnInsert: { tenantId: ctx.tenantId } },
        { upsert: true }
      );
    } else {
      await Stock.findOneAndUpdate(
        { produit: produitId, boutique: boutiqueId, tenantId: ctx.tenantId },
        { $inc: { quantite: -quantite } }
      );
    }

    // For transfers: create the paired entree movement
    if (isTransfer) {
      const count2 = await MouvementStock.countDocuments({ tenantId: ctx.tenantId });
      await MouvementStock.create({
        tenantId: ctx.tenantId,
        reference: makeRef(count2 + 1),
        boutique: boutiqueDestId,
        type: "entree",
        produit: produitId,
        quantite,
        prixUnitaire,
        montant,
        motif: motif || "",
        transfertRef,
        createdBy: ctx.userId,
      });
      await Stock.findOneAndUpdate(
        { produit: produitId, boutique: boutiqueDestId, tenantId: ctx.tenantId },
        { $inc: { quantite: +quantite }, $setOnInsert: { tenantId: ctx.tenantId } },
        { upsert: true }
      );
    }

    const populated = await MouvementStock.findById(mvt._id)
      .populate("boutique", "nom type")
      .populate("produit",  "nom reference unite");

    return NextResponse.json({ success: true, data: populated }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
