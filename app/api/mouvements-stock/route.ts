// app/api/mouvements-stock/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import MouvementStock from "@/lib/models/MouvementStock";
import Stock from "@/lib/models/Stock";
import { getTenantContext, canAccessBoutique } from "@/lib/utils/tenant";
import Tenant from "@/lib/models/Tenant";

export async function GET(req: NextRequest) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    await connectDB();
    // Vérifier si les mouvements sont activés
    const tenant = await Tenant.findById(ctx.tenantId).lean() as any;
    if (tenant && tenant.mouvementsActifs === false) {
      return NextResponse.json({ success: false, message: "Mouvements de marchandise désactivés." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const query: any = { tenantId: ctx.tenantId };
    if (searchParams.get("type"))        query.type        = searchParams.get("type");
    if (searchParams.get("statut"))      query.statut      = searchParams.get("statut");
    if (searchParams.get("destination")) query.destination = searchParams.get("destination");

    const dateDebut = searchParams.get("dateDebut");
    const dateFin   = searchParams.get("dateFin");
    if (dateDebut || dateFin) {
      query.createdAt = {};
      if (dateDebut) query.createdAt.$gte = new Date(dateDebut);
      if (dateFin)   { const fin = new Date(dateFin); fin.setHours(23, 59, 59, 999); query.createdAt.$lte = fin; }
    }

    // Restriction boutique : ne voir que les mouvements qui impliquent sa boutique
    if (ctx.boutiqueAssignee) {
      query.$or = [
        { source: ctx.boutiqueAssignee },
        { destination: ctx.boutiqueAssignee },
      ];
    }

    const page  = parseInt(searchParams.get("page")  || "1");
    const limit = parseInt(searchParams.get("limit") || "25");
    const skip  = (page - 1) * limit;

    const [mouvements, total] = await Promise.all([
      MouvementStock.find(query)
        .populate("produit",     "nom reference unite prixAchat")
        .populate("source",      "nom type")
        .populate("destination", "nom type")
        .populate("createdBy",   "nom")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      MouvementStock.countDocuments(query),
    ]);

    const today = new Date(); today.setHours(0, 0, 0, 0);
    return NextResponse.json({
      success: true, data: mouvements,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      stats: {
        nbAujourdhui: mouvements.filter(m => new Date(m.createdAt) >= today).length,
        nbEnTransit:  mouvements.filter(m => m.statut === "en_cours").length,
        nbEntrees:    mouvements.filter(m => m.type === "entree_fournisseur").length,
        totalUnites:  mouvements.reduce((s, m) => s + m.quantite, 0),
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
    const { type, produitId, sourceId, destinationId, quantite, motif } = await req.json();
    if (!produitId || !quantite || quantite < 0)
      return NextResponse.json({ success: false, message: "Données invalides" }, { status: 400 });

    // Vérifier l'accès aux boutiques concernées
    if (sourceId && !canAccessBoutique(ctx, sourceId))
      return NextResponse.json({ success: false, message: "Accès refusé à la boutique source." }, { status: 403 });
    if (destinationId && !canAccessBoutique(ctx, destinationId))
      return NextResponse.json({ success: false, message: "Accès refusé à la boutique destination." }, { status: 403 });

    if (sourceId) {
      const stockSource = await Stock.findOne({ produit: produitId, boutique: sourceId, tenantId: ctx.tenantId });
      if (!stockSource || stockSource.quantite < quantite)
        return NextResponse.json({
          success: false,
          message: `Stock insuffisant à la source (disponible : ${stockSource?.quantite ?? 0})`,
        }, { status: 400 });
    }

    const count     = await MouvementStock.countDocuments({ tenantId: ctx.tenantId });
    const reference = `MV-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

    const mouvement = await MouvementStock.create({
      tenantId: ctx.tenantId, reference, type,
      produit: produitId, source: sourceId || null,
      destination: destinationId || null, quantite,
      motif: motif || "", statut: "en_cours", createdBy: ctx.userId,
    });

    if (sourceId)
      await Stock.findOneAndUpdate(
        { produit: produitId, boutique: sourceId, tenantId: ctx.tenantId },
        { $inc: { quantite: -quantite } }
      );

    if (destinationId) {
      await Stock.findOneAndUpdate(
        { produit: produitId, boutique: destinationId, tenantId: ctx.tenantId },
        { $inc: { quantite: +quantite }, $setOnInsert: { tenantId: ctx.tenantId } },
        { upsert: true }
      );
      mouvement.statut = "livre"; await mouvement.save();
    }

    if (["sortie_perte", "entree_fournisseur"].includes(type)) {
      mouvement.statut = "livre"; await mouvement.save();
    }

    const populated = await MouvementStock.findById(mouvement._id)
      .populate("produit", "nom reference")
      .populate("source", "nom type")
      .populate("destination", "nom type");

    return NextResponse.json({ success: true, data: populated }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
