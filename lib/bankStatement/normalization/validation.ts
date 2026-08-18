// Extraction validation — the gate that decides what we are allowed to claim.
// ---------------------------------------------------------------------------
// Rules from the spec (§10, §30) and decision 20:
//
//   • Walk the balance chain: previous + credit − debit ≈ current.
//   • Reconcile declared opening/closing balances where the statement gives them.
//   • Roll row-level status up into a statement-level parseStatus.
//   • A row-count mismatch alone is NOT unresolved — statements rarely print a
//     trustworthy transaction count, so we never invent one to compare against.

import type {
  BalanceChainResult,
  ParseStatus,
  Transaction,
  ValidationIssue,
  ValidationReport,
} from "@/lib/bankStatement/types";
import { amountsEqual, round2 } from "@/lib/bankStatement/utils/numbers";

export type ValidationInput = {
  transactions: Transaction[];
  rejected: { reason: string; row?: number; page?: number }[];
  /** Zero-amount rows — reported, never counted as failures. */
  skipped?: number;
  declaredOpening?: number;
  declaredClosing?: number;
};

/** Walk the running-balance column and count the rows where it breaks. */
export function checkBalanceChain(
  transactions: Transaction[],
  declaredOpening?: number
): BalanceChainResult {
  const withBalance = transactions.filter((t) => typeof t.balance === "number");
  // A chain needs at least two balances to compare, otherwise there is nothing
  // to check and we must not imply that we checked.
  if (withBalance.length < 2) {
    return { checked: false, breaks: 0 };
  }

  let breaks = 0;
  let firstBreakRow: number | undefined;

  for (let i = 1; i < withBalance.length; i += 1) {
    const previous = withBalance[i - 1];
    const current = withBalance[i];
    const expected = round2((previous.balance ?? 0) + current.credit - current.debit);
    if (!amountsEqual(expected, current.balance ?? 0, 0.02)) {
      breaks += 1;
      if (firstBreakRow === undefined) firstBreakRow = current.sourceRow;
      // Mark the row so the review table can point straight at it.
      current.rowStatus = current.rowStatus === "UNRESOLVED" ? "UNRESOLVED" : "WARNING";
      current.rowIssue =
        current.rowIssue ??
        `Running balance does not follow: expected ${expected.toFixed(2)}, statement shows ${(current.balance ?? 0).toFixed(2)}`;
    }
  }

  const first = withBalance[0];
  const openingMatches =
    declaredOpening === undefined
      ? undefined
      : amountsEqual(
          round2(declaredOpening + first.credit - first.debit),
          first.balance ?? 0,
          0.02
        );

  return { checked: true, breaks, firstBreakRow, openingMatches };
}

export function validate(input: ValidationInput): ValidationReport {
  const { transactions, rejected, skipped = 0, declaredOpening, declaredClosing } = input;

  const balanceChain = checkBalanceChain(transactions, declaredOpening);

  if (declaredClosing !== undefined && transactions.length > 0) {
    const last = transactions[transactions.length - 1];
    if (typeof last.balance === "number") {
      balanceChain.closingMatches = amountsEqual(last.balance, declaredClosing, 0.02);
    }
  }

  const issues: ValidationIssue[] = [];

  for (const item of rejected) {
    issues.push({ severity: "error", message: item.reason, row: item.row, page: item.page });
  }

  const warningRows = transactions.filter((t) => t.rowStatus === "WARNING");
  const unresolvedRows = transactions.filter((t) => t.rowStatus === "UNRESOLVED");

  for (const transaction of unresolvedRows) {
    issues.push({
      severity: "error",
      message: transaction.rowIssue ?? "Row could not be resolved",
      row: transaction.sourceRow,
      page: transaction.sourcePage,
    });
  }

  if (balanceChain.checked && balanceChain.breaks > 0) {
    issues.push({
      severity: "error",
      message: `The running balance does not follow on ${balanceChain.breaks} row${balanceChain.breaks === 1 ? "" : "s"}. Some transactions may be missing or mis-read.`,
      row: balanceChain.firstBreakRow,
    });
  }

  if (balanceChain.openingMatches === false) {
    issues.push({
      severity: "warning",
      message: "The first row does not follow from the statement's opening balance.",
    });
  }
  if (balanceChain.closingMatches === false) {
    issues.push({
      severity: "warning",
      message: "The last row's balance does not match the statement's closing balance.",
    });
  }

  if (transactions.length === 0) {
    issues.push({
      severity: "error",
      message: "No transactions could be extracted from this file.",
    });
  }

  if (skipped > 0) {
    issues.push({
      severity: "warning",
      message: `${skipped} row${skipped === 1 ? "" : "s"} moved no money — an opening or closing balance, or a nil entry — and ${skipped === 1 ? "was" : "were"} not counted as a transaction.`,
    });
  }

  const extracted = transactions.length + rejected.length;

  return {
    extracted,
    resolved: transactions.length - warningRows.length - unresolvedRows.length,
    warnings: warningRows.length,
    unresolved: unresolvedRows.length + rejected.length,
    skippedRows: skipped,
    balanceChain,
    issues,
  };
}

/**
 * Roll everything up. UNRESOLVED means the CA must not treat the numbers as
 * complete; WARNING means usable but worth a look.
 */
export function parseStatusFrom(report: ValidationReport): ParseStatus {
  if (report.extracted === 0) return "UNRESOLVED";
  if (report.unresolved > 0) return "UNRESOLVED";
  if (report.balanceChain.checked && report.balanceChain.breaks > 0) return "UNRESOLVED";
  if (
    report.warnings > 0 ||
    report.balanceChain.openingMatches === false ||
    report.balanceChain.closingMatches === false
  ) {
    return "WARNING";
  }
  return "VALID";
}

/** The sentence the review screen leads with. Never overstates the result. */
export function summariseParse(report: ValidationReport, status: ParseStatus): string {
  if (status === "VALID") {
    return `${report.resolved} transactions extracted and checked against the running balance.`;
  }
  if (status === "WARNING") {
    return `${report.resolved + report.warnings} transactions extracted, ${report.warnings} of which need a look.`;
  }
  return `We could not confidently extract every transaction. Extracted: ${report.resolved + report.warnings}. Unresolved: ${report.unresolved}.`;
}
