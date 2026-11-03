import { describe, expect, it } from "vitest";
import {
  allocate,
  allocationUnitCost,
  batchTotal,
  expiryStatus,
  mergeBatches,
  reconcileAll,
  reconcileBatches,
  restoreAllocations,
  sortFefo,
  type StockBatch,
} from "@/lib/pos/batches";
import type { Product } from "@/lib/pos/types";

const product = (over: Partial<Product> = {}): Product =>
  ({ id: "p", name: "Milk", costPrice: 20, trackStock: true, stock: 0, ...over }) as Product;

const batch = (over: Partial<StockBatch>): StockBatch => ({
  id: "b",
  productId: "p",
  batchNo: "",
  expiry: "",
  costPrice: null,
  quantity: 0,
  receivedAt: "2026-10-01",
  purchaseId: null,
  note: "",
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z",
  ...over,
});

const b1 = batch({ id: "b1", batchNo: "A", expiry: "2026-12-01", costPrice: 18, quantity: 5 });
const b2 = batch({ id: "b2", batchNo: "B", expiry: "2026-11-15", costPrice: 22, quantity: 3 });
const b3 = batch({ id: "b3", batchNo: "C", expiry: "", costPrice: null, quantity: 10 });

describe("sortFefo", () => {
  it("orders by earliest expiry, no-expiry last", () => {
    expect(sortFefo([b3, b1, b2]).map((b) => b.id)).toEqual(["b2", "b1", "b3"]);
  });
});

describe("allocate", () => {
  it("takes from the earliest expiry first and records costs", () => {
    const r = allocate([b1, b2, b3], product({ stock: 18 }), 6);
    expect(r.allocations.map((a) => [a.batchId, a.quantity, a.unitCost])).toEqual([
      ["b2", 3, 22],
      ["b1", 3, 18],
    ]);
    expect(r.shortfall).toBe(0);
    expect(allocationUnitCost(r.allocations, 20)).toBe(20);
  });

  it("honours a picked batch, then falls back to FEFO", () => {
    const r = allocate([b1, b2, b3], product({ stock: 18 }), 12, "b3");
    expect(r.allocations.map((a) => [a.batchId, a.quantity])).toEqual([
      ["b3", 10],
      ["b2", 2],
    ]);
    // batch without its own cost uses the product cost
    expect(r.allocations[0].unitCost).toBe(20);
  });

  it("reports what no batch could cover", () => {
    expect(allocate([b2], product({ stock: 3 }), 5).shortfall).toBe(2);
  });
});

describe("restoreAllocations", () => {
  it("puts units back, recreating a deleted batch", () => {
    const sale = allocate([b1, b2], product({ stock: 8 }), 4);
    const after = mergeBatches([b1, b2], sale.updated);
    const restored = restoreAllocations(after.filter((b) => b.id !== "b2"), product(), sale.allocations);
    const merged = mergeBatches(after.filter((b) => b.id !== "b2"), restored);
    expect(merged.find((b) => b.id === "b1")?.quantity).toBe(5);
    expect(merged.find((b) => b.id === "b2")).toMatchObject({ quantity: 3, batchNo: "B", expiry: "2026-11-15" });
  });
});

describe("reconcileBatches", () => {
  it("creates an opening batch for stock that has no batch", () => {
    const changes = reconcileBatches(product({ stock: 7 }), []);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ quantity: 7, opening: true, costPrice: 20 });
  });

  it("tops up the existing opening batch rather than adding another", () => {
    const opening = batch({ id: "o", opening: true, quantity: 2 });
    const changes = reconcileBatches(product({ stock: 5 }), [opening]);
    expect(changes).toEqual([expect.objectContaining({ id: "o", quantity: 5 })]);
  });

  it("removes missing units from the earliest-expiring batch", () => {
    const changes = reconcileBatches(product({ stock: 16 }), [b1, b2, b3]);
    expect(changes).toEqual([expect.objectContaining({ id: "b2", quantity: 1 })]);
  });

  it("leaves untracked and already-matching products alone", () => {
    expect(reconcileBatches(product({ trackStock: false, stock: 5 }), [])).toEqual([]);
    expect(reconcileBatches(product({ stock: 18 }), [b1, b2, b3])).toEqual([]);
  });

  it("keeps batch totals equal to stock across all products", () => {
    const products = [product({ id: "p", stock: 4 }), product({ id: "q", stock: 9 })];
    const fixed = mergeBatches([b1, b2, b3], reconcileAll(products, [b1, b2, b3]));
    expect(batchTotal(fixed, "p")).toBe(4);
    expect(batchTotal(fixed, "q")).toBe(9);
  });
});

describe("expiryStatus", () => {
  it("classifies expired, soon, ok and none", () => {
    expect(expiryStatus("2026-11-01", "2026-11-03")).toBe("expired");
    expect(expiryStatus("2026-11-20", "2026-11-03")).toBe("soon");
    expect(expiryStatus("2027-01-20", "2026-11-03")).toBe("ok");
    expect(expiryStatus("", "2026-11-03")).toBe("none");
  });
});
