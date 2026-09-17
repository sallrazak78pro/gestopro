// lib/utils/devise.ts

// Le franc CFA ne circule pas à l'unité : la plus petite pièce est de 5 F,
// donc tout montant réellement encaissé ou rendu est un multiple de 5.
export const PAS_FCFA = 5;

/** Arrondit un montant au multiple de 5 F le plus proche (ex. 15 172 → 15 170, 15 173 → 15 175). */
export function arrondirFCFA(montant: number): number {
  return Math.round(montant / PAS_FCFA) * PAS_FCFA;
}

/**
 * Montant sans le symbole, en francs entiers — le format commun à toutes les
 * pages. Évite que chacune redéfinisse le sien : plusieurs oubliaient
 * l'arrondi et affichaient des montants à virgule (ex. « 11 999,5 F »).
 */
export function formatNombre(montant: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(montant);
}

/** Quantité (kg, litre, pièce…) — décimales conservées, au plus deux. */
export function formatQuantite(quantite: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(quantite);
}

export function formatMontant(montant: number): string {
  const nombre = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(montant);
  return `${nombre} F`;
}
