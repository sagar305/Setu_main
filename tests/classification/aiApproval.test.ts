// Approving a suggestion, and what it buys.
// ---------------------------------------------------------------------------
// The point of the review queue is not politeness — it is that saying yes turns
// a model answer into a rule, and a rule means the model is never asked about
// that merchant again. These tests pin that: the rule matches what it was
// approved on, it does not match what it was not, and it beats the model by
// construction because rules run first.

import { describe, expect, it } from "vitest";
import type { ClassificationRule, Transaction } from "@/lib/bankStatement/types";
import {
  AI_RULE_PRIORITY,
  aiApprovedRule,
  findRuleForAnchor,
  groupSuggestions,
  isAwaitingApproval,
  needsAiCategorisation,
  ruleAnchor,
} from "@/lib/bankStatement/ai/approval";
import { findMatchingRule, ruleMatches } from "@/lib/bankStatement/classification/rulesEngine";
import { classify } from "@/lib/bankStatement/classification/classifier";

const NOW = "2025-04-01T00:00:00.000Z";

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "t1",
    statementId: "s1",
    date: "2025-04-01",
    narration: "UPI/9033/BigBasket/BBNow",
    debit: 1200,
    credit: 0,
    currency: "INR",
    transactionType: "DEBIT",
    classificationType: "UNKNOWN",
    classificationSource: "UNCLASSIFIED",
    createdAt: NOW,
    ...overrides,
  };
}

/** A row as the AI pass leaves it: suggested, and waiting for the CA. */
function suggested(overrides: Partial<Transaction> = {}): Transaction {
  return transaction({
    category: "food-and-groceries",
    classificationSource: "AI",
    confidence: 88,
    aiSimilarity: 0.54,
    needsReview: true,
    ...overrides,
  });
}

describe("every AI answer waits for the CA", () => {
  it("counts a suggestion as unfinished however well it scored", () => {
    expect(isAwaitingApproval(suggested({ confidence: 99 }))).toBe(true);
    expect(isAwaitingApproval(suggested({ confidence: 71 }))).toBe(true);
  });

  it("stops counting it once the CA has settled it", () => {
    expect(isAwaitingApproval(suggested({ classificationSource: "RULE", needsReview: false }))).toBe(false);
    expect(isAwaitingApproval(suggested({ classificationSource: "MANUAL", needsReview: false }))).toBe(false);
  });

  it("leaves a rule, a pattern and a manual call alone", () => {
    expect(isAwaitingApproval(transaction({ classificationSource: "RULE", category: "rent" }))).toBe(false);
    expect(isAwaitingApproval(transaction({ classificationSource: "HEURISTIC", category: "rent" }))).toBe(false);
  });
});

describe("the queue asks about merchants, not rows", () => {
  const rows = [
    suggested({ id: "a", narration: "UPI/9033/BigBasket/BBNow" }),
    suggested({ id: "b", narration: "UPI/4471/BigBasket/Order", confidence: 91 }),
    suggested({ id: "c", narration: "UPI/5512/Netflix.com/Monthly", category: "entertainment", confidence: 80 }),
    transaction({ id: "d", category: "rent", classificationSource: "RULE" }),
  ];

  it("collapses repeats of one merchant into a single decision", () => {
    const groups = groupSuggestions(rows);
    expect(groups.length).toBe(2);

    const groceries = groups.find((group) => group.suggestedCategory === "food-and-groceries");
    expect(groceries?.transactions.map((t) => t.id).sort()).toEqual(["a", "b"]);
  });

  it("reports the strongest score the merchant produced", () => {
    const groceries = groupSuggestions(rows).find((g) => g.suggestedCategory === "food-and-groceries");
    expect(groceries?.score).toBe(91);
  });

  it("puts the merchant that clears the most rows first", () => {
    expect(groupSuggestions(rows)[0].transactions.length).toBe(2);
  });

  it("ignores everything that is not awaiting approval", () => {
    expect(groupSuggestions(rows).flatMap((g) => g.transactions).some((t) => t.id === "d")).toBe(false);
  });
});

