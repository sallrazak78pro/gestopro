// app/api/versements/route.ts — Versements boutique → caisse centrale
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getTenantContext } from "@/lib/utils/tenant";
import MouvementArgent from "@/lib/models/MouvementArgent";
import Boutique from "@/lib/models/Boutique";

export async function GET(req: NextRequest) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    await connectDB();

    const { searchParams } = new URL(req.url);
    const statut    = searchParams.get("statut") ?? "";
    const boutiqueId = searchParams.get("boutique") ?? "";

    const query: any = {
      tenantId: ctx.tenantId,
      type: "versement_boutique",
    };

    // Caissier/Gestionnaire : seulement sa boutique
    if (ctx.boutiqueAssignee) query.boutique = ctx.boutiqueAssignee;
    else if (boutiqueId)      query.boutique = boutiqueId;

    if (statut) query.statut = statut;

    const versements = await MouvementArgent.find(query)
      .populate("boutique",       "nom")
      .populate("boutiqueDestination", "nom")
      .populate("createdBy",      "nom prenom")
      .populate("confirmedBy",    "nom prenom")
      .sort({ createdAt: -1 })
      .lean();

    const nbEnAttente = await MouvementArgent.countDocuments({
      tenantId: ctx.tenantId,
      type: "versement_boutique",
      statut: "en_attente",
      ...(ctx.boutiqueAssignee ? { boutique: ctx.boutiqueAssignee } : {}),
    });

    return NextResponse.json({ success: true, data: versements, nbEnAttente });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    await connectDB();

    const { montant, boutiqueId, date } = await req.json();

    if (!montant || montant <= 0)
      return NextResponse.json({ success: false, message: "Montant invalide." }, { status: 400 });

    // Déterminer la boutique source
    const sourceBoutiqueId = ctx.boutiqueAssignee ?? boutiqueId;
    if (!sourceBoutiqueId)
      return NextResponse.json({ success: false, message: "Boutique source manquante." }, { status: 400 });

    // Trouver la caisse centrale / dépôt principal
    const depot = await Boutique.findOne({
      tenantId: ctx.tenantId,
      $or: [{ estPrincipale: true }, { type: "depot" }],
    }).lean();

    // Générer la référence
    const count = await MouvementArgent.countDocuments({ tenantId: ctx.tenantId });
    const reference = `VRS-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

    const versement = await MouvementArgent.create({
      tenantId:            ctx.tenantId,
      reference,
      type:                "versement_boutique",
      boutique:            sourceBoutiqueId,
      boutiqueDestination: depot?._id ?? null,
      montant:             Math.round(montant),
      statut:              "en_attente",      // ← toujours en attente à la création
      createdBy:           ctx.userId,
      createdAt:           date ? new Date(date) : new Date(),
    });

    return NextResponse.json({ success: true, data: versement }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
