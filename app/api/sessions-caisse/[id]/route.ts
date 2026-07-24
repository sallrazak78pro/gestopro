// app/api/sessions-caisse/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import SessionCaisse from "@/lib/models/SessionCaisse";
import Vente from "@/lib/models/Vente";
import MouvementArgent from "@/lib/models/MouvementArgent";
import { getTenantContext } from "@/lib/utils/tenant";
import { TYPES_ENTREE_CAISSE, TYPES_SORTIE_CAISSE } from "@/lib/utils/tresorerie";

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

    // Tant que la session est ouverte, les champs totalVentes/totalEntrees/
    // totalSorties/montantAttendu stockés sur le document sont ceux du jour
    // de sa création (0 par défaut) — ils ne sont calculés et figés qu'à la
    // fermeture (voir /fermer). Sans ça, le rapport affichait des totaux à 0
    // pour toute session en cours, malgré des ventes/mouvements bien réels.
    const sessionObj = session.toObject();
    if (sessionObj.statut === "ouverte") {
      const totalVentes = ventes.reduce((s: number, v: any) => s + v.montantTotal, 0);
      const mvts = mouvements.filter((m: any) => m.statut !== "rejete");
      const totalEntreesBase = mvts.filter((m: any) => TYPES_ENTREE_CAISSE.includes(m.type)).reduce((s: number, m: any) => s + m.montant, 0);
      const totalSorties     = mvts.filter((m: any) => TYPES_SORTIE_CAISSE.includes(m.type)).reduce((s: number, m: any) => s + m.montant, 0);

      const versementsRecusRes = await MouvementArgent.find({
        tenantId: ctx.tenantId, type: "versement_boutique", statut: "confirme",
        boutiqueDestination: session.boutique._id,
        createdAt: { $gte: session.dateOuverture, $lte: dateFin },
      });
      const totalVersementsRecus = versementsRecusRes.reduce((s: number, m: any) => s + m.montant, 0);
      const totalEntrees = totalEntreesBase + totalVersementsRecus;

      Object.assign(sessionObj, {
        totalVentes, totalEntrees, totalSorties,
        montantAttendu: sessionObj.fondOuverture + totalVentes + totalEntrees - totalSorties,
      });
    }

    return NextResponse.json({ success: true, data: { session: sessionObj, ventes, mouvements } });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
