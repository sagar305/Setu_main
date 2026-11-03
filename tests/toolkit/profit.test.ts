import { describe, expect, it } from "vitest";
import { buildUnitCostLookup, operatingExpenses } from "@/lib/toolkit/profit";
import type { Expense, Purchase } from "@/lib/toolkit/types";

const expense = (over: Partial<Expense>): Expense => ({
  id: "e",
  date: "2026-10-01",
  category: "Rent",
  description: "",
  amount: 100,
  paymentMode: "Cash",
  supplierId: null,
  createdByTool: "expense-tracker",
  createdAt: "",
  updatedAt: "",
  ...over,
});

const purchase = (over: Partial<Purchase>): Purchase => ({
  id: "p",
  supplierId: null,
  supplierName: "S",
  billNumber: "",
  date: "2026-10-01",
  items: [],
  total: 0,
  paymentMode: "Cash",
  stockApplied: true,
  notes: "",
  createdByTool: "purchase-register",
  createdAt: "",
  ...over,
});

describe("operatingExpenses", () => {
  it("drops purchase-register mirrors but keeps Expense Tracker entries", () => {
    const rows = [
      expense({ id: "rent" }),
      expense({ id: "mirror", category: "Purchases", createdByTool: "purchase-register" }),
      expense({ id: "linked", category: "Purchases" }),
      expense({ id: "manual", category: "Purchases" }),
    ];
    const kept = operatingExpenses(rows, [purchase({ expenseId: "linked" })]);
    expect(kept.map((e) => e.id)).toEqual(["rent", "manual"]);
  });
});

describe("buildUnitCostLookup", () => {
  const purchases = [
    purchase({ date: "2026-10-01", items: [{ productId: "a", name: "A", quantity: 10, unitCost: 50 }] }),
    purchase({ date: "2026-10-10", items: [{ productId: "a", name: "A", quantity: 10, unitCost: 60 }] }),
  ];
  const cost = buildUnitCostLookup(
    [
      { id: "a", costPrice: 40 },
      { id: "b", costPrice: 25 },
    ],
    purchases,
  );

  it("uses the latest purchase on or before the sale date", () => {
    expect(cost("a", "2026-10-05")).toBe(50);
    expect(cost("a", "2026-10-10")).toBe(60);
    expect(cost("a", "2026-11-01")).toBe(60);
  });

  it("falls back to product cost price before any purchase", () => {
    expect(cost("a", "2026-09-01")).toBe(40);
    expect(cost("b", "2026-10-05")).toBe(25);
  });

  it("is zero for unlinked items", () => {
    expect(cost(null, "2026-10-05")).toBe(0);
  });
});
