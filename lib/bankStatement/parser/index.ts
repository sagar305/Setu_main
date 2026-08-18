// The parse pipeline.
// ---------------------------------------------------------------------------
//   file → format detection → extraction → bank detection → column mapping →
//   date-format detection → normalisation → validation → statement
//
// Nothing here touches the network. The file is read with FileReader/arrayBuffer
// and stays in memory for the lifetime of the import (decision 5).

import type {
  BankStatement,
  ColumnMapping,
  DateFormat,
  ParseOutcome,
  RawRow,
  SourceFormat,
} from "@/lib/bankStatement/types";
import { parseCsv } from "@/lib/bankStatement/parser/csv";
import { parseWorkbook } from "@/lib/bankStatement/parser/excel";
import { extractPdf, PdfPasswordRequiredError } from "@/lib/bankStatement/parser/pdf";
import { detectMapping, findHeaderRow, looksLikeHeaderRow } from "@/lib/bankStatement/parser/columns";
import { extractMetadata } from "@/lib/bankStatement/parser/metadata";
import { selectAdapter, type BankAdapter } from "@/lib/bankStatement/parser/banks";
import { normalise } from "@/lib/bankStatement/normalization/normalizer";
import { parseStatusFrom, validate } from "@/lib/bankStatement/normalization/validation";
import { detectDateFormat } from "@/lib/bankStatement/utils/dates";
import { applyRowPlan, isRowPlanEmpty, type RowPlan } from "@/lib/bankStatement/parser/rowPlan";
import { normaliseText } from "@/lib/bankStatement/utils/text";

export { PdfPasswordRequiredError };

export type ParseOptions = {
  /** For encrypted PDFs. Held in memory only — never stored or logged (§12). */
  password?: string;
  /** Overrides detection when the CA has corrected the mapping. */
  mapping?: ColumnMapping;
  /** Overrides detection when the CA has resolved an ambiguous date format. */
  dateFormat?: DateFormat;
  /**
   * The CA's corrections to the table's shape — where it starts and ends, which
   * rows are not transactions, which are continuations. Applied before the
   * header is looked for, because it is what decides where the header is.
   */
  rowPlan?: RowPlan;
  onProgress?: (stage: string, current?: number, total?: number) => void;
};

export function detectFormat(fileName: string, type: string): SourceFormat | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf") || type === "application/pdf") return "PDF";
  if (lower.endsWith(".xlsx")) return "XLSX";
  if (lower.endsWith(".xls")) return "XLS";
  if (lower.endsWith(".csv") || type === "text/csv") return "CSV";
  if (type.includes("spreadsheetml")) return "XLSX";
  if (type.includes("ms-excel")) return "XLS";
  return null;
}

/** How many extracted rows the repair grid will show. */
const MAX_GRID_ROWS = 5000;

let statementCounter = 0;
function nextStatementId(): string {
  statementCounter += 1;
  return `stmt-${Date.now().toString(36)}-${statementCounter.toString(36)}`;
}

type Extraction = {
  rows: RawRow[];
  text: string;
  pageCount?: number;
  looksScanned?: boolean;
};

async function extract(
  file: File,
  format: SourceFormat,
  options: ParseOptions
): Promise<Extraction> {
  if (format === "CSV") {
    options.onProgress?.("Reading file");
    const text = await file.text();
    return { rows: parseCsv(text), text: text.slice(0, 8000) };
  }

  const buffer = await file.arrayBuffer();

  if (format === "XLSX" || format === "XLS") {
    options.onProgress?.("Reading spreadsheet");
    const { rows } = parseWorkbook(buffer);
    const text = rows
      .slice(0, 40)
      .map((row) => row.cells.join(" "))
      .join("\n");
    return { rows, text };
  }

  const extraction = await extractPdf(buffer, {
    password: options.password,
    onProgress: (page, total) => options.onProgress?.("Parsing statement", page, total),
  });
  return {
    rows: extraction.rows,
    text: extraction.pageText.join("\n"),
    pageCount: extraction.pageCount,
    looksScanned: extraction.looksScanned,
  };
}

/**
 * Parse a statement file end to end. Throws PdfPasswordRequiredError when the
 * caller needs to collect a password; every other failure mode is reported
 * through the returned statement's validation report rather than an exception,
 * so the CA always sees what happened.
 */
