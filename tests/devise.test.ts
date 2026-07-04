import { describe, it, expect } from "vitest";
import { getTaux, fcfaVersDevise, deviseVersFCFA, formatMontant, DEVISES } from "@/lib/utils/devise";

describe("getTaux", () => {
  it("returns 1 for FCFA regardless of tenant config", () => {
    expect(getTaux(null, "FCFA")).toBe(1);
    expect(getTaux({ tauxChange: [{ devise: "USD", taux: 2800 }] }, "FCFA")).toBe(1);
  });

  it("returns the configured taux for a known foreign devise", () => {
    const tenant = { tauxChange: [{ devise: "USD", taux: 2800 }] };
    expect(getTaux(tenant, "USD")).toBe(2800);
  });

  it("falls back to 1 when the devise isn't configured on the tenant", () => {
    expect(getTaux({ tauxChange: [] }, "USD")).toBe(1);
    expect(getTaux(null, "USD")).toBe(1);
    expect(getTaux(undefined, "EUR")).toBe(1);
  });

  it("picks the right entry when multiple devises are configured", () => {
    const tenant = { tauxChange: [{ devise: "USD", taux: 2800 }, { devise: "EUR", taux: 656 }] };
    expect(getTaux(tenant, "EUR")).toBe(656);
    expect(getTaux(tenant, "USD")).toBe(2800);
  });
});

describe("fcfaVersDevise (FCFA -> devise etrangere : division)", () => {
  it("returns the same amount unchanged for FCFA", () => {
    expect(fcfaVersDevise(1500, "FCFA", 1)).toBe(1500);
  });

  it("divides by the taux for a foreign devise", () => {
    // 1500 FCFA at 2800 FCFA/USD => ~0.54 USD
    expect(fcfaVersDevise(1500, "USD", 2800)).toBeCloseTo(0.54, 2);
  });

  it("rounds to 2 decimal places", () => {
    expect(fcfaVersDevise(1000, "USD", 3)).toBe(333.33);
  });
});

describe("deviseVersFCFA (devise etrangere -> FCFA : multiplication)", () => {
  it("returns the same amount unchanged for FCFA", () => {
    expect(deviseVersFCFA(1500, "FCFA", 1)).toBe(1500);
  });

  it("multiplies by the taux for a foreign devise", () => {
    expect(deviseVersFCFA(1.07, "USD", 2800)).toBe(2996);
  });

  it("rounds to the nearest whole FCFA", () => {
    expect(deviseVersFCFA(0.543, "USD", 2800)).toBe(Math.round(0.543 * 2800));
  });

  it("round-trips reasonably with fcfaVersDevise", () => {
    const original = 10000;
    const taux = 2800;
    const converted = fcfaVersDevise(original, "USD", taux);
    const back = deviseVersFCFA(converted, "USD", taux);
    expect(back).toBeCloseTo(original, -1); // within rounding tolerance
  });
});

// Intl.NumberFormat("fr-FR") separates thousands with a narrow no-break
// space (U+202F), not a regular space. Build expectations with an explicit
// unicode escape so this test isn't sensitive to whichever space character
// happens to get typed literally.
const NNBSP = " ";

describe("formatMontant", () => {
  it("formats FCFA with no decimals and the F symbol", () => {
    expect(formatMontant(1500, "FCFA")).toBe(`1${NNBSP}500 F`);
  });

  it("formats USD with 2 decimals and the $ symbol", () => {
    expect(formatMontant(1.5, "USD")).toBe("1,50 $");
  });

  it("formats EUR with the euro symbol", () => {
    expect(formatMontant(10, "EUR")).toBe("10,00 €");
  });

  it("defaults to FCFA when no devise is given", () => {
    expect(formatMontant(2000)).toBe(`2${NNBSP}000 F`);
  });

  it("falls back to the raw devise code as symbol when unknown", () => {
    expect(formatMontant(5, "XOF-UNKNOWN")).toContain("XOF-UNKNOWN");
  });
});

describe("DEVISES", () => {
  it("includes the three supported currencies", () => {
    expect(DEVISES).toEqual(["FCFA", "USD", "EUR"]);
  });
});
