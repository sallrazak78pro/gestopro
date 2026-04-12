// app/api/commandes/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import CommandeFournisseur from "@/lib/models/CommandeFournisseur";
import Fournisseur from "@/lib/models/Fournisseur";
import { getTenantContext } from "@/lib/utils/tenant";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    await connectDB();
    const c = await CommandeFournisseur.findOne({ _id: id, tenantId: ctx.tenantId })
      .populate("fournisseur", "nom telephone email adresse")
      .populate("destination", "nom type adresse")
      .populate("createdBy", "nom");
    if (!c) return NextResponse.json({ success: false, message: "Introuvable" }, { status: 404 });
    return NextResponse.json({ success: true, data: c });
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
    const { statut } = await req.json();
    const commande = await CommandeFournisseur.findOne({ _id: id, tenantId: ctx.tenantId });
    if (!commande) return NextResponse.json({ success: false, message: "Introuvable" }, { status: 404 });

    // Si annulation : rembourser le solde fournisseur du montant non payé
    if (statut === "annulee" && commande.statut !== "annulee") {
      await Fournisseur.findByIdAndUpdate(commande.fournisseur, { $inc: { soldeCredit: -commande.montantDu } });
    }
    commande.statut = statut;
    await commande.save();
    return NextResponse.json({ success: true, data: commande });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
