// The categorisation pipeline end to end, with the model stood in for.
// ---------------------------------------------------------------------------
// The real embedder cannot run under Node in CI, so this substitutes a
// deterministic bag-of-words vectoriser for it. That is a weaker semantic model
// than MiniLM by a wide margin — it can only see words the two texts literally
// share — which makes it a useful floor to test against: if the vocabulary in a
// normalised narration does not overlap its category's description even here,
// the sentences are wrong and no amount of model quality would hide it.
//
// What this pins is the wiring and the vocabulary. What it cannot pin is the
// real model's numbers, which is what the configurable thresholds are for.

import { describe, expect, it } from "vitest";
import { buildCategoryProfiles } from "@/lib/bankStatement/ai/categoryProfiles";
import { narrationToSentence } from "@/lib/bankStatement/ai/narration";
import { scoreTransaction } from "@/lib/bankStatement/ai/scoring";
import { defaultCategories } from "@/lib/bankStatement/classification/categories";

const STOPWORDS = new Set([
  "a", "an", "and", "or", "the", "to", "of", "for", "by", "in", "on", "is", "it",
  "this", "that", "with", "from", "at", "as", "money", "paid", "out", "received",
  "looks", "like", "example", "says", "note", "payment", "says", "usually",
]);

function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token))
    // Crude stemming, so "groceries" and "grocery" count as the same word.
    .map((token) => token.replace(/(ies|es|s)$/, ""));
}

/** Build a shared vocabulary, then a term-frequency vector per text. */
function vectoriser(corpus: string[]) {
  const vocabulary = new Map<string, number>();
  for (const text of corpus) {
    for (const token of tokenise(text)) {
      if (!vocabulary.has(token)) vocabulary.set(token, vocabulary.size);
    }
  }

  return (text: string): Float32Array => {
    const vector = new Float32Array(vocabulary.size);
    for (const token of tokenise(text)) {
      const index = vocabulary.get(token);
      if (index !== undefined) vector[index] += 1;
    }
    return vector;
  };
}

const categories = defaultCategories();
const profiles = buildCategoryProfiles(categories);

// Every narration the cases below use, so the vocabulary is fixed once.
const CASES: { narration: string; direction: "DEBIT" | "CREDIT"; expected: string }[] = [
  { narration: "UPI/9033/BigBasket/BBNow", direction: "DEBIT", expected: "food-and-groceries" },
  { narration: "UPI/5512/Netflix.com/Monthly", direction: "DEBIT", expected: "entertainment" },
  { narration: "UPI/8122/UrbanCompany/Salon", direction: "DEBIT", expected: "personal-care-and-health" },
  { narration: "IMPS/P2P/Ankit Sharma/Trip split", direction: "DEBIT", expected: "personal-transfer" },
  { narration: "IMPS/P2A/BAJAJ FIN EMI 8831", direction: "DEBIT", expected: "loan" },
  { narration: "UPI/2231/Blinkit/Groceries", direction: "DEBIT", expected: "food-and-groceries" },
  { narration: "POS 4412XXXX8890 CROMA ELECTRONICS", direction: "DEBIT", expected: "shopping" },
  { narration: "UPI/7781/Uber India/Ride", direction: "DEBIT", expected: "travel" },
];

const sentences = new Map(
  CASES.map((testCase) => [
    testCase.narration,
    narrationToSentence(testCase.narration, testCase.direction),
  ])
);

const embed = vectoriser([...profiles.map((profile) => profile.text), ...sentences.values()]);

const categoryEmbeddings = new Map(
  profiles.map((profile) => [profile.id, embed(profile.text)] as const)
);

describe("narration → category, end to end", () => {
  for (const testCase of CASES) {
    it(`places "${testCase.narration}" in ${testCase.expected}`, () => {
      const result = scoreTransaction(
        embed(sentences.get(testCase.narration) as string),
        categoryEmbeddings,
        profiles,
        testCase.direction
      );
      expect(result.best?.categoryId).toBe(testCase.expected);
    });
  }

  it("keeps a salary credit out of the salary expense category", () => {
    const sentence = narrationToSentence("NEFT CR/ACME CORP SAL NOV25", "CREDIT");
    const corpus = vectoriser([...profiles.map((profile) => profile.text), sentence]);
    const embeddings = new Map(
      profiles.map((profile) => [profile.id, corpus(profile.text)] as const)
    );

    const result = scoreTransaction(corpus(sentence), embeddings, profiles, "CREDIT");
    expect(result.best?.categoryId).not.toBe("salaries");
  });

  // Nothing recognisable in the narration and nothing to be similar to: the
  // score has to come out low enough that the default thresholds decline it.
  it("scores an unrecognisable narration too low to act on", () => {
    const sentence = narrationToSentence("XZ/9981/QQ", "DEBIT");
    const corpus = vectoriser([...profiles.map((profile) => profile.text), sentence]);
    const embeddings = new Map(
      profiles.map((profile) => [profile.id, corpus(profile.text)] as const)
    );

    const result = scoreTransaction(corpus(sentence), embeddings, profiles, "DEBIT");
    expect(result.score).toBeLessThan(70);
  });
});
