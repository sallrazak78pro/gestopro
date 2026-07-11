import { describe, it, expect } from "vitest";
import { TYPES_ENTREE_CAISSE, TYPES_SORTIE_CAISSE } from "@/lib/utils/tresorerie";

// Doit rester en phase avec l'enum `type` de lib/models/MouvementArgent.ts.
// Mis à jour à la main volontairement : si ce test casse après l'ajout d'un
// nouveau type de mouvement, c'est le signal qu'il faut explicitement le
// classer comme entrée ou sortie de caisse avant de continuer — exactement
// l'oubli qui a cassé deux fois le calcul de solde de caisse (caisse en
// cours et vérification de solde avant un nouveau mouvement), à chaque
// fois parce qu'un fichier redéfinissait sa propre liste locale au lieu
// d'utiliser TYPES_ENTREE_CAISSE/TYPES_SORTIE_CAISSE.
const TOUS_LES_TYPES_MOUVEMENT_ARGENT = [
  "versement_boutique", "versement_banque", "avance_caisse", "remboursement",
  "depense", "achat_direct", "depot_tiers", "retrait_tiers",
];

describe("TYPES_ENTREE_CAISSE / TYPES_SORTIE_CAISSE", () => {
  it("together cover every MouvementArgent type exactly once", () => {
    const combined = [...TYPES_ENTREE_CAISSE, ...TYPES_SORTIE_CAISSE].sort();
    expect(combined).toEqual([...TOUS_LES_TYPES_MOUVEMENT_ARGENT].sort());
  });

  it("has no type classified as both an entrée and a sortie", () => {
    const overlap = TYPES_ENTREE_CAISSE.filter(t => TYPES_SORTIE_CAISSE.includes(t));
    expect(overlap).toEqual([]);
  });

  it("specifically classifies retrait_tiers as a sortie (regression: was silently unchecked before a caisse-balance fix)", () => {
    expect(TYPES_SORTIE_CAISSE).toContain("retrait_tiers");
    expect(TYPES_ENTREE_CAISSE).not.toContain("retrait_tiers");
  });

  it("specifically classifies remboursement as a sortie, not an entrée (regression: sessions-caisse/active had this backwards)", () => {
    expect(TYPES_SORTIE_CAISSE).toContain("remboursement");
    expect(TYPES_ENTREE_CAISSE).not.toContain("remboursement");
  });
});
