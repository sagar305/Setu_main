import { describe, expect, it } from "vitest";
import { computePayables, openBills } from "@/lib/toolkit/payables";
import type { Purchase, Supplier, SupplierLedgerEntry } from "@/lib/toolkit/types";

const supplier = (id: string, name: string): Supplier => ({
  id,
  name,
  phone: "",
  email: "",
  gstin: "",
  address: "",
  notes: "",
  createdByTool: "supplier-book",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
});

const purchase = (
  id: string,
  supplierId: string | null,
  supplierName: string,
  date: string,
  total: number,
  paymentMode = "Credit",
): Purchase => ({
  id,
  supplierId,
  supplierName,
  billNumber: id.toUpperCase(),
  date,
  items: [],
  total,
  paymentMode,
  stockApplied: false,
  notes: "",
  createdByTool: "purchase-register",
  createdAt: `${date}T10:00:00Z`,
});

const payment = (
  id: string,
  supplierId: string | null,
  supplierName: string,
  date: string,
  amount: number,
  billRef?: string,
): SupplierLedgerEntry => ({
  id,
  supplierId,
  supplierName,
  type: "payment",
  amount,
  note: "",
  date,
  billRef,
  createdByTool: "supplier-ledger",
  createdAt: `${date}T12:00:00Z`,
});

describe("computePayables", () => {
  const suppliers = [supplier("s1", "Sharma Traders")];

  it("treats only Credit purchases as bills", () => {
    const pos = computePayables(
      suppliers,
      [
        purchase("a", "s1", "Sharma Traders", "2026-09-01", 1000),
        purchase("b", "s1", "Sharma Traders", "2026-09-02", 500, "Cash"),
        purchase("c", "s1", "Sharma Traders", "2026-09-03", 300, "UPI"),
      ],
      [],
    );
    const row = pos.get("id:s1")!;
    expect(row.balance).toBe(1000);
    expect(openBills(pos).map((b) => b.ref)).toEqual(["p:a"]);
  });

  it("excludes bills already recorded as paid", () => {
    const pos = computePayables(
      suppliers,
      [
        purchase("a", "s1", "Sharma Traders", "2026-09-01", 1000),
        purchase("b", "s1", "Sharma Traders", "2026-09-05", 400),
      ],
      [payment("x", "s1", "Sharma Traders", "2026-09-10", 400, "p:b")],
    );
    const open = openBills(pos);
    expect(open.map((b) => b.ref)).toEqual(["p:a"]);
    expect(pos.get("id:s1")!.balance).toBe(1000);
  });

  it("settles unlinked payments against the oldest bills first", () => {
    const pos = computePayables(
      suppliers,
      [
        purchase("a", "s1", "Sharma Traders", "2026-09-01", 1000),
        purchase("b", "s1", "Sharma Traders", "2026-09-05", 400),
      ],
      [payment("x", "s1", "Sharma Traders", "2026-09-10", 1200)],
    );
    const open = openBills(pos);
    expect(open).toHaveLength(1);
    expect(open[0].ref).toBe("p:b");
    expect(open[0].outstanding).toBe(200);
  });

  it("matches a typed supplier name to the saved supplier", () => {
    const pos = computePayables(
      suppliers,
      [purchase("a", null, "  sharma traders ", "2026-09-01", 750)],
      [],
    );
    expect(pos.get("id:s1")!.balance).toBe(750);
    expect([...pos.keys()]).toEqual(["id:s1"]);
  });

  it("reports overpayment as an advance", () => {
    const pos = computePayables(
      suppliers,
      [purchase("a", "s1", "Sharma Traders", "2026-09-01", 100)],
      [payment("x", "s1", "Sharma Traders", "2026-09-10", 150)],
    );
    expect(pos.get("id:s1")!.balance).toBe(-50);
    expect(openBills(pos)).toHaveLength(0);
  });
});
