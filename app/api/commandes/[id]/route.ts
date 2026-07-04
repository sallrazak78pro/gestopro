// app/api/commandes/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import CommandeFournisseur from "@/lib/models/CommandeFournisseur";
import Fournisseur from "@/lib/models/Fournisseur";
import MouvementArgent from "@/lib/models/MouvementArgent";
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

    const paiements = await MouvementArgent.find({ tenantId: ctx.tenantId, commandeId: c._id })
      .populate("boutique", "nom")
      .populate("createdBy", "nom")
      .sort({ createdAt: 1 });

    return NextResponse.json({ success: true, data: c, paiements });
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
    const { statut, fraisLivraison } = await req.json();
    const commande = await CommandeFournisseur.findOne({ _id: id, tenantId: ctx.tenantId });
    if (!commande) return NextResponse.json({ success: false, message: "Introuvable" }, { status: 404 });

    if (statut !== undefined) {
      // Si annulation : rembourser le solde fournisseur du montant non payé
      if (statut === "annulee" && commande.statut !== "annulee") {
        await Fournisseur.findByIdAndUpdate(commande.fournisseur, { $inc: { soldeCredit: -commande.montantDu } });
      }
      commande.statut = statut;
    }

    // Correction manuelle des frais de livraison (erreur de saisie) — ne
    // touche jamais le montant dû au fournisseur, uniquement le prix de
    // revient calculé lors des réceptions suivantes.
    if (fraisLivraison !== undefined) {
      if (fraisLivraison < 0)
        return NextResponse.json({ success: false, message: "Frais invalides" }, { status: 400 });
      commande.fraisLivraison = fraisLivraison;
    }

    await commande.save();
    return NextResponse.json({ success: true, data: commande });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
