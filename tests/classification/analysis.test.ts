// Analysis and duplicate policy. The key behaviour under test is decision 16:
// duplicates stay visible but are out of the totals unless the CA says
// otherwise — so an overlapping statement import cannot inflate income.

import { describe, expect, it } from "vitest";
import type { AnalyzerSettings, Transaction } from "@/lib/bankStatement/types";
import { analyse } from "@/lib/bankStatement/analysis";
import { countsTowardsTotals, markDuplicates } from "@/lib/bankStatement/normalization/deduplicator";
import { defaultCategories } from "@/lib/bankStatement/classification/categories";
import { DEFAULT_SETTINGS } from "@/lib/bankStatement/storage/store";

const categories = defaultCategories();
const settings: AnalyzerSettings = { ...DEFAULT_SETTINGS };

let id = 0;
function t(overrides: Partial<Transaction> = {}): Transaction {
  id += 1;
  return {
    id: `t${id}`,
    statementId: "s1",
    date: "2025-04-01",
    narration: "TEST",
    debit: 0,
    credit: 0,
    currency: "INR",
    transactionType: "DEBIT",
    classificationType: "BUSINESS",
    classificationSource: "HEURISTIC",
    createdAt: "2025-04-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("duplicate detection", () => {
  it("flags the later copy and leaves the first clean", () => {
    const rows = [
      t({ date: "2025-04-01", credit: 50000, narration: "NEFT CR MERIDIAN INV-4101", referenceNumber: "N01" }),
      t({ date: "2025-04-01", credit: 50000, narration: "NEFT CR MERIDIAN INV-4101", referenceNumber: "N01" }),
    ];
    expect(markDuplicates(rows)).toBe(1);
    expect(rows[0].isDuplicate).toBeUndefined();
    expect(rows[1].isDuplicate).toBe(true);
    expect(rows[1].duplicateOfId).toBe(rows[0].id);
  });

  it("does not flag same-day same-amount rows with different references", () => {
    const rows = [
      t({ credit: 5000, narration: "PAYMENT FROM ALPHA TRADERS", referenceNumber: "A1" }),
      t({ credit: 5000, narration: "PAYMENT FROM BETA SUPPLIES", referenceNumber: "B2" }),
    ];
    expect(markDuplicates(rows)).toBe(0);
  });

  it("keeps duplicates out of totals until the CA overrides", () => {
    const duplicate = t({ credit: 50000, isDuplicate: true });
    expect(countsTowardsTotals(duplicate, false)).toBe(false);
    expect(countsTowardsTotals({ ...duplicate, duplicateOverride: "KEEP" }, false)).toBe(true);
    expect(countsTowardsTotals(t({ credit: 100, duplicateOverride: "EXCLUDE" }), true)).toBe(false);
  });
});

describe("analysis", () => {
  const rows = [
    t({ date: "2025-04-05", credit: 50000, transactionType: "CREDIT", category: "sales" }),
    t({ date: "2025-04-10", debit: 18000, category: "rent" }),
    t({ date: "2025-05-05", credit: 30000, transactionType: "CREDIT", category: "sales" }),
    t({ date: "2025-05-12", debit: 12000, category: "purchases" }),
    t({ date: "2025-05-20", debit: 150000, category: "purchases" }),
    t({ date: "2025-05-22", debit: 5000, category: "cash-withdrawal", isCashTransaction: true }),
  ];

  it("totals credits, debits and the net", () => {
    const result = analyse(rows, categories, settings);
    expect(result.totals.credits).toBe(80000);
    expect(result.totals.debits).toBe(185000);
    expect(result.totals.net).toBe(-105000);
    expect(result.totals.count).toBe(6);
  });

  it("buckets by month in order", () => {
    const result = analyse(rows, categories, settings);
    expect(result.monthly.map((row) => row.month)).toEqual(["2025-04", "2025-05"]);
    expect(result.monthly[0].credits).toBe(50000);
    expect(result.monthly[1].debits).toBe(167000);
  });

  it("ranks expense categories by amount with a share that sums to 100", () => {
    const result = analyse(rows, categories, settings);
    expect(result.expenseCategories[0].category).toBe("Purchases");
    expect(result.expenseCategories[0].debit).toBe(162000);
    const totalShare = result.expenseCategories.reduce((sum, row) => sum + row.share, 0);
    expect(Math.round(totalShare)).toBe(100);
  });

  it("applies the high-value threshold from settings, not a hardcoded number", () => {
    expect(analyse(rows, categories, settings).highValue).toHaveLength(1);
    const raised = analyse(rows, categories, { ...settings, highValueThreshold: 200000 });
    expect(raised.highValue).toHaveLength(0);
  });

  it("separates cash movement", () => {
    const result = analyse(rows, categories, settings);
    expect(result.cash.withdrawals).toBe(5000);
    expect(result.cash.transactions).toHaveLength(1);
  });

  it("lists everything below the review confidence as uncategorised work", () => {
    const withGaps = [...rows, t({ debit: 900, category: undefined, confidence: 0 })];
    const result = analyse(withGaps, categories, settings);
    expect(result.uncategorised.length).toBeGreaterThan(0);
  });

  it("excludes duplicates from the totals it reports", () => {
    const withDuplicate = [...rows, t({ date: "2025-04-05", credit: 50000, transactionType: "CREDIT", isDuplicate: true })];
    const result = analyse(withDuplicate, categories, settings);
    expect(result.totals.credits).toBe(80000);
    expect(result.totals.excludedDuplicates).toBe(1);

    const including = analyse(withDuplicate, categories, {
      ...settings,
      includeDuplicatesInTotals: true,
    });
    expect(including.totals.credits).toBe(130000);
  });

  it("raises an anomaly for a balance chain break", () => {
    const broken = [...rows, t({ debit: 100, rowIssue: "Running balance does not follow: expected 1, statement shows 2" })];
    const result = analyse(broken, categories, settings);
    expect(result.anomalies.some((anomaly) => anomaly.kind === "BALANCE_BREAK")).toBe(true);
  });
});