describe("the rule an approval writes", () => {
  it("matches on text that is actually in the narration", () => {
    const anchor = ruleAnchor(suggested());
    expect(anchor).toBe("BIGBASKET");
    expect("UPI/9033/BigBasket/BBNow".toUpperCase()).toContain(anchor as string);
  });

  it("declines to write a rule on a narration with no merchant in it", () => {
    expect(ruleAnchor(suggested({ narration: "4471/99201/00" }))).toBeUndefined();
    expect(aiApprovedRule(suggested({ narration: "4471/99201/00" }), "purchases", "r1", NOW)).toBeNull();
  });

  it("claims the merchant it was approved on", () => {
    const rule = aiApprovedRule(suggested(), "food-and-groceries", "r1", NOW) as ClassificationRule;
    expect(ruleMatches(transaction({ narration: "UPI/1188/BIGBASKET/Weekly" }), rule)).toBe(true);
    expect(rule.result.category).toBe("food-and-groceries");
    expect(rule.origin).toBe("AI_APPROVED");
  });

  it("does not claim a different merchant", () => {
    const rule = aiApprovedRule(suggested(), "food-and-groceries", "r1", NOW) as ClassificationRule;
    expect(ruleMatches(transaction({ narration: "UPI/5512/Netflix.com/Monthly" }), rule)).toBe(false);
  });

  // A refund from a shop is not a purchase at it, so the rule is pinned to the
  // side of the ledger the CA actually looked at.
  it("does not claim the same merchant on the other side of the ledger", () => {
    const rule = aiApprovedRule(suggested(), "food-and-groceries", "r1", NOW) as ClassificationRule;
    const refund = transaction({
      narration: "UPI/9033/BigBasket/Refund",
      transactionType: "CREDIT",
      debit: 0,
      credit: 1200,
    });
    expect(ruleMatches(refund, rule)).toBe(false);
  });

  it("sits below a rule the CA wrote by hand", () => {
    const approved = aiApprovedRule(suggested(), "food-and-groceries", "r1", NOW) as ClassificationRule;
    const handWritten: ClassificationRule = {
      id: "mine",
      name: "Groceries are business meals",
      conditions: [{ field: "narration", operator: "contains", value: "BIGBASKET" }],
      result: { category: "office-expenses" },
      priority: 100,
      enabled: true,
      createdAt: NOW,
    };

    expect(approved.priority).toBeLessThan(handWritten.priority);
    expect(findMatchingRule(transaction(), [approved, handWritten])?.id).toBe("mine");
  });

  it("finds the rule a merchant already has instead of stacking a second", () => {
    const rule = aiApprovedRule(suggested(), "food-and-groceries", "r1", NOW) as ClassificationRule;
    expect(findRuleForAnchor([rule], "BIGBASKET", "DEBIT")?.id).toBe("r1");
    expect(findRuleForAnchor([rule], "BIGBASKET", "CREDIT")).toBeUndefined();
    expect(findRuleForAnchor([rule], "NETFLIX", "DEBIT")).toBeUndefined();
  });

  it("uses the priority the queue documents", () => {
    const rule = aiApprovedRule(suggested(), "food-and-groceries", "r1", NOW) as ClassificationRule;
    expect(rule.priority).toBe(AI_RULE_PRIORITY);
  });
});

// The reason the whole exercise is worth it: after approval the merchant is
// answered by the rule, and the AI pass is never offered it again.
describe("after approval the model is out of the loop", () => {
  const rule = aiApprovedRule(suggested(), "food-and-groceries", "r1", NOW) as ClassificationRule;

  it("classifies the next statement's rows from the rule", () => {
    const next = transaction({ id: "later", narration: "UPI/7781/BIGBASKET/Monthly stock" });
    const result = classify(next, [rule]);
    expect(result.classificationSource).toBe("RULE");
    expect(result.category).toBe("food-and-groceries");
    expect(result.confidence).toBe(100);
  });

  it("keeps those rows out of the next AI pass entirely", () => {
    const settled = transaction({
      narration: "UPI/7781/BIGBASKET/Monthly stock",
      category: "food-and-groceries",
      classificationSource: "RULE",
    });
    expect(needsAiCategorisation(settled)).toBe(false);
  });

  it("still offers the model a merchant nobody has ruled on", () => {
    const unknown = transaction({ narration: "UPI/2211/Kalyani Provision Stores/Bill" });
    expect(needsAiCategorisation(unknown)).toBe(true);
  });
});
