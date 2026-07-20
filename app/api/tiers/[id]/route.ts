// app/api/tiers/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import CompteTiers from "@/lib/models/CompteTiers";
import MouvementArgent from "@/lib/models/MouvementArgent";
import { getTenantContext, canAccessBoutique } from "@/lib/utils/tenant";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    await connectDB();
    const tiers = await CompteTiers.findOne({ _id: id, tenantId: ctx.tenantId }).populate("boutique","nom");
    if (!tiers) return NextResponse.json({ success: false, message: "Introuvable" }, { status: 404 });
    if (!canAccessBoutique(ctx, tiers.boutique?._id?.toString() ?? tiers.boutique?.toString()))
      return NextResponse.json({ success: false, message: "Accès refusé à cette boutique." }, { status: 403 });
    const historique = await MouvementArgent.find({ tiers: id, tenantId: ctx.tenantId }).populate("boutique","nom").populate("createdBy","nom").sort({ createdAt: -1 });
    return NextResponse.json({ success: true, data: { tiers, historique } });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

// PUT — modifier les informations du compte (nom/téléphone/description uniquement).
// Le solde ne doit JAMAIS être modifié ici : il ne bouge que via les dépôts/retraits
// de /api/tresorerie, qui créent un MouvementArgent traçable.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    if (!["admin", "superadmin", "gestionnaire"].includes(ctx.role))
      return NextResponse.json({ success: false, message: "Permission insuffisante" }, { status: 403 });
    await connectDB();

    const existing = await CompteTiers.findOne({ _id: id, tenantId: ctx.tenantId });
    if (!existing) return NextResponse.json({ success: false, message: "Introuvable" }, { status: 404 });
    if (!canAccessBoutique(ctx, existing.boutique?.toString()))
      return NextResponse.json({ success: false, message: "Accès refusé à cette boutique." }, { status: 403 });

    const body = await req.json();
    const update: any = {};
    if (body.nom !== undefined)         update.nom = body.nom;
    if (body.telephone !== undefined)   update.telephone = body.telephone;
    if (body.description !== undefined) update.description = body.description;
    if (body.actif !== undefined)       update.actif = body.actif;

    const tiers = await CompteTiers.findOneAndUpdate({ _id: id, tenantId: ctx.tenantId }, update, { new: true });
    return NextResponse.json({ success: true, data: tiers });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
