// app/api/sessions-caisse/[id]/fermer/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import SessionCaisse from "@/lib/models/SessionCaisse";
import Vente from "@/lib/models/Vente";
import MouvementArgent from "@/lib/models/MouvementArgent";
import { getTenantContext } from "@/lib/utils/tenant";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    await connectDB();

    const session = await SessionCaisse.findOne({
      _id: id,
      tenantId: ctx.tenantId,
      statut: "ouverte",
    });

    if (!session)
      return NextResponse.json({ success: false, message: "Session introuvable ou déjà fermée." }, { status: 404 });

    const {
      montantReelEspeces     = 0,
      montantReelMobileMoney = 0,
      montantReelVirement    = 0,
      montantReelCheque      = 0,
      noteFermeture          = "",
      fraisTransport         = 0,
    } = await req.json();

    const depuis     = session.dateOuverture;
    const boutiqueId = session.boutique.toString();

    // ── 1. Créer la dépense frais transport (avant fermeture) ─
    if (fraisTransport > 0) {
      const count = await MouvementArgent.countDocuments({ tenantId: ctx.tenantId });
      await MouvementArgent.create({
        tenantId:         ctx.tenantId,
        reference:        `DEP-TRP-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`,
        type:             "depense",
        boutique:         boutiqueId,
        montant:          fraisTransport,
        categorieDepense: "divers",
        motif:            "Frais de transport employés — fermeture caisse",
        createdBy:        ctx.userId,
      });
    }

    // ── 2. Recalculer tous les chiffres ───────────────────────
    const ventes = await Vente.find({
      tenantId: ctx.tenantId,
      boutique: boutiqueId,
      statut: "payee",
      createdAt: { $gte: depuis },
    });

    const totalVentes       = ventes.reduce((s, v) => s + v.montantTotal, 0);
    const ventesEspeces     = ventes.filter(v => v.modePaiement === "especes").reduce((s, v) => s + v.montantTotal, 0);
    const ventesMobileMoney = ventes.filter(v => v.modePaiement === "mobile_money").reduce((s, v) => s + v.montantTotal, 0);
    const ventesVirement    = ventes.filter(v => v.modePaiement === "virement").reduce((s, v) => s + v.montantTotal, 0);
    const ventesCheque      = ventes.filter(v => v.modePaiement === "cheque").reduce((s, v) => s + v.montantTotal, 0);

    // Mouvements de la session (inclut la dépense transport qu'on vient de créer)
    const mouvements = await MouvementArgent.find({
      tenantId: ctx.tenantId,
      boutique: boutiqueId,
      createdAt: { $gte: depuis },
    });

    const TYPES_ENTREE = ["depot_tiers", "avance_caisse"];
    const TYPES_SORTIE = ["versement_boutique", "versement_banque", "depense", "achat_direct", "remboursement", "retrait_tiers"];
    const totalEntrees = mouvements.filter(m => TYPES_ENTREE.includes(m.type)).reduce((s, m) => s + m.montant, 0);
    const totalSorties = mouvements.filter(m => TYPES_SORTIE.includes(m.type)).reduce((s, m) => s + m.montant, 0);

    // Versements reçus vers cette boutique
    const versementsRecusRes = await MouvementArgent.find({
      tenantId: ctx.tenantId,
      type: "versement_boutique",
      boutiqueDestination: boutiqueId,
      createdAt: { $gte: depuis },
    });
    const totalVersementsRecus = versementsRecusRes.reduce((s, m) => s + m.montant, 0);

    const montantAttendu =
      session.fondOuverture + totalVentes + totalEntrees + totalVersementsRecus - totalSorties;

    const montantReelTotal =
      montantReelEspeces + montantReelMobileMoney + montantReelVirement + montantReelCheque;

    const ecart = montantReelTotal - montantAttendu;

    // ── 3. Fermer la session ──────────────────────────────────
    const sessionFermee = await SessionCaisse.findByIdAndUpdate(
      id,
      {
        statut: "fermee",
        dateFermeture: new Date(),
        ferméPar: ctx.userId,
        noteFermeture,
        totalVentes,
        totalEntrees: totalEntrees + totalVersementsRecus,
        totalSorties,
        montantAttendu,
        ventesEspeces, ventesMobileMoney, ventesVirement, ventesCheque,
        montantReelEspeces, montantReelMobileMoney,
        montantReelVirement, montantReelCheque,
        montantReelTotal, ecart,
      },
      { new: true }
    )
      .populate("boutique", "nom")
      .populate("ouvertPar", "nom")
      .populate("ferméPar", "nom");

    return NextResponse.json({ success: true, data: sessionFermee });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
