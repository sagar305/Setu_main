// Duplicate detection, within and across statements.
// ---------------------------------------------------------------------------
// Decision 16: duplicates stay visible but are excluded from analytical totals
// by default, and the CA can override either way per transaction.
//
// Decision 13: a CA importing Jan–Mar and Apr–Jun of the same account will hit
// overlapping periods, so this runs across the whole session, not per file.

import type { Transaction } from "@/lib/bankStatement/types";
import { similarity } from "@/lib/bankStatement/utils/text";

const SIMILARITY_THRESHOLD = 0.6;

/** Same day + same amounts, as a cheap bucket key before the fuzzy compare. */
function bucketKey(transaction: Transaction): string {
  return `${transaction.date}|${transaction.debit.toFixed(2)}|${transaction.credit.toFixed(2)}`;
}

/**
 * Flag duplicates in place and return how many were found. The first
 * occurrence is left clean; later ones point back at it via `duplicateOfId`.
 * A CA override (`duplicateOverride`) is never touched.
 */
export function markDuplicates(transactions: Transaction[]): number {
  const buckets = new Map<string, Transaction[]>();
  let found = 0;

  for (const transaction of transactions) {
    const key = bucketKey(transaction);
    const bucket = buckets.get(key);
    if (!bucket) {
      buckets.set(key, [transaction]);
      continue;
    }

    const original = bucket.find((candidate) => isDuplicatePair(candidate, transaction));
    if (original) {
      transaction.isDuplicate = true;
      transaction.duplicateOfId = original.id;
      found += 1;
    }
    bucket.push(transaction);
  }

  return found;
}

/**
 * Two rows in the same date+amount bucket are duplicates when the reference
 * matches, or — with no reference to go on — the narrations are close enough.
 */
function isDuplicatePair(a: Transaction, b: Transaction): boolean {
  if (a.referenceNumber && b.referenceNumber) {
    return a.referenceNumber === b.referenceNumber;
  }
  return similarity(a.narration, b.narration) >= SIMILARITY_THRESHOLD;
}

/** Does this transaction count towards totals? Honours the CA's override. */
export function countsTowardsTotals(
  transaction: Transaction,
  includeDuplicates: boolean
): boolean {
  if (transaction.duplicateOverride === "EXCLUDE") return false;
  if (transaction.duplicateOverride === "KEEP") return true;
  if (transaction.isDuplicate && !includeDuplicates) return false;
  return true;
}

/** The transactions totals should be computed from. */
export function includedTransactions(
  transactions: Transaction[],
  includeDuplicates: boolean
): Transaction[] {
  return transactions.filter((transaction) => countsTowardsTotals(transaction, includeDuplicates));
}
