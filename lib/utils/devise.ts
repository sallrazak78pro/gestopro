// lib/utils/devise.ts

// Le franc CFA ne circule pas à l'unité : la plus petite pièce est de 5 F,
// donc tout montant réellement encaissé ou rendu est un multiple de 5.
export const PAS_FCFA = 5;

/** Arrondit un montant au multiple de 5 F le plus proche (ex. 15 172 → 15 170, 15 173 → 15 175). */
export function arrondirFCFA(montant: number): number {
  return Math.round(montant / PAS_FCFA) * PAS_FCFA;
}

export function formatMontant(montant: number): string {
  const nombre = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(montant);
  return `${nombre} F`;
}
