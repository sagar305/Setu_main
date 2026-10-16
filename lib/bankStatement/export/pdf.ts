// PDF report (spec §16), built with jsPDF — already a dependency of this repo.
// AutoTable is not installed, so the tables are laid out directly: a fixed
// column grid with page breaks and repeated headers. Generated in the browser.

import { jsPDF } from "jspdf";
import type {
  AnalysisResult,
  BankStatement,
  Category,
  ParseStatus,
  Transaction,
} from "@/lib/bankStatement/types";
import { groupIndian } from "@/lib/bankStatement/utils/numbers";
import { formatDate } from "@/lib/bankStatement/utils/dates";
import { categoryName } from "@/lib/bankStatement/classification/categories";
import type { LanguageCode } from "@/lib/i18n/config";
import { intlLocaleFor } from "@/lib/i18n/pages";
import { fill, translate, type TKey } from "@/lib/i18n/translate";

/** How a parse status reads in a report a CA hands to someone else. */
const PARSE_STATUS_KEYS: Record<ParseStatus, TKey> = {
  VALID: "bsStatusValid",
  WARNING: "bsStatusWarning",
  UNRESOLVED: "bsStatusUnresolved",
};

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

// The printed report is for a reader, not a machine: unlike the workbook in
// ./excel, every heading, column and note here follows the language the CA is
// working in. Narrations, party names and file names are the bank's own words
// and stay exactly as extracted.
export function downloadPdfReport(
  fileName: string,
  statements: BankStatement[],
  transactions: Transaction[],
  analysis: AnalysisResult,
  categories: Category[],
  lang: LanguageCode
): void {
  const report = new Report();
  const t = (key: TKey) => translate(lang, key);
  const statusLabel = (status: ParseStatus) => t(PARSE_STATUS_KEYS[status]);

  const period = statements.length
    ? `${statements[0].startDate ?? "—"} to ${statements[statements.length - 1].endDate ?? "—"}`
    : "—";

  report.title(
    t("bsPdfTitle"),
    fill(t(statements.length === 1 ? "bsPdfSubtitle1" : "bsPdfSubtitleN"), {
      n: statements.length,
      period,
      date: new Date().toLocaleDateString(intlLocaleFor(lang)),
    })
  );

  // Any statement that did not parse cleanly is declared up front, before a
  // single figure — a CA must not read these totals as complete (§30).
  const unresolved = statements.filter((statement) => statement.parseStatus !== "VALID");
  if (unresolved.length > 0) {
    report.heading(t("bsPdfExtractionWarnings"));
    for (const statement of unresolved) {
      report.paragraph(
        fill(t("bsPdfStatementLine"), {
          file: statement.fileName,
          status: statusLabel(statement.parseStatus),
          ok: statement.validation.resolved + statement.validation.warnings,
          total: statement.validation.extracted,
          bad: statement.validation.unresolved,
        })
      );
    }
    report.paragraph(t("bsPdfExcludeNote"));
  }

  const unverified = statements.filter((statement) => !statement.parserValidated);
  if (unverified.length > 0) {
    report.paragraph(t("bsPdfGenericNote"));
  }

  report.heading(t("bsSummary"));
  report.table(
    [
      { header: t("bsPdfMeasure"), width: 200 },
      { header: t("bsPdfValue"), width: 150, align: "right" },
    ],
    [
      [t("tbTotalCredits"), money(analysis.totals.credits)],
      [t("tbTotalDebits"), money(analysis.totals.debits)],
      [t("bsNetCashFlow"), money(analysis.totals.net)],
      [t("bsTransactions"), String(analysis.totals.count)],
      [t("bsPdfExcludedDuplicates"), String(analysis.totals.excludedDuplicates)],
    ]
  );

  report.heading(t("bsPdfMonthlySummary"));
  report.table(
    [
      { header: t("tuRpMonth"), width: 90 },
      { header: t("opening"), width: 90, align: "right" },
      { header: t("bsColCredits"), width: 90, align: "right" },
      { header: t("bsColDebits"), width: 90, align: "right" },
      { header: t("closing"), width: 90, align: "right" },
    ],
    analysis.monthly.map((row) => [
      row.label,
      row.openingBalance === undefined ? "—" : money(row.openingBalance),
      money(row.credits),
      money(row.debits),
      row.closingBalance === undefined ? "—" : money(row.closingBalance),
    ])
  );

  report.heading(t("bsPdfExpenseAnalysis"));
  report.table(
    [
      { header: t("category"), width: 200 },
      { header: t("amount"), width: 100, align: "right" },
      { header: t("share"), width: 70, align: "right" },
      { header: t("bsColCount"), width: 60, align: "right" },
    ],
    analysis.expenseCategories.map((row) => [
      row.category,
      money(row.debit),
      `${row.share.toFixed(1)}%`,
      String(row.count),
    ])
  );

  report.heading(t("bsPdfIncomeAnalysis"));
  report.table(
    [
      { header: t("category"), width: 200 },
      { header: t("amount"), width: 100, align: "right" },
      { header: t("share"), width: 70, align: "right" },
      { header: t("bsColCount"), width: 60, align: "right" },
    ],
    analysis.incomeCategories.map((row) => [
      row.category,
      money(row.credit),
      `${row.share.toFixed(1)}%`,
      String(row.count),
    ])
  );

  if (analysis.cash.transactions.length > 0) {
    report.heading(t("bsPdfCashTransactions"));
    report.table(
      [
        { header: t("date"), width: 70 },
        { header: t("bkNarration"), width: 220 },
        { header: t("bsColDeposit"), width: 85, align: "right" },
        { header: t("bsColWithdrawal"), width: 85, align: "right" },
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
    report.heading(t("bsPdfHighValue"));
    report.table(
      [
        { header: t("date"), width: 70 },
        { header: t("bkNarration"), width: 200 },
        { header: t("amount"), width: 90, align: "right" },
        { header: t("category"), width: 110 },
      ],
      analysis.highValue.map((t) => [
        formatDate(t.date),
        t.narration,
        money(Math.max(t.debit, t.credit)),
        categoryName(categories, t.category, lang),
      ])
    );
  }

  if (analysis.uncategorised.length > 0) {
    report.heading(t("bsPdfUncatReview"));
    report.table(
      [
        { header: t("date"), width: 70 },
        { header: t("bkNarration"), width: 250 },
        { header: t("amount"), width: 90, align: "right" },
      ],
      analysis.uncategorised.map((t) => [
        formatDate(t.date),
        t.narration,
        money(Math.max(t.debit, t.credit)),
      ])
    );
  }

  report.heading(t("bsPdfTopParties"));
  report.table(
    [
      { header: t("bsColParty"), width: 200 },
      { header: t("bsPdfPaidOut"), width: 100, align: "right" },
      { header: t("bsPdfReceived"), width: 100, align: "right" },
      { header: t("bsColCount"), width: 60, align: "right" },
    ],
    analysis.parties.map((row) => [
      row.party,
      money(row.debit),
      money(row.credit),
      String(row.count),
    ])
  );

  report.footerOnEveryPage(
    fill(t("bsPdfFooter"), { n: transactions.length })
  );

  report.save(fileName);
}
