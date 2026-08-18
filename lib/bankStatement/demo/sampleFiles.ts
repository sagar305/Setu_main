// Downloadable sample statements.
// ---------------------------------------------------------------------------
// The demo button loads data straight into the app; this builds the same
// synthetic statement as an actual FILE the user can download and then import
// through the normal path — which is the only way to try the parser itself.
//
// All three formats are generated on the device from buildDemoData(), so there
// is no binary asset in the repo and the file always matches the demo figures.

import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import { buildDemoData, DEMO_BUSINESS } from "@/lib/bankStatement/demo/sampleStatement";
import { formatDate } from "@/lib/bankStatement/utils/dates";
import { toCsv, downloadCsv } from "@/lib/pos/csv";

export const SAMPLE_BASENAME = "setu-sample-bank-statement";

const HEADERS = [
  "Txn Date",
  "Value Date",
  "Narration",
  "Chq/Ref No",
  "Withdrawal Amt.",
  "Deposit Amt.",
  "Closing Balance",
];

/** Deterministic reference numbers, so the file is byte-stable per format. */
function reference(index: number): string {
  return `S${String(index + 1).padStart(6, "0")}`;
}

type SampleRow = {
  date: string;
  narration: string;
  reference: string;
  debit: string;
  credit: string;
  balance: string;
};

function sampleRows(): { rows: SampleRow[]; opening: number; closing: number; period: string } {
  const { statement, transactions } = buildDemoData();
  const rows = transactions.map((transaction, index) => ({
    date: formatDate(transaction.date),
    narration: transaction.narration,
    reference: reference(index),
    debit: transaction.debit ? transaction.debit.toFixed(2) : "",
    credit: transaction.credit ? transaction.credit.toFixed(2) : "",
    balance: (transaction.balance ?? 0).toFixed(2),
  }));

  return {
    rows,
    opening: statement.openingBalance ?? 0,
    closing: statement.closingBalance ?? 0,
    period: `${formatDate(statement.startDate ?? "")} to ${formatDate(statement.endDate ?? "")}`,
  };
}

/**
 * The header block every format carries. It is deliberately shaped like a real
 * statement preamble so the importer's metadata extraction has something to
 * read — and it says "synthetic" so nobody mistakes the file for a real one.
 */
