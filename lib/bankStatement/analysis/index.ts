// Analysis: totals, monthly movement, category and party breakdowns, cash,
// high value, GST identification and anomalies (spec §15–16).
//
// Every figure here respects the duplicate policy (decision 16) — totals are
// computed from `includedTransactions`, never from the raw array.

import type {
  AnalysisResult,
  Anomaly,
  AnalyzerSettings,
  Category,
  CategoryRow,
  MonthlyRow,
  PartyRow,
  Transaction,
} from "@/lib/bankStatement/types";
import { includedTransactions } from "@/lib/bankStatement/normalization/deduplicator";
import { categoryGroup, categoryName } from "@/lib/bankStatement/classification/categories";
import { dayOfWeek, monthKey, monthLabel } from "@/lib/bankStatement/utils/dates";
import { round2 } from "@/lib/bankStatement/utils/numbers";
import { normaliseText } from "@/lib/bankStatement/utils/text";

export function analyse(
  transactions: Transaction[],
  categories: Category[],
  settings: AnalyzerSettings
): AnalysisResult {
  const included = includedTransactions(transactions, settings.includeDuplicatesInTotals);
  const excludedDuplicates = transactions.length - included.length;

  const credits = round2(included.reduce((sum, t) => sum + t.credit, 0));
  const debits = round2(included.reduce((sum, t) => sum + t.debit, 0));

  return {
    totals: {
      credits,
      debits,
      net: round2(credits - debits),
      count: included.length,
      excludedDuplicates,
    },
    monthly: monthlySummary(included),
    expenseCategories: categoryBreakdown(included, categories, "DEBIT"),
    incomeCategories: categoryBreakdown(included, categories, "CREDIT"),
    parties: topParties(included),
    cash: cashSummary(included),
    highValue: included
      .filter((t) => Math.max(t.debit, t.credit) >= settings.highValueThreshold)
      .sort((a, b) => Math.max(b.debit, b.credit) - Math.max(a.debit, a.credit)),
    uncategorised: included.filter(
      (t) => !t.category || (t.confidence ?? 0) < settings.reviewConfidenceThreshold
    ),
    bankCharges: sumCategory(included, "bank-charges"),
    interest: sumCategories(included, ["interest-income", "loan-interest"]),
    transfers: transferSummary(included),
    gst: {
      relevant: included.filter((t) => t.gstRelevant === "RELEVANT"),
      potential: included.filter((t) => t.gstRelevant === "POTENTIAL"),
    },
    anomalies: detectAnomalies(transactions, included, settings),
  };
}

export function monthlySummary(transactions: Transaction[]): MonthlyRow[] {
  const buckets = new Map<string, Transaction[]>();
  for (const transaction of transactions) {
    const key = monthKey(transaction.date);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(transaction);
    else buckets.set(key, [transaction]);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, rows]) => {
      const ordered = [...rows].sort((a, b) => a.date.localeCompare(b.date));
      const credits = round2(rows.reduce((sum, t) => sum + t.credit, 0));
      const debits = round2(rows.reduce((sum, t) => sum + t.debit, 0));

      // Opening = the balance before the month's first transaction, derived
      // from that row's own running balance so it stays consistent with the
      // statement rather than being accumulated independently.
      const first = ordered.find((t) => typeof t.balance === "number");
      const last = [...ordered].reverse().find((t) => typeof t.balance === "number");
      const opening =
        first && typeof first.balance === "number"
          ? round2(first.balance - first.credit + first.debit)
          : undefined;

      return {
        month: key,
        label: monthLabel(key),
        openingBalance: opening,
        credits,
        debits,
        closingBalance: last?.balance,
        net: round2(credits - debits),
        count: rows.length,
      };
    });
}

export function categoryBreakdown(
  transactions: Transaction[],
  categories: Category[],
  direction: "DEBIT" | "CREDIT"
): CategoryRow[] {
  const relevant = transactions.filter((t) =>
    direction === "DEBIT" ? t.debit > 0 : t.credit > 0
  );

  const buckets = new Map<string, { debit: number; credit: number; count: number }>();
  for (const transaction of relevant) {
    const key = transaction.category ?? "__uncategorised__";
    const bucket = buckets.get(key) ?? { debit: 0, credit: 0, count: 0 };
    bucket.debit += transaction.debit;
    bucket.credit += transaction.credit;
    bucket.count += 1;
    buckets.set(key, bucket);
  }

  const total = relevant.reduce(
    (sum, t) => sum + (direction === "DEBIT" ? t.debit : t.credit),
    0
  );

  return [...buckets.entries()]
    .map(([key, bucket]) => {
      const value = direction === "DEBIT" ? bucket.debit : bucket.credit;
      return {
        category: key === "__uncategorised__" ? "Uncategorised" : categoryName(categories, key),
        group: key === "__uncategorised__" ? ("UNCATEGORISED" as const) : categoryGroup(categories, key),
        debit: round2(bucket.debit),
        credit: round2(bucket.credit),
        count: bucket.count,
        share: total > 0 ? round2((value / total) * 100) : 0,
      };
    })
    .sort((a, b) =>
      direction === "DEBIT" ? b.debit - a.debit : b.credit - a.credit
    );
}

