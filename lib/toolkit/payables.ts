// Supplier payables — the one place that decides what the shop still owes.
// ---------------------------------------------------------------------------
// Used by the Supplier Ledger and the Accounts Payable Aging report so both
// always agree on a supplier's balance and on which bills are still open.
//
// What counts as a bill (money owed to a supplier):
//   • a Purchase Register entry whose payment mode is "Credit"  — read live,
//     never copied, so deleting the purchase removes the bill too;
//   • a "bill" entry typed into the Supplier Ledger (opening balance, or a
//     bill that was never recorded in the register).
// Purchases paid by Cash / UPI / Card / Bank were settled at the counter and
// are not payables.
//
// How payments settle bills:
//   1. A payment linked to a specific bill (billRef) settles that bill first.
//   2. Every other payment — and any leftover from a linked one — settles the
//      supplier's OLDEST open bills first (FIFO), the way suppliers expect.
//   3. Anything still left is an advance with that supplier.

import type { Purchase, Supplier, SupplierLedgerEntry } from "@/lib/toolkit/types";

export const CREDIT_PAYMENT_MODE = "Credit";

const EPSILON = 0.005;

/** True when a purchase was bought on credit, i.e. it is still owed. */
export function isCreditPurchase(p: Pick<Purchase, "paymentMode">): boolean {
  return (p.paymentMode ?? "").trim().toLowerCase() === CREDIT_PAYMENT_MODE.toLowerCase();
}

export const purchaseBillRef = (purchaseId: string) => `p:${purchaseId}`;
export const entryBillRef = (entryId: string) => `e:${entryId}`;

/**
 * Turns (supplierId, name) into one stable key, so a purchase typed as
 * "Sharma Traders" without picking the saved supplier still lands on the
 * saved "Sharma Traders" — and two unsaved spellings stay separate.
 */
export function makePartyResolver(suppliers: Supplier[]) {
  const ids = new Set(suppliers.map((s) => s.id));
  const byName = new Map<string, string>();
  for (const s of suppliers) {
    const key = s.name.trim().toLowerCase();
    if (key && !byName.has(key)) byName.set(key, s.id);
  }
  return (supplierId: string | null | undefined, name: string): string => {
    if (supplierId && ids.has(supplierId)) return `id:${supplierId}`;
    const lower = (name ?? "").trim().toLowerCase();
    const matched = byName.get(lower);
    if (matched) return `id:${matched}`;
    if (supplierId) return `id:${supplierId}`;
    return `name:${lower || "(unknown)"}`;
  };
}

export type OpenBill = {
  /** "p:<purchaseId>" or "e:<entryId>". */
  ref: string;
  source: "purchase" | "ledger";
  partyKey: string;
  partyName: string;
  supplierId: string | null;
  date: string;
  number: string;
  amount: number;
  paid: number;
  outstanding: number;
};

export type SupplierPosition = {
  key: string;
  supplierId: string | null;
  name: string;
  phone: string;
  billed: number;
  paid: number;
  /** billed − paid. Positive = you owe them; negative = advance with them. */
  balance: number;
  bills: OpenBill[];
};

/** Every supplier's bills, payments and balance, with bill-wise outstanding. */
export function computePayables(
  suppliers: Supplier[],
  purchases: Purchase[],
  entries: SupplierLedgerEntry[],
): Map<string, SupplierPosition> {
  const resolve = makePartyResolver(suppliers);
  const positions = new Map<string, SupplierPosition>();

  const position = (key: string, supplierId: string | null, name: string) => {
    let row = positions.get(key);
    if (!row) {
      const saved = key.startsWith("id:")
        ? suppliers.find((s) => s.id === key.slice(3))
        : undefined;
      row = {
        key,
        supplierId: saved?.id ?? supplierId ?? null,
        name: saved?.name ?? (name.trim() || "Unknown supplier"),
        phone: saved?.phone ?? "",
        billed: 0,
        paid: 0,
        balance: 0,
        bills: [],
      };
      positions.set(key, row);
    }
    return row;
  };

  // Saved suppliers always appear, even with nothing owed.
  for (const s of suppliers) position(`id:${s.id}`, s.id, s.name);

  // 1. Bills.
  const billsByRef = new Map<string, OpenBill>();
  for (const p of purchases) {
    if (!isCreditPurchase(p) || !(p.total > 0)) continue;
    const key = resolve(p.supplierId, p.supplierName);
    const row = position(key, p.supplierId, p.supplierName);
    const bill: OpenBill = {
      ref: purchaseBillRef(p.id),
      source: "purchase",
      partyKey: key,
      partyName: row.name,
      supplierId: row.supplierId,
      date: p.date,
      number: p.billNumber,
      amount: p.total,
      paid: 0,
      outstanding: p.total,
    };
    row.bills.push(bill);
    row.billed += p.total;
    billsByRef.set(bill.ref, bill);
  }
  for (const e of entries) {
    if (e.type !== "bill" || !(e.amount > 0)) continue;
    const key = resolve(e.supplierId, e.supplierName);
    const row = position(key, e.supplierId, e.supplierName);
    const bill: OpenBill = {
      ref: entryBillRef(e.id),
      source: "ledger",
      partyKey: key,
      partyName: row.name,
      supplierId: row.supplierId,
      date: e.date,
      number: e.note,
      amount: e.amount,
      paid: 0,
      outstanding: e.amount,
    };
    row.bills.push(bill);
    row.billed += e.amount;
    billsByRef.set(bill.ref, bill);
  }
  for (const row of positions.values()) {
    row.bills.sort((a, b) => a.date.localeCompare(b.date) || a.ref.localeCompare(b.ref));
  }

  // 2. Payments: linked ones first, then FIFO for the rest.
  const payments = entries
    .filter((e) => e.type === "payment" && e.amount > 0)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  const leftovers = new Map<string, number>();

  for (const pay of payments) {
    const key = resolve(pay.supplierId, pay.supplierName);
    const row = position(key, pay.supplierId, pay.supplierName);
    row.paid += pay.amount;
    let remaining = pay.amount;
    const linked = pay.billRef ? billsByRef.get(pay.billRef) : undefined;
    if (linked && linked.partyKey === key) {
      const applied = Math.min(remaining, linked.outstanding);
      linked.paid += applied;
      linked.outstanding -= applied;
      remaining -= applied;
    }
    if (remaining > EPSILON) leftovers.set(key, (leftovers.get(key) ?? 0) + remaining);
  }

  for (const [key, amount] of leftovers) {
    const row = positions.get(key)!;
    let remaining = amount;
    for (const bill of row.bills) {
      if (remaining <= EPSILON) break;
      const applied = Math.min(remaining, bill.outstanding);
      bill.paid += applied;
      bill.outstanding -= applied;
      remaining -= applied;
    }
  }

  for (const row of positions.values()) {
    row.balance = row.billed - row.paid;
    for (const bill of row.bills) {
      if (bill.outstanding < EPSILON) bill.outstanding = 0;
    }
  }
  return positions;
}

/** Bills still (partly) unpaid, across every supplier, oldest first. */
export function openBills(positions: Map<string, SupplierPosition>): OpenBill[] {
  const all: OpenBill[] = [];
  for (const row of positions.values()) {
    for (const bill of row.bills) if (bill.outstanding > 0) all.push(bill);
  }
  return all.sort((a, b) => a.date.localeCompare(b.date));
}
