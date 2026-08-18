// PDF → raw rows, using PDF.js.
// ---------------------------------------------------------------------------
// A statement PDF has no table structure — only positioned text runs. We
// rebuild rows geometrically:
//
//   1. group text items into lines by their y position,
//   2. find the x positions where columns start, across the whole page,
//   3. drop each line's items into those column buckets.
//
// PDF.js does the decoding in its own worker, so this is the one genuinely
// off-main-thread stage of the import. Nothing embedded in the PDF is ever
// executed: we only read the text layer (§20).

import type { RawRow } from "@/lib/bankStatement/types";
import { sanitiseCell } from "@/lib/bankStatement/utils/text";
import { gridFromOperatorList, rowsFromGrid, type TableGrid } from "@/lib/bankStatement/parser/grid";

export class PdfPasswordRequiredError extends Error {
  /** True when the user supplied a password and it was wrong. */
  readonly incorrect: boolean;
  constructor(incorrect: boolean) {
    super(incorrect ? "Incorrect password." : "Password required.");
    this.name = "PdfPasswordRequiredError";
    this.incorrect = incorrect;
  }
}

export type TextItem = { text: string; x: number; y: number; width: number };

export type PdfExtraction = {
  rows: RawRow[];
  pageCount: number;
  /** Every line of text, page by page — used for header/bank detection. */
  pageText: string[];
  /** True when pages carried no text layer at all (a scan). */
  looksScanned: boolean;
};

type PdfJsModule = typeof import("pdfjs-dist");

let pdfjsPromise: Promise<PdfJsModule> | null = null;

/**
 * Load PDF.js and point it at its worker. Browser only.
 *
 * We deliberately use the LEGACY build. The modern one calls
 * `Map.prototype.getOrInsertComputed` inside getOperatorList() — a very new
 * proposal method — so reading a page's drawn table rules throws on anything
 * but a bleeding-edge browser. The legacy bundle carries the polyfills, which
 * also buys us Safari and older Chrome/Edge for every other stage. A CA should
 * not need this month's browser to read a bank statement.
 */
async function loadPdfjs(): Promise<PdfJsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = (await import(
        /* webpackChunkName: "pdfjs-legacy" */ "pdfjs-dist/legacy/build/pdf.mjs"
      )) as unknown as PdfJsModule;
      // Leave an already-configured worker alone, so a host that knows better
      // (a headless harness, say) can point PDF.js at its own copy.
      if (!pdfjs.GlobalWorkerOptions.workerSrc) {
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
          import.meta.url
        ).toString();
      }
      return pdfjs;
    })();
  }
  return pdfjsPromise;
}