function preamble(opening: number, period: string): string[][] {
  return [
    ["DEMO BANK LIMITED — SYNTHETIC SAMPLE STATEMENT"],
    [`Account Name: ${DEMO_BUSINESS}`],
    ["Account No: XXXXXXXX4417"],
    ["IFSC: DEMO0001234"],
    ["Branch: MG Road"],
    ["Account Type: Current"],
    [`Statement Period: ${period}`],
    [`Opening Balance: ${opening.toFixed(2)}`],
    [],
  ];
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

export function buildSampleCsv(): string {
  const { rows, opening, closing, period } = sampleRows();

  // Ragged rows on purpose: a bank's CSV export puts a one-column preamble
  // above the seven-column table, and the importer has to cope with that.
  const lines: string[][] = [
    ...preamble(opening, period),
    HEADERS,
    ...rows.map((row) => [
      row.date,
      row.date,
      row.narration,
      row.reference,
      row.debit,
      row.credit,
      row.balance,
    ]),
    [],
    [`Closing Balance: ${closing.toFixed(2)}`],
  ];

  return toCsv(lines[0], lines.slice(1));
}

export function downloadSampleCsv(): void {
  downloadCsv(`${SAMPLE_BASENAME}.csv`, buildSampleCsv());
}

// ---------------------------------------------------------------------------
// XLSX
// ---------------------------------------------------------------------------

export function downloadSampleXlsx(): void {
  const { rows, opening, closing, period } = sampleRows();

  const sheet = XLSX.utils.aoa_to_sheet([
    ...preamble(opening, period),
    HEADERS,
    ...rows.map((row) => [
      row.date,
      row.date,
      row.narration,
      row.reference,
      row.debit,
      row.credit,
      row.balance,
    ]),
    [],
    [`Closing Balance: ${closing.toFixed(2)}`],
  ]);

  sheet["!cols"] = [
    { wch: 12 }, { wch: 12 }, { wch: 52 }, { wch: 12 },
    { wch: 16 }, { wch: 14 }, { wch: 16 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Statement");
  XLSX.writeFile(workbook, `${SAMPLE_BASENAME}.xlsx`, { compression: true });
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

// Column x positions in points, on A4 (595pt wide) with a 36pt margin.
// Amounts are RIGHT-aligned at these edges, the way a real statement prints
// them — which is also what makes this a genuine test of the PDF parser.
const COL = {
  date: 36,
  valueDate: 88,
  narration: 140,
  reference: 340,
  debitRight: 428,
  creditRight: 500,
  balanceRight: 559,
};

const ROW_HEIGHT = 13;
const PAGE_BOTTOM = 780;

export function buildSamplePdf(): jsPDF {
  const { rows, opening, closing, period } = sampleRows();
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  let y = 0;
  let page = 0;

  const drawLetterhead = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("DEMO BANK LIMITED", COL.date, 48);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text("SYNTHETIC SAMPLE STATEMENT — NOT A REAL BANK STATEMENT", COL.date, 61);
    doc.setTextColor(0);

    doc.setFontSize(9);
    doc.text(`Account Name: ${DEMO_BUSINESS}`, COL.date, 80);
    doc.text("Account No: XXXXXXXX4417", COL.date, 93);
    doc.text("IFSC: DEMO0001234", COL.date, 106);
    doc.text("Branch: MG Road", COL.narration + 120, 80);
    doc.text("Account Type: Current", COL.narration + 120, 93);
    doc.text(`Statement Period: ${period}`, COL.narration + 120, 106);
    doc.text(`Opening Balance: ${opening.toFixed(2)}`, COL.date, 123);
    y = 148;
  };

  const drawTableHeader = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text("Txn Date", COL.date, y);
    doc.text("Value Date", COL.valueDate, y);
    doc.text("Narration", COL.narration, y);
    doc.text("Chq/Ref No", COL.reference, y);
    doc.text("Withdrawal Amt.", COL.debitRight, y, { align: "right" });
    doc.text("Deposit Amt.", COL.creditRight, y, { align: "right" });
    doc.text("Closing Balance", COL.balanceRight, y, { align: "right" });
    y += 6;
    doc.setDrawColor(180);
    doc.line(COL.date, y, COL.balanceRight, y);
    y += 12;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
  };

  const newPage = () => {
    page += 1;
    if (page > 1) {
      doc.addPage();
      y = 48;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(`${DEMO_BUSINESS} · Account XXXXXXXX4417 · Page ${page}`, COL.date, y);
      doc.setTextColor(0);
      y += 20;
    } else {
      drawLetterhead();
    }
    drawTableHeader();
  };

  newPage();

  for (const row of rows) {
    if (y > PAGE_BOTTOM) newPage();

    doc.text(row.date, COL.date, y);
    doc.text(row.date, COL.valueDate, y);
    // Narration is clipped to the column so it never collides with the ref.
    doc.text(doc.splitTextToSize(row.narration, COL.reference - COL.narration - 8)[0] ?? "", COL.narration, y);
    doc.text(row.reference, COL.reference, y);
    if (row.debit) doc.text(row.debit, COL.debitRight, y, { align: "right" });
    if (row.credit) doc.text(row.credit, COL.creditRight, y, { align: "right" });
    doc.text(row.balance, COL.balanceRight, y, { align: "right" });

    y += ROW_HEIGHT;
  }

  if (y > PAGE_BOTTOM - 20) newPage();
  y += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(`Closing Balance: ${closing.toFixed(2)}`, COL.date, y);

  return doc;
}

export function downloadSamplePdf(): void {
  buildSamplePdf().save(`${SAMPLE_BASENAME}.pdf`);
}
