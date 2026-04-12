// app/api/commandes/[id]/payer/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import CommandeFournisseur from "@/lib/models/CommandeFournisseur";
import Fournisseur from "@/lib/models/Fournisseur";
import MouvementArgent from "@/lib/models/MouvementArgent";
import Boutique from "@/lib/models/Boutique";
import { getTenantContext } from "@/lib/utils/tenant";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    await connectDB();

    const { montant, boutiqueId, note } = await req.json();
    if (!montant || montant <= 0)
      return NextResponse.json({ success: false, message: "Montant invalide." }, { status: 400 });

    const commande = await CommandeFournisseur.findOne({ _id: (await params).id, tenantId: ctx.tenantId })
      .populate("fournisseur", "nom");
    if (!commande)
      return NextResponse.json({ success: false, message: "Commande introuvable." }, { status: 404 });

    const montantAPayer = Math.min(montant, commande.montantDu);
    if (montantAPayer <= 0)
      return NextResponse.json({ success: false, message: "Cette commande est déjà entièrement réglée." }, { status: 400 });

    // Mettre à jour la commande
    commande.montantPaye += montantAPayer;
    commande.montantDu   -= montantAPayer;
    await commande.save();

    // Mettre à jour le solde fournisseur
    await Fournisseur.findByIdAndUpdate(commande.fournisseur, { $inc: { soldeCredit: -montantAPayer } });

    // Créer les mouvements de trésorerie
    if (boutiqueId) {
      const boutique = await Boutique.findById(boutiqueId);
      const count = await MouvementArgent.countDocuments({ tenantId: ctx.tenantId });
      const fournisseurNom = (commande.fournisseur as any).nom;
      const motifBase = `Paiement fournisseur ${fournisseurNom} — ${commande.reference}${note ? ` — ${note}` : ""}`;

      if (boutique?.estPrincipale) {
        // Boutique principale : dépense directe (achat marchandise)
        await MouvementArgent.create({
          tenantId:         ctx.tenantId,
          reference:        `ACH-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`,
          type:             "depense",
          boutique:         boutiqueId,
          montant:          montantAPayer,
          categorieDepense: "achat_marchandise",
          motif:            motifBase,
          createdBy:        ctx.userId,
        });
      } else {
        // Boutique secondaire : versement automatique vers la principale
        // (elle a payé pour le compte de la principale)
        const principale = await Boutique.findOne({
          tenantId:     ctx.tenantId,
          estPrincipale: true,
          type:         "boutique",
        });

        await MouvementArgent.create({
          tenantId:            ctx.tenantId,
          reference:           `VRS-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`,
          type:                "versement_boutique",
          boutique:            boutiqueId,
          boutiqueDestination: principale?._id ?? null,
          montant:             montantAPayer,
          motif:               `Avance commande — ${motifBase}`,
          createdBy:           ctx.userId,
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: { montantPaye: commande.montantPaye, montantDu: commande.montantDu },
      message: boutiqueId
        ? (await Boutique.findById(boutiqueId))?.estPrincipale
          ? "Paiement enregistré."
          : "Paiement enregistré — versement automatique créé vers la boutique principale."
        : "Paiement enregistré.",
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
