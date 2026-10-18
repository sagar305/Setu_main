"use client";

// Step 1 — Import.
// ---------------------------------------------------------------------------
// Owns the whole file → transactions journey: format detection, the password
// prompt for encrypted PDFs, column mapping, the ambiguous-date question, and
// the extraction verdict. The verdict is the important part: when we could not
// resolve every row we say so plainly instead of showing a tidy number (§30).

import { useI18n } from "@/lib/i18n";
import { fill } from "@/lib/i18n/translate";
import { intlLocaleFor } from "@/lib/i18n/pages";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, FileText, Upload, X } from "lucide-react";
import {
  Card,
  ConfirmDialog,
  Field,
  PrimaryButton,
  SecondaryButton,
  Select,
  TextInput,
} from "@/components/toolkit/ui";
import { useAnalyzer } from "@/components/tools/BankStatementAnalyzer/AnalyzerProvider";
import { ColumnMapper } from "@/components/tools/BankStatementAnalyzer/ColumnMapper";
import { StatementGrid } from "@/components/tools/BankStatementAnalyzer/StatementGrid";
import { ProgressPanel, type ProgressState } from "@/components/tools/BankStatementAnalyzer/ProgressPanel";
import { PrivacyNote, ProcessingNote } from "@/components/tools/BankStatementAnalyzer/PrivacyNote";
import { SampleDownload } from "@/components/tools/BankStatementAnalyzer/SampleDownload";
import {
  PdfPasswordRequiredError,
  detectFormat,
  parseStatementFile,
} from "@/lib/bankStatement/parser";
import { describeMappingGaps, isMappingUsable } from "@/lib/bankStatement/parser/columns";
import type { ParseStage } from "@/lib/bankStatement/parser";
import { isRowPlanEmpty, type RowPlan } from "@/lib/bankStatement/parser/rowPlan";
import {
  describeFailure,
  formatDiagnostics,
  type ImportFailure,
} from "@/lib/bankStatement/utils/diagnostics";
import { summariseParse } from "@/lib/bankStatement/normalization/validation";
import {
  mappingGapLabel,
  parseStageLabel,
  parseStatusLabel,
  validationIssueLabel,
} from "@/lib/bankStatement/messages";
import { buildDemoData } from "@/lib/bankStatement/demo/sampleStatement";
import type {
  ColumnMapping,
  DateFormat,
  ParseOutcome,
} from "@/lib/bankStatement/types";
import { formatDate } from "@/lib/bankStatement/utils/dates";

const MAX_FILE_MB = 100;

type Pending = {
  file: File;
  outcome: ParseOutcome;
};

