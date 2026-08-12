// Customer credit — the khata a restaurant keeps for its regulars.
//
// The rule this file exists to hold: a diner's creditBalance is always the sum
// of their ledger entries. The balance is stored on the diner so the floor can
// draw a badge without summing a year of history, and every write moves both
// together inside one transaction (see dineApplyCredit). Everything here is a
// pure function over those two, so the invariant can be checked at build time
// instead of hoped for.
//
// MONEY: paise, always. Positive means the diner owes the restaurant.

import type { DineCreditEntry, DineCustomer } from "./types";

/** What the ledger says a diner owes. The reconciliation side of the balance. */
export function ledgerBalance(entries: DineCreditEntry[], customerId: string): number {
  return entries
    .filter((entry) => entry.customerId === customerId)
    .reduce((sum, entry) => sum + entry.change, 0);
}

/**
 * How much more this diner may put on account, in paise.
 *
 * null means "no ceiling" — an owner who has set no limit is saying they will
 * judge it themselves, and a made-up number would only get in their way.
 */
export function headroom(customer: Pick<DineCustomer, "creditLimit" | "creditBalance">): number | null {
  if (customer.creditLimit <= 0) return null;
  return customer.creditLimit - customer.creditBalance;
}

/**
 * How far a charge would push this diner past their limit, in paise.
 *
 * 0 when it fits, or when no limit is set. Never negative — callers ask "by
 * how much is this over", and a negative answer to that reads as a bug at the
 * call site rather than as spare room.
 */
export function overLimitBy(
  customer: Pick<DineCustomer, "creditLimit" | "creditBalance">,
  amount: number
): number {
  const room = headroom(customer);
  if (room === null) return 0;
  return Math.max(amount - room, 0);
}

/** Whether a diner may be charged at all. A limit does not block, it warns. */
export function canTakeCredit(customer: Pick<DineCustomer, "creditAllowed">): boolean {
  return customer.creditAllowed;
}

/** Diners who owe something, most owed first. */
export function withOutstanding(customers: DineCustomer[]): DineCustomer[] {
  return customers
    .filter((customer) => customer.creditBalance > 0)
    .sort((a, b) => b.creditBalance - a.creditBalance);
}

/** Everything owed to the restaurant right now, in paise. */
export function totalOutstanding(customers: DineCustomer[]): number {
  return customers.reduce((sum, customer) => sum + Math.max(customer.creditBalance, 0), 0);
}

/**
 * How long the oldest still-unpaid charge has been outstanding, in days.
 *
 * Payments are applied oldest-first (there is no invoice-level allocation in a
 * khata — a diner hands over ₹2,000 against "what I owe"), so the age of the
 * debt is found by walking the ledger forward and seeing which charge the
 * running payments have not yet covered. Returns null when nothing is owed.
 */
export function oldestUnpaidDays(
  entries: DineCreditEntry[],
  customerId: string,
  now: Date = new Date()
): number | null {
  const mine = entries
    .filter((entry) => entry.customerId === customerId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  let credited = mine.reduce((sum, entry) => (entry.change < 0 ? sum - entry.change : sum), 0);

  for (const entry of mine) {
    if (entry.change <= 0) continue;
    if (credited >= entry.change) {
      credited -= entry.change;
      continue;
    }
    // This charge is the oldest one payments have not covered.
    const since = new Date(entry.createdAt).getTime();
    if (Number.isNaN(since)) return null;
    return Math.max(0, Math.floor((now.getTime() - since) / 86_400_000));
  }
  return null;
}

/** Ledger for one diner, newest first, for the history list. */
export function entriesFor(entries: DineCreditEntry[], customerId: string): DineCreditEntry[] {
  return entries
    .filter((entry) => entry.customerId === customerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * A reminder to send a diner over WhatsApp.
 *
 * Written to be sent as-is by someone who is busy: what is owed, since when,
 * and how to pay. No guilt and no threat — this goes to a regular the
 * restaurant wants back next week.
 */
export function creditReminderMessage(input: {
  businessName: string;
  guestName: string;
  balance: string;
  days: number | null;
  upiId?: string;
}): string {
  const lines = [
    `Namaste ${input.guestName || "ji"},`,
    "",
    `This is a gentle reminder from ${input.businessName}.`,
    `Your running account stands at ${input.balance}${
      input.days !== null && input.days > 0 ? `, oldest since ${input.days} days` : ""
    }.`,
  ];
  if (input.upiId) {
    lines.push("", `You can pay by UPI to ${input.upiId}, or settle on your next visit.`);
  } else {
    lines.push("", "You can settle it on your next visit — no hurry.");
  }
  lines.push("", "Thank you!");
  return lines.join("\n");
}
