// Bank ↔ books matching (spec §17).
// ---------------------------------------------------------------------------
// Three levels, tried in order, each entry consumed once:
//
//   1  exact:  same date, same amount, same reference
//   2  window: date ± 2 days, same amount
//   3  fuzzy:  date ± 3 days, same amount, similar narration
//
// Anything left over is UNMATCHED_BANK or UNMATCHED_BOOK. Amount-only near
// misses within the window are reported as AMOUNT_MISMATCH rather than being
// silently matched, because a CA needs to see the difference.

import type {
  LedgerEntry,
  MatchStatus,
  ReconciliationMatch,
  Transaction,
} from "@/lib/bankStatement/types";
import { daysBetween } from "@/lib/bankStatement/utils/dates";
import { amountsEqual, round2 } from "@/lib/bankStatement/utils/numbers";
import { normaliseText, similarity } from "@/lib/bankStatement/utils/text";

const FUZZY_THRESHOLD = 0.35;
const MISMATCH_TOLERANCE = 0.1; // fraction of the amount

let matchCounter = 0;
function matchId(): string {
  matchCounter += 1;
  return `match-${Date.now().toString(36)}-${matchCounter.toString(36)}`;
}

/** Signed amount, so a bank debit only ever matches a book debit. */
function signedAmount(row: { debit: number; credit: number }): number {
  return round2(row.credit - row.debit);
}

function reference(row: { referenceNumber?: string; reference?: string; chequeNumber?: string }): string {
  const value =
    ("referenceNumber" in row ? row.referenceNumber : undefined) ??
    ("reference" in row ? row.reference : undefined) ??
    row.chequeNumber ??
    "";
  return normaliseText(value);
}

export function reconcile(
  transactions: Transaction[],
  entries: LedgerEntry[]
): ReconciliationMatch[] {
  const matches: ReconciliationMatch[] = [];
  const usedBank = new Set<string>();
  const usedBook = new Set<string>();

  const push = (
    status: MatchStatus,
    bank: Transaction | undefined,
    book: LedgerEntry | undefined,
    level: 1 | 2 | 3 | undefined,
    score?: number
  ) => {
    if (bank) usedBank.add(bank.id);
    if (book) usedBook.add(book.id);
    matches.push({
      id: matchId(),
      status,
      bankTransactionId: bank?.id,
      ledgerEntryId: book?.id,
      level,
      score,
      difference:
        bank && book ? round2(signedAmount(bank) - signedAmount(book)) : undefined,
    });
  };

  // Level 1 — date + amount + reference.
  for (const bank of transactions) {
    if (usedBank.has(bank.id)) continue;
    const bankReference = reference(bank);
    if (!bankReference) continue;

    const book = entries.find(
      (entry) =>
        !usedBook.has(entry.id) &&
        entry.date === bank.date &&
        amountsEqual(signedAmount(entry), signedAmount(bank)) &&
        reference(entry) === bankReference
    );
    if (book) push("MATCHED", bank, book, 1, 1);
  }

  // Level 2 — amount exact, date within two days.
  for (const bank of transactions) {
    if (usedBank.has(bank.id)) continue;
    const book = entries.find(
      (entry) =>
        !usedBook.has(entry.id) &&
        Math.abs(daysBetween(bank.date, entry.date)) <= 2 &&
        amountsEqual(signedAmount(entry), signedAmount(bank))
    );
    if (book) {
      const exactDate = book.date === bank.date;
      push(exactDate ? "MATCHED" : "LIKELY_MATCH", bank, book, 2, exactDate ? 0.95 : 0.8);
    }
  }

  // Level 3 — amount exact, date within three days, narration similar.
  for (const bank of transactions) {
    if (usedBank.has(bank.id)) continue;
    let best: { entry: LedgerEntry; score: number } | null = null;
    for (const entry of entries) {
      if (usedBook.has(entry.id)) continue;
      if (Math.abs(daysBetween(bank.date, entry.date)) > 3) continue;
      if (!amountsEqual(signedAmount(entry), signedAmount(bank))) continue;
      const score = similarity(bank.narration, entry.narration);
      if (score >= FUZZY_THRESHOLD && (!best || score > best.score)) best = { entry, score };
    }
    if (best) push("LIKELY_MATCH", bank, best.entry, 3, round2(best.score));
  }

  // Near misses on amount — surfaced, never auto-matched.
  for (const bank of transactions) {
    if (usedBank.has(bank.id)) continue;
    const bankAmount = signedAmount(bank);
    const book = entries.find((entry) => {
      if (usedBook.has(entry.id)) return false;
      if (Math.abs(daysBetween(bank.date, entry.date)) > 2) return false;
      const entryAmount = signedAmount(entry);
      if (Math.sign(entryAmount) !== Math.sign(bankAmount)) return false;
      const difference = Math.abs(entryAmount - bankAmount);
      return difference > 0 && difference <= Math.abs(bankAmount) * MISMATCH_TOLERANCE;
    });
    if (book) push("AMOUNT_MISMATCH", bank, book, undefined);
  }

  for (const bank of transactions) {
    if (!usedBank.has(bank.id)) push("UNMATCHED_BANK", bank, undefined, undefined);
  }
  for (const entry of entries) {
    if (!usedBook.has(entry.id)) push("UNMATCHED_BOOK", undefined, entry, undefined);
  }

  return matches;
}

export type ReconciliationSummary = {
  matched: number;
  likely: number;
  unmatchedBank: number;
  unmatchedBook: number;
  amountMismatch: number;
  bankTotal: number;
  bookTotal: number;
  difference: number;
};

export function summarise(
  matches: ReconciliationMatch[],
  transactions: Transaction[],
  entries: LedgerEntry[]
): ReconciliationSummary {
  const count = (status: MatchStatus) =>
    matches.filter((match) => match.status === status && !match.rejected).length;

  const bankTotal = round2(transactions.reduce((sum, t) => sum + signedAmount(t), 0));
  const bookTotal = round2(entries.reduce((sum, e) => sum + signedAmount(e), 0));

  return {
    matched: count("MATCHED") + matches.filter((m) => m.confirmed && m.status === "LIKELY_MATCH").length,
    likely: matches.filter((m) => m.status === "LIKELY_MATCH" && !m.confirmed && !m.rejected).length,
    unmatchedBank: count("UNMATCHED_BANK"),
    unmatchedBook: count("UNMATCHED_BOOK"),
    amountMismatch: count("AMOUNT_MISMATCH"),
    bankTotal,
    bookTotal,
    difference: round2(bankTotal - bookTotal),
  };
}
