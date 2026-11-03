import { describe, expect, it } from "vitest";
import { derivedCashRows, isCashMode } from "@/lib/toolkit/cashbook";
import type { Order } from "@/lib/pos/types";
import type { Expense, LedgerEntry, Purchase, SupplierLedgerEntry } from "@/lib/toolkit/types";

const order = (over: Partial<Order>): Order =>
  ({
    id: "o",
    invoiceNumber: "INV-1",
    date: "2026-11-01T10:00:00.000Z",
    customerName: "",
    total: 500,
    paymentMethodId: "cash",
    paymentMethodName: "Cash",
    status: "completed",
    createdAt: "2026-11-01T10:00:00.000Z",
    ...over,
  }) as Order;

const purchase = (over: Partial<Purchase>): Purchase => ({
  id: "p",
  supplierId: null,
  supplierName: "S",
  billNumber: "B1",
  date: "2026-11-01",
  items: [],
  total: 300,
  paymentMode: "Cash",
  stockApplied: false,
  notes: "",
  createdByTool: "purchase-register",
  createdAt: "",
  ...over,
});

const expense = (over: Partial<Expense>): Expense => ({
  id: "e",
  date: "2026-11-01",
  category: "Rent",
  description: "",
  amount: 100,
  paymentMode: "UPI",
  supplierId: null,
  createdByTool: "expense-tracker",
  createdAt: "",
  updatedAt: "",
  ...over,
});

describe("derivedCashRows", () => {
  const rows = derivedCashRows({
    orders: [
      order({ id: "sale" }),
      order({ id: "udhaar", paymentMethodId: "credit", paymentMethodName: "Credit" }),
      order({ id: "void", status: "cancelled" }),
    ],
    ledger: [
      { id: "l1", customerId: "c", customerName: "Ravi", type: "payment", amount: 200, note: "", date: "2026-11-01", createdByTool: "customer-ledger", createdAt: "" } as LedgerEntry,
      { id: "l2", customerId: "c", customerName: "Ravi", type: "credit", amount: 500, note: "", date: "2026-11-01", createdByTool: "browser-pos", createdAt: "" } as LedgerEntry,
    ],
    purchases: [purchase({ id: "paid", expenseId: "mirror" }), purchase({ id: "oncredit", paymentMode: "Credit" })],
    expenses: [
      expense({ id: "rent" }),
      expense({ id: "mirror", category: "Purchases", createdByTool: "purchase-register", amount: 300 }),
    ],
    supplierLedger: [
      { id: "s1", supplierId: null, supplierName: "S", type: "payment", amount: 150, note: "", date: "2026-11-02", paymentMode: "Bank transfer", createdByTool: "supplier-ledger", createdAt: "" } as SupplierLedgerEntry,
      { id: "s2", supplierId: null, supplierName: "S", type: "bill", amount: 900, note: "", date: "2026-11-02", createdByTool: "supplier-ledger", createdAt: "" } as SupplierLedgerEntry,
    ],
  });
  const ids = rows.map((r) => `${r.type}:${r.id}`);

  it("records paid POS sales and customer payments as money in", () => {
    expect(ids).toContain("in:pos:sale");
    expect(ids).toContain("in:cl:l1");
    expect(ids).not.toContain("in:pos:udhaar");
    expect(ids).not.toContain("in:pos:void");
    expect(ids).not.toContain("in:cl:l2");
  });

  it("records paid purchases, expenses and supplier payments as money out", () => {
    expect(ids).toContain("out:pur:paid");
    expect(ids).toContain("out:exp:rent");
    expect(ids).toContain("out:sl:s1");
    expect(ids).not.toContain("out:pur:oncredit");
    expect(ids).not.toContain("out:sl:s2");
  });

  it("does not count a purchase twice through its legacy expense mirror", () => {
    expect(ids).not.toContain("out:exp:mirror");
    expect(rows).toHaveLength(5);
  });

  it("filters to physical cash", () => {
    expect(rows.filter(isCashMode).map((r) => r.id).sort()).toEqual(["cl:l1", "pos:sale", "pur:paid"]);
  });
});
