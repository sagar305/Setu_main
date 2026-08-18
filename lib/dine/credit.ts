// Credit (udhaar) for Free Dine.
//
// There is no khata inside Free Dine. What a diner owes lives in the shared
// Customer Ledger — the same book the Browser Based POS, the Invoice Generator
// and the Customer Ledger tool all read and write — so a regular who runs a tab
// at the counter and at the table has one balance, not two that disagree.
//
// That means everything here is a pure function over LedgerEntry rows fetched
// from the workspace, plus the one builder that turns a bill into an entry.
// Free Dine stores no balance of its own; there is nothing to drift.
//
// MONEY: the shared ledger is in major units (rupees), because every other
// toolkit tool is. Free Dine is in paise. The conversion happens at this
// boundary and nowhere else — see ledgerAmountOf / toPaiseFromLedger.

import { generateId, nowIso } from "./types";
import { toMajor, toPaise } from "./money";
import type { LedgerEntry } from "@/lib/toolkit/types";

/** Free Dine's paise turned into the rupees the shared ledger speaks. */
export function ledgerAmountOf(paise: number): number {
  return toMajor(paise);
}

/** And back, for showing a shared balance inside Free Dine. */
export function toPaiseFromLedger(amount: number): number {
  return toPaise(amount);
}

/**
 * What a diner owes, in paise.
 *
 * "credit" means they owe more, "payment" means they paid — the Customer
 * Ledger's own convention, reproduced exactly so the two never disagree about
 * the sign of anything.
 */
export function balanceOf(entries: LedgerEntry[], customerId: string): number {
  const total = entries
    .filter((entry) => entry.customerId === customerId)
    .reduce((sum, entry) => sum + (entry.type === "credit" ? entry.amount : -entry.amount), 0);
  return toPaiseFromLedger(total);
}

/** Every diner with something outstanding, and what, in paise. */
export function balancesByCustomer(entries: LedgerEntry[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const entry of entries) {
    const signed = entry.type === "credit" ? entry.amount : -entry.amount;
    totals.set(entry.customerId, (totals.get(entry.customerId) ?? 0) + signed);
  }
  const out = new Map<string, number>();
  for (const [id, amount] of totals) out.set(id, toPaiseFromLedger(amount));
  return out;
}

/** Everything owed to the business right now, in paise. Credits never net off. */
export function totalOutstanding(entries: LedgerEntry[]): number {
  let total = 0;
  for (const balance of balancesByCustomer(entries).values()) {
    if (balance > 0) total += balance;
  }
  return total;
}

/**
 * How long the oldest still-unpaid charge has been outstanding, in days.
 *
 * A khata has no invoice-level allocation — a diner hands over ₹2,000 against
 * "what I owe" — so payments are applied oldest-first and the age of the debt
 * is found by walking forward to the first charge they have not covered.
 * Returns null when nothing is owed.
 */
export function oldestUnpaidDays(
  entries: LedgerEntry[],
  customerId: string,
  now: Date = new Date()
): number | null {
  const mine = entries
    .filter((entry) => entry.customerId === customerId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  let paid = mine.reduce((sum, entry) => (entry.type === "payment" ? sum + entry.amount : sum), 0);

  for (const entry of mine) {
    if (entry.type !== "credit") continue;
    if (paid >= entry.amount) {
      paid -= entry.amount;
      continue;
    }
    const since = new Date(entry.createdAt).getTime();
    if (Number.isNaN(since)) return null;
    return Math.max(0, Math.floor((now.getTime() - since) / 86_400_000));
  }
  return null;
}

/**
 * The ledger entry a bill settled on account becomes.
 *
 * Stamped as Free Dine's work so the Customer Ledger can show where a line came
 * from, and noted with the bill label so a disagreement can be traced back to
 * the meal rather than to a number.
 */
export function billLedgerEntry(input: {
  customerId: string;
  customerName: string;
  amountPaise: number;
  billLabel: string;
}): LedgerEntry {
  const at = nowIso();
  return {
    id: generateId(),
    customerId: input.customerId,
    customerName: input.customerName,
    type: "credit",
    amount: ledgerAmountOf(input.amountPaise),
    note: input.billLabel ? `Free Dine bill ${input.billLabel}` : "Free Dine bill",
    date: at.slice(0, 10),
    createdByTool: "free-dine",
    createdAt: at,
  };
}

/** The same, for a booking advance a regular puts on their account. */
export function depositLedgerEntry(input: {
  customerId: string;
  customerName: string;
  amountPaise: number;
  when: string;
}): LedgerEntry {
  const at = nowIso();
  return {
    id: generateId(),
    customerId: input.customerId,
    customerName: input.customerName,
    type: "credit",
    amount: ledgerAmountOf(input.amountPaise),
    note: `Free Dine booking advance${input.when ? ` · ${input.when}` : ""}`,
    date: at.slice(0, 10),
    createdByTool: "free-dine",
    createdAt: at,
  };
}
