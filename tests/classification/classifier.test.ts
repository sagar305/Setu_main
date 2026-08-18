// Classification is deterministic and rule-first (spec §13). These tests pin
// the precedence order and the honesty of the confidence score.

import { describe, expect, it } from "vitest";
import type { ClassificationRule, Transaction } from "@/lib/bankStatement/types";
import { buildPartyMemory, classify, confidenceBand } from "@/lib/bankStatement/classification/classifier";
import { conditionMatches, findMatchingRule, ruleFromTransaction } from "@/lib/bankStatement/classification/rulesEngine";
import { defaultCategories } from "@/lib/bankStatement/classification/categories";

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "t1",
    statementId: "s1",
    date: "2025-04-01",
    narration: "UPI/DR/SWIGGY ORDER",
    debit: 500,
    credit: 0,
    currency: "INR",
    transactionType: "DEBIT",
    classificationType: "UNKNOWN",
    classificationSource: "UNCLASSIFIED",
    createdAt: "2025-04-01T00:00:00.000Z",
    ...overrides,
  };
}

function rule(overrides: Partial<ClassificationRule> = {}): ClassificationRule {
  return {
    id: "r1",
    name: "Swiggy",
    conditions: [{ field: "narration", operator: "contains", value: "SWIGGY" }],
    result: { category: "office-expenses", classificationType: "BUSINESS" },
    priority: 100,
    enabled: true,
    createdAt: "2025-04-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("rules engine", () => {
  it("matches on each supported operator", () => {
    const t = transaction({ narration: "NEFT DR SALARY RAHUL", debit: 22000 });
    expect(conditionMatches(t, { field: "narration", operator: "contains", value: "salary" })).toBe(true);
    expect(conditionMatches(t, { field: "narration", operator: "startsWith", value: "NEFT" })).toBe(true);
    expect(conditionMatches(t, { field: "narration", operator: "endsWith", value: "RAHUL" })).toBe(true);
    expect(conditionMatches(t, { field: "amount", operator: "greaterThan", value: "20000" })).toBe(true);
    expect(conditionMatches(t, { field: "amount", operator: "lessThan", value: "20000" })).toBe(false);
    expect(conditionMatches(t, { field: "direction", operator: "equals", value: "DEBIT" })).toBe(true);
    expect(
      conditionMatches(t, { field: "date", operator: "between", value: "2025-03-01", value2: "2025-05-01" })
    ).toBe(true);
  });

  it("requires every condition to hold", () => {
    const r = rule({
      conditions: [
        { field: "narration", operator: "contains", value: "SWIGGY" },
        { field: "amount", operator: "greaterThan", value: "1000" },
      ],
    });
    expect(findMatchingRule(transaction({ debit: 500 }), [r])).toBeNull();
    expect(findMatchingRule(transaction({ debit: 1500 }), [r])).not.toBeNull();
  });

  it("takes the highest priority rule first", () => {
    const low = rule({ id: "low", priority: 10, result: { category: "other-expenses" } });
    const high = rule({ id: "high", priority: 90, result: { category: "office-expenses" } });
    expect(findMatchingRule(transaction(), [low, high])?.id).toBe("high");
  });

  it("ignores disabled rules", () => {
    expect(findMatchingRule(transaction(), [rule({ enabled: false })])).toBeNull();
  });

  it("drafts a rule from a transaction without saving anything", () => {
    const draft = ruleFromTransaction(
      transaction({ partyName: "ABC Enterprise", category: "purchases" }),
      "r-new",
      "2025-04-01T00:00:00.000Z"
    );
    expect(draft.conditions[0]).toEqual({
      field: "narration",
      operator: "contains",
      value: "ABC ENTERPRISE",
    });
    expect(draft.result.category).toBe("purchases");
  });
});

