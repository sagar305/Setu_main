import { describe, expect, it } from "vitest";
import { closingSoon, creditNoteTotal, returnWindow, returnableLines } from "@/lib/toolkit/purchaseReturns";
import { computePayables } from "@/lib/toolkit/payables";
import type { Purchase, PurchaseItem, PurchaseReturn } from "@/lib/toolkit/types";

const item = (over: Partial<PurchaseItem>): PurchaseItem => ({
  productId: "p1",
  name: "Biscuits",
  quantity: 10,
  unitCost: 20,
  ...over,
});

const purchase = (over: Partial<Purchase>): Purchase => ({
  id: "pu1",
  supplierId: null,
  supplierName: "Ram Traders",
  billNumber: "B1",
  date: "2026-11-01",
  items: [],
  total: 0,
  paymentMode: "Credit",
  stockApplied: true,
  notes: "",
  createdByTool: "purchase-register",
  createdAt: "2026-11-01T10:00:00Z",
  ...over,
});

const ret = (over: Partial<PurchaseReturn>): PurchaseReturn => ({
  id: "r1",
  purchaseId: "pu1",
  supplierId: null,
  supplierName: "Ram Traders",
  billNumber: "B1",
  date: "2026-11-02",
  mode: "credit-note",
  items: [{ itemIndex: 0, productId: "p1", name: "Biscuits", quantity: 4, unitCost: 20 }],
  amount: 80,
  status: "settled",
  stockApplied: true,
  note: "",
  createdByTool: "purchase-register",
  createdAt: "2026-11-02T10:00:00Z",
  ...over,
});

const today = "2026-11-03";

describe("returnWindow", () => {
  it("follows the return deadline", () => {
    expect(returnWindow(item({}), today)).toBe("none");
    expect(returnWindow(item({ returnable: true }), today)).toBe("open");
    expect(returnWindow(item({ returnable: true, returnBy: "2026-12-31" }), today)).toBe("open");
    expect(returnWindow(item({ returnable: true, returnBy: "2026-11-08" }), today)).toBe("closing");
    expect(returnWindow(item({ returnable: true, returnBy: "2026-11-02" }), today)).toBe("closed");
  });
});

describe("returnableLines", () => {
  const p = purchase({
    items: [
      item({ returnable: true, returnBy: "2026-11-08", returnType: "credit-note" }),
      item({ name: "Soap" }),
      item({ name: "Old", returnable: true, returnBy: "2026-10-01" }),
    ],
  });

  it("lists only returnable lines in their window, net of earlier returns", () => {
    const lines = returnableLines(p, [ret({})], today);
    expect(lines.map((l) => [l.item.name, l.left])).toEqual([["Biscuits", 6]]);
    expect(returnableLines(p, [ret({}), ret({ id: "r2", amount: 120, items: [{ itemIndex: 0, productId: "p1", name: "Biscuits", quantity: 6, unitCost: 20 }] })], today)).toEqual([]);
  });

  it("warns about deadlines within a week", () => {
    expect(closingSoon([p], [], today).map((x) => x.line.item.name)).toEqual(["Biscuits"]);
  });
});

describe("credit notes in payables", () => {
  const p = purchase({ total: 200, items: [item({ quantity: 10, unitCost: 20 })] });

  it("reduce what is owed on that bill", () => {
    const pos = computePayables([], [p], [], [ret({})]);
    const row = [...pos.values()][0];
    expect(row).toMatchObject({ billed: 200, paid: 0, credited: 80, balance: 120 });
    expect(row.bills[0].outstanding).toBe(120);
  });

  it("leave the supplier owing you when the bill was paid", () => {
    const paid = purchase({ paymentMode: "Cash", total: 200 });
    const row = [...computePayables([], [paid], [], [ret({})]).values()][0];
    expect(row.balance).toBe(-80);
  });

  it("ignore replacements", () => {
    const row = [...computePayables([], [p], [], [ret({ mode: "replacement", status: "pending" })]).values()][0];
    expect(row.balance).toBe(200);
    expect(creditNoteTotal([ret({}), ret({ id: "r2", mode: "replacement" })])).toBe(80);
  });
});
