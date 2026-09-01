// app/api/employes/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Employe, { SANS_COMPTE_UTILISATEUR } from "@/lib/models/Employe";
import User from "@/lib/models/User";
import { getTenantContext, requirePermission } from "@/lib/utils/tenant";
import { logActivity, ACTIONS, MODULES } from "@/lib/utils/activity";
import { ROLE_LABEL } from "@/lib/utils/roles";

export async function GET(req: NextRequest) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    const denied = requirePermission(ctx, "employes", "view");
    if (denied) return denied;
    await connectDB();

    const { searchParams } = new URL(req.url);
    const boutiqueId = ctx.boutiqueAssignee
      ?? searchParams.get("boutiqueId")
      ?? searchParams.get("boutique");

    // pourVente=1 : utilisé par le sélecteur "vendeur" de la vente — inclut
    // aussi les comptes admin/gestionnaire/caissier éligibles pour cette
    // boutique (voir plus bas), et ne masque donc pas les fiches "fantômes"
    // déjà liées à un compte (sinon elles réapparaîtraient en double).
    const pourVente = searchParams.get("pourVente") === "1";

    const query: any = { tenantId: ctx.tenantId };
    if (boutiqueId) query.boutique = boutiqueId;
    if (pourVente) {
      query.actif = true;
    } else {
      Object.assign(query, SANS_COMPTE_UTILISATEUR);
      if (searchParams.get("actif") !== null && searchParams.get("actif") !== "")
        query.actif = searchParams.get("actif") === "true";
    }
    if (searchParams.get("search")) {
      const s = searchParams.get("search");
      query.$or = [
        { nom:    { $regex: s, $options: "i" } },
        { prenom: { $regex: s, $options: "i" } },
        { poste:  { $regex: s, $options: "i" } },
      ];
    }

    const employes = await Employe.find(query)
      .populate("boutique", "nom")
      .populate("userId", "nom email role")
      .sort({ nom: 1, prenom: 1 });

    // Le sélecteur de vendeur doit aussi proposer les comptes utilisateur
    // (admin/gestionnaire/caissier) qui participent aux ventes sans avoir de
    // fiche Employé classique — accès global (aucune boutique fixée sur leur
    // compte) ou explicitement assignés à CETTE boutique. On ne les crée en
    // fiche réelle qu'au moment où une vente est effectivement enregistrée
    // (voir POST /api/ventes) pour ne pas polluer la RH pour rien.
    let data: any[] = employes;
    if (pourVente && boutiqueId) {
      const dejaRepresentes = new Set(
        employes.filter((e: any) => e.userId).map((e: any) => e.userId._id.toString())
      );
      const usersEligibles = await User.find({
        tenantId: ctx.tenantId,
        role: { $in: ["admin", "gestionnaire", "caissier"] },
        actif: { $ne: false },
        $or: [{ boutique: null }, { boutique: boutiqueId }],
      }).select("nom prenom role").lean();

      const virtuels = usersEligibles
        .filter((u: any) => !dejaRepresentes.has(u._id.toString()))
        .map((u: any) => ({
          _id: `user:${u._id}`,
          nom: u.nom, prenom: u.prenom || "",
          poste: ROLE_LABEL[u.role] ?? u.role,
          actif: true,
        }));

      data = [...employes, ...virtuels].sort((a, b) =>
        `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`)
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    const denied = requirePermission(ctx, "employes", "create");
    if (denied) return denied;
    await connectDB();
    const body = await req.json();
    if (!body.nom || !body.prenom || !body.poste || !body.boutique || !body.salaireBase || !body.dateEmbauche)
      return NextResponse.json({ success: false, message: "Champs obligatoires manquants." }, { status: 400 });

    // Empêcher le doublon (même nom + prénom, même boutique) — insensible à
    // la casse et aux espaces superflus. Couvre aussi les fiches désactivées :
    // on suggère de la réactiver plutôt que d'en recréer une identique.
    const nomRegex    = new RegExp(`^${body.nom.trim()}$`, "i");
    const prenomRegex = new RegExp(`^${body.prenom.trim()}$`, "i");
    const existant = await Employe.findOne({
      tenantId: ctx.tenantId, boutique: body.boutique,
      nom: nomRegex, prenom: prenomRegex,
    });
    if (existant) {
      return NextResponse.json({
        success: false,
        message: existant.actif
          ? `${body.prenom} ${body.nom} existe déjà dans cette boutique.`
          : `${body.prenom} ${body.nom} existe déjà dans cette boutique (désactivé) — réactivez-le plutôt que d'en créer un nouveau.`,
      }, { status: 409 });
    }

    const employe = await Employe.create({ ...body, tenantId: ctx.tenantId });
    const populated = await Employe.findById(employe._id).populate("boutique", "nom");

    await logActivity({
      tenantId: ctx.tenantId, userId: ctx.userId, userNom: ctx.userNom, role: ctx.role,
      action: ACTIONS.EMPLOYE_CREE, module: MODULES.EMPLOYES,
      details: `Employé créé — ${employe.prenom} ${employe.nom} (${employe.poste})`,
      boutique: employe.boutique?.toString(),
    });

    return NextResponse.json({ success: true, data: populated }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
