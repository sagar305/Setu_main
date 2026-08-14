// Finding the categories the list is missing.
// ---------------------------------------------------------------------------
// Two halves, tested separately because they fail differently: the grouping is
// maths over embeddings, and the naming is extraction from text. The naming
// half is where the honesty lives — it must decline to name a group rather than
// invent something, because a category called "Payment 2" is worse for the CA
// than an empty box they fill in themselves.

import { describe, expect, it } from "vitest";
import type { Transaction } from "@/lib/bankStatement/types";
import { clusterByMeaning, significantClusters } from "@/lib/bankStatement/ai/clustering";
import {
  buildSuggestion,
  clusterMerchants,
  isUnmatchedByAi,
  sharedName,
  suggestedDescription,
} from "@/lib/bankStatement/ai/categorySuggestion";

function unit(values: number[]): Float32Array {
  const length = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
  return Float32Array.from(values.map((value) => (length === 0 ? 0 : value / length)));
}

describe("grouping merchants by meaning", () => {
  it("puts things that point the same way together and leaves the rest apart", () => {
    const clusters = clusterByMeaning(
      [
        { key: "a-salon", embedding: unit([1, 0, 0]) },
        { key: "b-salon", embedding: unit([0.97, 0.1, 0]) },
        { key: "c-salon", embedding: unit([0.95, 0.15, 0]) },
        { key: "z-fuel", embedding: unit([0, 1, 0]) },
      ],
      0.55
    );

    expect(clusters.length).toBe(2);
    expect(clusters[0]).toEqual(["a-salon", "b-salon", "c-salon"]);
    expect(clusters[1]).toEqual(["z-fuel"]);
  });

  // The reason this is leader clustering and not single-link: A resembles B and
  // B resembles C, but A and C have nothing to do with each other. Single-link
  // would chain all three into one incoherent group.
  it("does not chain two unrelated things through a middle one", () => {
    const clusters = clusterByMeaning(
      [
        { key: "a", embedding: unit([1, 0]) },
        { key: "b", embedding: unit([1, 1]) },
        { key: "c", embedding: unit([0, 1]) },
      ],
      0.72
    );

    const groupOf = (key: string) => clusters.findIndex((cluster) => cluster.includes(key));
    expect(groupOf("a")).not.toBe(groupOf("c"));
  });

  it("gives the same answer whatever order the merchants arrive in", () => {
    const items = [
      { key: "one", embedding: unit([1, 0, 0]) },
      { key: "two", embedding: unit([0.96, 0.2, 0]) },
      { key: "three", embedding: unit([0, 0, 1]) },
    ];
    expect(clusterByMeaning(items, 0.55)).toEqual(clusterByMeaning([...items].reverse(), 0.55));
  });

  it("reports the biggest group first", () => {
    const clusters = clusterByMeaning(
      [
        { key: "lonely", embedding: unit([0, 1]) },
        { key: "a", embedding: unit([1, 0]) },
        { key: "b", embedding: unit([0.99, 0.05]) },
      ],
      0.6
    );
    expect(clusters[0].length).toBe(2);
  });

  it("keeps only groups big enough to be a pattern, and not too many of them", () => {
    const clusters = [["a", "b", "c", "d"], ["e", "f", "g"], ["h", "i", "j"], ["k", "l"]];
    const kept = significantClusters(clusters, 3, 2);
    expect(kept.length).toBe(2);
    expect(kept.every((cluster) => cluster.length >= 3)).toBe(true);
  });
});

// ---------------------------------------------------------------------------

function transaction(narration: string, overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: narration,
    statementId: "s1",
    date: "2025-04-01",
    narration,
    debit: 800,
    credit: 0,
    currency: "INR",
    transactionType: "DEBIT",
    classificationType: "UNKNOWN",
    classificationSource: "UNCLASSIFIED",
    aiSimilarity: 0.31,
    needsReview: true,
    createdAt: "2025-04-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("which transactions feed a suggestion", () => {
  it("takes the ones the model saw and declined", () => {
    expect(isUnmatchedByAi(transaction("UPI/1/GLOW SALON/Bill"))).toBe(true);
  });

  it("ignores rows the model never saw", () => {
    expect(isUnmatchedByAi(transaction("UPI/1/X/Y", { aiSimilarity: undefined }))).toBe(false);
  });

  it("ignores anything already categorised", () => {
    expect(
      isUnmatchedByAi(transaction("UPI/1/X/Y", { category: "rent", classificationSource: "AI" }))
    ).toBe(false);
  });
});

describe("naming a group from its own merchants", () => {
  it("uses the word the merchants share", () => {
    expect(sharedName(["Glow Salon", "Sharma Salon And Spa", "Urban Salon"])).toBe("Salon");
  });

  it("ignores corporate furniture that every Indian merchant carries", () => {
    const name = sharedName(["Vertex India Pvt Ltd", "Orion India Pvt Ltd", "Nova India Pvt Ltd"]);
    expect(["", "Vertex", "Orion", "Nova"]).toContain(name);
    expect(name).not.toBe("India");
    expect(name).not.toBe("Pvt");
  });

  // The honest failure. Nothing is shared, so nothing is proposed — the CA gets
  // an empty box rather than a name the tool made up.
  it("declines to name a group with nothing in common", () => {
    expect(sharedName(["Billdesk", "Kalyani Stores", "Zenith Traders"])).toBe("");
  });

  it("needs most of the group to share the word, not just two of them", () => {
    expect(
      sharedName(["Glow Salon", "Sharma Salon", "Zenith Traders", "Orion Motors", "Nova Foods"])
    ).toBe("");
  });

  it("says nothing about a group of one", () => {
    expect(sharedName(["Glow Salon"])).toBe("");
  });
});

describe("building the proposal", () => {
  const rows = [
    transaction("UPI/9033/GLOW SALON/Haircut"),
    transaction("UPI/4471/SHARMA SALON/Bill"),
    transaction("UPI/1188/URBAN SALON/Spa"),
  ];

  it("lists every distinct merchant once", () => {
    const merchants = clusterMerchants([...rows, transaction("UPI/7781/GLOW SALON/Again")]);
    expect(merchants.length).toBe(3);
  });

  it("proposes the shared name and a description built from the merchants", () => {
    const suggestion = buildSuggestion(rows);
    expect(suggestion.name).toBe("Salon");
    expect(suggestion.description).toContain("Glow Salon");
    expect(suggestion.merchantCount).toBe(3);
    expect(suggestion.transactions.length).toBe(3);
  });

  // A category is matched on its description, so a proposal that arrived with
  // an empty one would be nearly unmatchable — the very thing this fixes.
  it("never proposes a category with no description", () => {
    expect(buildSuggestion(rows).description.length).toBeGreaterThan(0);
  });

  it("reads the ledger side from the transactions", () => {
    expect(buildSuggestion(rows).group).toBe("EXPENSE");

    const credits = rows.map((row) =>
      transaction(row.narration, { transactionType: "CREDIT", debit: 0, credit: 500 })
    );
    expect(buildSuggestion(credits).group).toBe("INCOME");
  });

  it("phrases the description for the side of the ledger it is on", () => {
    expect(suggestedDescription(["Acme Corp"], "INCOME")).toContain("received from");
    expect(suggestedDescription(["Acme Corp"], "EXPENSE")).toContain("Payments to");
  });

  it("still produces a usable proposal when no merchant name can be read", () => {
    const opaque = [transaction("4471/99201/00"), transaction("8812/33119/01")];
    const suggestion = buildSuggestion(opaque);
    expect(suggestion.name).toBe("");
    expect(suggestion.transactions.length).toBe(2);
  });
});
