// app/api/mouvements-stock/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import MouvementStock from "@/lib/models/MouvementStock";
import Stock from "@/lib/models/Stock";
import Boutique from "@/lib/models/Boutique";
import { getTenantContext } from "@/lib/utils/tenant";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    await connectDB();
    const m = await MouvementStock.findOne({ _id: id, tenantId: ctx.tenantId })
      .populate("boutique",       "nom type")
      .populate("lignes.produit", "nom reference unite prixAchat")
      .populate("createdBy",      "nom");
    if (!m) return NextResponse.json({ success: false, message: "Introuvable" }, { status: 404 });
    return NextResponse.json({ success: true, data: m });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

// DELETE — annule le mouvement en inversant le stock pour toutes les lignes
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    if (!["admin", "superadmin", "gestionnaire"].includes(ctx.role))
      return NextResponse.json({ success: false, message: "Permission insuffisante." }, { status: 403 });

    await connectDB();
    const m = await MouvementStock.findOne({ _id: id, tenantId: ctx.tenantId });
    if (!m) return NextResponse.json({ success: false, message: "Introuvable" }, { status: 404 });

    // Inverser le stock pour chaque ligne
    for (const ligne of m.lignes) {
      const delta = m.type === "entree" ? -ligne.quantite : +ligne.quantite;
      await Stock.findOneAndUpdate(
        { produit: ligne.produit, boutique: m.boutique, tenantId: ctx.tenantId },
        { $inc: { quantite: delta } }
      );
    }

    // Si c'est un transfert, inverser aussi la jambe liée
    if (m.transfertRef) {
      const paired = await MouvementStock.findOne({
        transfertRef: m.transfertRef,
        _id: { $ne: m._id },
        tenantId: ctx.tenantId,
      });
      if (paired) {
        for (const ligne of paired.lignes) {
          const deltaP = paired.type === "entree" ? -ligne.quantite : +ligne.quantite;
          await Stock.findOneAndUpdate(
            { produit: ligne.produit, boutique: paired.boutique, tenantId: ctx.tenantId },
            { $inc: { quantite: deltaP } }
          );
        }
        await paired.deleteOne();
      }
    }

    await m.deleteOne();
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
