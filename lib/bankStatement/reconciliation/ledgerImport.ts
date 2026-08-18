// Ledger / books import for reconciliation (decision 21).
// Flexible column mapping over CSV, XLS and XLSX — the same detection the
// statement importer uses, so a Tally or Excel export needs no fixed template.

import type { ColumnMapping, DateFormat, LedgerEntry, RawRow } from "@/lib/bankStatement/types";
import { parseCsv } from "@/lib/bankStatement/parser/csv";
import { parseWorkbook } from "@/lib/bankStatement/parser/excel";
import { detectMapping, findHeaderRow } from "@/lib/bankStatement/parser/columns";
import { detectDateFormat, parseDate } from "@/lib/bankStatement/utils/dates";
import { parseAmount, round2 } from "@/lib/bankStatement/utils/numbers";
import { sanitiseCell } from "@/lib/bankStatement/utils/text";

export type LedgerImport = {
  entries: LedgerEntry[];
  headers: string[];
  mapping: ColumnMapping;
  dateFormat: DateFormat;
  skipped: number;
};

let ledgerCounter = 0;
function nextId(): string {
  ledgerCounter += 1;
  return `led-${Date.now().toString(36)}-${ledgerCounter.toString(36)}`;
}

export async function readLedgerFile(file: File): Promise<{ rows: RawRow[] }> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".csv")) {
    return { rows: parseCsv(await file.text()) };
  }
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    const { rows } = parseWorkbook(await file.arrayBuffer());
    return { rows };
  }
  throw new Error("Import your books as CSV, XLS or XLSX.");
}

/** Rows → ledger entries, using a detected or CA-corrected mapping. */
export function buildLedger(
  rows: RawRow[],
  overrides: { mapping?: ColumnMapping; dateFormat?: DateFormat } = {}
): LedgerImport {
  const headerIndex = findHeaderRow(rows);
  const headers = headerIndex >= 0 ? rows[headerIndex].cells : [];
  const dataRows = headerIndex >= 0 ? rows.slice(headerIndex + 1) : rows;

  const mapping = overrides.mapping ?? detectMapping(headers, dataRows);
  const samples =
    mapping.date === undefined
      ? []
      : dataRows.slice(0, 120).map((row) => row.cells[mapping.date as number] ?? "");
  const dateFormat = overrides.dateFormat ?? detectDateFormat(samples).format;

  const entries: LedgerEntry[] = [];
  let skipped = 0;

  for (const row of dataRows) {
    const cell = (index: number | undefined) =>
      index === undefined ? "" : sanitiseCell(row.cells[index] ?? "");

    const date = parseDate(cell(mapping.date), dateFormat);
    if (!date) {
      skipped += 1;
      continue;
    }

    const debitRaw = parseAmount(cell(mapping.debit));
    const creditRaw = parseAmount(cell(mapping.credit));
    const amountRaw = parseAmount(cell(mapping.amount));

    let debit = 0;
    let credit = 0;
    if (debitRaw !== null || creditRaw !== null) {
      debit = Math.abs(debitRaw ?? 0);
      credit = Math.abs(creditRaw ?? 0);
    } else if (amountRaw !== null) {
      const direction = cell(mapping.direction).toUpperCase();
      if (direction.startsWith("DR") || (direction === "" && amountRaw < 0)) debit = Math.abs(amountRaw);
      else credit = Math.abs(amountRaw);
    } else {
      skipped += 1;
      continue;
    }

    if (debit === 0 && credit === 0) {
      skipped += 1;
      continue;
    }

    entries.push({
      id: nextId(),
      date,
      narration: cell(mapping.narration) || "(no narration)",
      reference: cell(mapping.reference) || cell(mapping.cheque) || undefined,
      debit: round2(debit),
      credit: round2(credit),
      sourceRow: row.row,
    });
  }

  return { entries, headers, mapping, dateFormat, skipped };
}

/** The optional starter template offered on the reconcile screen. */
export const LEDGER_TEMPLATE_HEADERS = [
  "Date",
  "Description",
  "Reference",
  "Debit",
  "Credit",
];
