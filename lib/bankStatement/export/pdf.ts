// PDF report (spec §16), built with jsPDF — already a dependency of this repo.
// AutoTable is not installed, so the tables are laid out directly: a fixed
// column grid with page breaks and repeated headers. Generated in the browser.

import { jsPDF } from "jspdf";
import type {
  AnalysisResult,
  BankStatement,
  Category,
  Transaction,
} from "@/lib/bankStatement/types";
import { groupIndian } from "@/lib/bankStatement/utils/numbers";
import { formatDate } from "@/lib/bankStatement/utils/dates";
import { categoryName } from "@/lib/bankStatement/classification/categories";

const MARGIN = 40;
const LINE = 14;

type Column = { header: string; width: number; align?: "left" | "right" };

class Report {
  private doc: jsPDF;
  private y = MARGIN;
  private pageHeight: number;
  private pageWidth: number;

  constructor() {
    this.doc = new jsPDF({ unit: "pt", format: "a4" });
    this.pageHeight = this.doc.internal.pageSize.getHeight();
    this.pageWidth = this.doc.internal.pageSize.getWidth();
  }

  private ensureSpace(needed: number): void {
    if (this.y + needed <= this.pageHeight - MARGIN) return;
    this.doc.addPage();
    this.y = MARGIN;
  }

  title(text: string, subtitle?: string): void {
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(18);
    this.doc.text(text, MARGIN, this.y);
    this.y += 22;
    if (subtitle) {
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(10);
      this.doc.setTextColor(110);
      this.doc.text(subtitle, MARGIN, this.y);
      this.doc.setTextColor(0);
      this.y += 18;
    }
  }

  heading(text: string): void {
    this.ensureSpace(40);
    this.y += 10;
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(12);
    this.doc.text(text, MARGIN, this.y);
    this.y += 6;
    this.doc.setDrawColor(220);
    this.doc.line(MARGIN, this.y, this.pageWidth - MARGIN, this.y);
    this.y += 12;
  }

  paragraph(text: string): void {
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(9.5);
    const lines = this.doc.splitTextToSize(text, this.pageWidth - MARGIN * 2) as string[];
    for (const line of lines) {
      this.ensureSpace(LINE);
      this.doc.text(line, MARGIN, this.y);
      this.y += LINE;
    }
  }

  table(columns: Column[], rows: string[][]): void {
    const drawHeader = () => {
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(9);
      let x = MARGIN;
      for (const column of columns) {
        this.doc.text(
          column.header,
          column.align === "right" ? x + column.width : x,
          this.y,
          { align: column.align === "right" ? "right" : "left" }
        );
        x += column.width;
      }
      this.y += 6;
      this.doc.setDrawColor(220);
      this.doc.line(MARGIN, this.y, this.pageWidth - MARGIN, this.y);
      this.y += 12;
    };

    this.ensureSpace(50);
    drawHeader();

    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(9);

    for (const row of rows) {
      if (this.y + LINE > this.pageHeight - MARGIN) {
        this.doc.addPage();
        this.y = MARGIN;
        drawHeader();
        this.doc.setFont("helvetica", "normal");
        this.doc.setFontSize(9);
      }
      let x = MARGIN;
      row.forEach((cell, index) => {
        const column = columns[index];
        const text = this.doc.splitTextToSize(cell, column.width - 6)[0] ?? "";
        this.doc.text(
          text,
          column.align === "right" ? x + column.width - 6 : x,
          this.y,
          { align: column.align === "right" ? "right" : "left" }
        );
        x += column.width;
      });
      this.y += LINE;
    }
    this.y += 6;
  }

  footerOnEveryPage(text: string): void {
    const pages = this.doc.getNumberOfPages();
    for (let page = 1; page <= pages; page += 1) {
      this.doc.setPage(page);
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(8);
      this.doc.setTextColor(140);
      this.doc.text(text, MARGIN, this.pageHeight - 24);
      this.doc.text(`Page ${page} of ${pages}`, this.pageWidth - MARGIN, this.pageHeight - 24, {
        align: "right",
      });
      this.doc.setTextColor(0);
    }
  }

  save(fileName: string): void {
    this.doc.save(fileName);
  }
}

const money = (value: number) => groupIndian(value);