export function ImportStep() {
  const { t, lang } = useI18n();
  const { statements, transactions, actions, loaded } = useAnalyzer();
  const searchParams = useSearchParams();

  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [dateFormat, setDateFormat] = useState<DateFormat | null>(null);
  const [rowPlan, setRowPlan] = useState<RowPlan>({});
  const [passwordFor, setPasswordFor] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [largeFileNotice, setLargeFileNotice] = useState<string | null>(null);
  const [failure, setFailure] = useState<ImportFailure | null>(null);
  const [copied, setCopied] = useState(false);

  // The last stage the parser reported, so a failure can say where it happened
  // rather than only what the exception was.
  const stageRef = useRef<ParseStage>("READING_FILE");

  const inputRef = useRef<HTMLInputElement>(null);

  const run = useCallback(
    async (
      file: File,
      options: {
        password?: string;
        mapping?: ColumnMapping;
        dateFormat?: DateFormat;
        rowPlan?: RowPlan;
      } = {}
    ) => {
      setBusy(true);
      setError(null);
      setFailure(null);
      if (options.rowPlan === undefined) setRowPlan({});
      setCopied(false);
      setPasswordError(null);
      stageRef.current = "READING_FILE";
      try {
        const outcome = await parseStatementFile(file, {
          ...options,
          onProgress: (stage, current, total) => (
            (stageRef.current = stage),
            setProgress({
              label: parseStageLabel(stage, lang),
              current,
              total,
              unit: stage === "PARSING_STATEMENT" ? "page" : undefined,
            })
          ),
        });
        setPending({ file, outcome });
        setMapping(outcome.mapping ?? null);
        setDateFormat(options.dateFormat ?? null);
        setPasswordFor(null);
        setPassword("");
      } catch (caught) {
        if (caught instanceof PdfPasswordRequiredError) {
          setPasswordFor(file);
          setPasswordError(caught.incorrect ? t("bsImIncorrectPassword") : null);
        } else {
          // The exception text itself stays as the browser wrote it — it is a
          // diagnostic, and translating it would lose the only words that
          // identify the fault.
          setError(caught instanceof Error ? caught.message : t("bsImGenericError"));
          setFailure(describeFailure(caught, stageRef.current, file));
        }
      } finally {
        setBusy(false);
        setProgress(null);
      }
    },
    [lang, t]
  );

  const onFile = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      setPending(null);
      setError(null);
      setLargeFileNotice(null);

      if (!detectFormat(file.name, file.type)) {
        setError(t("bsImUnsupportedType"));
        return;
      }
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        setError(fill(t("bsImTooLarge"), { mb: MAX_FILE_MB }));
        return;
      }
      // Decision 26: mobile is not blocked, but a large statement is slow on a
      // phone and the CA deserves to know before they wait.
      if (file.size > 5 * 1024 * 1024 && typeof window !== "undefined" && window.innerWidth < 768) {
        setLargeFileNotice(t("bsImLargeNotice"));
      }
      void run(file);
    },
    [run, t]
  );

  const confirmImport = useCallback(async () => {
    if (!pending) return;
    await actions.addStatement(pending.outcome.statement, pending.outcome.transactions);
    setPending(null);
    setMapping(null);
    setDateFormat(null);
    if (inputRef.current) inputRef.current.value = "";
  }, [actions, pending]);

  const loadDemo = useCallback(async () => {
    const { statement, transactions: demoTransactions } = buildDemoData();
    await actions.addStatement(statement, demoTransactions);
    actions.log({ code: "DEMO_LOADED" }, "Demo statement loaded");
  }, [actions]);

  // "Try Sample Statement" from the landing page arrives as ?demo=1. Load it
  // once, and only if the demo is not already imported.
  const demoRequested = searchParams.get("demo") === "1";
  const demoHandled = useRef(false);
  useEffect(() => {
    if (!loaded || !demoRequested || demoHandled.current) return;
    demoHandled.current = true;
    if (statements.some((statement) => statement.id === "demo-statement")) return;
    void loadDemo();
  }, [demoRequested, loadDemo, loaded, statements]);

  const remap = useCallback(() => {
    if (!pending || !mapping) return;
    void run(pending.file, {
      mapping,
      dateFormat: dateFormat ?? undefined,
      rowPlan: isRowPlanEmpty(rowPlan) ? undefined : rowPlan,
    });
  }, [dateFormat, mapping, pending, rowPlan, run]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-ink">{t("bsImTitle")}</h2>
        <PrivacyNote />
      </div>

      {!pending ? (
        <Card>
          <div
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              onFile(event.dataTransfer.files?.[0]);
            }}
            className="rounded-2xl border-2 border-dashed border-muted-line/50 bg-cream-paper/40 p-8 text-center"
          >
            <Upload className="mx-auto h-8 w-8 text-indigo" aria-hidden="true" />
            <h3 className="mt-3 text-lg font-bold text-ink">{t("bsImDropHere")}</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted">
              {fill(t("bsImDropBody"), { mb: MAX_FILE_MB })}
            </p>

            <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-indigo px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo/90">
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.xlsx,.xls,.csv"
                className="sr-only"
                onChange={(event) => onFile(event.target.files?.[0])}
                disabled={busy}
              />
              {t("bsImChooseStatement")}
            </label>

            <div className="mt-3">
              <SecondaryButton onClick={loadDemo} disabled={busy}>
                {t("bsImTryDemo")}
              </SecondaryButton>
            </div>

            <div className="mt-6 border-t border-muted-line/30 pt-5">
              <SampleDownload compact />
            </div>
          </div>

          <ProcessingNote className="mt-4" />
        </Card>
      ) : null}

      {largeFileNotice ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">{largeFileNotice}</p>
      ) : null}

      {busy ? (
        <ProgressPanel
          progress={progress ?? { label: parseStageLabel("READING_FILE", lang) }}
          stages={[
            {
              name: t("bsImStageReading"),
              status: stageRef.current === "READING_FILE" ? "active" : "done",
            },
            {
              name: t("bsImStageExtracting"),
              status:
                stageRef.current === "PARSING_STATEMENT" ||
                stageRef.current === "READING_SPREADSHEET"
                  ? "active"
                  : stageRef.current === "NORMALISING"
                    ? "done"
                    : "pending",
            },
            {
              name: t("bsImStageValidating"),
              status: stageRef.current === "NORMALISING" ? "active" : "pending",
            },
          ]}
        />
      ) : null}

      {error ? (
        <Card className="border-red-200">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-ink">{t("bsImReadFailTitle")}</h3>
              <p className="mt-1 text-sm text-muted">{error}</p>

              {failure ? (
                <>
                  <p className="mt-2 text-sm text-muted">
                    {/* The stage is emphasised wherever the sentence puts it. */}
                    {(() => {
                      const [before, after] = fill(t("bsImFailedWhile"), {
                        strong: "\u0000",
                      }).split("\u0000");
                      return (
                        <>
                          {before}
                          <strong className="text-ink">
                            {parseStageLabel(failure.stage, lang).toLocaleLowerCase(
                              intlLocaleFor(lang)
                            )}
                          </strong>
                          {after}
                        </>
                      );
                    })()}
                  </p>

                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm font-semibold text-indigo">
                      {t("bsImTechnicalDetails")}
                    </summary>
                    <p className="mt-2 text-xs text-muted">{t("bsImDiagnosticsNote")}</p>
                    <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-cream-paper/70 p-3 text-[11px] leading-relaxed text-muted">
                      {formatDiagnostics(failure)}
                    </pre>
                    <SecondaryButton
                      className="mt-2 !px-3 !py-1.5 !text-xs"
                      onClick={() => {
                        void window.navigator.clipboard
                          ?.writeText(formatDiagnostics(failure))
                          .then(() => setCopied(true))
                          .catch(() => setCopied(false));
                      }}
                    >
                      {copied ? t("spCopiedShort") : t("bsImCopyDetails")}
                    </SecondaryButton>
                  </details>
                </>
              ) : null}
            </div>
          </div>
        </Card>
      ) : null}

      {passwordFor ? (
        <Card>
          <h3 className="text-lg font-bold text-ink">{t("bsImPasswordTitle")}</h3>
          <p className="mt-1 text-sm text-muted">{t("bsImPasswordBody")}</p>
          <form
            className="mt-4 flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void run(passwordFor, { password });
            }}
          >
            <div className="min-w-[220px] flex-1">
              <Field label={t("bsImPassword")}>
                <TextInput
                  type="password"
                  value={password}
                  autoComplete="off"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={t("bsImPasswordPlaceholder")}
                />
              </Field>
            </div>
            <PrimaryButton type="submit" disabled={busy || password === ""}>
              {t("bsImUnlock")}
            </PrimaryButton>
            <SecondaryButton
              onClick={() => {
                setPasswordFor(null);
                setPassword("");
                setPasswordError(null);
              }}
            >
              {t("cancel")}
            </SecondaryButton>
          </form>
          {passwordError ? <p className="mt-2 text-sm text-red-600">{passwordError}</p> : null}
        </Card>
      ) : null}

      {pending ? (
        <PendingReview
          pending={pending}
          mapping={mapping}
          dateFormat={dateFormat}
          rowPlan={rowPlan}
          onRowPlanChange={setRowPlan}
          onMappingChange={setMapping}
          onDateFormatChange={(value) => {
            setDateFormat(value);
            void run(pending.file, { mapping: mapping ?? undefined, dateFormat: value });
          }}
          onRemap={remap}
          onConfirm={confirmImport}
          onCancel={() => {
            setPending(null);
            setMapping(null);
            if (inputRef.current) inputRef.current.value = "";
          }}
          busy={busy}
        />
      ) : null}

      {loaded && statements.length > 0 ? (
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-bold text-ink">
              {fill(t("bsImImportedStatements"), { n: statements.length })}
            </h3>
            {transactions.length > 0 ? (
              <Link
                href="/products/bank-statement-analyzer/review"
                className="rounded-lg bg-indigo px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo/90"
              >
                {fill(t("bsImReviewTransactions"), {
                  n: transactions.length.toLocaleString(intlLocaleFor(lang)),
                })}
              </Link>
            ) : null}
          </div>

          <p className="mb-3 text-sm text-muted">{t("bsImTickNote")}</p>

          <ul className="space-y-2">
            {statements.map((statement) => (
              <StatementRow
                key={statement.id}
                statementId={statement.id}
                onRemove={() => setRemoving(statement.id)}
              />
            ))}
          </ul>
        </Card>
      ) : null}

      <ConfirmDialog
        open={removing !== null}
        title={t("bsImRemoveTitle")}
        message={t("bsImRemoveBody")}
        confirmLabel={t("remove")}
        onConfirm={() => {
          if (removing) void actions.removeStatement(removing);
          setRemoving(null);
        }}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
}

