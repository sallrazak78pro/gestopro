import { describe, it, expect } from "vitest";
import { formatMontant, arrondirFCFA, PAS_FCFA } from "@/lib/utils/devise";

// Intl.NumberFormat("fr-FR") separates thousands with a narrow no-break
// space (U+202F), not a regular space.
const NNBSP = " ";

describe("formatMontant", () => {
  it("formats with no decimals and the F symbol", () => {
    expect(formatMontant(1500)).toBe(`1${NNBSP}500 F`);
  });

  it("rounds to the nearest whole franc", () => {
    expect(formatMontant(2000)).toBe(`2${NNBSP}000 F`);
  });
});

describe("arrondirFCFA", () => {
  it("arrondit au multiple de 5 F le plus proche", () => {
    expect(arrondirFCFA(15172.21)).toBe(15170);
    expect(arrondirFCFA(15173)).toBe(15175);
    expect(arrondirFCFA(15172.5)).toBe(15175);
    expect(arrondirFCFA(11999.5)).toBe(12000);
    expect(arrondirFCFA(12002.4)).toBe(12000);
  });

  it("laisse intact un montant déjà multiple de 5", () => {
    expect(arrondirFCFA(0)).toBe(0);
    expect(arrondirFCFA(12000)).toBe(12000);
    expect(arrondirFCFA(15175)).toBe(15175);
  });

  it("produit toujours un multiple du pas FCFA", () => {
    for (const m of [1, 2, 3, 4, 6, 7, 8, 9, 1234.56, 99999.99]) {
      expect(arrondirFCFA(m) % PAS_FCFA).toBe(0);
    }
  });
});
