// User rules — deterministic, ordered, and entirely local (spec §12).
// A rule fires only when every one of its conditions holds. Rules are tried in
// priority order, highest first, and the first match wins.

import type {
  ClassificationRule,
  RuleCondition,
  Transaction,
} from "@/lib/bankStatement/types";
import { normaliseText } from "@/lib/bankStatement/utils/text";

function fieldValue(transaction: Transaction, condition: RuleCondition): string {
  switch (condition.field) {
    case "narration":
      return normaliseText(transaction.narration);
    case "reference":
      return normaliseText(transaction.referenceNumber ?? transaction.chequeNumber ?? "");
    case "direction":
      return transaction.transactionType;
    case "date":
      return transaction.date;
    case "amount":
      return String(transaction.debit > 0 ? transaction.debit : transaction.credit);
    default:
      return "";
  }
}

export function conditionMatches(transaction: Transaction, condition: RuleCondition): boolean {
  const value = fieldValue(transaction, condition);
  const target = condition.field === "narration" || condition.field === "reference" || condition.field === "direction"
    ? normaliseText(condition.value)
    : condition.value.trim();

  switch (condition.operator) {
    case "contains":
      return target !== "" && value.includes(target);
    case "startsWith":
      return target !== "" && value.startsWith(target);
    case "endsWith":
      return target !== "" && value.endsWith(target);
    case "equals":
      return value === target;
    case "greaterThan":
      return Number(value) > Number(target);
    case "lessThan":
      return Number(value) < Number(target);
    case "between": {
      if (condition.field === "date") {
        return value >= target && value <= (condition.value2 ?? "").trim();
      }
      const numeric = Number(value);
      return numeric >= Number(target) && numeric <= Number(condition.value2 ?? target);
    }
    default:
      return false;
  }
}

export function ruleMatches(transaction: Transaction, rule: ClassificationRule): boolean {
  if (!rule.enabled) return false;
  if (rule.conditions.length === 0) return false;
  return rule.conditions.every((condition) => conditionMatches(transaction, condition));
}

/** Highest priority first; ties broken by creation order for stability. */
export function sortRules(rules: ClassificationRule[]): ClassificationRule[] {
  return [...rules].sort((a, b) => b.priority - a.priority || a.createdAt.localeCompare(b.createdAt));
}

export function findMatchingRule(
  transaction: Transaction,
  rules: ClassificationRule[]
): ClassificationRule | null {
  for (const rule of sortRules(rules)) {
    if (ruleMatches(transaction, rule)) return rule;
  }
  return null;
}

/** How many of the given transactions a rule would claim — shown in the editor. */
export function countMatches(transactions: Transaction[], rule: ClassificationRule): number {
  let count = 0;
  for (const transaction of transactions) if (ruleMatches(transaction, rule)) count += 1;
  return count;
}

/**
 * Build a starter rule from a transaction ("create rule from this transaction",
 * spec §14). The CA edits it before saving — this is a draft, not a commitment.
 */
export function ruleFromTransaction(
  transaction: Transaction,
  id: string,
  now: string
): ClassificationRule {
  const anchor = transaction.partyName ?? transaction.narration.slice(0, 24);
  return {
    id,
    name: `Rule for ${anchor}`.slice(0, 60),
    conditions: [
      { field: "narration", operator: "contains", value: anchor.toUpperCase() },
    ],
    result: {
      category: transaction.category,
      subCategory: transaction.subCategory,
      partyName: transaction.partyName,
      classificationType:
        transaction.classificationType === "UNKNOWN" ? undefined : transaction.classificationType,
      gstRelevant: transaction.gstRelevant,
    },
    priority: 100,
    enabled: true,
    createdAt: now,
  };
}
