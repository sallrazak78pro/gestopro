// lib/utils/devise.ts
export function formatMontant(montant: number): string {
  const nombre = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(montant);
  return `${nombre} F`;
}
