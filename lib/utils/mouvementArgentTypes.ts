// lib/utils/mouvementArgentTypes.ts
// Classification canonique des types de MouvementArgent (entrée/sortie de
// caisse). Séparé de lib/utils/tresorerie.ts (qui importe des modèles
// Mongoose côté serveur) pour rester importable tel quel depuis un
// composant client — évite qu'un fichier "use client" ne redéfinisse sa
// propre copie locale, source récurrente de bugs quand la liste canonique
// change (cf. commentaire dans tests/tresorerie-types.test.ts).
export const TYPES_ENTREE_CAISSE = ["depot_tiers", "avance_caisse", "ajustement_positif"];
export const TYPES_SORTIE_CAISSE = ["versement_boutique", "versement_banque", "depense", "achat_direct", "remboursement", "retrait_tiers", "ajustement_negatif"];

// Un versement (boutique→principale ou principale→banque) est un transfert
// interne entre comptes de l'entreprise, pas une dépense — il reste dans
// TYPES_SORTIE_CAISSE ci-dessus car il sort bien physiquement de la caisse
// (le solde de caisse et le calcul de fermeture doivent continuer à le
// compter), mais les RAPPORTS de "sorties/dépenses" (KPIs, graphiques) ne
// doivent jamais le mélanger avec les vraies sorties : cf. TYPES_SORTIE_REPORTING.
export const TYPES_VERSEMENT = ["versement_boutique", "versement_banque"];
export const TYPES_SORTIE_REPORTING = TYPES_SORTIE_CAISSE.filter(t => !TYPES_VERSEMENT.includes(t));
