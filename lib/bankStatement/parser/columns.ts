// Working out which column is which.
// ---------------------------------------------------------------------------
// Two passes: match the header text against known synonyms, then — for columns
// the header did not explain — look at what the cells actually contain. The
// result is always shown to the CA on the import screen so it can be corrected
// (decision 21: mapping, never a fixed template).

import type { ColumnMapping, RawRow } from "@/lib/bankStatement/types";
import { looksLikeAmount } from "@/lib/bankStatement/utils/numbers";
import { looksLikeDate } from "@/lib/bankStatement/utils/dates";
import { normaliseText } from "@/lib/bankStatement/utils/text";

type Field = keyof ColumnMapping;

/**
 * Headers arrive decorated: "Debit (₹)", "Balance (Rs.)", "Amount (INR)",
 * "Credit (in Rs)". The decoration says nothing about which field it is, so it
 * comes off before matching — otherwise every amount column on a ₹-annotated
 * statement fails to map.
 */
function stripDecoration(header: string): string {
  return normaliseText(header)
    .replace(/\(\s*(₹|RS\.?|INR|IN\s*RS\.?|IN\s*₹)\s*\)/g, " ")
    .replace(/[₹]/g, " ")
    .replace(/[.]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Header synonyms seen across Indian bank statements and accounting exports. */
const HEADER_SYNONYMS: { field: Field; patterns: RegExp[] }[] = [
  {
    field: "date",
    patterns: [/^TXN\.?\s*DATE$/, /^TRANSACTION\s*DATE$/, /^DATE$/, /^POST(ING)?\s*DATE$/, /^TRAN\.?\s*DATE$/, /^BOOKING\s*DATE$/],
  },
  { field: "valueDate", patterns: [/^VALUE\s*DATE$/, /^VAL\.?\s*DT\.?$/, /^VALUE\s*DT$/] },
  {
    field: "narration",
    patterns: [/^NARRATION$/, /^DESCRIPTION$/, /^PARTICULARS$/, /^TRANSACTION\s*(DETAILS|REMARKS|DESCRIPTION)$/, /^REMARKS$/, /^DETAILS$/, /^NARRATIVE$/],
  },
  {
    field: "reference",
    patterns: [
      // "Chq/Ref No", "Ref No./Cheque No.", "Cheque - Reference Number", "Ref No"
      /^(CHQ|CHEQUE)?[/\- ]*(REF|REFERENCE)[/\- ]*(NO|NUMBER)?$/,
      /^(REF|REFERENCE)[/\- ]*(NO|NUMBER)?[/\- ]*(CHQ|CHEQUE)[/\- ]*(NO|NUMBER)?$/,
      /^(CHQ|CHEQUE)[/\- ]*(NO|NUMBER)?[/\- ]*(REF|REFERENCE)[/\- ]*(NO|NUMBER)?$/,
      /^REF\s*NO$/,
      /^UTR$/,
      /^TRANSACTION\s*ID$/,
      /^INSTRUMENT\s*(NO|ID)$/,
    ],
  },
  { field: "cheque", patterns: [/^CHEQUE\s*(NO|NUMBER)?\.?$/, /^CHQ\.?\s*(NO|NUM)?\.?$/] },
  {
    field: "debit",
    patterns: [/^(WITHDRAWAL|WITHDRAWL)S?(\s*AMT\.?)?$/, /^DEBIT(\s*AMOUNT)?$/, /^DR\.?$/, /^PAYMENTS?$/, /^WITHDRAWALS?\s*\(DR\.?\)$/, /^DEBIT\s*\(RS\.?\)$/],
  },
  {
    field: "credit",
    patterns: [/^DEPOSITS?(\s*AMT\.?)?$/, /^CREDIT(\s*AMOUNT)?$/, /^CR\.?$/, /^RECEIPTS?$/, /^DEPOSITS?\s*\(CR\.?\)$/, /^CREDIT\s*\(RS\.?\)$/],
  },
  { field: "amount", patterns: [/^AMOUNT$/, /^AMT\.?$/, /^TRANSACTION\s*AMOUNT$/, /^VALUE$/] },
  { field: "balance", patterns: [/^(CLOSING\s*)?BALANCE$/, /^BAL\.?$/, /^RUNNING\s*BALANCE$/, /^BALANCE\s*\(RS\.?\)$/] },
  { field: "direction", patterns: [/^(DR|CR)\.?\s*\/?\s*(CR|DR)\.?$/, /^TYPE$/, /^DR\s*OR\s*CR$/, /^INDICATOR$/] },
];

/** Does this row read like a header rather than data? */
export function looksLikeHeaderRow(cells: string[]): boolean {
  const filled = cells.filter((cell) => cell.trim() !== "");
  if (filled.length < 3) return false;

  let hits = 0;
  for (const cell of filled) {
    const text = stripDecoration(cell);
    for (const { patterns } of HEADER_SYNONYMS) {
      if (patterns.some((pattern) => pattern.test(text))) {
        hits += 1;
        break;
      }
    }
  }
  // A header needs a date-ish column and at least two other recognised ones.
  return hits >= 3;
}

/**
 * Find the header row in the first `limit` rows. Statements carry a preamble
 * (bank name, account details) before the table starts.
 */
export function findHeaderRow(rows: RawRow[], limit = 40): number {
  const end = Math.min(rows.length, limit);
  for (let i = 0; i < end; i += 1) {
    if (looksLikeHeaderRow(rows[i].cells)) return i;
  }
  return -1;
}

/** Map columns from header text alone. */
export function mapFromHeaders(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};

  headers.forEach((header, index) => {
    const text = stripDecoration(header);
    if (!text) return;
    for (const { field, patterns } of HEADER_SYNONYMS) {
      if (mapping[field] !== undefined) continue;
      if (patterns.some((pattern) => pattern.test(text))) {
        mapping[field] = index;
        return;
      }
    }
  });

  // "Amount" alongside an explicit debit and credit column is redundant.
  if (mapping.debit !== undefined && mapping.credit !== undefined) delete mapping.amount;
  return mapping;
}

/**
 * Fill gaps by looking at the data. Only ever *adds* to the mapping — anything
 * the header already settled wins.
 */
export function inferFromContent(rows: RawRow[], mapping: ColumnMapping): ColumnMapping {
  const result: ColumnMapping = { ...mapping };
  const sample = rows.slice(0, 60);
  if (sample.length === 0) return result;

  const width = sample.reduce((max, row) => Math.max(max, row.cells.length), 0);
  const taken = new Set(Object.values(result).filter((v): v is number => typeof v === "number"));

  const stats = Array.from({ length: width }, (_, column) => {
    let dates = 0;
    let amounts = 0;
    let codes = 0;
    let text = 0;
    let filled = 0;
    for (const row of sample) {
      const cell = (row.cells[column] ?? "").trim();
      if (cell === "") continue;
      filled += 1;
      if (looksLikeDate(cell)) dates += 1;
      // A short unbroken integer with no decimal point is a code (branch,
      // office, cheque), not an amount. Treating it as money is how a branch
      // code ends up mapped as the debit column.
      else if (/^\d{1,6}$/.test(cell)) codes += 1;
      else if (looksLikeAmount(cell)) amounts += 1;
      else text += 1;
    }
    return { column, dates, amounts, codes, text, filled };
  });

  if (result.date === undefined) {
    const best = stats
      .filter((s) => !taken.has(s.column) && s.filled > 0 && s.dates / s.filled > 0.7)
      .sort((a, b) => b.dates - a.dates)[0];
    if (best) {
      result.date = best.column;
      taken.add(best.column);
    }
  }

  if (result.narration === undefined) {
    const best = stats
      .filter((s) => !taken.has(s.column) && s.filled > 0 && s.text / s.filled > 0.6)
      .sort((a, b) => b.text - a.text)[0];
    if (best) {
      result.narration = best.column;
      taken.add(best.column);
    }
  }

  // Amount-ish columns left over, in column order: the last one is usually the
  // running balance, and the ones before it are debit/credit or a single amount.
  const numeric = stats
    .filter((s) => !taken.has(s.column) && s.filled > 0 && s.amounts / s.filled > 0.7)
    .sort((a, b) => a.column - b.column);

  const hasDebitCredit = result.debit !== undefined || result.credit !== undefined;

  if (result.balance === undefined && numeric.length >= 3 && !hasDebitCredit) {
    result.balance = numeric[numeric.length - 1].column;
    numeric.pop();
  }

  if (!hasDebitCredit && result.amount === undefined) {
    if (numeric.length >= 2) {
      result.debit = numeric[0].column;
      result.credit = numeric[1].column;
    } else if (numeric.length === 1) {
      result.amount = numeric[0].column;
    }
  } else if (result.balance === undefined && numeric.length >= 1) {
    result.balance = numeric[numeric.length - 1].column;
  }

  return result;
}

/** Header + content, in that order of authority. */
export function detectMapping(headers: string[], dataRows: RawRow[]): ColumnMapping {
  return inferFromContent(dataRows, mapFromHeaders(headers));
}

/** A mapping is usable when we know the date and at least one amount column. */
export function isMappingUsable(mapping: ColumnMapping): boolean {
  const hasAmount =
    mapping.debit !== undefined || mapping.credit !== undefined || mapping.amount !== undefined;
  return mapping.date !== undefined && hasAmount;
}

/** What is still missing, phrased for the import screen. */
export function describeMappingGaps(mapping: ColumnMapping): string[] {
  const gaps: string[] = [];
  if (mapping.date === undefined) gaps.push("date column");
  if (mapping.debit === undefined && mapping.credit === undefined && mapping.amount === undefined) {
    gaps.push("debit/credit or amount column");
  }
  if (mapping.narration === undefined) gaps.push("narration column");
  return gaps;
}
