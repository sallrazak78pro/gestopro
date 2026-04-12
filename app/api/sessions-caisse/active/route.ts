// app/api/sessions-caisse/active/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import SessionCaisse from "@/lib/models/SessionCaisse";
import Vente from "@/lib/models/Vente";
import MouvementArgent from "@/lib/models/MouvementArgent";
import { getTenantContext } from "@/lib/utils/tenant";

// GET — session active d'une boutique + ses chiffres en temps réel
export async function GET(req: NextRequest) {
  try {
    const { ctx, error } = await getTenantContext();
    if (error) return error;
    await connectDB();

    const boutiqueId = new URL(req.url).searchParams.get("boutiqueId");
    if (!boutiqueId)
      return NextResponse.json({ success: false, message: "boutiqueId requis" }, { status: 400 });

    const session = await SessionCaisse.findOne({
      tenantId: ctx.tenantId,
      boutique: boutiqueId,
      statut: "ouverte",
    })
      .populate("boutique", "nom")
      .populate("ouvertPar", "nom");

    if (!session)
      return NextResponse.json({ success: true, data: null });

    // ── Calculer les chiffres en temps réel depuis l'ouverture ───
    const depuis = session.dateOuverture;

    // Ventes payées depuis l'ouverture
    const ventes = await Vente.find({
      tenantId: ctx.tenantId,
      boutique: boutiqueId,
      statut: "payee",
      createdAt: { $gte: depuis },
    });

    const totalVentes      = ventes.reduce((s, v) => s + v.montantTotal, 0);
    const ventesEspeces    = ventes.filter(v => v.modePaiement === "especes").reduce((s, v) => s + v.montantTotal, 0);
    const ventesMobileMoney= ventes.filter(v => v.modePaiement === "mobile_money").reduce((s, v) => s + v.montantTotal, 0);
    const ventesVirement   = ventes.filter(v => v.modePaiement === "virement").reduce((s, v) => s + v.montantTotal, 0);
    const ventesCheque     = ventes.filter(v => v.modePaiement === "cheque").reduce((s, v) => s + v.montantTotal, 0);

    // Mouvements d'argent depuis l'ouverture
    const mouvements = await MouvementArgent.find({
      tenantId: ctx.tenantId,
      boutique: boutiqueId,
      createdAt: { $gte: depuis },
    });

    const TYPES_ENTREE = ["depot_tiers", "avance_caisse", "remboursement"];
    const TYPES_SORTIE = ["versement_hebdo", "depense", "retrait_tiers"];

    const totalEntrees = mouvements
      .filter(m => TYPES_ENTREE.includes(m.type))
      .reduce((s, m) => s + m.montant, 0);
    const totalSorties = mouvements
      .filter(m => TYPES_SORTIE.includes(m.type))
      .reduce((s, m) => s + m.montant, 0);

    // Versements reçus depuis l'ouverture (cette boutique = destination)
    const versementsRecus = await MouvementArgent.find({
      tenantId: ctx.tenantId,
      type: "versement_hebdo",
      boutiqueDestination: boutiqueId,
      createdAt: { $gte: depuis },
    });
    const totalVersementsRecus = versementsRecus.reduce((s, m) => s + m.montant, 0);

    const montantAttendu =
      session.fondOuverture + totalVentes + totalEntrees + totalVersementsRecus - totalSorties;

    return NextResponse.json({
      success: true,
      data: {
        session,
        live: {
          totalVentes, ventesEspeces, ventesMobileMoney, ventesVirement, ventesCheque,
          totalEntrees: totalEntrees + totalVersementsRecus,
          totalSorties,
          montantAttendu,
          nbVentes: ventes.length,
          nbMouvements: mouvements.length,
        },
        ventes,
        mouvements,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