export async function parseStatementFile(
  file: File,
  options: ParseOptions = {}
): Promise<ParseOutcome> {
  const format = detectFormat(file.name, file.type);
  if (!format) {
    throw new Error("Unsupported file type. Import a PDF, XLSX, XLS or CSV statement.");
  }

  const extraction = await extract(file, format, options);
  const statementId = nextStatementId();

  if (extraction.looksScanned && extraction.rows.length === 0) {
    throw new Error(
      "This PDF has no text layer — it looks like a scan. Scanned statements need OCR, which this version does not include yet."
    );
  }

  const { adapter, detected } = selectAdapter(extraction.text);

  // The CA's plan, where there is one, decides the table's extent before
  // anything is detected — the header cannot be found above a start marker
  // they have already told us is letterhead.
  const plan = options.rowPlan ?? {};
  const planned = isRowPlanEmpty(plan)
    ? { rows: extraction.rows, headerIndex: -1 }
    : applyRowPlan(extraction.rows, plan);

  // Split the preamble from the table.
  const headerIndex = planned.headerIndex >= 0 ? planned.headerIndex : findHeaderRow(planned.rows);
  const headers = headerIndex >= 0 ? planned.rows[headerIndex].cells : [];
  // Multi-page statements repeat the column header on every page. Left in, a
  // header row has no date and no amount, so it looks like wrapped narration
  // and gets glued onto the last transaction of the previous page.
  const dataRows = (headerIndex >= 0 ? planned.rows.slice(headerIndex + 1) : planned.rows)
    .filter((row) => !looksLikeHeaderRow(row.cells));

  const mapping = options.mapping ?? buildMapping(headers, dataRows, detected ?? adapter);

  const dateSamples =
    mapping.date === undefined
      ? []
      : dataRows.slice(0, 120).map((row) => row.cells[mapping.date as number] ?? "");
  const detection = detectDateFormat(dateSamples);
  const dateFormat = options.dateFormat ?? adapter.hints.dateFormat ?? detection.format;

  const metadata = extractMetadata(extraction.text, dateFormat);
  const currency = metadata.currency ?? "INR";

  options.onProgress?.("Normalising transactions");
  const { transactions, rejected, skipped, balanceMarkers } = normalise({
    rows: dataRows,
    mapping,
    dateFormat,
    statementId,
    currency,
  });

  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));

  // The statement's own opening/closing markers outrank anything scraped from
  // the letterhead, because they sit in the table next to the figures.
  const openingMarker = balanceMarkers.find((marker) => /OPENING|BROUGHT\s*FORWARD|B\/F/i.test(marker.narration));
  const closingMarker = [...balanceMarkers].reverse().find((marker) => /CLOSING|CARRIED\s*FORWARD|C\/F/i.test(marker.narration));

  const report = validate({
    transactions: sorted,
    rejected: rejected.map((item) => ({
      reason: item.reason,
      row: item.row.row,
      page: item.row.page,
    })),
    skipped: skipped.length,
    declaredOpening: openingMarker?.balance ?? metadata.openingBalance,
    declaredClosing: closingMarker?.balance ?? metadata.closingBalance,
  });

  const parseStatus = parseStatusFrom(report);

  const statement: BankStatement = {
    id: statementId,
    fileName: file.name,
    bankName: detected?.name,
    parserId: adapter.id,
    parserValidated: adapter.validated && (detected ? detected.validated : true),
    accountHolder: metadata.accountHolder,
    accountNumberMasked: metadata.accountNumberMasked,
    accountType: metadata.accountType,
    branch: metadata.branch,
    ifsc: metadata.ifsc,
    startDate: metadata.startDate ?? sorted[0]?.date,
    endDate: metadata.endDate ?? sorted[sorted.length - 1]?.date,
    openingBalance: openingMarker?.balance ?? metadata.openingBalance,
    closingBalance:
      closingMarker?.balance ?? metadata.closingBalance ?? sorted[sorted.length - 1]?.balance,
    transactionCount: sorted.length,
    currency,
    sourceFormat: format,
    importedAt: new Date().toISOString(),
    parseStatus,
    validation: report,
  };

  return {
    statement,
    transactions: sorted,
    ambiguousDateFormat: options.dateFormat ? false : detection.ambiguous,
    mapping,
    headers,
    rawRows: dataRows.slice(0, 200),
    // Bounded: the repair grid needs the whole file, but a runaway extraction
    // should not be able to hold an unbounded copy of it in memory.
    grid: extraction.rows.slice(0, MAX_GRID_ROWS),
  };
}

/**
 * Detected mapping, with a detected bank's header aliases layered on top.
 * Aliases are hints only while the adapter is unvalidated — they can add a
 * column the generic detector missed, but the CA still sees and confirms the
 * result on the import screen.
 */
function buildMapping(headers: string[], dataRows: RawRow[], adapter: BankAdapter): ColumnMapping {
  const mapping = detectMapping(headers, dataRows);
  const aliases = adapter.hints.headerAliases;
  if (!aliases) return mapping;

  headers.forEach((header, index) => {
    const text = normaliseText(header);
    for (const alias of aliases) {
      if (mapping[alias.field] !== undefined) continue;
      if (alias.pattern.test(text)) mapping[alias.field] = index;
    }
  });
  return mapping;
}
