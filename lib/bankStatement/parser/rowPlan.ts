// The CA's corrections to the shape of the extracted table.
// ---------------------------------------------------------------------------
// Detection gets the table right most of the time. When it does not, the useful
// thing is not a better guess — it is letting someone who can see the file say
// where the table starts, which rows are not transactions, and which lines are
// really the tail of the row above.
//
// A plan is expressed in indices into the *extracted* grid, so it survives
// being saved and replayed against the same statement, and reads the same way
// in the UI as it does here: "rows 0–6 are the letterhead, row 7 is the header,
// row 214 is a subtotal, row 88 is the second line of row 87".
//
// Pure. No DOM, no file, no model.

import type { RawRow } from "@/lib/bankStatement/types";

export type RowPlan = {
  /** First row of the table. Everything above it is preamble. */
  startRow?: number;
  /** Last row of the table, inclusive. Everything below is footer. */
  endRow?: number;
  /** The column header row, when the CA points at one. */
  headerRow?: number;
  /** Rows that are not transactions: subtotals, page furniture, blank rules. */
  skipRows?: number[];
  /**
   * Rows that are the continuation of the row above — a narration that wrapped
   * onto a second line. Folded into the previous kept row rather than dropped,
   * because the text usually matters.
   */
  mergeUp?: number[];
};

export const EMPTY_ROW_PLAN: RowPlan = {};

export function isRowPlanEmpty(plan: RowPlan): boolean {
  return (
    plan.startRow === undefined &&
    plan.endRow === undefined &&
    plan.headerRow === undefined &&
    (plan.skipRows === undefined || plan.skipRows.length === 0) &&
    (plan.mergeUp === undefined || plan.mergeUp.length === 0)
  );
}

/** Fold a continuation row into the row above it, column by column. */
function mergeInto(target: RawRow, continuation: RawRow): RawRow {
  const width = Math.max(target.cells.length, continuation.cells.length);
  const cells: string[] = [];

  for (let index = 0; index < width; index += 1) {
    const head = (target.cells[index] ?? "").trim();
    const tail = (continuation.cells[index] ?? "").trim();
    cells.push(head && tail ? `${head} ${tail}` : head || tail);
  }

  return { ...target, cells };
}

/**
 * Apply a plan to the extracted grid.
 *
 * Returns the rows the parser should work on and where the header ended up in
 * them — the plan's indices point at the original grid, and everything shifts
 * once rows are dropped and merged, so the caller is told rather than left to
 * recompute it.
 */
export function applyRowPlan(
  rows: RawRow[],
  plan: RowPlan
): { rows: RawRow[]; headerIndex: number } {
  if (rows.length === 0) return { rows: [], headerIndex: -1 };

  const start = Math.max(0, Math.min(plan.startRow ?? 0, rows.length - 1));
  const end = Math.max(start, Math.min(plan.endRow ?? rows.length - 1, rows.length - 1));
  const skip = new Set(plan.skipRows ?? []);
  const merge = new Set(plan.mergeUp ?? []);

  const kept: RawRow[] = [];
  let headerIndex = -1;

  for (let index = start; index <= end; index += 1) {
    if (skip.has(index)) continue;

    // A continuation with nothing above it cannot be folded anywhere, so it is
    // kept as an ordinary row rather than silently dropped.
    if (merge.has(index) && kept.length > 0) {
      kept[kept.length - 1] = mergeInto(kept[kept.length - 1], rows[index]);
      continue;
    }

    if (plan.headerRow === index) headerIndex = kept.length;
    kept.push({ ...rows[index], cells: [...rows[index].cells] });
  }

  return { rows: kept, headerIndex };
}

/** One line describing what a plan does, for the import screen and the audit. */
export function describeRowPlan(plan: RowPlan): string {
  const parts: string[] = [];

  if (plan.startRow !== undefined || plan.endRow !== undefined) {
    const from = plan.startRow !== undefined ? plan.startRow + 1 : 1;
    const to = plan.endRow !== undefined ? plan.endRow + 1 : "end";
    parts.push(`rows ${from}–${to}`);
  }
  if (plan.headerRow !== undefined) parts.push(`header on row ${plan.headerRow + 1}`);
  if (plan.skipRows && plan.skipRows.length > 0) {
    parts.push(`${plan.skipRows.length} row${plan.skipRows.length === 1 ? "" : "s"} skipped`);
  }
  if (plan.mergeUp && plan.mergeUp.length > 0) {
    parts.push(`${plan.mergeUp.length} row${plan.mergeUp.length === 1 ? "" : "s"} joined to the row above`);
  }

  return parts.length > 0 ? parts.join(" · ") : "No changes";
}

const DATE_CELL = /\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{4}-\d{2}-\d{2}/;
const AMOUNT_CELL = /\d[\d,]*\.\d{2}\s*(CR|DR)?$/i;

function hasDate(cells: string[]): boolean {
  return cells.some((cell) => DATE_CELL.test(cell));
}

function hasAmount(cells: string[]): boolean {
  return cells.some((cell) => AMOUNT_CELL.test(cell));
}

/**
 * Rows that look like the tail of the row above: no date-ish cell, no
 * amount-ish cell, but some text. Offered as a suggestion the CA can accept in
 * one press — the commonest repair on a PDF statement, and tedious by hand.
 *
 * Suggestions are bounded by the first and last rows that look like
 * transactions. A letterhead and a page footer are also "text with no date and
 * no amount", and gluing the bank's address or "Page 1 of 3" onto a transaction
 * would be worse than suggesting nothing — the CA has usually set no markers at
 * all at the point they reach for this button, so it has to be safe without
 * them. A continuation always has a transaction above it and, being part of the
 * table, never appears after the last one.
 */
export function suggestMergeUp(rows: RawRow[], plan: RowPlan): number[] {
  const end = Math.min(plan.endRow ?? rows.length - 1, rows.length - 1);
  const skip = new Set(plan.skipRows ?? []);

  const explicitStart = Math.max(0, plan.startRow ?? 0);

  const isTransaction = (index: number) => {
    if (skip.has(index) || index === plan.headerRow) return false;
    const cells = rows[index].cells.map((cell) => cell.trim());
    return hasDate(cells) && hasAmount(cells);
  };

  let firstTransaction = -1;
  for (let index = explicitStart; index <= end; index += 1) {
    if (isTransaction(index)) {
      firstTransaction = index;
      break;
    }
  }
  if (firstTransaction === -1) return [];

  let lastTransaction = firstTransaction;
  for (let index = end; index > firstTransaction; index -= 1) {
    if (isTransaction(index)) {
      lastTransaction = index;
      break;
    }
  }

  const suggestions: number[] = [];

  for (let index = firstTransaction + 1; index <= lastTransaction; index += 1) {
    if (skip.has(index) || index === plan.headerRow) continue;

    const cells = rows[index].cells.map((cell) => cell.trim());
    if (cells.join(" ").trim() === "") continue;

    if (!hasDate(cells) && !hasAmount(cells)) suggestions.push(index);
  }

  return suggestions;
}
