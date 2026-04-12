// app/api/versements/[id]/route.ts — Confirmer ou rejeter un versement
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getTenantContext } from "@/lib/utils/tenant";
import MouvementArgent from "@/lib/models/MouvementArgent";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;

    // Seul l'admin peut confirmer/rejeter
    if (!["admin", "superadmin"].includes(ctx.role))
      return NextResponse.json({ success: false, message: "Accès refusé." }, { status: 403 });

    await connectDB();
    const { id } = await params;
    const { action, rejetMotif } = await req.json();

    if (!["confirmer", "rejeter"].includes(action))
      return NextResponse.json({ success: false, message: "Action invalide." }, { status: 400 });

    const versement = await MouvementArgent.findOne({
      _id: id, tenantId: ctx.tenantId, type: "versement_boutique",
    });

    if (!versement)
      return NextResponse.json({ success: false, message: "Versement introuvable." }, { status: 404 });

    if (versement.statut !== "en_attente")
      return NextResponse.json({ success: false, message: "Ce versement a déjà été traité." }, { status: 400 });

    if (action === "confirmer") {
      versement.statut      = "confirme";
      versement.confirmedBy = ctx.userId as any;
      versement.confirmedAt = new Date();
    } else {
      versement.statut     = "rejete";
      versement.rejetMotif = rejetMotif ?? "";
    }

    await versement.save();

    return NextResponse.json({ success: true, data: versement });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