export function topParties(transactions: Transaction[], limit = 15): PartyRow[] {
  const buckets = new Map<string, PartyRow>();
  for (const transaction of transactions) {
    const party = transaction.partyName?.trim();
    if (!party) continue;
    const key = normaliseText(party);
    const row = buckets.get(key) ?? { party, debit: 0, credit: 0, count: 0 };
    row.debit += transaction.debit;
    row.credit += transaction.credit;
    row.count += 1;
    buckets.set(key, row);
  }

  return [...buckets.values()]
    .map((row) => ({ ...row, debit: round2(row.debit), credit: round2(row.credit) }))
    .sort((a, b) => b.debit + b.credit - (a.debit + a.credit))
    .slice(0, limit);
}

function cashSummary(transactions: Transaction[]): AnalysisResult["cash"] {
  const rows = transactions.filter((t) => t.isCashTransaction);
  return {
    deposits: round2(rows.reduce((sum, t) => sum + t.credit, 0)),
    withdrawals: round2(rows.reduce((sum, t) => sum + t.debit, 0)),
    transactions: rows,
  };
}

function sumCategory(transactions: Transaction[], category: string) {
  return sumCategories(transactions, [category]);
}

function sumCategories(transactions: Transaction[], categoryIds: string[]) {
  const rows = transactions.filter((t) => t.category && categoryIds.includes(t.category));
  return {
    total: round2(rows.reduce((sum, t) => sum + t.debit + t.credit, 0)),
    transactions: rows,
  };
}

function transferSummary(transactions: Transaction[]) {
  const rows = transactions.filter((t) => t.isTransfer || t.classificationType === "TRANSFER");
  return {
    total: round2(rows.reduce((sum, t) => sum + t.debit + t.credit, 0)),
    transactions: rows,
  };
}

/**
 * Anomalies worth a CA's attention. Every one is explainable in a sentence —
 * nothing statistical the user cannot check by eye.
 */
export function detectAnomalies(
  all: Transaction[],
  included: Transaction[],
  settings: AnalyzerSettings
): Anomaly[] {
  const anomalies: Anomaly[] = [];

  const highValue = included.filter(
    (t) => Math.max(t.debit, t.credit) >= settings.highValueThreshold
  );
  if (highValue.length > 0) {
    anomalies.push({
      id: "high-value",
      kind: "HIGH_VALUE",
      severity: "info",
      message: `${highValue.length} transaction${highValue.length === 1 ? "" : "s"} at or above the ₹${settings.highValueThreshold.toLocaleString("en-IN")} threshold.`,
      transactionIds: highValue.map((t) => t.id),
    });
  }

  const duplicates = all.filter((t) => t.isDuplicate && t.duplicateOverride !== "KEEP");
  if (duplicates.length > 0) {
    anomalies.push({
      id: "duplicates",
      kind: "DUPLICATE",
      severity: "warning",
      message: `${duplicates.length} possible duplicate${duplicates.length === 1 ? "" : "s"} found — excluded from totals until you say otherwise.`,
      transactionIds: duplicates.map((t) => t.id),
    });
  }

  // Money in and straight back out, same amount, within two days.
  const roundTrips: string[] = [];
  const credits = included.filter((t) => t.credit > 0);
  for (const credit of credits) {
    const match = included.find(
      (t) =>
        t.debit > 0 &&
        Math.abs(t.debit - credit.credit) < 1 &&
        t.date >= credit.date &&
        Date.parse(`${t.date}T00:00:00Z`) - Date.parse(`${credit.date}T00:00:00Z`) <= 2 * 86400000
    );
    if (match) roundTrips.push(credit.id, match.id);
  }
  if (roundTrips.length > 0) {
    anomalies.push({
      id: "round-tripping",
      kind: "ROUND_TRIPPING",
      severity: "info",
      message: `${roundTrips.length / 2} credit(s) were followed by a matching debit within two days.`,
      transactionIds: roundTrips,
    });
  }

  const weekendCash = included.filter(
    (t) => t.isCashTransaction && [0, 6].includes(dayOfWeek(t.date))
  );
  if (weekendCash.length > 0) {
    anomalies.push({
      id: "weekend-cash",
      kind: "WEEKEND_CASH",
      severity: "info",
      message: `${weekendCash.length} cash transaction${weekendCash.length === 1 ? "" : "s"} dated on a weekend.`,
      transactionIds: weekendCash.map((t) => t.id),
    });
  }

  // A month whose debits are more than double the median month.
  const monthly = monthlySummary(included);
  if (monthly.length >= 3) {
    const sorted = [...monthly].map((m) => m.debits).sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const spikes = monthly.filter((m) => median > 0 && m.debits > median * 2);
    if (spikes.length > 0) {
      anomalies.push({
        id: "spend-spike",
        kind: "SPIKE",
        severity: "info",
        message: `Spending in ${spikes.map((s) => s.label).join(", ")} was more than double the typical month.`,
        transactionIds: [],
      });
    }
  }

  const balanceBreaks = all.filter((t) => t.rowIssue?.startsWith("Running balance"));
  if (balanceBreaks.length > 0) {
    anomalies.push({
      id: "balance-breaks",
      kind: "BALANCE_BREAK",
      severity: "warning",
      message: `${balanceBreaks.length} row${balanceBreaks.length === 1 ? " does" : "s do"} not follow the running balance — the extraction may be incomplete.`,
      transactionIds: balanceBreaks.map((t) => t.id),
    });
  }

  return anomalies;
}
