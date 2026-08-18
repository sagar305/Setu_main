// Model selection, device policy, and the merchant layer that keeps work away
// from the model in the first place.

import { describe, expect, it } from "vitest";
import type { Category, ClassificationRule, Transaction } from "@/lib/bankStatement/types";
import {
  DEFAULT_MODEL,
  EMBEDDING_MODELS,
  FALLBACK_MODEL,
  WEBGPU_BATCH_THRESHOLD,
  backendCandidates,
} from "@/lib/bankStatement/ai/models";
import {
  KNOWN_MERCHANT_COUNT,
  merchantCategory,
  merchantCategoryFor,
} from "@/lib/bankStatement/ai/merchantMemory";
import { classify } from "@/lib/bankStatement/classification/classifier";
import { defaultCategories } from "@/lib/bankStatement/classification/categories";
import { learn } from "@/lib/bankStatement/ai/learned";

describe("the model registry", () => {
  it("keeps MiniLM as the baseline until something is proven better", () => {
    expect(DEFAULT_MODEL).toBe("all-MiniLM-L6-v2");
    expect(FALLBACK_MODEL).toBe("all-MiniLM-L6-v2");
  });

  it("offers the candidate alongside it", () => {
    expect(Object.keys(EMBEDDING_MODELS).sort()).toEqual([
      "all-MiniLM-L6-v2",
      "mxbai-embed-xsmall-v1",
    ]);
  });

  it("describes each model well enough to swap without reading the code", () => {
    for (const spec of Object.values(EMBEDDING_MODELS)) {
      expect(spec.repo).toMatch(/\//);
      expect(spec.dimensions).toBeGreaterThan(0);
      expect(spec.notes.length).toBeGreaterThan(20);
    }
  });
});

describe("choosing a device", () => {
  it("does not start a GPU for a handful of transactions", () => {
    const candidates = backendCandidates({ batchSize: 5, webgpu: true });
    expect(candidates.every((candidate) => candidate.device === "wasm")).toBe(true);
  });

  it("uses the GPU once the batch is big enough to repay starting it", () => {
    const candidates = backendCandidates({ batchSize: WEBGPU_BATCH_THRESHOLD, webgpu: true });
    expect(candidates[0].device).toBe("webgpu");
  });

  it("never leaves WASM off the end, whatever the size", () => {
    for (const batchSize of [1, 500]) {
      for (const webgpu of [true, false]) {
        const candidates = backendCandidates({ batchSize, webgpu });
        expect(candidates[candidates.length - 1].device).toBe("wasm");
        expect(candidates.some((candidate) => candidate.device === "wasm")).toBe(true);
      }
    }
  });

  it("never offers WebGPU when the browser has none", () => {
    const candidates = backendCandidates({ batchSize: 5000, webgpu: false });
    expect(candidates.some((candidate) => candidate.device === "webgpu")).toBe(false);
  });

  // q8 is the format the WASM kernels are tuned for; q4 is worth the
  // dequantisation cost only where a GPU absorbs it.
  it("prefers q8 on the CPU and q4f16 on the GPU", () => {
    expect(backendCandidates({ batchSize: 1, webgpu: false })[0].dtype).toBe("q8");
    expect(backendCandidates({ batchSize: 1000, webgpu: true })[0].dtype).toBe("q4f16");
  });
});

describe("merchants we already know", () => {
  it("answers for merchants the tool ships", () => {
    expect(merchantCategory("UPI/9033/BigBasket/BBNow", "DEBIT")?.categoryId).toBe(
      "food-and-groceries"
    );
    expect(merchantCategory("UPI/5512/Netflix.com/Monthly", "DEBIT")?.categoryId).toBe("entertainment");
    expect(merchantCategory("UPI/7781/Uber India/Ride", "DEBIT")?.categoryId).toBe("travel");
    expect(merchantCategory("IMPS/P2A/BAJAJ FIN EMI 8831", "DEBIT")?.categoryId).toBe("loan");
  });

  it("says nothing about a merchant it does not know", () => {
    expect(merchantCategory("UPI/2211/Kalyani Provision Stores/Bill", "DEBIT")).toBeUndefined();
  });

  // A gateway paying a business is income; the same gateway charging it a fee
  // is not. Collapsing the two would misfile every settlement.
  it("separates the two sides of the ledger", () => {
    expect(merchantCategory("NEFT CR/RAZORPAY SETTLEMENT", "CREDIT")?.categoryId).toBe("sales");
    expect(merchantCategory("UPI/1122/Razorpay/Fee", "DEBIT")?.categoryId).toBe("bank-charges");
  });

  it("declines where it has no answer for that direction", () => {
    expect(merchantCategory("UPI/9033/BigBasket/Refund", "CREDIT")).toBeUndefined();
  });

  it("refuses a mapping into a category the CA archived", () => {
    const archived: Category[] = defaultCategories().map((category) =>
      category.id === "entertainment" ? { ...category, archived: true } : category
    );
    expect(
      merchantCategoryFor("UPI/5512/Netflix.com/Monthly", "DEBIT", archived)
    ).toBeUndefined();
  });

  it("refuses a mapping into a category that no longer exists", () => {
    expect(merchantCategoryFor("UPI/5512/Netflix.com/Monthly", "DEBIT", [])).toBeUndefined();
  });

  it("ships a useful number of merchants", () => {
    expect(KNOWN_MERCHANT_COUNT).toBeGreaterThan(20);
  });
});

describe("where the merchant layer sits", () => {
  const categories = defaultCategories();

  function transaction(overrides: Partial<Transaction> = {}): Transaction {
    return {
      id: "t1",
      statementId: "s1",
      date: "2025-04-01",
      narration: "UPI/5512/Netflix.com/Monthly",
      debit: 649,
      credit: 0,
      currency: "INR",
      transactionType: "DEBIT",
      classificationType: "UNKNOWN",
      classificationSource: "UNCLASSIFIED",
      createdAt: "2025-04-01T00:00:00.000Z",
      ...overrides,
    };
  }

  it("answers without the model where it can", () => {
    const result = classify(transaction(), [], new Map(), new Map(), categories);
    expect(result.classificationSource).toBe("MERCHANT");
    expect(result.category).toBe("entertainment");
  });

  it("loses to a rule the CA wrote", () => {
    const rule: ClassificationRule = {
      id: "r1",
      name: "Netflix is a software subscription",
      conditions: [{ field: "narration", operator: "contains", value: "NETFLIX" }],
      result: { category: "software" },
      priority: 100,
      enabled: true,
      createdAt: "2025-04-01T00:00:00.000Z",
    };
    expect(classify(transaction(), [rule], new Map(), new Map(), categories).category).toBe("software");
  });

  // The specification put the shipped list above corrections. It cannot be:
  // a list that outranked the CA could never be corrected — they would change
  // Netflix, and the next run would change it straight back.
  it("loses to a correction the CA made", () => {
    const learned = learn(
      new Map(),
      transaction(),
      "software",
      "BUSINESS",
      "2025-04-02T00:00:00.000Z"
    );
    const result = classify(transaction(), [], new Map(), learned, categories);
    expect(result.classificationSource).toBe("MEMORY");
    expect(result.category).toBe("software");
  });

  it("leaves an unknown merchant for the model", () => {
    const result = classify(
      transaction({ narration: "UPI/2211/Kalyani Provision Stores/Bill" }),
      [],
      new Map(),
      new Map(),
      categories
    );
    expect(result.classificationSource).toBe("UNCLASSIFIED");
    expect(result.category).toBeUndefined();
  });

  // The signature grew; every existing caller passes fewer arguments.
  it("still works when no categories are supplied", () => {
    expect(() => classify(transaction(), [])).not.toThrow();
    expect(classify(transaction(), []).classificationSource).not.toBe("MERCHANT");
  });
});
