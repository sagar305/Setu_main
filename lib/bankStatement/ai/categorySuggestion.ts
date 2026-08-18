// Turning a cluster of unplaceable transactions into a category to propose.
// ---------------------------------------------------------------------------
// The model can tell us these six merchants belong together. It cannot tell us
// what to call them: it is an embedding model, it has no decoder, and inventing
// a name is not something it is able to do. So the name is *extracted* from the
// transactions rather than generated — the word the merchants themselves have
// in common — and where there is no such word we propose nothing and leave the
// field blank for the CA rather than offering them "Category 2".
//
// That division matters. Everything in this file is derived from text the CA
// already has in front of them, so a proposal can always be checked against the
// list of merchants shown beside it.
//
// Pure — no model, no DOM.

import type { CategoryGroup, Transaction } from "@/lib/bankStatement/types";
import { merchantContext, merchantKey, splitCounterparty } from "@/lib/bankStatement/ai/narration";
import { normaliseText, titleCase } from "@/lib/bankStatement/utils/text";

export type CategorySuggestion = {
  /** Stable identity for the proposal itself, not for the category. */
  key: string;
  /** Proposed name, or "" when nothing in the data reads like one. */
  name: string;
  /** Pre-filled description — what the model will match against later. */
  description: string;
  /** Merchant names, which become the category's examples. */
  examples: string[];
  group: CategoryGroup;
  transactions: Transaction[];
  merchantCount: number;
};

/**
 * A transaction the model was shown and declined to place: it has a similarity
 * on record, but no category and nothing else claimed it. This is the pool the
 * suggestions are drawn from.
 */
export function isUnmatchedByAi(transaction: Transaction): boolean {
  return (
    !transaction.category &&
    transaction.aiSimilarity !== undefined &&
    transaction.classificationSource === "UNCLASSIFIED"
  );
}

/** Corporate furniture — never the name of a kind of spending. */
const NOT_A_NAME = new Set([
  "PVT", "PRIVATE", "LTD", "LIMITED", "LLP", "INC", "CORP", "CORPORATION", "COMPANY",
  "INDIA", "INDIAN", "BHARAT", "COM", "CO", "ONLINE", "PAYMENT", "PAYMENTS", "PAY",
  "THE", "AND", "FOR", "NEW", "SHRI", "SRI", "MR", "MRS", "M/S", "MS",
  "UPI", "IMPS", "NEFT", "RTGS", "POS", "ATM", "REF", "TXN", "DR", "CR",
]);

function nameTokens(value: string): string[] {
  return normaliseText(value)
    .split(/[^A-Z]+/)
    .filter((token) => token.length >= 3 && !NOT_A_NAME.has(token));
}

/** Every counterparty in the cluster, deduplicated, in first-seen order. */
export function clusterMerchants(transactions: Transaction[]): string[] {
  const seen = new Map<string, string>();

  for (const transaction of transactions) {
    const known = merchantContext(transaction.narration);
    const parsed = splitCounterparty(transaction.narration);
    const name = known?.canonical ?? parsed.name ?? transaction.partyName;
    if (!name) continue;
    const key = normaliseText(name);
    if (!seen.has(key)) seen.set(key, name);
  }

  return [...seen.values()];
}

/**
 * The word these merchants share, if they share one.
 *
 * "Sharma Salon", "Glow Salon & Spa" and "Urban Salon" have "Salon" in common,
 * and that is a better category name than anything we could invent. It has to
 * appear in most of the cluster to count — a word two of six merchants happen
 * to use is a coincidence, and naming a category after it would be worse than
 * leaving the field empty.
 */
export function sharedName(merchants: string[]): string {
  if (merchants.length < 2) return "";

  const counts = new Map<string, number>();
  for (const merchant of merchants) {
    // Once per merchant, so a repeated word inside one name cannot carry it.
    for (const token of new Set(nameTokens(merchant))) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }

  const needed = Math.max(2, Math.ceil(merchants.length * 0.6));
  let best = "";
  let bestCount = 0;

  for (const [token, count] of counts) {
    if (count < needed) continue;
    if (count > bestCount || (count === bestCount && token.length > best.length)) {
      best = token;
      bestCount = count;
    }
  }

  return best ? titleCase(best) : "";
}

/** Debits are spending, credits are receipts. A mixed cluster follows the majority. */
function groupFor(transactions: Transaction[]): CategoryGroup {
  const debits = transactions.filter((t) => t.transactionType === "DEBIT").length;
  return debits >= transactions.length - debits ? "EXPENSE" : "INCOME";
}

/**
 * Pre-fill the description, which is the part that actually matters.
 *
 * A category is matched by its description, not its name, so a category created
 * here with an empty one would be nearly unmatchable — the very outcome the
 * feature exists to fix. Listing the merchants gives the model something real
 * to compare against from the first statement onward, and gives the CA a
 * sentence to edit rather than a blank box to fill.
 */
export function suggestedDescription(merchants: string[], group: CategoryGroup): string {
  if (merchants.length === 0) return "";
  const listed = merchants.slice(0, 6).join(", ");
  return group === "INCOME"
    ? `Money received from ${listed}`
    : `Payments to ${listed}`;
}

/** Build the proposal for one cluster of transactions. */
export function buildSuggestion(transactions: Transaction[]): CategorySuggestion {
  const merchants = clusterMerchants(transactions);
  const group = groupFor(transactions);

  return {
    key: transactions
      .map((transaction) => merchantKey(transaction.narration, transaction.transactionType))
      .sort()
      .join("|")
      .slice(0, 120),
    name: sharedName(merchants),
    description: suggestedDescription(merchants, group),
    examples: merchants.slice(0, 6),
    group,
    transactions,
    merchantCount: merchants.length,
  };
}
