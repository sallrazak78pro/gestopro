// app/api/sessions-caisse/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import SessionCaisse from "@/lib/models/SessionCaisse";
import Vente from "@/lib/models/Vente";
import MouvementArgent from "@/lib/models/MouvementArgent";
import { getTenantContext } from "@/lib/utils/tenant";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    await connectDB();

    const session = await SessionCaisse.findOne({ _id: (await params).id, tenantId: ctx.tenantId })
      .populate("boutique", "nom adresse")
      .populate("ouvertPar", "nom")
      .populate("ferméPar", "nom");

    if (!session)
      return NextResponse.json({ success: false, message: "Session introuvable." }, { status: 404 });

    // Charger toutes les ventes et mouvements de la session
    const dateFin = session.dateFermeture ?? new Date();
    const ventes = await Vente.find({
      tenantId: ctx.tenantId,
      boutique: session.boutique._id,
      statut: "payee",
      createdAt: { $gte: session.dateOuverture, $lte: dateFin },
    }).populate("employe", "nom").sort({ createdAt: 1 });

    const mouvements = await MouvementArgent.find({
      tenantId: ctx.tenantId,
      boutique: session.boutique._id,
      createdAt: { $gte: session.dateOuverture, $lte: dateFin },
    }).sort({ createdAt: 1 });

    return NextResponse.json({ success: true, data: { session, ventes, mouvements } });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