export async function extractPdf(
  data: ArrayBuffer,
  options: {
    password?: string;
    onProgress?: (page: number, total: number) => void;
  } = {}
): Promise<PdfExtraction> {
  const pdfjs = await loadPdfjs();

  // PDF.js transfers and neuters the buffer, so hand it a copy — the caller may
  // need to retry with a password.
  const buffer = data.slice(0);

  // PDF.js 6 dropped its eval-based font path entirely, so there is no
  // isEvalSupported flag to turn off any more — nothing here evaluates code
  // from the file (decision 31). We only ever read the text layer.
  const task = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    password: options.password,
    useSystemFonts: false,
  });

  let document;
  try {
    document = await task.promise;
  } catch (error) {
    const name = (error as { name?: string })?.name;
    if (name === "PasswordException") {
      const code = (error as { code?: number })?.code;
      // 1 = NEED_PASSWORD, 2 = INCORRECT_PASSWORD
      throw new PdfPasswordRequiredError(code === 2);
    }
    throw error;
  }

  const pageCount = document.numPages;
  const rows: RawRow[] = [];
  const pageText: string[] = [];
  let textItemCount = 0;

  // Column geometry is the same on every page and is remembered, but ROW rules
  // are per page — the table sits higher once the letterhead is gone — so they
  // are read fresh each time. Borrowing page 1's rows drops everything that
  // falls outside them, silently, which is the worst failure this tool can have.
  let columns: TableGrid["columns"] | null = null;
  let gridUnavailable = false;

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    options.onProgress?.(pageNumber, pageCount);

    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();

    const items: TextItem[] = [];
    for (const item of content.items) {
      const textItem = item as { str?: string; transform?: number[]; width?: number };
      const text = (textItem.str ?? "").trim();
      if (text === "") continue;
      const transform = textItem.transform ?? [1, 0, 0, 1, 0, 0];
      items.push({
        text,
        x: transform[4],
        y: transform[5],
        width: textItem.width ?? 0,
      });
    }
    textItemCount += items.length;

    const lines = groupIntoLines(items);
    pageText.push(lines.map((line) => line.map((i) => i.text).join(" ")).join("\n"));

    // 1 — the table the document drew, if it drew one. This is the only
    // strategy that survives rows split across several baselines.
    let pageGrid: TableGrid | null = null;
    if (!gridUnavailable) {
      try {
        const operatorList = await page.getOperatorList();
        pageGrid = gridFromOperatorList(operatorList, pdfjs.OPS.constructPath);
        if (pageGrid) columns = columns ?? pageGrid.columns;
        else if (columns) {
          // This page drew no rules of its own — keep the known columns and
          // let the row bands be derived from the text.
          pageGrid = { columns, horizontals: [] };
        } else if (pageNumber >= 3) {
          // Three pages in with no rules anywhere: stop paying for op lists.
          gridUnavailable = true;
        }
      } catch {
        gridUnavailable = true; // no operator list available — use geometry
      }
    } else if (columns) {
      pageGrid = { columns, horizontals: [] };
    }

    const gridRows = pageGrid ? rowsFromGrid(items, pageGrid, pageNumber) : [];
    if (gridRows.length > 0) {
      rows.push(...gridRows);
      page.cleanup();
      continue;
    }

    // 2 — no usable grid: infer columns from where text never appears, which
    // handles right-aligned amounts. 3 — failing that, cluster left edges.
    const ranges = columnRanges(lines);
    const boundaries = ranges.length >= 2 ? null : leftEdgeBoundaries(lines);

    lines.forEach((line, index) => {
      const cells = boundaries
        ? splitIntoColumns(line, boundaries)
        : splitIntoRanges(line, ranges);
      if (cells.every((cell) => cell === "")) return;
      rows.push({ cells, page: pageNumber, row: index + 1 });
    });
    page.cleanup();
  }

  // Destroying the loading task tears down the document and its worker port.
  await task.destroy();

  return {
    rows,
    pageCount,
    pageText,
    looksScanned: textItemCount < pageCount * 5,
  };
}

/** Cluster items into lines by y, then order each line left to right. */
export function groupIntoLines(items: TextItem[]): TextItem[][] {
  if (items.length === 0) return [];

  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: TextItem[][] = [];
  let current: TextItem[] = [sorted[0]];
  let currentY = sorted[0].y;

  for (let i = 1; i < sorted.length; i += 1) {
    const item = sorted[i];
    // 2.5pt of drift still counts as the same visual line.
    if (Math.abs(item.y - currentY) <= 2.5) {
      current.push(item);
    } else {
      lines.push(current.sort((a, b) => a.x - b.x));
      current = [item];
      currentY = item.y;
    }
  }
  lines.push(current.sort((a, b) => a.x - b.x));
  return lines;
}

/**
 * Work out where the columns are.
 * ---------------------------------------------------------------------------
 * Clustering the LEFT edge of each text run only works when every column is
 * left-aligned. Real statements right-align the amount columns, so a short
 * amount ("710.00") starts far to the right of a long one ("1,38,162.00") and
 * left-edge clustering scatters them across the wrong columns.
 *
 * So instead of guessing where text starts, we find where text never appears:
 * project every run onto the horizontal axis, and the vertical strips of
 * whitespace that survive across the whole page are the column separators.
 * That works the same for left-, right- and centre-aligned columns.
 */
export type ColumnRange = { start: number; end: number };

/** Whitespace narrower than this is a word gap, not a column separator. */
const MIN_SEPARATOR = 4;