describe("classification pipeline", () => {
  it("puts a user rule above every heuristic, at full confidence", () => {
    const result = classify(transaction({ narration: "UPI/DR/GOOGLE ADS" }), [
      rule({ conditions: [{ field: "narration", operator: "contains", value: "GOOGLE ADS" }] }),
    ]);
    expect(result.classificationSource).toBe("RULE");
    expect(result.confidence).toBe(100);
    expect(result.category).toBe("office-expenses");
  });

  it("recognises common Indian narration patterns", () => {
    expect(classify(transaction({ narration: "NEFT DR/SALARY/RAHUL MEHTA" }), []).category).toBe("salaries");
    expect(classify(transaction({ narration: "ACH DR/OFFICE RENT/SKYLINE" }), []).category).toBe("rent");
    expect(
      classify(transaction({ narration: "BANK CHARGE:MONTHLY SERVICE CHARGE" }), []).category
    ).toBe("bank-charges");
    expect(
      classify(transaction({ narration: "INT.PD:SB INTEREST CREDIT", debit: 0, credit: 1200, transactionType: "CREDIT" }), []).category
    ).toBe("interest-income");
  });

  it("respects direction — a salary credit is not a salary expense", () => {
    const credit = classify(
      transaction({ narration: "NEFT CR/SALARY", debit: 0, credit: 40000, transactionType: "CREDIT" }),
      []
    );
    expect(credit.category).not.toBe("salaries");
  });

  it("flags cash transactions on both sides", () => {
    const deposit = classify(
      transaction({ narration: "CASH DEPOSIT/CDM", debit: 0, credit: 15000, transactionType: "CREDIT" }),
      []
    );
    expect(deposit.category).toBe("cash-deposit");
    expect(deposit.isCashTransaction).toBe(true);

    const withdrawal = classify(transaction({ narration: "ATM WDL/SELF WITHDRAWAL" }), []);
    expect(withdrawal.category).toBe("cash-withdrawal");
    expect(withdrawal.isCashTransaction).toBe(true);
  });

  it("says nothing rather than guessing when no pattern fits", () => {
    const result = classify(transaction({ narration: "XZ/9981/QQ" }), []);
    expect(result.category).toBeUndefined();
    expect(result.classificationSource).toBe("UNCLASSIFIED");
    expect(result.confidence).toBe(0);
  });

  it("reuses a party the CA classified by hand", () => {
    const memory = buildPartyMemory([
      transaction({
        id: "seen",
        partyName: "Vertex Supplies",
        category: "purchases",
        classificationType: "BUSINESS",
        classificationSource: "MANUAL",
      }),
    ]);
    const result = classify(
      transaction({ narration: "RTGS DR/PURCHASE/VERTEX SUPPLIES", partyName: "Vertex Supplies" }),
      [],
      memory
    );
    expect(result.category).toBe("purchases");
    expect(result.confidence).toBeGreaterThanOrEqual(70);
  });

  it("marks GST-relevant transactions without drawing compliance conclusions", () => {
    const result = classify(transaction({ narration: "GST PAYMENT/GSTN CHALLAN/202504" }), []);
    expect(result.gstRelevant).toBe("RELEVANT");
    expect(result.category).toBe("gst");
  });

  it("bands confidence the way the UI reports it", () => {
    expect(confidenceBand(95)).toBe("high");
    expect(confidenceBand(75)).toBe("medium");
    expect(confidenceBand(40)).toBe("low");
    expect(confidenceBand(undefined)).toBe("low");
  });
});

describe("categories", () => {
  it("ships the CA-oriented default tree", () => {
    const categories = defaultCategories();
    expect(categories.every((category) => category.builtIn)).toBe(true);
    expect(categories.find((category) => category.id === "bank-charges")?.group).toBe("EXPENSE");
    expect(categories.find((category) => category.id === "sales")?.group).toBe("INCOME");
    expect(categories.find((category) => category.id === "own-account-transfer")?.group).toBe("TRANSFER");
    expect(categories.find((category) => category.id === "cash-deposit")?.group).toBe("CASH");
  });
});
