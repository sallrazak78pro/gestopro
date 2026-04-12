// app/api/sessions-caisse/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import SessionCaisse from "@/lib/models/SessionCaisse";
import { getTenantContext, canAccessBoutique } from "@/lib/utils/tenant";

// GET — historique des sessions (avec filtre boutique)
export async function GET(req: NextRequest) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
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
    await connectDB();

    const { boutiqueId, fondOuverture, noteOuverture } = await req.json();

    if (!boutiqueId)
      return NextResponse.json({ success: false, message: "Boutique requise." }, { status: 400 });

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

    const session = await SessionCaisse.create({
      tenantId: ctx.tenantId,
      boutique: boutiqueId,
      ouvertPar: ctx.userId,
      fondOuverture: fondOuverture ?? 0,
      noteOuverture: noteOuverture ?? "",
      statut: "ouverte",
      dateOuverture: new Date(),
    });

    const populated = await SessionCaisse.findById(session._id)
      .populate("boutique", "nom")
      .populate("ouvertPar", "nom");

    return NextResponse.json({ success: true, data: populated }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
