// Learning from the CA's corrections, and where that sits in the priority
// order. The storage half is exercised through the pure functions — the
// localStorage wrapper around them is a two-line read/write.

import { describe, expect, it } from "vitest";
import type { ClassificationRule, Transaction } from "@/lib/bankStatement/types";
import { learn, recall, toMemory, trim, unlearn } from "@/lib/bankStatement/ai/learned";
import { classify } from "@/lib/bankStatement/classification/classifier";
import { LEARNED_LIMIT } from "@/lib/bankStatement/ai/config";

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "t1",
    statementId: "s1",
    date: "2025-04-01",
    narration: "UPI/4471/ABC RESTAURANT/Dinner",
    debit: 900,
    credit: 0,
    currency: "INR",
    transactionType: "DEBIT",
    classificationType: "UNKNOWN",
    classificationSource: "UNCLASSIFIED",
    createdAt: "2025-04-01T00:00:00.000Z",
    ...overrides,
  };
}

const NOW = "2025-04-01T10:00:00.000Z";

describe("learning from a correction", () => {
  it("remembers the merchant, not the transaction", () => {
    const memory = learn(new Map(), transaction(), "food-and-groceries", "PERSONAL", NOW);

    // A different night, a different reference number, same restaurant.
    const later = transaction({ id: "t2", narration: "UPI/9912/ABC RESTAURANT/Lunch", debit: 400 });
    expect(recall(memory, later)?.category).toBe("food-and-groceries");
  });

  it("does not answer for a merchant it was never taught", () => {
    const memory = learn(new Map(), transaction(), "food-and-groceries", "PERSONAL", NOW);
    expect(recall(memory, transaction({ narration: "UPI/1122/XYZ HARDWARE/Bill" }))).toBeUndefined();
  });

  it("does not answer across directions", () => {
    const memory = learn(new Map(), transaction(), "food-and-groceries", "PERSONAL", NOW);
    const refund = transaction({ transactionType: "CREDIT", debit: 0, credit: 900 });
    expect(recall(memory, refund)).toBeUndefined();
  });

  it("counts repeated confirmations of the same answer", () => {
    let memory = learn(new Map(), transaction(), "food-and-groceries", "PERSONAL", NOW);
    memory = learn(memory, transaction({ id: "t2" }), "food-and-groceries", "PERSONAL", NOW);
    expect(recall(memory, transaction())?.count).toBe(2);
  });

  // Changing your mind is a decision, not a vote to be outnumbered.
  it("replaces the answer outright when the CA changes it", () => {
    let memory = learn(new Map(), transaction(), "shopping", "PERSONAL", NOW);
    memory = learn(memory, transaction({ id: "t2" }), "shopping", "PERSONAL", NOW);
    memory = learn(memory, transaction({ id: "t3" }), "food-and-groceries", "PERSONAL", NOW);

    const remembered = recall(memory, transaction());
    expect(remembered?.category).toBe("food-and-groceries");
    expect(remembered?.count).toBe(1);
  });

  it("forgets on request", () => {
    const memory = learn(new Map(), transaction(), "food-and-groceries", "PERSONAL", NOW);
    const key = [...memory.keys()][0];
    expect(recall(unlearn(memory, key), transaction())).toBeUndefined();
  });

  it("keeps the most recent when it has to drop some", () => {
    let memory = new Map();
    for (let i = 0; i < LEARNED_LIMIT + 25; i += 1) {
      memory = learn(
        memory,
        transaction({ narration: `UPI/1000/MERCHANT ${i}/Bill` }),
        "purchases",
        "BUSINESS",
        new Date(Date.UTC(2025, 0, 1, 0, i)).toISOString()
      );
    }
    const kept = trim(memory);
    expect(kept.length).toBe(LEARNED_LIMIT);
    expect(kept[0].label).toContain(`MERCHANT ${LEARNED_LIMIT + 24}`);
  });

  it("round-trips through the stored form", () => {
    const memory = learn(new Map(), transaction(), "food-and-groceries", "PERSONAL", NOW);
    expect(recall(toMemory(trim(memory)), transaction())?.category).toBe("food-and-groceries");
  });
});

describe("where a correction sits in the pipeline", () => {
  const memory = learn(new Map(), transaction(), "food-and-groceries", "PERSONAL", NOW);

  it("beats the keyword patterns", () => {
    // "ABC RESTAURANT" matches no pattern, so without the memory this is
    // uncategorised — with it, the CA's own answer applies.
    expect(classify(transaction(), [], new Map(), memory).category).toBe("food-and-groceries");
    expect(classify(transaction(), [], new Map(), memory).classificationSource).toBe("MEMORY");
  });

  it("loses to a rule the CA wrote", () => {
    const rule: ClassificationRule = {
      id: "r1",
      name: "Restaurant meals are business",
      conditions: [{ field: "narration", operator: "contains", value: "ABC RESTAURANT" }],
      result: { category: "office-expenses", classificationType: "BUSINESS" },
      priority: 100,
      enabled: true,
      createdAt: NOW,
    };

    const result = classify(transaction(), [rule], new Map(), memory);
    expect(result.classificationSource).toBe("RULE");
    expect(result.category).toBe("office-expenses");
  });

  it("changes nothing when there is nothing learned", () => {
    const result = classify(transaction(), [], new Map(), new Map());
    expect(result.classificationSource).toBe("UNCLASSIFIED");
    expect(result.category).toBeUndefined();
  });
});
