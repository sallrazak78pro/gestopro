// app/api/ventes/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Vente from "@/lib/models/Vente";
import Stock from "@/lib/models/Stock";
import { getTenantContext } from "@/lib/utils/tenant";
import { logActivity, ACTIONS, MODULES } from "@/lib/utils/activity";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    await connectDB();
    const vente = await Vente.findOne({ _id: id, tenantId: ctx.tenantId })
      .populate("boutique", "nom adresse telephone").populate("createdBy", "nom");
    if (!vente) return NextResponse.json({ success: false, message: "Vente introuvable" }, { status: 404 });
    return NextResponse.json({ success: true, data: vente });
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
    const { statut, montantRecu } = await req.json();

    const vente = await Vente.findOne({ _id: id, tenantId: ctx.tenantId });
    if (!vente) return NextResponse.json({ success: false, message: "Vente introuvable" }, { status: 404 });

    // Caissier : vérifier que la vente appartient à sa boutique
    if (ctx.boutiqueAssignee && vente.boutique.toString() !== ctx.boutiqueAssignee.toString()) {
      return NextResponse.json({ success: false, message: "Accès refusé à cette vente." }, { status: 403 });
    }

    const ancienStatut = vente.statut;
    vente.statut = statut;
    if (montantRecu) { vente.montantRecu = montantRecu; vente.monnaie = montantRecu - vente.montantTotal; }
    await vente.save();

    if (ancienStatut === "en_attente" && statut === "payee")
      for (const ligne of vente.lignes)
        await Stock.findOneAndUpdate({ produit: ligne.produit, boutique: vente.boutique, tenantId: ctx.tenantId }, { $inc: { quantite: -ligne.quantite } });

    if (ancienStatut === "payee" && statut === "annulee")
      for (const ligne of vente.lignes)
        await Stock.findOneAndUpdate({ produit: ligne.produit, boutique: vente.boutique, tenantId: ctx.tenantId }, { $inc: { quantite: +ligne.quantite } });

    // Log d'activité
    if (statut === "annulee" && ancienStatut !== "annulee") {
      await logActivity({
        tenantId: ctx.tenantId, userId: ctx.userId, userNom: "", role: ctx.role,
        action: ACTIONS.VENTE_ANNULEE, module: MODULES.VENTES,
        details: `Vente ${vente.reference} annulée — ${new Intl.NumberFormat("fr-FR").format(vente.montantTotal)} F`,
        reference: vente.reference, boutique: vente.boutique?.toString(),
      });
    }

    return NextResponse.json({ success: true, data: vente });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
