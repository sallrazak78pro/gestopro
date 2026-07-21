// app/api/versements/route.ts — Versements boutique → caisse centrale
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getTenantContext } from "@/lib/utils/tenant";
import MouvementArgent from "@/lib/models/MouvementArgent";
import Boutique from "@/lib/models/Boutique";
import { genererReference } from "@/lib/utils/reference";
import { calculerSoldeCaisse } from "@/lib/utils/tresorerie";

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

    // Vérifier le solde disponible — sans ce contrôle, un versement pouvait
    // dépasser ce qu'il y a réellement en caisse. Le solde affiché est ensuite
    // plafonné à 0 (jamais négatif), donc un déficit masquait silencieusement
    // toute déduction ultérieure : le chiffre restait bloqué à "0 F".
    const { soldeCaisse } = await calculerSoldeCaisse(ctx.tenantId, sourceBoutiqueId);
    if (montant > soldeCaisse) {
      return NextResponse.json({
        success: false,
        message: `Solde insuffisant. Disponible en caisse : ${new Intl.NumberFormat("fr-FR").format(soldeCaisse)} F.`,
      }, { status: 400 });
    }

    // Trouver la caisse centrale / dépôt principal
    const depot = await Boutique.findOne({
      tenantId: ctx.tenantId,
      $or: [{ estPrincipale: true }, { type: "depot" }],
    }).lean();

    // Générer la référence
    const reference = await genererReference(ctx.tenantId, `VRS-${new Date().getFullYear()}`);

    // Le champ "date" du formulaire n'est qu'une date (pas d'heure) — new Date(date)
    // la ferait tomber à minuit UTC, donc avant l'ouverture de la caisse du jour
    // même, ce qui excluait silencieusement le versement des totaux "depuis
    // l'ouverture" (session en cours ET fermeture de caisse). On garde l'heure
    // actuelle pour rester dans la fenêtre de la session ouverte aujourd'hui.
    const now = new Date();
    let createdAt = now;
    if (date) {
      const [y, m, d] = date.split("-").map(Number);
      createdAt = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
    }

    const versement = await MouvementArgent.create({
      tenantId:            ctx.tenantId,
      reference,
      type:                "versement_boutique",
      boutique:            sourceBoutiqueId,
      boutiqueDestination: depot?._id ?? null,
      montant:             Math.round(montant),
      statut:              "en_attente",      // ← toujours en attente à la création
      createdBy:           ctx.userId,
      createdAt,
    });

    return NextResponse.json({ success: true, data: versement }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
