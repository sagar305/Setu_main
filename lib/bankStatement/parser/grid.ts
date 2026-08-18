// Reading the table a statement actually drew.
// ---------------------------------------------------------------------------
// Most Indian bank statements render the transaction table with ruled borders.
// Those rules are vector paths in the page's operator list, and they are the
// document's own declaration of where every column and row begins and ends.
// Using them beats inferring structure from text positions, because it fixes
// three things geometry alone cannot:
//
//   1. Rows whose content sits on several baselines. A statement that prints
//      "01 Dec" above "2025" in a narrow date column produces three separate
//      baselines per transaction; grouping by baseline shreds every row. Row
//      bands from the horizontal rules put them back together.
//   2. Wrapped headers. "Value"/"Date" and "Credit"/"(₹)" stacked in one cell
//      reassemble into "Value Date" and "Credit (₹)".
//   3. Fused text runs. PDF.js merges adjacent cells into a single positioned
//      string — "4430 28,000.00" is a branch code and a debit amount in one
//      run. Knowing the exact boundary between the columns is what makes it
//      splittable at all; there is no flag to stop the merge in PDF.js 6.

import type { RawRow } from "@/lib/bankStatement/types";
import { sanitiseCell } from "@/lib/bankStatement/utils/text";
import type { TextItem } from "@/lib/bankStatement/parser/pdf";

export type ColumnRange = { start: number; end: number };

export type TableGrid = {
  columns: ColumnRange[];
  /** Row rule y positions, top to bottom. May be empty on a column-ruled table. */
  horizontals: number[];
};

/** Rules closer together than this are the two halves of one drawn border. */
const RULE_MERGE = 4;
/** A column narrower than this is a border artefact, not a real column. */
const MIN_COLUMN_WIDTH = 8;

type PathLike = { fnArray: unknown[]; argsArray: unknown[] };

/** Collapse near-identical rule positions into one. */
function dedupe(values: number[], tolerance = RULE_MERGE): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const merged: number[] = [];
  for (const value of sorted) {
    const last = merged[merged.length - 1];
    if (last !== undefined && value - last <= tolerance) {
      // Keep the midpoint of the pair — a drawn border has thickness.
      merged[merged.length - 1] = (last + value) / 2;
    } else {
      merged.push(value);
    }
  }
  return merged;
}

/**
 * Pull the ruled lines out of a page's operator list. Returns null when the
 * page has no table rules, which is the signal to fall back to text geometry.
 */
export function gridFromOperatorList(
  operatorList: PathLike,
  constructPathOp: number
): TableGrid | null {
  const verticals: number[] = [];
  const horizontals: number[] = [];

  for (let i = 0; i < operatorList.fnArray.length; i += 1) {
    if (operatorList.fnArray[i] !== constructPathOp) continue;

    // args are [op, segments, boundingBox]; the bounding box is all we need.
    const args = operatorList.argsArray[i] as unknown[];
    const box = args?.[2] as ArrayLike<number> | undefined;
    if (!box) continue;

    const x0 = Number(box[0]);
    const y0 = Number(box[1]);
    const x1 = Number(box[2]);
    const y1 = Number(box[3]);
    if (![x0, y0, x1, y1].every(Number.isFinite)) continue;

    const width = Math.abs(x1 - x0);
    const height = Math.abs(y1 - y0);

    // Thin and tall is a column rule; thin and wide is a row rule.
    if (width < 2.5 && height > 8) verticals.push((x0 + x1) / 2);
    else if (height < 2.5 && width > 20) horizontals.push((y0 + y1) / 2);
  }

  const columnEdges = dedupe(verticals);
  if (columnEdges.length < 3) return null; // not a ruled table

  const columns: ColumnRange[] = [];
  for (let i = 0; i < columnEdges.length - 1; i += 1) {
    const start = columnEdges[i];
    const end = columnEdges[i + 1];
    if (end - start >= MIN_COLUMN_WIDTH) columns.push({ start, end });
  }
  if (columns.length < 2) return null;

  return {
    columns,
    horizontals: dedupe(horizontals).sort((a, b) => b - a),
  };
}

/**
 * Split a run that straddles a column boundary.
 *
 * PDF.js hands back "4430 28,000.00" as one string spanning two columns. We
 * know where the boundary is, so we can estimate which character sits on it —
 * proportionally across the run's width — and cut at the nearest space. If
 * there is no space near the estimate we leave the run intact rather than
 * slicing a number in half; a fused cell is recoverable by hand, a mangled
 * amount is not.
 */
function splitAcrossBoundaries(item: TextItem, columns: ColumnRange[]): TextItem[] {
  const left = item.x;
  const right = item.x + item.width;
  if (item.width <= 0 || item.text.length < 2) return [item];

  const crossings = columns
    .map((column) => column.start)
    .filter((edge) => edge > left + 1 && edge < right - 1)
    .sort((a, b) => a - b);
  if (crossings.length === 0) return [item];

  const pieces: TextItem[] = [];
  let text = item.text;
  let originX = left;

  for (const edge of crossings) {
    const fraction = (edge - originX) / (right - originX);
    if (!Number.isFinite(fraction) || fraction <= 0 || fraction >= 1) continue;

    const estimate = Math.round(fraction * text.length);
    // Only cut on whitespace, and only near where the boundary actually falls.
    let cut = -1;
    for (let distance = 0; distance <= 3; distance += 1) {
      if (text[estimate - distance] === " ") {
        cut = estimate - distance;
        break;
      }
      if (text[estimate + distance] === " ") {
        cut = estimate + distance;
        break;
      }
    }
    if (cut <= 0 || cut >= text.length - 1) continue;

    const head = text.slice(0, cut);
    const headWidth = ((right - originX) * cut) / text.length;
    pieces.push({ text: head, x: originX, y: item.y, width: headWidth });

    text = text.slice(cut + 1);
    originX = originX + headWidth;
  }

  pieces.push({ text, x: originX, y: item.y, width: Math.max(0, right - originX) });
  return pieces;
}

