import { describe, it, expect } from "vitest";
import { formatMontant } from "@/lib/utils/devise";

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