function StatementRow({ statementId, onRemove }: { statementId: string; onRemove: () => void }) {
  const { t, lang } = useI18n();
  const { statements, activeStatementIds, actions } = useAnalyzer();
  const statement = statements.find((item) => item.id === statementId);
  if (!statement) return null;

  const active = activeStatementIds.includes(statement.id);
  const toggle = () =>
    actions.setActiveStatements(
      active
        ? activeStatementIds.filter((id) => id !== statement.id)
        : [...activeStatementIds, statement.id]
    );

  const statusStyle =
    statement.parseStatus === "VALID"
      ? "bg-emerald-100 text-emerald-700"
      : statement.parseStatus === "WARNING"
        ? "bg-amber-100 text-amber-700"
        : "bg-red-100 text-red-700";

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-xl border border-muted-line/30 px-4 py-3">
      <input
        type="checkbox"
        checked={active}
        onChange={toggle}
        className="h-4 w-4 rounded border-muted-line text-indigo focus:ring-indigo"
        aria-label={fill(t("bsImIncludeAria"), { file: statement.fileName })}
      />
      <FileText className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{statement.fileName}</p>
        <p className="text-xs text-muted">
          {statement.bankName ?? t("bsImBankNotDetected")} ·{" "}
          {statement.accountNumberMasked ?? t("bsImAccountNotDetected")} ·{" "}
          {statement.startDate ? formatDate(statement.startDate) : "—"} –{" "}
          {statement.endDate ? formatDate(statement.endDate) : "—"} ·{" "}
          {fill(t("bsImRowsCount"), {
            n: statement.transactionCount.toLocaleString(intlLocaleFor(lang)),
          })}
        </p>
      </div>
      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle}`}>
        {parseStatusLabel(statement.parseStatus, lang)}
      </span>
      <button
        type="button"
        onClick={onRemove}
        className="rounded-lg p-1.5 text-muted transition hover:bg-red-50 hover:text-red-600"
        aria-label={fill(t("bsImRemoveAria"), { file: statement.fileName })}
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </li>
  );
}

function PendingReview({
  pending,
  mapping,
  dateFormat,
  rowPlan,
  onRowPlanChange,
  onMappingChange,
  onDateFormatChange,
  onRemap,
  onConfirm,
  onCancel,
  busy,
}: {
  pending: Pending;
  mapping: ColumnMapping | null;
  dateFormat: DateFormat | null;
  rowPlan: RowPlan;
  onRowPlanChange: (plan: RowPlan) => void;
  onMappingChange: (mapping: ColumnMapping) => void;
  onDateFormatChange: (format: DateFormat) => void;
  onRemap: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const { t, lang } = useI18n();
  const { statement, transactions, headers, rawRows, grid, ambiguousDateFormat } = pending.outcome;
  const report = statement.validation;
  const summary = summariseParse(report, statement.parseStatus, lang);
  const gaps = mapping ? describeMappingGaps(mapping) : [];
  const usable = mapping ? isMappingUsable(mapping) : false;

  const tone =
    statement.parseStatus === "VALID"
      ? { border: "border-emerald-200", chip: "bg-emerald-100 text-emerald-700", Icon: CheckCircle2, iconClass: "text-emerald-600" }
      : statement.parseStatus === "WARNING"
        ? { border: "border-amber-200", chip: "bg-amber-100 text-amber-700", Icon: AlertTriangle, iconClass: "text-amber-600" }
        : { border: "border-red-200", chip: "bg-red-100 text-red-700", Icon: AlertTriangle, iconClass: "text-red-600" };

  return (
    <>
      <Card className={tone.border}>
        <div className="flex flex-wrap items-start gap-3">
          <tone.Icon className={`h-6 w-6 shrink-0 ${tone.iconClass}`} aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold text-ink">{statement.fileName}</h3>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone.chip}`}>
                {parseStatusLabel(statement.parseStatus, lang)}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted">{summary}</p>

            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <Stat label={t("bsImRowsFound")} value={String(report.extracted)} />
              <Stat label={t("bsImResolved")} value={String(report.resolved)} />
              <Stat label={t("bsStatusWarning")} value={String(report.warnings)} />
              <Stat label={t("bsStatusUnresolved")} value={String(report.unresolved)} />
            </dl>

            {statement.parseStatus === "UNRESOLVED" ? (
              <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {t("bsImUnresolvedNote")}
              </p>
            ) : null}

            {!statement.parserValidated ? (
              <p className="mt-3 rounded-xl bg-cream-paper/70 px-4 py-3 text-sm text-muted">
                {statement.bankName
                  ? fill(t("bsImUnverifiedParser"), { bank: statement.bankName })
                  : t("bsImGenericEngine")}
              </p>
            ) : null}

            {report.issues.length > 0 ? (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-semibold text-indigo">
                  {fill(t(report.issues.length === 1 ? "bsImIssues1" : "bsImIssuesN"), {
                    n: report.issues.length.toLocaleString(intlLocaleFor(lang)),
                  })}
                </summary>
                <ul className="mt-2 max-h-52 space-y-1 overflow-y-auto text-xs text-muted">
                  {report.issues.slice(0, 60).map((issue, index) => {
                    // Page and row prefix the finding in whatever order the
                    // language wants, so each combination is its own sentence.
                    const message = validationIssueLabel(issue, lang);
                    const key =
                      issue.page && issue.row
                        ? "bsImIssuePageRow"
                        : issue.page
                          ? "bsImIssuePage"
                          : issue.row
                            ? "bsImIssueRow"
                            : null;
                    return (
                      <li key={index}>
                        {key
                          ? fill(t(key), {
                              page: issue.page ?? "",
                              row: issue.row ?? "",
                              message,
                            })
                          : message}
                      </li>
                    );
                  })}
                </ul>
              </details>
            ) : null}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <PrimaryButton onClick={onConfirm} disabled={busy || transactions.length === 0}>
            {fill(
              t(
                statement.parseStatus === "UNRESOLVED"
                  ? "bsImImportAnyway"
                  : "bsImImportCount"
              ),
              { n: transactions.length.toLocaleString(intlLocaleFor(lang)) }
            )}
          </PrimaryButton>
          <SecondaryButton onClick={onCancel} disabled={busy}>
            {t("bsImDiscard")}
          </SecondaryButton>
        </div>
      </Card>

      {ambiguousDateFormat ? (
        <Card className="border-amber-200">
          <h3 className="text-lg font-bold text-ink">{t("bsImDateFormatTitle")}</h3>
          <p className="mt-1 text-sm text-muted">{t("bsImDateFormatBody")}</p>
          <div className="mt-4 max-w-xs">
            <Field label={t("bsImDateFormat")}>
              <Select
                value={dateFormat ?? "DMY"}
                onChange={(event) => onDateFormatChange(event.target.value as DateFormat)}
              >
                <option value="DMY">DD/MM/YYYY</option>
                <option value="MDY">MM/DD/YYYY</option>
                <option value="YMD">YYYY-MM-DD</option>
              </Select>
            </Field>
          </div>
        </Card>
      ) : null}

      {mapping ? (
        <Card>
          <h3 className="text-lg font-bold text-ink">{t("bsImColumnMapping")}</h3>
          <p className="mt-1 text-sm text-muted">
            {gaps.length === 0
              ? t("bsImMappingOk")
              : fill(t("bsImMappingGaps"), {
                  gaps: gaps
                    .map((gap) => mappingGapLabel(gap, lang))
                    .join(` ${t("bsRvCondAnd")} `),
                })}
          </p>
          <div className="mt-4">
            <ColumnMapper
              headers={headers ?? []}
              sampleRows={(rawRows ?? []).slice(0, 40).map((row) => row.cells)}
              mapping={mapping}
              onChange={onMappingChange}
            />
          </div>
          <div className="mt-4">
            <SecondaryButton onClick={onRemap} disabled={busy || !usable}>
              {t("bsImReread")}
            </SecondaryButton>
          </div>
        </Card>
      ) : null}

      {grid && grid.length > 0 && mapping ? (
        <Card>
          <details open={statement.parseStatus !== "VALID"}>
            <summary className="cursor-pointer text-lg font-bold text-ink">
              {t("bsImFixColumns")}
            </summary>
            <p className="mt-1 text-sm text-muted">{t("bsImFixColumnsBody")}</p>
            <div className="mt-4">
              <StatementGrid
                grid={grid}
                mapping={mapping}
                plan={rowPlan}
                onMappingChange={onMappingChange}
                onPlanChange={onRowPlanChange}
                onApply={onRemap}
                busy={busy}
              />
            </div>
          </details>
        </Card>
      ) : null}

      {transactions.length > 0 ? (
        <Card>
          <h3 className="mb-3 text-lg font-bold text-ink">{t("preview")}</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead>
                <tr className="border-b border-muted-line/30 text-xs uppercase tracking-wide text-muted">
                  <th className="py-2 pr-3">{t("date")}</th>
                  <th className="py-2 pr-3">{t("bkNarration")}</th>
                  <th className="py-2 pr-3 text-right">{t("bkDebit")}</th>
                  <th className="py-2 pr-3 text-right">{t("bkCredit")}</th>
                  <th className="py-2 text-right">{t("balance")}</th>
                </tr>
              </thead>
              <tbody>
                {transactions.slice(0, 10).map((transaction) => (
                  <tr key={transaction.id} className="border-b border-muted-line/20">
                    <td className="py-2 pr-3 whitespace-nowrap">{formatDate(transaction.date)}</td>
                    <td className="max-w-xs truncate py-2 pr-3">{transaction.narration}</td>
                    <td className="py-2 pr-3 text-right">{transaction.debit || ""}</td>
                    <td className="py-2 pr-3 text-right">{transaction.credit || ""}</td>
                    <td className="py-2 text-right">{transaction.balance ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {transactions.length > 10 ? (
            <p className="mt-2 text-xs text-muted">
              {fill(t("bsImShowingFirst10"), {
                n: transactions.length.toLocaleString(intlLocaleFor(lang)),
              })}
            </p>
          ) : null}
        </Card>
      ) : null}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-cream-paper/70 p-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-lg font-bold text-ink">{value}</dd>
    </div>
  );
}
