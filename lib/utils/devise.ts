// lib/utils/devise.ts
// Gestion centralisée des devises : FCFA est toujours la devise d'achat
// (commandes fournisseurs). Chaque boutique peut vendre dans sa propre devise.
// Le taux stocké représente toujours "combien de FCFA pour 1 unité de la devise étrangère".

export const DEVISES = ["FCFA", "USD", "EUR"];

const SYMBOLES: Record<string, string> = { FCFA: "F", USD: "$", EUR: "€" };

export function getTaux(tenant: { tauxChange?: { devise: string; taux: number }[] } | null | undefined, devise: string): number {
  if (devise === "FCFA") return 1;
  const entry = tenant?.tauxChange?.find(t => t.devise === devise);
  return entry?.taux || 1;
}

// FCFA → devise étrangère : on DIVISE (le taux = FCFA par unité étrangère)
export function fcfaVersDevise(montantFCFA: number, devise: string, taux: number): number {
  if (devise === "FCFA") return Math.round(montantFCFA);
  return Math.round((montantFCFA / taux) * 100) / 100;
}

// Devise étrangère → FCFA : on MULTIPLIE
export function deviseVersFCFA(montantDevise: number, devise: string, taux: number): number {
  if (devise === "FCFA") return Math.round(montantDevise);
  return Math.round(montantDevise * taux);
}

export function formatMontant(montant: number, devise: string = "FCFA"): string {
  const decimals = devise === "FCFA" ? 0 : 2;
  const nombre = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(montant);
  const symbole = SYMBOLES[devise] || devise;
  return `${nombre} ${symbole}`;
}
