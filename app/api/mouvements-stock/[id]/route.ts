// app/api/mouvements-stock/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import MouvementStock from "@/lib/models/MouvementStock";
import Stock from "@/lib/models/Stock";
import { getTenantContext } from "@/lib/utils/tenant";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    await connectDB();
    const m = await MouvementStock.findOne({ _id: id, tenantId: ctx.tenantId })
      .populate("produit","nom reference unite prixAchat").populate("source","nom type").populate("destination","nom type").populate("createdBy","nom");
    if (!m) return NextResponse.json({ success: false, message: "Introuvable" }, { status: 404 });
    return NextResponse.json({ success: true, data: m });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    await connectDB();

    // Seuls admin, superadmin et gestionnaire peuvent annuler
    if (!["admin", "superadmin", "gestionnaire"].includes(ctx.role))
      return NextResponse.json({ success: false, message: "Permission insuffisante. Contactez un responsable." }, { status: 403 });

    // Chercher le mouvement en tenant compte de la restriction boutique du caissier
    const baseQuery: any = { _id: id, tenantId: ctx.tenantId };
    if (ctx.boutiqueAssignee) {
      baseQuery.$or = [
        { source:      ctx.boutiqueAssignee },
        { destination: ctx.boutiqueAssignee },
      ];
    }

    const mouvement = await MouvementStock.findOne(baseQuery);
    if (!mouvement) return NextResponse.json({ success: false, message: "Mouvement introuvable ou accès refusé." }, { status: 404 });
    if (mouvement.statut === "annule") return NextResponse.json({ success: false, message: "Déjà annulé" }, { status: 400 });

    if (mouvement.source)
      await Stock.findOneAndUpdate({ produit: mouvement.produit, boutique: mouvement.source, tenantId: ctx.tenantId }, { $inc: { quantite: +mouvement.quantite } }, { upsert: true });
    if (mouvement.destination)
      await Stock.findOneAndUpdate({ produit: mouvement.produit, boutique: mouvement.destination, tenantId: ctx.tenantId }, { $inc: { quantite: -mouvement.quantite } });

    mouvement.statut = "annule";
    await mouvement.save();
    return NextResponse.json({ success: true, data: mouvement });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
