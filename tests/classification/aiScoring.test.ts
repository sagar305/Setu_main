// The maths between "the model returned some numbers" and "the table says 91%".
// No model here: vectors are handed in directly so the scoring rules can be
// pinned exactly.

import { describe, expect, it } from "vitest";
import {
  calibrateScore,
  cosineSimilarity,
  outcomeFor,
  scoreTransaction,
} from "@/lib/bankStatement/ai/scoring";
import { buildCategoryProfiles, categoryProfileText } from "@/lib/bankStatement/ai/categoryProfiles";
import { defaultCategories } from "@/lib/bankStatement/classification/categories";
import type { Category } from "@/lib/bankStatement/types";

function vector(values: number[]): Float32Array {
  return Float32Array.from(values);
}

describe("cosine similarity", () => {
  it("is 1 for the same direction and 0 for a right angle", () => {
    expect(cosineSimilarity(vector([1, 0]), vector([2, 0]))).toBeCloseTo(1);
    expect(cosineSimilarity(vector([1, 0]), vector([0, 1]))).toBeCloseTo(0);
    expect(cosineSimilarity(vector([1, 0]), vector([-1, 0]))).toBeCloseTo(-1);
  });

  it("refuses to compare things it cannot compare", () => {
    expect(cosineSimilarity(vector([1, 0]), vector([1, 0, 0]))).toBe(0);
    expect(cosineSimilarity(vector([]), vector([]))).toBe(0);
    expect(cosineSimilarity(vector([0, 0]), vector([1, 1]))).toBe(0);
  });
});

describe("score calibration", () => {
  it("rises with similarity", () => {
    expect(calibrateScore(0.2, 0.1)).toBeLessThan(calibrateScore(0.5, 0.1));
  });

  // The point of the margin half: being vaguely near everything is not
  // confidence, however respectable the top number looks.
  it("punishes a close-run second place", () => {
    const clear = calibrateScore(0.55, 0.2);
    const contested = calibrateScore(0.55, 0.54);
    expect(clear).toBeGreaterThan(contested);
  });

  it("stays inside 0–100", () => {
    expect(calibrateScore(-1, -1)).toBe(0);
    expect(calibrateScore(1, -1)).toBe(100);
    expect(calibrateScore(0.05, 0.04)).toBeGreaterThanOrEqual(0);
  });

  it("treats a lone category as unopposed rather than as a tie", () => {
    expect(calibrateScore(0.5, undefined)).toBeGreaterThan(calibrateScore(0.5, 0.5));
  });
});

describe("thresholds", () => {
  const thresholds = { auto: 85, review: 70 };

  it("bands a score the way the panel describes", () => {
    expect(outcomeFor(92, thresholds)).toBe("AUTO");
    expect(outcomeFor(85, thresholds)).toBe("AUTO");
    expect(outcomeFor(78, thresholds)).toBe("REVIEW");
    expect(outcomeFor(70, thresholds)).toBe("REVIEW");
    expect(outcomeFor(69, thresholds)).toBe("NONE");
  });

  it("honours retuned thresholds", () => {
    expect(outcomeFor(60, { auto: 55, review: 40 })).toBe("AUTO");
  });
});

describe("scoring against categories", () => {
  const profiles = [
    { id: "food", name: "Food", text: "food", directions: ["DEBIT"] as ("DEBIT" | "CREDIT")[] },
    { id: "travel", name: "Travel", text: "travel", directions: ["DEBIT"] as ("DEBIT" | "CREDIT")[] },
    { id: "sales", name: "Sales", text: "sales", directions: ["CREDIT"] as ("DEBIT" | "CREDIT")[] },
  ];

  const embeddings = new Map<string, Float32Array>([
    ["food", vector([1, 0, 0])],
    ["travel", vector([0, 1, 0])],
    ["sales", vector([1, 0, 0])], // deliberately identical to food
  ]);

  it("picks the closest eligible category", () => {
    const result = scoreTransaction(vector([0.9, 0.1, 0]), embeddings, profiles, "DEBIT");
    expect(result.best?.categoryId).toBe("food");
    expect(result.runnerUp?.categoryId).toBe("travel");
  });

  // "Sales" sits exactly where "Food" sits in this fixture, so if direction were
  // not enforced a debit could be scored as income.
  it("never scores a debit against an income category", () => {
    const result = scoreTransaction(vector([1, 0, 0]), embeddings, profiles, "DEBIT");
    expect(result.best?.categoryId).toBe("food");
    expect([result.best?.categoryId, result.runnerUp?.categoryId]).not.toContain("sales");
  });

  it("reports nothing at all when no category is eligible", () => {
    const creditOnly = [profiles[2]];
    const result = scoreTransaction(vector([1, 0, 0]), embeddings, creditOnly, "DEBIT");
    expect(result.best).toBeUndefined();
    expect(result.score).toBe(0);
  });

  it("skips a category whose embedding is missing", () => {
    const partial = new Map([["travel", vector([0, 1, 0])]]);
    const result = scoreTransaction(vector([1, 0, 0]), partial, profiles, "DEBIT");
    expect(result.best?.categoryId).toBe("travel");
  });
});

describe("category profiles", () => {
  const categories = defaultCategories();

  it("gives the model a description to match against, not just a name", () => {
    const groceries = categories.find((category) => category.id === "food-and-groceries") as Category;
    const text = categoryProfileText(groceries);
    expect(text).toContain("Food & Groceries");
    expect(text.toLowerCase()).toContain("grocery shopping");
    expect(text).toContain("for example");
  });

  it("assigns the direction a category can appear on", () => {
    const profiles = buildCategoryProfiles(categories);
    const byId = new Map(profiles.map((profile) => [profile.id, profile]));

    expect(byId.get("sales")?.directions).toEqual(["CREDIT"]);
    expect(byId.get("rent")?.directions).toEqual(["DEBIT"]);
    expect(byId.get("cash-deposit")?.directions).toEqual(["CREDIT"]);
    expect(byId.get("cash-withdrawal")?.directions).toEqual(["DEBIT"]);
    // A transfer genuinely goes both ways.
    expect(byId.get("own-account-transfer")?.directions).toEqual(["DEBIT", "CREDIT"]);
  });

  it("leaves archived categories out entirely", () => {
    const archived = categories.map((category) =>
      category.id === "rent" ? { ...category, archived: true } : category
    );
    expect(buildCategoryProfiles(archived).some((profile) => profile.id === "rent")).toBe(false);
  });

  it("still profiles a category the CA added with no description", () => {
    const custom: Category = {
      id: "freight-inward",
      name: "Freight Inward",
      group: "EXPENSE",
      builtIn: false,
      archived: false,
      order: 99,
    };
    expect(categoryProfileText(custom)).toContain("Freight Inward");
  });
});
