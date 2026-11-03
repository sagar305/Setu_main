// Cash Book rows that come from other tools.
//
// The Cash Book never copies these into its own store: it reads them live from
// their source records, the same way the Supplier Ledger reads credit
// purchases. So a sale cancelled in the POS, or an expense deleted in the
// Expense Tracker, can never leave a stale cash entry behind, and nothing is
// ever counted twice.
//
//   money in  — completed POS sales (except credit/udhaar sales), and
//               payments received from customers in the Customer Ledger
//   money out — purchases not bought on credit, Expense Tracker expenses,
//               and payments made to suppliers in the Supplier Ledger
//
// Credit sales and credit purchases move no money on the day; the money moves
// when the customer pays or the supplier is paid, and those payments are what
// appear here.

import type { Order } from "@/lib/pos/types";
import { operatingExpenses } from "@/lib/toolkit/profit";
import type {
  CashEntry,
  Expense,
  LedgerEntry,
  Purchase,
  SupplierLedgerEntry,
} from "@/lib/toolkit/types";

export type CashSource =
  | "manual"
  | "pos-sale"
  | "customer-payment"
  | "purchase"
  | "expense"
  | "supplier-payment";

export type CashRow = {
  id: string;
  date: string; // ISO date (yyyy-mm-dd)
  type: "in" | "out";
  amount: number;
  description: string;
  /** How the money moved (Cash / UPI / Card …); blank when not recorded. */
  mode: string;
  source: CashSource;
  createdAt: string;
};

export type CashSources = {
  orders?: Order[];
  ledger?: LedgerEntry[];
  purchases?: Purchase[];
  expenses?: Expense[];
  supplierLedger?: SupplierLedgerEntry[];
};

/** The POS stores credit (udhaar) sales with this payment method id. */
const CREDIT_METHOD_ID = "credit";

const isCredit = (mode: string | undefined) => (mode ?? "").trim().toLowerCase() === "credit";

/** Manual Cash Book entries, as rows. */
export function manualCashRows(entries: CashEntry[]): CashRow[] {
  return entries.map((e) => ({
    id: e.id,
    date: e.date,
    type: e.type,
    amount: e.amount,
    description: e.description,
    mode: "",
    source: "manual",
    createdAt: e.createdAt,
  }));
}

/** Money in and out recorded by the POS and the other toolkit tools. */
export function derivedCashRows(src: CashSources): CashRow[] {
  const rows: CashRow[] = [];
  const purchases = src.purchases ?? [];

  for (const o of src.orders ?? []) {
    if (o.status !== "completed" || o.paymentMethodId === CREDIT_METHOD_ID) continue;
    if (!(o.total > 0)) continue;
    rows.push({
      id: `pos:${o.id}`,
      date: o.date.slice(0, 10),
      type: "in",
      amount: o.total,
      description: `POS sale ${o.invoiceNumber}${o.customerName ? ` — ${o.customerName}` : ""}`,
      mode: o.paymentMethodName ?? "",
      source: "pos-sale",
      createdAt: o.createdAt || o.date,
    });
  }

  for (const l of src.ledger ?? []) {
    if (l.type !== "payment" || !(l.amount > 0)) continue;
    rows.push({
      id: `cl:${l.id}`,
      date: l.date,
      type: "in",
      amount: l.amount,
      description: `Payment from ${l.customerName || "customer"}${l.note ? ` — ${l.note}` : ""}`,
      mode: "",
      source: "customer-payment",
      createdAt: l.createdAt,
    });
  }

  for (const p of purchases) {
    if (isCredit(p.paymentMode) || !(p.total > 0)) continue;
    rows.push({
      id: `pur:${p.id}`,
      date: p.date,
      type: "out",
      amount: p.total,
      description: `Purchase${p.billNumber ? ` ${p.billNumber}` : ""} from ${p.supplierName || "supplier"}`,
      mode: p.paymentMode,
      source: "purchase",
      createdAt: p.createdAt,
    });
  }

  // Older Purchase Register versions mirrored purchases into expenses; those
  // are already counted above as purchases.
  for (const e of operatingExpenses(src.expenses ?? [], purchases)) {
    if (isCredit(e.paymentMode) || !(e.amount > 0)) continue;
    rows.push({
      id: `exp:${e.id}`,
      date: e.date,
      type: "out",
      amount: e.amount,
      description: `${e.category}${e.description ? ` — ${e.description}` : ""}`,
      mode: e.paymentMode,
      source: "expense",
      createdAt: e.createdAt,
    });
  }

  for (const s of src.supplierLedger ?? []) {
    if (s.type !== "payment" || !(s.amount > 0)) continue;
    rows.push({
      id: `sl:${s.id}`,
      date: s.date,
      type: "out",
      amount: s.amount,
      description: `Payment to ${s.supplierName || "supplier"}${s.note ? ` — ${s.note}` : ""}`,
      mode: s.paymentMode ?? "",
      source: "supplier-payment",
      createdAt: s.createdAt,
    });
  }

  return rows;
}

/**
 * Whether a row is physical cash. Manual entries and rows with no recorded
 * mode count as cash; everything else must say "Cash".
 */
export function isCashMode(row: CashRow): boolean {
  if (row.source === "manual" || !row.mode.trim()) return true;
  return row.mode.trim().toLowerCase() === "cash";
}
