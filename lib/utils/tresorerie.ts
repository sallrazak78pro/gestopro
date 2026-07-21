// lib/utils/tresorerie.ts
// Calcul centralisé du solde de caisse d'une boutique.
//
// Règle de statut : un versement_boutique "en_attente" est déjà déduit de
// la caisse source (l'argent en est physiquement sorti) mais n'est crédité
// à la caisse destination qu'une fois confirmé par un admin — le temps du
// transit, cet argent n'apparaît dans aucune des deux caisses. Un versement
// "rejeté" n'est jamais déduit ni crédité (comme s'il n'avait jamais eu lieu).
import mongoose from "mongoose";
import MouvementArgent from "@/lib/models/MouvementArgent";
import Vente from "@/lib/models/Vente";

export const TYPES_ENTREE_CAISSE = ["depot_tiers", "avance_caisse", "ajustement_positif"];
export const TYPES_SORTIE_CAISSE = ["versement_boutique", "versement_banque", "depense", "achat_direct", "remboursement", "retrait_tiers", "ajustement_negatif"];

export interface DetailSoldeCaisse {
  totalVentes: number;
  totalEntrees: number;
  versementsRecus: number;
  totalSorties: number;
}

/** Solde de caisse détaillé d'une seule boutique. */
export async function calculerSoldeCaisse(
  tenantId: string | mongoose.Types.ObjectId,
  boutiqueId: string | mongoose.Types.ObjectId
): Promise<{ soldeCaisse: number; detail: DetailSoldeCaisse }> {
  const tid = new mongoose.Types.ObjectId(tenantId);
  const bid = new mongoose.Types.ObjectId(boutiqueId);

  const [ventesRes, sortiesRes, entreesRes, versRecusRes] = await Promise.all([
    Vente.aggregate([
      { $match: { boutique: bid, tenantId: tid, statut: "payee" } },
      { $group: { _id: null, total: { $sum: "$montantTotal" } } },
    ]),
    MouvementArgent.aggregate([
      { $match: { tenantId: tid, boutique: bid,
          type: { $in: TYPES_SORTIE_CAISSE }, statut: { $ne: "rejete" } } },
      { $group: { _id: null, total: { $sum: "$montant" } } },
    ]),
    MouvementArgent.aggregate([
      { $match: { tenantId: tid, boutique: bid, type: { $in: TYPES_ENTREE_CAISSE } } },
      { $group: { _id: null, total: { $sum: "$montant" } } },
    ]),
    MouvementArgent.aggregate([
      { $match: { tenantId: tid, type: "versement_boutique", statut: "confirme", boutiqueDestination: bid } },
      { $group: { _id: null, total: { $sum: "$montant" } } },
    ]),
  ]);

  const detail: DetailSoldeCaisse = {
    totalVentes:     ventesRes[0]?.total    ?? 0,
    totalSorties:    sortiesRes[0]?.total   ?? 0,
    totalEntrees:    entreesRes[0]?.total   ?? 0,
    versementsRecus: versRecusRes[0]?.total ?? 0,
  };

  const soldeCaisse = detail.totalVentes + detail.totalEntrees + detail.versementsRecus - detail.totalSorties;
  return { soldeCaisse: Math.max(0, soldeCaisse), detail };
}

/** Soldes de caisse de plusieurs boutiques, en une seule série d'agrégations groupées. */
export async function calculerSoldesCaisseParBoutique(
  tenantId: string | mongoose.Types.ObjectId,
  boutiqueIds: (string | mongoose.Types.ObjectId)[]
): Promise<Record<string, number>> {
  if (boutiqueIds.length === 0) return {};

  const tid  = new mongoose.Types.ObjectId(tenantId);
  const bids = boutiqueIds.map(id => new mongoose.Types.ObjectId(id));

  const [ventesRes, sortiesRes, entreesRes, versRecusRes] = await Promise.all([
    Vente.aggregate([
      { $match: { tenantId: tid, statut: "payee", boutique: { $in: bids } } },
      { $group: { _id: "$boutique", total: { $sum: "$montantTotal" } } },
    ]),
    MouvementArgent.aggregate([
      { $match: { tenantId: tid, boutique: { $in: bids },
          type: { $in: TYPES_SORTIE_CAISSE }, statut: { $ne: "rejete" } } },
      { $group: { _id: "$boutique", total: { $sum: "$montant" } } },
    ]),
    MouvementArgent.aggregate([
      { $match: { tenantId: tid, boutique: { $in: bids }, type: { $in: TYPES_ENTREE_CAISSE } } },
      { $group: { _id: "$boutique", total: { $sum: "$montant" } } },
    ]),
    MouvementArgent.aggregate([
      { $match: { tenantId: tid, type: "versement_boutique", statut: "confirme", boutiqueDestination: { $in: bids } } },
      { $group: { _id: "$boutiqueDestination", total: { $sum: "$montant" } } },
    ]),
  ]);

  const toMap = (arr: any[]) => {
    const m: Record<string, number> = {};
    arr.forEach(r => { m[r._id.toString()] = r.total; });
    return m;
  };
  const ventesMap    = toMap(ventesRes);
  const sortiesMap   = toMap(sortiesRes);
  const entreesMap   = toMap(entreesRes);
  const versRecusMap = toMap(versRecusRes);

  const soldes: Record<string, number> = {};
  bids.forEach(bid => {
    const id = bid.toString();
    const solde = (ventesMap[id] ?? 0) + (entreesMap[id] ?? 0) + (versRecusMap[id] ?? 0) - (sortiesMap[id] ?? 0);
    soldes[id] = Math.max(0, Math.round(solde));
  });
  return soldes;
}
