// app/api/sessions-caisse/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import SessionCaisse from "@/lib/models/SessionCaisse";
import { getTenantContext, canAccessBoutique, requirePermission } from "@/lib/utils/tenant";
import MouvementArgent from "@/lib/models/MouvementArgent";
import { genererReference } from "@/lib/utils/reference";
import { logActivity, ACTIONS, MODULES } from "@/lib/utils/activity";

// GET — historique des sessions (avec filtre boutique)
export async function GET(req: NextRequest) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    const denied = requirePermission(ctx, "caisse", "view");
    if (denied) return denied;
    await connectDB();

    const { searchParams } = new URL(req.url);
    const query: any = { tenantId: ctx.tenantId };

    if (ctx.boutiqueAssignee) {
      query.boutique = ctx.boutiqueAssignee;
    } else if (searchParams.get("boutique")) {
      query.boutique = searchParams.get("boutique");
    }
    if (searchParams.get("statut")) query.statut = searchParams.get("statut");

    const sessions = await SessionCaisse.find(query)
      .populate("boutique", "nom")
      .populate("ouvertPar", "nom")
      .populate("ferméPar", "nom")
      .sort({ dateOuverture: -1 })
      .limit(50);

    return NextResponse.json({ success: true, data: sessions });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

// POST — ouvrir une nouvelle session de caisse
export async function POST(req: NextRequest) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    const denied = requirePermission(ctx, "caisse", "create");
    if (denied) return denied;
    await connectDB();

    const body = await req.json();
    const { boutiqueId, noteOuverture } = body;
    // "fondOuverture" : repli pour une ouverture mise en file hors-ligne par
    // une version précédente de l'écran, qui envoyait le fond sous ce nom.
    const montantCompte = Number(body.montantCompte ?? body.fondOuverture);

    if (!boutiqueId)
      return NextResponse.json({ success: false, message: "Boutique requise." }, { status: 400 });

    if (!Number.isFinite(montantCompte) || montantCompte < 0)
      return NextResponse.json({ success: false, message: "Saisissez le montant compté dans la caisse." }, { status: 400 });

    if (!canAccessBoutique(ctx, boutiqueId))
      return NextResponse.json({ success: false, message: "Accès refusé à cette boutique." }, { status: 403 });

    // Vérifier qu'il n'y a pas déjà une session ouverte pour cette boutique
    const sessionExistante = await SessionCaisse.findOne({
      tenantId: ctx.tenantId,
      boutique: boutiqueId,
      statut: "ouverte",
    });

    if (sessionExistante) {
      return NextResponse.json({
        success: false,
        message: "Une session de caisse est déjà ouverte pour cette boutique. Fermez-la d'abord.",
        sessionId: sessionExistante._id,
      }, { status: 400 });
    }

    // Fond attendu = montant compté à la dernière fermeture de cette caisse.
    const derniereFermee = await SessionCaisse.findOne({
      tenantId: ctx.tenantId, boutique: boutiqueId, statut: "fermee",
    }).sort({ dateFermeture: -1 });
    const fondAttendu = derniereFermee ? derniereFermee.montantReelTotal : null;
    const ecartOuverture = fondAttendu === null ? 0 : montantCompte - fondAttendu;
    const instantOuverture = new Date();

    // Le fond de la session est ce qui est réellement compté dans la caisse :
    // c'est lui qui sert d'ancrage au solde de caisse (cf. lib/utils/tresorerie.ts).
    const session = await SessionCaisse.create({
      tenantId: ctx.tenantId,
      boutique: boutiqueId,
      ouvertPar: ctx.userId,
      fondOuverture: montantCompte,
      fondAttendu,
      ecartOuverture,
      noteOuverture: noteOuverture ?? "",
      statut: "ouverte",
      dateOuverture: instantOuverture,
    });

    // Un écart entre la fermeture précédente et le comptage d'ouverture est
    // tracé en trésorerie comme à la fermeture (ajustement excédent/manquant).
    // Daté juste AVANT l'ouverture : le solde de la session part déjà du
    // montant compté, l'ajustement ne doit pas y être compté une seconde fois.
    if (Math.round(ecartOuverture) !== 0) {
      const positif = ecartOuverture > 0;
      await MouvementArgent.create({
        tenantId: ctx.tenantId,
        reference: await genererReference(ctx.tenantId, `${positif ? "AJP" : "AJM"}-${instantOuverture.getFullYear()}`),
        type: positif ? "ajustement_positif" : "ajustement_negatif",
        boutique: boutiqueId,
        montant: Math.abs(Math.round(ecartOuverture)),
        motif: `Écart constaté à l'ouverture de caisse (${session._id})${noteOuverture ? ` — ${noteOuverture}` : ""}`,
        createdAt: new Date(instantOuverture.getTime() - 1),
        createdBy: ctx.userId,
      });
    }

    const populated = await SessionCaisse.findById(session._id)
      .populate("boutique", "nom")
      .populate("ouvertPar", "nom");

    await logActivity({
      tenantId: ctx.tenantId, userId: ctx.userId, userNom: ctx.userNom, role: ctx.role,
      action: ACTIONS.CAISSE_OUVERTE, module: MODULES.CAISSE,
      details: `Ouverture de caisse — compté ${new Intl.NumberFormat("fr-FR").format(montantCompte)} F${
        fondAttendu === null ? "" : `, écart ${ecartOuverture >= 0 ? "+" : ""}${new Intl.NumberFormat("fr-FR").format(ecartOuverture)} F`
      }`,
      boutique: boutiqueId,
    });

    return NextResponse.json({ success: true, data: populated }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
