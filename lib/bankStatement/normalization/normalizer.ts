// Raw rows → normalised transactions.
// ---------------------------------------------------------------------------
// Every row is either resolved into a transaction or accounted for as a
// warning/unresolved row. Nothing is silently dropped — that count is what the
// review screen reports (§30).

import type {
  ColumnMapping,
  DateFormat,
  RawRow,
  RowStatus,
  Transaction,
  TransactionType,
} from "@/lib/bankStatement/types";
import { parseDate } from "@/lib/bankStatement/utils/dates";
import { parseAmount, round2 } from "@/lib/bankStatement/utils/numbers";
import { extractGstin, extractParty, extractReference, sanitiseCell } from "@/lib/bankStatement/utils/text";

export type NormaliseInput = {
  rows: RawRow[];
  mapping: ColumnMapping;
  dateFormat: DateFormat;
  statementId: string;
  currency: string;
};

export type NormaliseResult = {
  transactions: Transaction[];
  /** Rows that produced nothing usable, with the reason. */
  rejected: { row: RawRow; reason: string }[];
  /**
   * Rows with a valid date but an explicit zero amount — an opening carry
   * forward, a nil entry. Not a failure: no money moved, so there is nothing
   * to lose. Counted separately so it never inflates the unresolved figure.
   */
  skipped: { row: RawRow; reason: string }[];
  /** Rows that continued a previous transaction's narration. */
  continuations: number;
  /**
   * Rows stating a balance without moving money — OPENING BALANCE, CLOSING
   * BALANCE, brought/carried forward. They are not transactions, but they are
   * the statement's own declaration of where the chain starts and ends.
   */
  balanceMarkers: { date: string; balance: number; narration: string }[];
};

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`;
}

const cell = (row: RawRow, index: number | undefined): string =>
  index === undefined ? "" : sanitiseCell(row.cells[index] ?? "");

/**
 * Turn extracted rows into transactions.
 *
 * Wrapped narration is common in PDFs: a row with no date and no amount that
 * carries text is folded into the previous transaction rather than counted as
 * a failure.
 */
export function normalise(input: NormaliseInput): NormaliseResult {
  const { rows, mapping, dateFormat, statementId, currency } = input;

  const transactions: Transaction[] = [];
  const rejected: { row: RawRow; reason: string }[] = [];
  const skipped: { row: RawRow; reason: string }[] = [];
  const balanceMarkers: { date: string; balance: number; narration: string }[] = [];
  let continuations = 0;

  for (const row of rows) {
    const dateText = cell(row, mapping.date);
    const date = parseDate(dateText, dateFormat);

    const debitRaw = parseAmount(cell(row, mapping.debit));
    const creditRaw = parseAmount(cell(row, mapping.credit));
    const amountRaw = parseAmount(cell(row, mapping.amount));
    const hasAmount = debitRaw !== null || creditRaw !== null || amountRaw !== null;

    const narrationText = cell(row, mapping.narration);

    if (!date) {
      // No date, no amount, but some text → wrapped narration.
      if (!hasAmount && narrationText && transactions.length > 0) {
        const previous = transactions[transactions.length - 1];
        previous.narration = `${previous.narration} ${narrationText}`.trim();
        continuations += 1;
        continue;
      }
      if (!hasAmount && !narrationText) continue; // decorative/blank row
      rejected.push({
        row,
        reason: dateText ? `Unreadable date "${dateText}"` : "No date on a row carrying an amount",
      });
      continue;
    }

    let debit = 0;
    let credit = 0;
    let status: RowStatus = "VALID";
    let issue: string | undefined;

    if (debitRaw !== null || creditRaw !== null) {
      debit = Math.abs(debitRaw ?? 0);
      credit = Math.abs(creditRaw ?? 0);
      // Both sides filled is almost always a column mis-read, not a real row.
      if (debit > 0 && credit > 0) {
        status = "UNRESOLVED";
        issue = "Row has both a debit and a credit amount";
      }
    } else if (amountRaw !== null) {
      const direction = cell(row, mapping.direction).toUpperCase();
      const isDebit = direction.startsWith("DR") || (direction === "" && amountRaw < 0);
      if (isDebit) debit = Math.abs(amountRaw);
      else credit = Math.abs(amountRaw);
    } else {
      // A dated row with a balance but no debit or credit is a balance
      // marker, not a failed extraction — no money moved, so nothing is lost
      // by setting it aside, and the balance itself is worth keeping.
      const markerBalance = parseAmount(cell(row, mapping.balance));
      if (markerBalance !== null) {
        balanceMarkers.push({
          date,
          balance: round2(markerBalance),
          narration: narrationText,
        });
        skipped.push({ row, reason: "Balance marker row — no money moved" });
        continue;
      }
      rejected.push({ row, reason: "No amount on the row" });
      continue;
    }

    if (debit === 0 && credit === 0) {
      // An explicit zero is a real, readable value — this row simply moved no
      // money (an opening carry forward, a nil entry). Skipping it loses
      // nothing, so it is not an extraction failure.
      skipped.push({ row, reason: "Row has a zero amount — no money moved" });
      continue;
    }

    const balance = parseAmount(cell(row, mapping.balance));
    const narration = narrationText || "(no narration)";
    if (!narrationText) {
      status = status === "VALID" ? "WARNING" : status;
      issue = issue ?? "Row has no narration";
    }

    const reference = cell(row, mapping.reference) || extractReference(narration);
    const gstin = extractGstin(narration);
    const transactionType: TransactionType = debit > 0 ? "DEBIT" : "CREDIT";

    transactions.push({
      id: nextId("txn"),
      statementId,
      date,
      valueDate: parseDate(cell(row, mapping.valueDate), dateFormat) ?? undefined,
      narration,
      referenceNumber: reference || undefined,
      chequeNumber: cell(row, mapping.cheque) || undefined,
      debit: round2(debit),
      credit: round2(credit),
      balance: balance === null ? undefined : round2(balance),
      currency,
      transactionType,
      partyName: extractParty(narration),
      gstin,
      classificationType: "UNKNOWN",
      classificationSource: "UNCLASSIFIED",
      sourcePage: row.page,
      sourceRow: row.row,
      rowStatus: status,
      rowIssue: issue,
      createdAt: new Date().toISOString(),
    });
  }

  return { transactions, rejected, skipped, continuations, balanceMarkers };
}
