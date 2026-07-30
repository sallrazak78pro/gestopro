// lib/utils/mouvementArgentTypes.ts
// Classification canonique des types de MouvementArgent (entrée/sortie de
// caisse). Séparé de lib/utils/tresorerie.ts (qui importe des modèles
// Mongoose côté serveur) pour rester importable tel quel depuis un
// composant client — évite qu'un fichier "use client" ne redéfinisse sa
// propre copie locale, source récurrente de bugs quand la liste canonique
// change (cf. commentaire dans tests/tresorerie-types.test.ts).
export const TYPES_ENTREE_CAISSE = ["depot_tiers", "avance_caisse", "ajustement_positif"];
export const TYPES_SORTIE_CAISSE = ["versement_boutique", "versement_banque", "depense", "achat_direct", "remboursement", "retrait_tiers", "ajustement_negatif"];
