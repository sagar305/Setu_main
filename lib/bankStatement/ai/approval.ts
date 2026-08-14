// Turning a reviewed AI suggestion into something deterministic.
// ---------------------------------------------------------------------------
// The model never gets the last word. Every category it proposes is put in front
// of the CA, and what the CA does with it is what gets kept:
//
//   approve  →  a rule is written for that merchant, so the next statement is
//               answered by the rule and the model is never consulted again
//   correct  →  the same, with the CA's category instead of the model's
//
// Either way the outcome is a rule plus a remembered correction, which is why
// the second run over the same books is faster than the first: work moves out
// of the model and into deterministic matching, permanently.
//
// Pure — no model, no DOM, no storage. The provider does the saving.

import type { ClassificationRule, Transaction } from "@/lib/bankStatement/types";
import { merchantKey, splitCounterparty } from "@/lib/bankStatement/ai/narration";
import { normaliseText } from "@/lib/bankStatement/utils/text";

/** Priority for rules written by approving a suggestion. */
export const AI_RULE_PRIORITY = 50;

/**
 * A suggestion waiting for the CA: one merchant, however many transactions of
 * it there are, and what the model thinks they are.
 */
export type AiSuggestionGroup = {
  key: string;
  /** How the merchant reads in the queue. */
  label: string;
  /** Every pending transaction this covers — approving answers all of them. */
  transactions: Transaction[];
  /** What the model proposed, if it proposed anything. */
  suggestedCategory?: string;
  /** Best model score across the group. */
  score: number;
  similarity?: number;
};

/**
 * Which transactions the model is offered.
 *
 * Only the ones the deterministic pipeline could not answer. A rule — including
 * one written by approving a suggestion — a correction the CA taught us, or a
 * keyword pattern that already produced a category is never re-opened by a
 * model. That is the priority order the tool promises, and it is what makes the
 * second pass over the same books cheap: every approval permanently removes a
 * merchant from the model's workload.
 */
export function needsAiCategorisation(transaction: Transaction): boolean {
  switch (transaction.classificationSource) {
    case "MANUAL":
    case "RULE":
    case "MEMORY":
      return false;
    default:
      return !transaction.category;
  }
}

/**
 * A transaction the model has answered but the CA has not yet confirmed.
 * Nothing the model produces skips this state, whatever it scored.
 */
export function isAwaitingApproval(transaction: Transaction): boolean {
  return transaction.classificationSource === "AI" && transaction.needsReview === true;
}

/**
 * Group the pending suggestions by merchant, strongest first.
 *
 * Grouping is the point: fifty Swiggy rows are one decision, not fifty. The
 * queue asks about merchants, and one press resolves every row of that merchant.
 */
export function groupSuggestions(transactions: Transaction[]): AiSuggestionGroup[] {
  const groups = new Map<string, AiSuggestionGroup>();

  for (const transaction of transactions) {
    if (!isAwaitingApproval(transaction)) continue;

    const key = merchantKey(transaction.narration, transaction.transactionType);
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, {
        key,
        label: suggestionLabel(transaction),
        transactions: [transaction],
        suggestedCategory: transaction.category,
        score: transaction.confidence ?? 0,
        similarity: transaction.aiSimilarity,
      });
      continue;
    }

    existing.transactions.push(transaction);
    // Within a merchant, report the strongest evidence the model produced.
    if ((transaction.confidence ?? 0) > existing.score) {
      existing.score = transaction.confidence ?? 0;
      existing.suggestedCategory = transaction.category;
      existing.similarity = transaction.aiSimilarity;
    }
  }

  return [...groups.values()].sort(
    (a, b) => b.transactions.length - a.transactions.length || b.score - a.score
  );
}

function suggestionLabel(transaction: Transaction): string {
  const parsed = splitCounterparty(transaction.narration);
  return parsed.name ?? transaction.partyName ?? transaction.narration.slice(0, 48);
}

/**
 * The text a rule should match on for this merchant.
 *
 * It has to be something that genuinely appears in the narration — a canonical
 * merchant name we inferred ("Bajaj Finance" for "BAJAJ FIN") would match
 * nothing — and it has to be specific enough not to sweep up unrelated rows.
 * When there is no such anchor we return nothing and write no rule at all: a
 * rule built on a reference number would be worse than no rule.
 */
export function ruleAnchor(transaction: Transaction): string | undefined {
  const candidate = splitCounterparty(transaction.narration).name ?? transaction.partyName;
  if (!candidate) return undefined;

  const anchor = normaliseText(candidate);
  const letters = (anchor.match(/[A-Z]/g) ?? []).length;
  if (letters < 4) return undefined;
  if (!normaliseText(transaction.narration).includes(anchor)) return undefined;

  return anchor;
}

/**
 * Write the rule that an approval (or a correction) earns.
 *
 * Deliberately lower priority than the default a hand-written rule gets: the
 * CA's own rules were composed deliberately and must keep winning, while these
 * are one-merchant shortcuts accumulated by saying yes.
 */
export function aiApprovedRule(
  transaction: Transaction,
  categoryId: string,
  id: string,
  now: string
): ClassificationRule | null {
  const anchor = ruleAnchor(transaction);
  if (!anchor) return null;

  return {
    id,
    name: `${anchor.slice(0, 40)} → this category`,
    conditions: [
      { field: "narration", operator: "contains", value: anchor, values: [anchor] },
      // A merchant refunding money is not the same event as paying them, so the
      // rule is pinned to the side of the ledger it was approved on.
      { field: "direction", operator: "equals", value: transaction.transactionType },
    ],
    result: {
      category: categoryId,
      classificationType:
        transaction.classificationType === "UNKNOWN" ? undefined : transaction.classificationType,
    },
    priority: AI_RULE_PRIORITY,
    enabled: true,
    createdAt: now,
    origin: "AI_APPROVED",
  };
}

/**
 * Whether an existing rule already says this, so approving the same merchant
 * twice updates one rule instead of accumulating duplicates.
 */
export function findRuleForAnchor(
  rules: ClassificationRule[],
  anchor: string,
  direction: "DEBIT" | "CREDIT"
): ClassificationRule | undefined {
  return rules.find(
    (rule) =>
      rule.origin === "AI_APPROVED" &&
      rule.conditions.some(
        (condition) =>
          condition.field === "narration" &&
          condition.operator === "contains" &&
          (condition.values ?? [condition.value]).includes(anchor)
      ) &&
      rule.conditions.some(
        (condition) => condition.field === "direction" && condition.value === direction
      )
  );
}