export function downloadPdfReport(
  fileName: string,
  statements: BankStatement[],
  transactions: Transaction[],
  analysis: AnalysisResult,
  categories: Category[]
): void {
  const report = new Report();

  const period = statements.length
    ? `${statements[0].startDate ?? "—"} to ${statements[statements.length - 1].endDate ?? "—"}`
    : "—";

  report.title(
    "Bank Statement Analysis",
    `${statements.length} statement${statements.length === 1 ? "" : "s"} · ${period} · generated ${new Date().toLocaleDateString("en-IN")}`
  );

  // Any statement that did not parse cleanly is declared up front, before a
  // single figure — a CA must not read these totals as complete (§30).
  const unresolved = statements.filter((statement) => statement.parseStatus !== "VALID");
  if (unresolved.length > 0) {
    report.heading("Extraction warnings");
    for (const statement of unresolved) {
      report.paragraph(
        `${statement.fileName}: ${statement.parseStatus}. Extracted ${statement.validation.resolved + statement.validation.warnings} of ${statement.validation.extracted} rows; ${statement.validation.unresolved} unresolved.`
      );
    }
    report.paragraph(
      "Figures below exclude rows that could not be resolved. Review the statement before relying on these totals."
    );
  }

  const unverified = statements.filter((statement) => !statement.parserValidated);
  if (unverified.length > 0) {
    report.paragraph(
      "Parsed with the generic layout engine. Bank-specific parsers have not been verified against real statements from this bank."
    );
  }

  report.heading("Summary");
  report.table(
    [
      { header: "Measure", width: 200 },
      { header: "Value", width: 150, align: "right" },
    ],
    [
      ["Total credits", money(analysis.totals.credits)],
      ["Total debits", money(analysis.totals.debits)],
      ["Net cash flow", money(analysis.totals.net)],
      ["Transactions", String(analysis.totals.count)],
      ["Excluded as duplicates", String(analysis.totals.excludedDuplicates)],
    ]
  );

  report.heading("Monthly summary");
  report.table(
    [
      { header: "Month", width: 90 },
      { header: "Opening", width: 90, align: "right" },
      { header: "Credits", width: 90, align: "right" },
      { header: "Debits", width: 90, align: "right" },
      { header: "Closing", width: 90, align: "right" },
    ],
    analysis.monthly.map((row) => [
      row.label,
      row.openingBalance === undefined ? "—" : money(row.openingBalance),
      money(row.credits),
      money(row.debits),
      row.closingBalance === undefined ? "—" : money(row.closingBalance),
    ])
  );

  report.heading("Expense analysis");
  report.table(
    [
      { header: "Category", width: 200 },
      { header: "Amount", width: 100, align: "right" },
      { header: "Share", width: 70, align: "right" },
      { header: "Count", width: 60, align: "right" },
    ],
    analysis.expenseCategories.map((row) => [
      row.category,
      money(row.debit),
      `${row.share.toFixed(1)}%`,
      String(row.count),
    ])
  );

  report.heading("Income analysis");
  report.table(
    [
      { header: "Category", width: 200 },
      { header: "Amount", width: 100, align: "right" },
      { header: "Share", width: 70, align: "right" },
      { header: "Count", width: 60, align: "right" },
    ],
    analysis.incomeCategories.map((row) => [
      row.category,
      money(row.credit),
      `${row.share.toFixed(1)}%`,
      String(row.count),
    ])
  );

  if (analysis.cash.transactions.length > 0) {
    report.heading("Cash transactions");
    report.table(
      [
        { header: "Date", width: 70 },
        { header: "Narration", width: 220 },
        { header: "Deposit", width: 85, align: "right" },
        { header: "Withdrawal", width: 85, align: "right" },
      ],
      analysis.cash.transactions.map((t) => [
        formatDate(t.date),
        t.narration,
        t.credit ? money(t.credit) : "",
        t.debit ? money(t.debit) : "",
      ])
    );
  }

  if (analysis.highValue.length > 0) {
    report.heading("High value transactions");
    report.table(
      [
        { header: "Date", width: 70 },
        { header: "Narration", width: 200 },
        { header: "Amount", width: 90, align: "right" },
        { header: "Category", width: 110 },
      ],
      analysis.highValue.map((t) => [
        formatDate(t.date),
        t.narration,
        money(Math.max(t.debit, t.credit)),
        categoryName(categories, t.category),
      ])
    );
  }

  if (analysis.uncategorised.length > 0) {
    report.heading("Uncategorised — needs review");
    report.table(
      [
        { header: "Date", width: 70 },
        { header: "Narration", width: 250 },
        { header: "Amount", width: 90, align: "right" },
      ],
      analysis.uncategorised.map((t) => [
        formatDate(t.date),
        t.narration,
        money(Math.max(t.debit, t.credit)),
      ])
    );
  }

  report.heading("Top counterparties");
  report.table(
    [
      { header: "Party", width: 200 },
      { header: "Paid out", width: 100, align: "right" },
      { header: "Received", width: 100, align: "right" },
      { header: "Count", width: 60, align: "right" },
    ],
    analysis.parties.map((row) => [
      row.party,
      money(row.debit),
      money(row.credit),
      String(row.count),
    ])
  );

  report.footerOnEveryPage(
    `Generated locally in the browser by Setu Bank Statement Analyzer · ${transactions.length} transactions reviewed`
  );

  report.save(fileName);
}
