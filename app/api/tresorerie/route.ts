// app/api/tresorerie/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import MouvementArgent from "@/lib/models/MouvementArgent";
import CompteTiers from "@/lib/models/CompteTiers";
import Boutique from "@/lib/models/Boutique";
import { getTenantContext, canAccessBoutique } from "@/lib/utils/tenant";
import { genererReference } from "@/lib/utils/reference";
import { calculerSoldeCaisse, TYPES_ENTREE_CAISSE, TYPES_SORTIE_CAISSE } from "@/lib/utils/tresorerie";

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

    if (searchParams.get("search")) {
      const regex = { $regex: searchParams.get("search"), $options: "i" };
      const matchingBoutiques = await Boutique.find({ tenantId: ctx.tenantId, nom: regex }).select("_id").lean();
      query.$or = [
        { reference: regex },
        { motif: regex },
        { tiersNom: regex },
        { boutique: { $in: matchingBoutiques.map(b => b._id) } },
      ];
    }

    const dateDebut = searchParams.get("dateDebut");
    const dateFin   = searchParams.get("dateFin");
    if (dateDebut || dateFin) {
      query.createdAt = {};
      if (dateDebut) query.createdAt.$gte = new Date(dateDebut);
      if (dateFin)   { const f = new Date(dateFin); f.setHours(23, 59, 59, 999); query.createdAt.$lte = f; }
    }

    const page  = parseInt(searchParams.get("page")  ?? "1");
    const limit = parseInt(searchParams.get("limit") ?? "50");
    const skip  = (page - 1) * limit;

    // Les stats portent sur tout l'ensemble filtré, pas seulement la page affichée.
    const [mouvements, total, tousLesMouvements] = await Promise.all([
      MouvementArgent.find(query)
        .populate("boutique", "nom")
        .populate("boutiqueDestination", "nom")
        .populate("tiers", "nom telephone")
        .populate("createdBy", "nom")
        .sort({ createdAt: -1 }).skip(skip).limit(limit),
      MouvementArgent.countDocuments(query),
      MouvementArgent.find(query).select("type montant").lean(),
    ]);

    const totalEntrees  = tousLesMouvements.filter(m => TYPES_ENTREE_CAISSE.includes(m.type)).reduce((s, m) => s + m.montant, 0);
    const totalSorties  = tousLesMouvements.filter(m => TYPES_SORTIE_CAISSE.includes(m.type)).reduce((s, m) => s + m.montant, 0);
    const versementsRecus = tousLesMouvements.filter(m => m.type === "versement_boutique").reduce((s, m) => s + m.montant, 0);
    const versementsBanque = tousLesMouvements.filter(m => m.type === "versement_banque").reduce((s, m) => s + m.montant, 0);
    const totalDepenses = tousLesMouvements.filter(m => ["depense","achat_direct"].includes(m.type)).reduce((s, m) => s + m.montant, 0);

    return NextResponse.json({
      success: true, data: mouvements,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
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
    const { soldeCaisse } = await calculerSoldeCaisse(ctx.tenantId, boutiqueId);
    if (TYPES_SORTIE_CAISSE.includes(type) && montant > soldeCaisse) {
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

    const prefix: Record<string, string> = {
      versement_boutique: "VRS", versement_banque: "BNQ",
      avance_caisse: "AVN", remboursement: "RMB",
      depense: "DEP", achat_direct: "ACH",
      depot_tiers: "DPT", retrait_tiers: "RTR",
    };
    const reference = await genererReference(ctx.tenantId, `${prefix[type] || "TRX"}-${new Date().getFullYear()}`);

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
