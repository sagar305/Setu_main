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

export class PdfPasswordRequiredError extends Error {
  /** True when the user supplied a password and it was wrong. */
  readonly incorrect: boolean;
  constructor(incorrect: boolean) {
    super(incorrect ? "Incorrect password." : "Password required.");
    this.name = "PdfPasswordRequiredError";
    this.incorrect = incorrect;
  }
}

type TextItem = { text: string; x: number; y: number; width: number };

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

/** Load PDF.js and point it at its worker. Browser only. */
async function loadPdfjs(): Promise<PdfJsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url
      ).toString();
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
    page.cleanup();

    const lines = groupIntoLines(items);
    pageText.push(lines.map((line) => line.map((i) => i.text).join(" ")).join("\n"));

    const boundaries = columnBoundaries(lines);
    lines.forEach((line, index) => {
      const cells = splitIntoColumns(line, boundaries);
      if (cells.every((cell) => cell === "")) return;
      rows.push({ cells, page: pageNumber, row: index + 1 });
    });
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
function groupIntoLines(items: TextItem[]): TextItem[][] {
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
 * Find the x positions that repeat across many lines — those are the column
 * starts. Positions are rounded into 4pt buckets so slight kerning differences
 * between rows still land together.
 */
function columnBoundaries(lines: TextItem[][]): number[] {
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

  // Merge starts that sit within 12pt of each other — same column, ragged text.
  const merged: number[] = [];
  for (const start of starts) {
    if (merged.length === 0 || start - merged[merged.length - 1] > 12) merged.push(start);
  }
  return merged;
}

function splitIntoColumns(line: TextItem[], boundaries: number[]): string[] {
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