export function columnRanges(lines: TextItem[][]): ColumnRange[] {
  // Only rows that look like table rows get a vote. A wide letterhead line
  // would otherwise paint over every separator on the page.
  const tableLines = lines.filter((line) => line.length >= 3);
  if (tableLines.length < 3) return [];

  let maxX = 0;
  for (const line of tableLines) {
    for (const item of line) maxX = Math.max(maxX, item.x + item.width);
  }
  if (maxX <= 0) return [];

  // 1pt bins: covered[i] is how many table rows have text over that point.
  const covered = new Uint32Array(Math.ceil(maxX) + 2);
  for (const line of tableLines) {
    for (const item of line) {
      const from = Math.max(0, Math.floor(item.x));
      const to = Math.min(covered.length - 1, Math.ceil(item.x + item.width));
      for (let i = from; i <= to; i += 1) covered[i] += 1;
    }
  }

  // A bin counts as occupied only if a real share of rows cover it. Without
  // this, one outlier line closes a separator for the whole page: a header
  // label like "Withdrawal Amt." is wide enough to overhang the reference
  // column, and that single row would fuse the two columns together.
  const occupied = Math.max(2, Math.ceil(tableLines.length * 0.08));

  // Contiguous runs of occupied bins are candidate columns.
  const runs: ColumnRange[] = [];
  let runStart = -1;
  for (let i = 0; i < covered.length; i += 1) {
    if (covered[i] >= occupied) {
      if (runStart === -1) runStart = i;
    } else if (runStart !== -1) {
      runs.push({ start: runStart, end: i });
      runStart = -1;
    }
  }
  if (runStart !== -1) runs.push({ start: runStart, end: covered.length - 1 });

  // Merge runs separated by a gap too narrow to be a real column separator —
  // those are the spaces between words inside one cell.
  const merged: ColumnRange[] = [];
  for (const run of runs) {
    const previous = merged[merged.length - 1];
    if (previous && run.start - previous.end < MIN_SEPARATOR) previous.end = run.end;
    else merged.push({ ...run });
  }

  return merged;
}

/**
 * Fallback for pages where the whitespace projection finds nothing usable
 * (a single dense column, or too few rows): cluster left edges, which is
 * correct for a plain left-aligned layout.
 */
export function leftEdgeBoundaries(lines: TextItem[][]): number[] {
  const buckets = new Map<number, number>();
  for (const line of lines) {
    if (line.length < 2) continue;
    for (const item of line) {
      const bucket = Math.round(item.x / 4) * 4;
      buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
    }
  }

  const threshold = Math.max(3, Math.floor(lines.length * 0.15));
  const starts = [...buckets.entries()]
    .filter(([, count]) => count >= threshold)
    .map(([position]) => position)
    .sort((a, b) => a - b);

  const merged: number[] = [];
  for (const start of starts) {
    if (merged.length === 0 || start - merged[merged.length - 1] > 12) merged.push(start);
  }
  return merged;
}

/** Assign a line's runs to columns by where the middle of each run sits. */
export function splitIntoRanges(line: TextItem[], ranges: ColumnRange[]): string[] {
  const cells: string[] = new Array(ranges.length).fill("");
  for (const item of line) {
    const centre = item.x + item.width / 2;
    let column = -1;
    for (let i = 0; i < ranges.length; i += 1) {
      if (centre >= ranges[i].start && centre <= ranges[i].end) {
        column = i;
        break;
      }
    }
    // Outside every column (rare — a stray glyph): fall back to the nearest.
    if (column === -1) {
      let best = Number.POSITIVE_INFINITY;
      for (let i = 0; i < ranges.length; i += 1) {
        const distance = Math.min(
          Math.abs(centre - ranges[i].start),
          Math.abs(centre - ranges[i].end)
        );
        if (distance < best) {
          best = distance;
          column = i;
        }
      }
    }
    if (column < 0) continue;
    cells[column] = cells[column] ? `${cells[column]} ${item.text}` : item.text;
  }
  return cells.map((cell) => sanitiseCell(cell));
}

export function splitIntoColumns(line: TextItem[], boundaries: number[]): string[] {
  if (boundaries.length === 0) {
    return [sanitiseCell(line.map((item) => item.text).join(" "))];
  }

  const cells: string[] = new Array(boundaries.length).fill("");
  for (const item of line) {
    let column = 0;
    for (let i = 0; i < boundaries.length; i += 1) {
      // 6pt of slack so text starting just left of a boundary still belongs
      // to that column rather than bleeding into the previous one.
      if (item.x >= boundaries[i] - 6) column = i;
      else break;
    }
    cells[column] = cells[column] ? `${cells[column]} ${item.text}` : item.text;
  }
  return cells.map((cell) => sanitiseCell(cell));
}
