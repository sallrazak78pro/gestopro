// lib/utils/tresorerie.ts
// Calcul centralisé du solde de caisse d'une boutique.
//
// Le solde est ancré sur le dernier montant physique réellement compté
// (la session ouverte en cours, ou la dernière fermeture) — jamais recalculé
// depuis le tout début à partir des seuls mouvements enregistrés. Une somme
// depuis zéro ignorerait le fond de départ de la toute première session
// d'une boutique, qui n'est jamais lui-même un MouvementArgent : l'écart en
// résultant ne se serait jamais résorbé, même avec des fermetures de caisse
// parfaitement équilibrées. Comme aucune vente ni aucun mouvement d'argent
// ne peut être créé pour une boutique sans que sa caisse soit ouverte (voir
// /api/ventes et /api/tresorerie), tout ce qui s'est passé avant ce point
// d'ancrage est déjà reflété dans le montant compté à ce moment-là — inutile
// (et risqué) de le resommer.
//
// Règle de statut : un versement_boutique "en_attente" est déjà déduit de
// la caisse source (l'argent en est physiquement sorti) mais n'est crédité
// à la caisse destination qu'une fois confirmé par un admin — le temps du
// transit, cet argent n'apparaît dans aucune des deux caisses. Un versement
// "rejeté" n'est jamais déduit ni crédité (comme s'il n'avait jamais eu lieu).
//
// avance_caisse et remboursement sont chacun un mouvement à deux faces : le
// champ `boutique` porte la face immédiate (qui reçoit l'avance / qui
// rembourse), et `boutiqueDestination` porte l'autre boutique impliquée
// (généralement la principale). Sans compter aussi cette seconde face, la
// somme des soldes de toutes les boutiques ne correspond plus à l'argent
// réellement en circulation — une avance ferait apparaître de l'argent, un
// remboursement en ferait disparaître.
import mongoose from "mongoose";
import MouvementArgent from "@/lib/models/MouvementArgent";
import Vente from "@/lib/models/Vente";
import SessionCaisse from "@/lib/models/SessionCaisse";
import { TYPES_ENTREE_CAISSE, TYPES_SORTIE_CAISSE, TYPES_VERSEMENT, TYPES_SORTIE_REPORTING } from "@/lib/utils/mouvementArgentTypes";

export { TYPES_ENTREE_CAISSE, TYPES_SORTIE_CAISSE, TYPES_VERSEMENT, TYPES_SORTIE_REPORTING };

export interface DetailSoldeCaisse {
  ancrage: number;
  totalVentes: number;
  totalEntrees: number;
  versementsRecus: number;
  totalSorties: number;
}

/** Point d'ancrage d'une boutique : dernier montant physique connu, et date depuis laquelle compter l'activité. */
async function ancrageCaisse(
  tid: mongoose.Types.ObjectId,
  bid: mongoose.Types.ObjectId
): Promise<{ ancrage: number; depuis: Date }> {
  const [sessionOuverte, derniereFermee] = await Promise.all([
    SessionCaisse.findOne({ tenantId: tid, boutique: bid, statut: "ouverte" }),
    SessionCaisse.findOne({ tenantId: tid, boutique: bid, statut: "fermee" }).sort({ dateFermeture: -1 }),
  ]);
  if (sessionOuverte) return { ancrage: sessionOuverte.fondOuverture, depuis: sessionOuverte.dateOuverture };
  if (derniereFermee) return { ancrage: derniereFermee.montantReelTotal, depuis: derniereFermee.dateFermeture! };
  return { ancrage: 0, depuis: new Date(0) };
}

/** Solde de caisse détaillé d'une seule boutique. */
export async function calculerSoldeCaisse(
  tenantId: string | mongoose.Types.ObjectId,
  boutiqueId: string | mongoose.Types.ObjectId
): Promise<{ soldeCaisse: number; detail: DetailSoldeCaisse }> {
  const tid = new mongoose.Types.ObjectId(tenantId);
  const bid = new mongoose.Types.ObjectId(boutiqueId);

  const { ancrage, depuis } = await ancrageCaisse(tid, bid);

  const [ventesRes, sortiesRes, entreesRes, versRecusRes, avancesEnvoyeesRes, remboursementsRecusRes] = await Promise.all([
    Vente.aggregate([
      { $match: { boutique: bid, tenantId: tid, statut: "payee", createdAt: { $gte: depuis } } },
      { $group: { _id: null, total: { $sum: "$montantTotal" } } },
    ]),
    MouvementArgent.aggregate([
      { $match: { tenantId: tid, boutique: bid,
          type: { $in: TYPES_SORTIE_CAISSE }, statut: { $ne: "rejete" }, createdAt: { $gte: depuis } } },
      { $group: { _id: null, total: { $sum: "$montant" } } },
    ]),
    MouvementArgent.aggregate([
      { $match: { tenantId: tid, boutique: bid, type: { $in: TYPES_ENTREE_CAISSE }, createdAt: { $gte: depuis } } },
      { $group: { _id: null, total: { $sum: "$montant" } } },
    ]),
    MouvementArgent.aggregate([
      { $match: { tenantId: tid, type: "versement_boutique", statut: "confirme", boutiqueDestination: bid, createdAt: { $gte: depuis } } },
      { $group: { _id: null, total: { $sum: "$montant" } } },
    ]),
    // Avance envoyée par cette boutique (destination d'un avance_caisse) — sort de sa caisse.
    MouvementArgent.aggregate([
      { $match: { tenantId: tid, type: "avance_caisse", statut: { $ne: "rejete" }, boutiqueDestination: bid, createdAt: { $gte: depuis } } },
      { $group: { _id: null, total: { $sum: "$montant" } } },
    ]),
    // Remboursement reçu par cette boutique (destination d'un remboursement) — entre dans sa caisse.
    MouvementArgent.aggregate([
      { $match: { tenantId: tid, type: "remboursement", statut: { $ne: "rejete" }, boutiqueDestination: bid, createdAt: { $gte: depuis } } },
      { $group: { _id: null, total: { $sum: "$montant" } } },
    ]),
  ]);

  const detail: DetailSoldeCaisse = {
    ancrage,
    totalVentes:     ventesRes[0]?.total    ?? 0,
    totalSorties:    (sortiesRes[0]?.total ?? 0) + (avancesEnvoyeesRes[0]?.total ?? 0),
    totalEntrees:    (entreesRes[0]?.total ?? 0) + (remboursementsRecusRes[0]?.total ?? 0),
    versementsRecus: versRecusRes[0]?.total ?? 0,
  };

  const soldeCaisse = ancrage + detail.totalVentes + detail.totalEntrees + detail.versementsRecus - detail.totalSorties;
  return { soldeCaisse: Math.max(0, soldeCaisse), detail };
}

/** Soldes de caisse de plusieurs boutiques (même règle d'ancrage, une boutique à la fois en parallèle). */
export async function calculerSoldesCaisseParBoutique(
  tenantId: string | mongoose.Types.ObjectId,
  boutiqueIds: (string | mongoose.Types.ObjectId)[]
): Promise<Record<string, number>> {
  if (boutiqueIds.length === 0) return {};

  const resultats = await Promise.all(
    boutiqueIds.map(async id => {
      const { soldeCaisse } = await calculerSoldeCaisse(tenantId, id);
      return [id.toString(), soldeCaisse] as const;
    })
  );

  return Object.fromEntries(resultats);
}
