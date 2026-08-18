// Excel export (spec §16) — every CA report as a sheet in one workbook.
// Generated entirely in the browser with SheetJS; nothing is uploaded.

import * as XLSX from "xlsx";
import type {
  AnalysisResult,
  BankStatement,
  Category,
  Transaction,
} from "@/lib/bankStatement/types";
import { categoryName } from "@/lib/bankStatement/classification/categories";
import { formatDate } from "@/lib/bankStatement/utils/dates";
import { sourceLabel } from "@/lib/bankStatement/classification/classifier";

type SheetRow = (string | number)[];

function sheet(rows: SheetRow[]): XLSX.WorkSheet {
  return XLSX.utils.aoa_to_sheet(rows);
}

const TYPE_LABEL: Record<string, string> = {
  BUSINESS: "Business",
  PERSONAL: "Personal",
  TRANSFER: "Transfer",
  UNKNOWN: "Unreviewed",
};

export function buildWorkbook(
  statements: BankStatement[],
  transactions: Transaction[],
  analysis: AnalysisResult,
  categories: Category[]
): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();

  // --- Statements -----------------------------------------------------------
  XLSX.utils.book_append_sheet(
    workbook,
    sheet([
      ["File", "Bank", "Account", "Period", "Transactions", "Parse status", "Parser"],
      ...statements.map((statement) => [
        statement.fileName,
        statement.bankName ?? "Not detected",
        statement.accountNumberMasked ?? "—",
        `${statement.startDate ?? "—"} to ${statement.endDate ?? "—"}`,
        statement.transactionCount,
        statement.parseStatus,
        statement.parserValidated ? statement.parserId : `${statement.parserId} (unverified)`,
      ]),
    ]),
    "Statements"
  );

  // --- Transactions ---------------------------------------------------------
  XLSX.utils.book_append_sheet(
    workbook,
    sheet([
      [
        "Date", "Narration", "Reference", "Debit", "Credit", "Balance",
        "Category", "Party", "Type", "Confidence", "Source", "Duplicate", "Notes",
      ],
      ...transactions.map((t) => [
        formatDate(t.date),
        t.narration,
        t.referenceNumber ?? "",
        t.debit || "",
        t.credit || "",
        t.balance ?? "",
        categoryName(categories, t.category),
        t.partyName ?? "",
        TYPE_LABEL[t.classificationType] ?? t.classificationType,
        t.confidence ?? 0,
        sourceLabel(t.classificationSource),
        t.isDuplicate ? "Possible duplicate" : "",
        t.notes ?? "",
      ]),
    ]),
    "Transactions"
  );

  // --- Transaction summary --------------------------------------------------
  XLSX.utils.book_append_sheet(
    workbook,
    sheet([
      ["Category", "Transactions", "Debit", "Credit"],
      ...[...analysis.expenseCategories, ...analysis.incomeCategories].map((row) => [
        row.category,
        row.count,
        row.debit,
        row.credit,
      ]),
      [],
      ["Total", analysis.totals.count, analysis.totals.debits, analysis.totals.credits],
    ]),
    "Transaction Summary"
  );

  // --- Monthly summary ------------------------------------------------------
  XLSX.utils.book_append_sheet(
    workbook,
    sheet([
      ["Month", "Opening balance", "Credits", "Debits", "Closing balance", "Net"],
      ...analysis.monthly.map((row) => [
        row.label,
        row.openingBalance ?? "",
        row.credits,
        row.debits,
        row.closingBalance ?? "",
        row.net,
      ]),
    ]),
    "Monthly Summary"
  );

  // --- Expense analysis -----------------------------------------------------
  XLSX.utils.book_append_sheet(
    workbook,
    sheet([
      ["Category", "Amount", "Share %", "Transactions"],
      ...analysis.expenseCategories.map((row) => [row.category, row.debit, row.share, row.count]),
    ]),
    "Expense Analysis"
  );

  // --- Cash transactions ----------------------------------------------------
  XLSX.utils.book_append_sheet(
    workbook,
    sheet([
      ["Date", "Narration", "Deposit", "Withdrawal"],
      ...analysis.cash.transactions.map((t) => [
        formatDate(t.date),
        t.narration,
        t.credit || "",
        t.debit || "",
      ]),
      [],
      ["Total", "", analysis.cash.deposits, analysis.cash.withdrawals],
    ]),
    "Cash Transactions"
  );

  // --- High value -----------------------------------------------------------
  XLSX.utils.book_append_sheet(
    workbook,
    sheet([
      ["Date", "Narration", "Debit", "Credit", "Category"],
      ...analysis.highValue.map((t) => [
        formatDate(t.date),
        t.narration,
        t.debit || "",
        t.credit || "",
        categoryName(categories, t.category),
      ]),
    ]),
    "High Value"
  );

  // --- Uncategorised --------------------------------------------------------
  XLSX.utils.book_append_sheet(
    workbook,
    sheet([
      ["Date", "Narration", "Debit", "Credit", "Confidence"],
      ...analysis.uncategorised.map((t) => [
        formatDate(t.date),
        t.narration,
        t.debit || "",
        t.credit || "",
        t.confidence ?? 0,
      ]),
    ]),
    "Uncategorised"
  );

  // --- Bank charges, interest, transfers ------------------------------------
  XLSX.utils.book_append_sheet(
    workbook,
    sheet([
      ["Date", "Narration", "Amount"],
      ...analysis.bankCharges.transactions.map((t) => [
        formatDate(t.date),
        t.narration,
        t.debit || t.credit,
      ]),
      [],
      ["Total", "", analysis.bankCharges.total],
    ]),
    "Bank Charges"
  );

  XLSX.utils.book_append_sheet(
    workbook,
    sheet([
      ["Date", "Narration", "Amount"],
      ...analysis.interest.transactions.map((t) => [
        formatDate(t.date),
        t.narration,
        t.debit || t.credit,
      ]),
      [],
      ["Total", "", analysis.interest.total],
    ]),
    "Interest"
  );

  XLSX.utils.book_append_sheet(
    workbook,
    sheet([
      ["Date", "Narration", "Debit", "Credit"],
      ...analysis.transfers.transactions.map((t) => [
        formatDate(t.date),
        t.narration,
        t.debit || "",
        t.credit || "",
      ]),
    ]),
    "Transfers"
  );

  // --- Top counterparties ---------------------------------------------------
  XLSX.utils.book_append_sheet(
    workbook,
    sheet([
      ["Party", "Paid out", "Received", "Transactions"],
      ...analysis.parties.map((row) => [row.party, row.debit, row.credit, row.count]),
    ]),
    "Counterparties"
  );

  // --- GST identification ---------------------------------------------------
  XLSX.utils.book_append_sheet(
    workbook,
    sheet([
      ["Date", "Narration", "Amount", "GST flag", "GSTIN in narration"],
      ...[...analysis.gst.relevant, ...analysis.gst.potential].map((t) => [
        formatDate(t.date),
        t.narration,
        t.debit || t.credit,
        t.gstRelevant === "RELEVANT" ? "GST relevant" : "Potentially GST relevant",
        t.gstin ?? "",
      ]),
      [],
      ["Identification only — this tool draws no GST compliance conclusions."],
    ]),
    "GST Relevant"
  );

  return workbook;
}

/** Build and download the workbook. Runs entirely client-side. */
export function downloadWorkbook(
  fileName: string,
  statements: BankStatement[],
  transactions: Transaction[],
  analysis: AnalysisResult,
  categories: Category[]
): void {
  const workbook = buildWorkbook(statements, transactions, analysis, categories);
  XLSX.writeFile(workbook, fileName, { compression: true });
}
