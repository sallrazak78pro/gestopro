// app/api/tresorerie/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import MouvementArgent from "@/lib/models/MouvementArgent";
import CompteTiers from "@/lib/models/CompteTiers";
import Vente from "@/lib/models/Vente";
import { getTenantContext, canAccessBoutique } from "@/lib/utils/tenant";
import mongoose from "mongoose";

async function getSoldeCaisse(boutiqueId: string, tenantId: string): Promise<number> {
  const tid = new mongoose.Types.ObjectId(tenantId);
  const bid = new mongoose.Types.ObjectId(boutiqueId);

  const [ventesRes] = await Vente.aggregate([
    { $match: { boutique: bid, tenantId: tid, statut: "payee" } },
    { $group: { _id: null, total: { $sum: "$montantTotal" } } },
  ]);
  const totalVentes = ventesRes?.total ?? 0;

  // Sorties : tout ce qui quitte la caisse de cette boutique
  const mouvsSortie = await MouvementArgent.find({
    tenantId, boutique: boutiqueId,
    type: { $in: ["versement_boutique", "versement_banque", "depense", "achat_direct", "retrait_tiers", "remboursement"] },
  });
  const totalSorties = mouvsSortie.reduce((s, m) => s + m.montant, 0);

  // Entrées directes dans cette boutique (dépôts tiers, avances reçues)
  const mouvsEntree = await MouvementArgent.find({
    tenantId, boutique: boutiqueId,
    type: { $in: ["depot_tiers", "avance_caisse"] },
  });
  const totalEntrees = mouvsEntree.reduce((s, m) => s + m.montant, 0);

  // Versements reçus : quand CETTE boutique est la destination d'un versement_boutique
  const [versRecusRes] = await MouvementArgent.aggregate([
    { $match: { tenantId: tid, type: "versement_boutique", boutiqueDestination: bid } },
    { $group: { _id: null, total: { $sum: "$montant" } } },
  ]);
  const versementsRecus = versRecusRes?.total ?? 0;

  return Math.max(0, totalVentes + totalEntrees + versementsRecus - totalSorties);
}

export async function GET(req: NextRequest) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    await connectDB();

    const { searchParams } = new URL(req.url);
    const query: any = { tenantId: ctx.tenantId };
    if (searchParams.get("type")) query.type = searchParams.get("type");

    // Restriction boutique
    if (ctx.boutiqueAssignee) {
      query.boutique = ctx.boutiqueAssignee;
    } else if (searchParams.get("boutique")) {
      query.boutique = searchParams.get("boutique");
    }

    const mouvements = await MouvementArgent.find(query)
      .populate("boutique", "nom")
      .populate("boutiqueDestination", "nom")
      .populate("tiers", "nom telephone")
      .populate("createdBy", "nom")
      .sort({ createdAt: -1 }).limit(100);

    const totalEntrees  = mouvements.filter(m => ["avance_caisse", "depot_tiers"].includes(m.type)).reduce((s, m) => s + m.montant, 0);
    const totalSorties  = mouvements.filter(m => ["versement_boutique","versement_banque","depense","achat_direct","remboursement","retrait_tiers"].includes(m.type)).reduce((s, m) => s + m.montant, 0);
    const versementsRecus = mouvements.filter(m => m.type === "versement_boutique").reduce((s, m) => s + m.montant, 0);
    const versementsBanque = mouvements.filter(m => m.type === "versement_banque").reduce((s, m) => s + m.montant, 0);
    const totalDepenses = mouvements.filter(m => ["depense","achat_direct"].includes(m.type)).reduce((s, m) => s + m.montant, 0);

    return NextResponse.json({
      success: true, data: mouvements,
      stats: {
        totalEntrees, totalSorties,
        soldeNet: totalEntrees - totalSorties,
        totalDepenses,
        versementsRecus,
        versementsBanque,
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
    await connectDB();

    const { type, boutiqueId, boutiqueDestinationId, montant, categorieDepense,
            tiersId, motif, avanceRef, banqueNom } = await req.json();

    if (!montant || montant <= 0) return NextResponse.json({ success: false, message: "Montant invalide." }, { status: 400 });
    if (!boutiqueId) return NextResponse.json({ success: false, message: "Boutique requise." }, { status: 400 });

    // Vérifier accès boutique
    if (!canAccessBoutique(ctx, boutiqueId))
      return NextResponse.json({ success: false, message: "Accès refusé à cette boutique." }, { status: 403 });

    // Vérification solde caisse pour les types qui retirent de l'argent
    const typesSortie = ["versement_boutique", "versement_banque", "depense", "remboursement", "achat_direct"];
    const soldeCaisse = await getSoldeCaisse(boutiqueId, ctx.tenantId);
    if (typesSortie.includes(type) && montant > soldeCaisse) {
      return NextResponse.json({
        success: false,
        message: `Solde insuffisant. Disponible en caisse : ${new Intl.NumberFormat("fr-FR").format(soldeCaisse)} F.`,
      }, { status: 400 });
    }

    let tiersNom = "";
    if (tiersId) {
      const tiers = await CompteTiers.findOne({ _id: tiersId, tenantId: ctx.tenantId });
      if (!tiers) return NextResponse.json({ success: false, message: "Compte tiers introuvable." }, { status: 404 });
      if (type === "retrait_tiers" && tiers.solde < montant)
        return NextResponse.json({ success: false, message: `Solde tiers insuffisant (${new Intl.NumberFormat("fr-FR").format(tiers.solde)} F).` }, { status: 400 });
      tiersNom = tiers.nom;
      if (type === "depot_tiers")   await CompteTiers.findByIdAndUpdate(tiersId, { $inc: { solde: +montant } });
      if (type === "retrait_tiers") await CompteTiers.findByIdAndUpdate(tiersId, { $inc: { solde: -montant } });
    }

    const count = await MouvementArgent.countDocuments({ tenantId: ctx.tenantId });
    const prefix: Record<string, string> = {
      versement_boutique: "VRS", versement_banque: "BNQ",
      avance_caisse: "AVN", remboursement: "RMB",
      depense: "DEP", achat_direct: "ACH",
      depot_tiers: "DPT", retrait_tiers: "RTR",
    };
    const reference = `${prefix[type] || "TRX"}-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

    const mouvement = await MouvementArgent.create({
      tenantId: ctx.tenantId, reference, type,
      boutique: boutiqueId, boutiqueDestination: boutiqueDestinationId || null,
      montant, categorieDepense: categorieDepense || null,
      banqueNom: banqueNom || "",
      tiers: tiersId || null, tiersNom, motif: motif || "",
      avanceRef: avanceRef || "", createdBy: ctx.userId,
    });

    const populated = await MouvementArgent.findById(mouvement._id)
      .populate("boutique", "nom").populate("boutiqueDestination", "nom").populate("tiers", "nom");

    return NextResponse.json({ success: true, data: populated }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
