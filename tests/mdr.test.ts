import { describe, expect, it } from "vitest";
import {
  DEFAULT_QR_CAP,
  MAX_QR_CHUNKS,
  MDR_PRESETS,
  calculateMdr,
  splitForZeroMdr,
} from "@/lib/mdr";

const base = { ratePct: 2, fixedFee: 0, gstPct: 18 };

describe("calculateMdr — inclusive", () => {
  it("deducts the MDR and its GST from what the customer paid", () => {
    const r = calculateMdr({ ...base, amount: 5000, mode: "inclusive" });
    expect(r.customerPays).toBe(5000);
    expect(r.mdrFee).toBe(100);
    expect(r.gstOnMdr).toBe(18);
    expect(r.totalDeduction).toBe(118);
    expect(r.youReceive).toBe(4882);
    expect(r.effectivePct).toBeCloseTo(2.36, 5);
  });

  it("adds a flat fee on top of the percentage, and charges GST on both", () => {
    const r = calculateMdr({ ...base, amount: 1000, mode: "inclusive", fixedFee: 3 });
    expect(r.mdrFee).toBe(23); // 1000 * 2% + 3
    expect(r.gstOnMdr).toBe(4.14);
    expect(r.youReceive).toBe(972.86);
  });

  it("settles the full amount on a zero-MDR rail", () => {
    const r = calculateMdr({ ...base, amount: 5000, mode: "inclusive", ratePct: 0 });
    expect(r.totalDeduction).toBe(0);
    expect(r.youReceive).toBe(5000);
  });
});

describe("calculateMdr — exclusive", () => {
  it("grosses the charge up so the net equals the amount asked for", () => {
    const r = calculateMdr({ ...base, amount: 5000, mode: "exclusive" });
    expect(r.customerPays).toBeGreaterThan(5000);
    // The whole point of the mode: the net comes back to the target, and never
    // under it — a paise short would defeat the purpose.
    expect(r.youReceive).toBeGreaterThanOrEqual(5000);
    expect(r.youReceive).toBeLessThanOrEqual(5000.02);
  });

  it("holds the net target when a flat fee is in play too", () => {
    const r = calculateMdr({ ...base, amount: 2500, mode: "exclusive", fixedFee: 5, ratePct: 1.1 });
    expect(r.youReceive).toBeGreaterThanOrEqual(2500);
    expect(r.youReceive).toBeLessThanOrEqual(2500.02);
  });

  it("is a no-op when the rate is zero", () => {
    const r = calculateMdr({ ...base, amount: 5000, mode: "exclusive", ratePct: 0 });
    expect(r.customerPays).toBe(5000);
    expect(r.youReceive).toBe(5000);
  });

  it("never lands under the target across a spread of rates, fees and amounts", () => {
    for (const ratePct of [0, 0.4, 0.9, 1.1, 2, 3.5, 12.75]) {
      for (const fixedFee of [0, 2.5, 7]) {
        for (const amount of [1, 37.77, 1999, 5000.55, 123456.78]) {
          const r = calculateMdr({ amount, mode: "exclusive", ratePct, fixedFee, gstPct: 18 });
          expect(r.feasible).toBe(true);
          expect(r.youReceive).toBeGreaterThanOrEqual(amount);
          // ...and never overshoots by more than rounding demands.
          expect(r.youReceive).toBeLessThanOrEqual(amount + 0.05);
        }
      }
    }
  });

  it("reports infeasible when MDR plus GST swallows every rupee charged", () => {
    const r = calculateMdr({ ...base, amount: 1000, mode: "exclusive", ratePct: 90 });
    expect(r.feasible).toBe(false);
    expect(r.customerPays).toBe(0);
  });
});

describe("calculateMdr — edges", () => {
  it("returns zeroes for a zero or negative amount", () => {
    for (const amount of [0, -100]) {
      const r = calculateMdr({ ...base, amount, mode: "inclusive" });
      expect(r.customerPays).toBe(0);
      expect(r.youReceive).toBe(0);
      expect(r.feasible).toBe(true);
    }
  });

  it("always keeps the four money figures self-consistent", () => {
    for (const mode of ["inclusive", "exclusive"] as const) {
      for (const amount of [1, 99.99, 1999, 250000]) {
        const r = calculateMdr({ ...base, amount, mode, fixedFee: 2.5 });
        expect(r.mdrFee + r.gstOnMdr).toBeCloseTo(r.totalDeduction, 2);
        expect(r.customerPays - r.totalDeduction).toBeCloseTo(r.youReceive, 2);
      }
    }
  });
});

describe("splitForZeroMdr", () => {
  it("fills each QR to the cap and puts the remainder on the last one", () => {
    const s = splitForZeroMdr(7500, 1999);
    expect(s.chunks).toEqual([1999, 1999, 1999, 1503]);
    expect(s.capped).toBe(false);
    expect(s.shortfall).toBe(0);
  });

  it("needs no remainder QR when the total divides exactly", () => {
    const s = splitForZeroMdr(5997, 1999);
    expect(s.chunks).toEqual([1999, 1999, 1999]);
  });

  it("uses a single QR when the total already fits under the cap", () => {
    const s = splitForZeroMdr(450, DEFAULT_QR_CAP);
    expect(s.chunks).toEqual([450]);
  });

  it("keeps paise exact rather than drifting on floats", () => {
    const s = splitForZeroMdr(4000.05, 1999);
    expect(s.chunks).toEqual([1999, 1999, 2.05]);
    expect(s.covered).toBe(4000.05);
  });

  it("holds the sum for a spread of awkward totals", () => {
    for (const total of [0.01, 1.99, 2000, 2000.01, 19999.99, 88888.88]) {
      const s = splitForZeroMdr(total, 1999);
      const sum = s.chunks.reduce((a, b) => a + b, 0);
      expect(Math.round(sum * 100)).toBe(Math.round(total * 100));
      expect(s.chunks.every((c) => c <= 1999)).toBe(true);
    }
  });

  it("stops at the chunk ceiling and reports what is left over", () => {
    const s = splitForZeroMdr(1999 * 200, 1999);
    expect(s.chunks).toHaveLength(MAX_QR_CHUNKS);
    expect(s.capped).toBe(true);
    expect(s.covered).toBe(1999 * MAX_QR_CHUNKS);
    expect(s.shortfall).toBe(1999 * (200 - MAX_QR_CHUNKS));
  });

  it("returns nothing for a zero total or a nonsense cap", () => {
    expect(splitForZeroMdr(0, 1999).chunks).toEqual([]);
    expect(splitForZeroMdr(5000, 0).chunks).toEqual([]);
    expect(splitForZeroMdr(5000, -10).chunks).toEqual([]);
  });
});

describe("MDR_PRESETS", () => {
  it("has unique ids and exactly one custom entry with no rate", () => {
    const ids = MDR_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(MDR_PRESETS.filter((p) => p.ratePct === null)).toHaveLength(1);
  });

  it("keeps the regulated zero-MDR rails at zero", () => {
    for (const id of ["upi", "rupay-debit"]) {
      expect(MDR_PRESETS.find((p) => p.id === id)?.ratePct).toBe(0);
    }
  });
});
