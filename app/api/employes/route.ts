// app/api/employes/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Employe from "@/lib/models/Employe";
import { getTenantContext, requirePermission } from "@/lib/utils/tenant";

export async function GET(req: NextRequest) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    const denied = requirePermission(ctx, "employes", "view");
    if (denied) return denied;
    await connectDB();

    const { searchParams } = new URL(req.url);
    const query: any = { tenantId: ctx.tenantId };
    if (ctx.boutiqueAssignee) query.boutique = ctx.boutiqueAssignee;
    else if (searchParams.get("boutiqueId")) query.boutique = searchParams.get("boutiqueId");
    else if (searchParams.get("boutique"))   query.boutique = searchParams.get("boutique");
    if (searchParams.get("actif") !== null && searchParams.get("actif") !== "")
      query.actif = searchParams.get("actif") === "true";
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

    return NextResponse.json({ success: true, data: employes });
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
    return NextResponse.json({ success: true, data: populated }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
