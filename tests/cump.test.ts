import { describe, it, expect } from "vitest";
import { calculerCUMP } from "@/lib/utils/cump";

describe("calculerCUMP", () => {
  it("returns the new cost as-is when there is no existing stock", () => {
    expect(calculerCUMP(0, 0, 100, 1500)).toBe(1500);
  });

  it("computes the weighted average with existing stock (worked example)", () => {
    // 100 units @ 1500F existing, receiving 100 more @ 2000F
    // => (100*1500 + 100*2000) / 200 = 1750
    expect(calculerCUMP(100, 1500, 100, 2000)).toBe(1750);
  });

  it("weights toward the larger quantity", () => {
    // 300 units @ 1000F existing, receiving 10 @ 5000F
    // barely moves the average since the new batch is tiny
    const result = calculerCUMP(300, 1000, 10, 5000);
    expect(result).toBeCloseTo(1129.03, 2);
    expect(result).toBeGreaterThan(1000);
    expect(result).toBeLessThan(1200);
  });

  it("returns the incoming cost unchanged when receiving the exact same cost", () => {
    expect(calculerCUMP(50, 800, 25, 800)).toBe(800);
  });

  it("handles a delivery-fee-inclusive cost per unit (fee already folded in)", () => {
    // 0 existing stock, first delivery: cost is prixUnitaire + fraisParUnite
    const coutAvecFrais = 1000 + 200; // e.g. fraisParUnite = 200
    expect(calculerCUMP(0, 0, 5, coutAvecFrais)).toBe(1200);
  });

  it("treats zero total quantity (no existing + no incoming) as a no-op returning the incoming cost", () => {
    expect(calculerCUMP(0, 0, 0, 999)).toBe(999);
  });
});
