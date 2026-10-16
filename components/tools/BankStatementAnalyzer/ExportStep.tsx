"use client";

// Step 5 — Export. Excel workbook, PDF report and a plain CSV, all generated in
// the browser (§18). Nothing is uploaded and no email is sent.

import { useI18n } from "@/lib/i18n";
import { fill } from "@/lib/i18n/translate";
import { intlLocaleFor } from "@/lib/i18n/pages";
import { useState } from "react";
import Link from "next/link";
import { FileSpreadsheet, FileText, Table } from "lucide-react";
import { Card, PrimaryButton, SecondaryButton } from "@/components/toolkit/ui";
import { useAnalyzer } from "@/components/tools/BankStatementAnalyzer/AnalyzerProvider";
import { ProcessingNote } from "@/components/tools/BankStatementAnalyzer/PrivacyNote";
import { downloadWorkbook } from "@/lib/bankStatement/export/excel";
import { downloadPdfReport } from "@/lib/bankStatement/export/pdf";
import { categoryName } from "@/lib/bankStatement/classification/categories";
import { sourceLabel } from "@/lib/bankStatement/classification/classifier";
import { formatDate } from "@/lib/bankStatement/utils/dates";
import { downloadCsv, toCsv } from "@/lib/pos/csv";
import { summariseParse } from "@/lib/bankStatement/normalization/validation";

export function ExportStep() {
  const { t, lang } = useI18n();
  const { activeStatements, activeTransactions, analysis, categories, actions, loaded, statements } =
    useAnalyzer();
  const [busy, setBusy] = useState<string | null>(null);

  if (loaded && statements.length === 0) {
    return (
      <Card>
        <h2 className="text-xl font-bold text-ink">{t("bsExNothing")}</h2>
        <p className="mt-2 text-sm text-muted">{t("bsExImportFirst")}</p>
        <Link
          href="/products/bank-statement-analyzer/import"
          className="mt-4 inline-block rounded-lg bg-indigo px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo/90"
        >
          Go to import
        </Link>
      </Card>
    );
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const flagged = activeStatements.filter((statement) => statement.parseStatus !== "VALID");

  const exportExcel = () => {
    setBusy("excel");
    try {
      downloadWorkbook(
        `bank-statement-analysis-${stamp}.xlsx`,
        activeStatements,
        activeTransactions,
        analysis,
        categories
      );
      actions.log({ code: "REPORT_EXPORTED", format: "excel" }, "Report exported", "Excel workbook");
    } finally {
      setBusy(null);
    }
  };

  const exportPdf = () => {
    setBusy("pdf");
    try {
      downloadPdfReport(
        `bank-statement-analysis-${stamp}.pdf`,
        activeStatements,
        activeTransactions,
        analysis,
        categories,
        lang
      );
      actions.log({ code: "REPORT_EXPORTED", format: "pdf" }, "Report exported", "PDF report");
    } finally {
      setBusy(null);
    }
  };

  const exportCsv = () => {
    setBusy("csv");
    try {
      // A CSV is a data file, like the workbook: the column names and the cell
      // values stay English so a Tally import or a formula built on them does
      // not break when the reader's language changes. The PDF is the artefact
      // that follows the reader.
      downloadCsv(
        `bank-transactions-${stamp}.csv`,
        toCsv(
          ["Date", "Narration", "Reference", "Debit", "Credit", "Balance", "Category", "Party", "Type", "Confidence", "Source", "Duplicate", "Notes"],
          activeTransactions.map((transaction) => [
            formatDate(transaction.date),
            transaction.narration,
            transaction.referenceNumber ?? "",
            transaction.debit || "",
            transaction.credit || "",
            transaction.balance ?? "",
            categoryName(categories, transaction.category, "en"),
            transaction.partyName ?? "",
            transaction.classificationType,
            transaction.confidence ?? 0,
            sourceLabel(transaction.classificationSource, "en"),
            transaction.isDuplicate ? "Possible duplicate" : "",
            transaction.notes ?? "",
          ])
        )
      );
      actions.log({ code: "REPORT_EXPORTED", format: "csv" }, "Report exported", "Transactions CSV");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-ink">{t("bsStepExport")}</h2>
        <p className="mt-1 text-sm text-muted">
          {fill(t(activeStatements.length === 1 ? "bsExCount1" : "bsExCountN"), {
            n: activeTransactions.length.toLocaleString(intlLocaleFor(lang)),
            s: activeStatements.length,
          })}
        </p>
      </div>

      {flagged.length > 0 ? (
        <Card className="border-amber-200">
          <h3 className="font-bold text-ink">{t("bsExWarnTitle")}</h3>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            {flagged.map((statement) => (
              <li key={statement.id}>
                <strong className="text-ink">{statement.fileName}</strong> —{" "}
                {summariseParse(statement.validation, statement.parseStatus, lang)}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-muted">{t("bsExWarnBody")}</p>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <ExportCard
          icon={<FileSpreadsheet className="h-5 w-5" aria-hidden="true" />}
          title={t("bsFmtExcel")}
          description={t("bsExExcelDesc")}
          action={
            <PrimaryButton onClick={exportExcel} disabled={busy !== null}>
              {busy === "excel" ? t("bsSampBuilding") : t("bsExDownloadXlsx")}
            </PrimaryButton>
          }
        />
        <ExportCard
          icon={<FileText className="h-5 w-5" aria-hidden="true" />}
          title={t("bsFmtPdf")}
          description={t("bsExPdfDesc")}
          action={
            <PrimaryButton onClick={exportPdf} disabled={busy !== null}>
              {busy === "pdf" ? t("bsSampBuilding") : t("bsExDownloadPdf")}
            </PrimaryButton>
          }
        />
        <ExportCard
          icon={<Table className="h-5 w-5" aria-hidden="true" />}
          title={t("bsFmtCsv")}
          description={t("bsExCsvDesc")}
          action={
            <SecondaryButton onClick={exportCsv} disabled={busy !== null}>
              {busy === "csv" ? t("bsSampBuilding") : t("bsExDownloadCsv")}
            </SecondaryButton>
          }
        />
      </div>

      <Card>
        <h3 className="text-base font-bold text-ink">{t("bsExWhatsIn")}</h3>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Figure
            label={t("bsTransactions")}
            value={analysis.totals.count.toLocaleString(intlLocaleFor(lang))}
          />
          <Figure label={t("bsUncategorised")} value={String(analysis.uncategorised.length)} />
          <Figure
            label={t("bsPdfCashTransactions")}
            value={String(analysis.cash.transactions.length)}
          />
          <Figure label={t("bsExHighValue")} value={String(analysis.highValue.length)} />
        </dl>
        <ProcessingNote className="mt-4" />
      </Card>
    </div>
  );
}

function ExportCard({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cream text-indigo">
        {icon}
      </span>
      <h3 className="mt-3 text-base font-bold text-ink">{title}</h3>
      <p className="mt-2 flex-1 text-sm text-muted">{description}</p>
      <div className="mt-4">{action}</div>
    </Card>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-cream-paper/70 p-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-lg font-bold text-ink">{value}</dd>
    </div>
  );
}