/** Which column does this run belong to? Decided by its midpoint. */
function columnOf(item: TextItem, columns: ColumnRange[]): number {
  const centre = item.x + item.width / 2;
  for (let i = 0; i < columns.length; i += 1) {
    if (centre >= columns[i].start && centre <= columns[i].end) return i;
  }
  // Outside the ruled area (page furniture) — ignore rather than misfile it.
  return -1;
}

/**
 * Group runs into row bands.
 *
 * With row rules we use them directly. Without them we anchor on the column
 * that carries exactly one run per transaction — in practice the balance or
 * the narration — and take the midpoints between consecutive anchors.
 */
function rowBands(items: TextItem[], grid: TableGrid): { top: number; bottom: number }[] {
  // Row rules for THIS page are the best answer. They must never be borrowed
  // from another page: the table starts at a different height once the
  // letterhead is gone, so page 1's bands would silently drop rows lower down.
  if (grid.horizontals.length >= 3) {
    const bands: { top: number; bottom: number }[] = [];
    for (let i = 0; i < grid.horizontals.length - 1; i += 1) {
      bands.push({ top: grid.horizontals[i], bottom: grid.horizontals[i + 1] });
    }
    return bands;
  }
  return bandsFromBaselineGaps(items);
}

/**
 * Fallback banding for a page with no row rules.
 *
 * One transaction can occupy several baselines — a date wrapped as "01 Dec"
 * over "2025", a narration running to a second line. Those baselines sit a few
 * points apart, while consecutive transactions sit much further apart. So we
 * measure the gaps, and if they separate into a tight cluster and a wide one,
 * we cut rows at the midpoint between the two. With only one cluster (a plain
 * one-line-per-row table) every gap is a row break, which is also correct.
 */
export function bandsFromBaselineGaps(items: TextItem[]): { top: number; bottom: number }[] {
  const baselines = [...new Set(items.map((item) => Math.round(item.y * 2) / 2))].sort(
    (a, b) => b - a
  );
  if (baselines.length < 2) return [];

  const gaps = baselines.slice(1).map((y, i) => baselines[i] - y).filter((g) => g > 0);
  if (gaps.length === 0) return [];

  const sorted = [...gaps].sort((a, b) => a - b);
  const smallest = sorted[0];
  const largest = sorted[sorted.length - 1];

  // Split point between "same row, next line" and "next row".
  let threshold = Number.POSITIVE_INFINITY;
  if (largest > smallest * 2.2) {
    const midpoint = (smallest + largest) / 2;
    const below = sorted.filter((g) => g <= midpoint);
    const above = sorted.filter((g) => g > midpoint);
    if (below.length > 0 && above.length > 0) {
      threshold = (below[below.length - 1] + above[0]) / 2;
    }
  }

  const bands: { top: number; bottom: number }[] = [];
  let start = baselines[0];
  for (let i = 1; i < baselines.length; i += 1) {
    if (baselines[i - 1] - baselines[i] > threshold) {
      bands.push({ top: start + 1, bottom: (baselines[i - 1] + baselines[i]) / 2 });
      start = (baselines[i - 1] + baselines[i]) / 2;
    }
  }
  bands.push({ top: start + 1, bottom: baselines[baselines.length - 1] - 1 });
  return bands;
}

/**
 * Turn a page's text runs into rows using the drawn grid. Runs outside the
 * ruled table (letterhead, footers) are left out — they are still available
 * through the page's plain text for metadata extraction.
 */
export function rowsFromGrid(
  items: TextItem[],
  grid: TableGrid,
  pageNumber: number
): RawRow[] {
  const split = items.flatMap((item) => splitAcrossBoundaries(item, grid.columns));
  const bands = rowBands(split, grid);
  if (bands.length === 0) return [];

  const rows: RawRow[] = [];

  bands.forEach((band, index) => {
    // Several runs can share a cell — a wrapped date, a wrapped narration, a
    // stacked header. Keep them top-to-bottom, then left-to-right.
    const cells: TextItem[][] = grid.columns.map(() => []);
    for (const item of split) {
      if (item.y > band.top || item.y <= band.bottom) continue;
      const column = columnOf(item, grid.columns);
      if (column < 0) continue;
      cells[column].push(item);
    }

    const text = cells.map((runs) =>
      sanitiseCell(
        runs
          .sort((a, b) => b.y - a.y || a.x - b.x)
          .map((run) => run.text)
          .join(" ")
      )
    );

    if (text.every((cell) => cell === "")) return;
    rows.push({ cells: text, page: pageNumber, row: index + 1 });
  });

  return rows;
}
