"use client";

// Step 1 — Import.
// ---------------------------------------------------------------------------
// Owns the whole file → transactions journey: format detection, the password
// prompt for encrypted PDFs, column mapping, the ambiguous-date question, and
// the extraction verdict. The verdict is the important part: when we could not
// resolve every row we say so plainly instead of showing a tidy number (§30).

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
import { ProgressPanel, type ProgressState } from "@/components/tools/BankStatementAnalyzer/ProgressPanel";
import { PrivacyNote, ProcessingNote } from "@/components/tools/BankStatementAnalyzer/PrivacyNote";
import { SampleDownload } from "@/components/tools/BankStatementAnalyzer/SampleDownload";
import {
  PdfPasswordRequiredError,
  detectFormat,
  parseStatementFile,
} from "@/lib/bankStatement/parser";
import { describeMappingGaps, isMappingUsable } from "@/lib/bankStatement/parser/columns";
import { summariseParse } from "@/lib/bankStatement/normalization/validation";
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
  const { statements, transactions, actions, loaded } = useAnalyzer();
  const searchParams = useSearchParams();

  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [dateFormat, setDateFormat] = useState<DateFormat | null>(null);
  const [passwordFor, setPasswordFor] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [largeFileNotice, setLargeFileNotice] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const run = useCallback(
    async (
      file: File,
      options: { password?: string; mapping?: ColumnMapping; dateFormat?: DateFormat } = {}
    ) => {
      setBusy(true);
      setError(null);
      setPasswordError(null);
      try {
        const outcome = await parseStatementFile(file, {
          ...options,
          onProgress: (stage, current, total) =>
            setProgress({
              label: stage,
              current,
              total,
              unit: stage === "Parsing statement" ? "page" : undefined,
            }),
        });
        setPending({ file, outcome });
        setMapping(outcome.mapping ?? null);
        setDateFormat(options.dateFormat ?? null);
        setPasswordFor(null);
        setPassword("");
      } catch (caught) {
        if (caught instanceof PdfPasswordRequiredError) {
          setPasswordFor(file);
          setPasswordError(caught.incorrect ? "Incorrect password. Please try again." : null);
        } else {
          setError(caught instanceof Error ? caught.message : "This file could not be read.");
        }
      } finally {
        setBusy(false);
        setProgress(null);
      }
    },
    []
  );

  const onFile = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      setPending(null);
      setError(null);
      setLargeFileNotice(null);

      if (!detectFormat(file.name, file.type)) {
        setError("Unsupported file type. Import a PDF, XLSX, XLS or CSV statement.");
        return;
      }
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        setError(`That file is larger than ${MAX_FILE_MB} MB.`);
        return;
      }
      // Decision 26: mobile is not blocked, but a large statement is slow on a
      // phone and the CA deserves to know before they wait.
      if (file.size > 5 * 1024 * 1024 && typeof window !== "undefined" && window.innerWidth < 768) {
        setLargeFileNotice(
          "This is a large statement. For files this size a desktop browser will be considerably faster."
        );
      }
      void run(file);
    },
    [run]
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
    actions.log("Demo statement loaded");
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
    void run(pending.file, { mapping, dateFormat: dateFormat ?? undefined });
  }, [dateFormat, mapping, pending, run]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-ink">Import a statement</h2>
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
            <h3 className="mt-3 text-lg font-bold text-ink">Drop your statement here</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted">
              PDF, XLSX, XLS or CSV, up to {MAX_FILE_MB} MB. The file is read in this browser — it is
              never uploaded.
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
              Choose a statement
            </label>

            <div className="mt-3">
              <SecondaryButton onClick={loadDemo} disabled={busy}>
                Try a demo statement
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
          progress={progress ?? { label: "Reading file" }}
          stages={[
            { name: "Reading the file", status: progress?.label === "Reading file" ? "active" : "done" },
            {
              name: "Extracting transactions",
              status:
                progress?.label === "Parsing statement" || progress?.label === "Reading spreadsheet"
                  ? "active"
                  : progress?.label === "Normalising transactions"
                    ? "done"
                    : "pending",
            },
            {
              name: "Normalising and validating",
              status: progress?.label === "Normalising transactions" ? "active" : "pending",
            },
          ]}
        />
      ) : null}

      {error ? (
        <Card className="border-red-200">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" aria-hidden="true" />
            <div>
              <h3 className="font-bold text-ink">We could not read that file</h3>
              <p className="mt-1 text-sm text-muted">{error}</p>
            </div>
          </div>
        </Card>
      ) : null}

      {passwordFor ? (
        <Card>
          <h3 className="text-lg font-bold text-ink">Password required</h3>
          <p className="mt-1 text-sm text-muted">
            This bank statement is password protected. Enter the PDF password to continue. The
            password is used once, in memory — it is never stored, logged or sent anywhere.
          </p>
          <form
            className="mt-4 flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void run(passwordFor, { password });
            }}
          >
            <div className="min-w-[220px] flex-1">
              <Field label="Password">
                <TextInput
                  type="password"
                  value={password}
                  autoComplete="off"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="PDF password"
                />
              </Field>
            </div>
            <PrimaryButton type="submit" disabled={busy || password === ""}>
              Unlock
            </PrimaryButton>
            <SecondaryButton
              onClick={() => {
                setPasswordFor(null);
                setPassword("");
                setPasswordError(null);
              }}
            >
              Cancel
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
              Imported statements ({statements.length})
            </h3>
            {transactions.length > 0 ? (
              <Link
                href="/products/bank-statement-analyzer/review"
                className="rounded-lg bg-indigo px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo/90"
              >
                Review {transactions.length.toLocaleString("en-IN")} transactions
              </Link>
            ) : null}
          </div>

          <p className="mb-3 text-sm text-muted">
            Tick the statements to analyse together. Overlapping periods are de-duplicated
            automatically.
          </p>

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
        title="Remove this statement?"
        message="Its transactions and any edits you made to them will be deleted from this browser."
        confirmLabel="Remove"
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
        aria-label={`Include ${statement.fileName} in the analysis`}
      />
      <FileText className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{statement.fileName}</p>
        <p className="text-xs text-muted">
          {statement.bankName ?? "Bank not detected"} · {statement.accountNumberMasked ?? "account not detected"} ·{" "}
          {statement.startDate ? formatDate(statement.startDate) : "—"} to{" "}
          {statement.endDate ? formatDate(statement.endDate) : "—"} · {statement.transactionCount} rows
        </p>
      </div>
      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle}`}>
        {statement.parseStatus}
      </span>
      <button
        type="button"
        onClick={onRemove}
        className="rounded-lg p-1.5 text-muted transition hover:bg-red-50 hover:text-red-600"
        aria-label={`Remove ${statement.fileName}`}
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
  onMappingChange: (mapping: ColumnMapping) => void;
  onDateFormatChange: (format: DateFormat) => void;
  onRemap: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const { statement, transactions, headers, rawRows, ambiguousDateFormat } = pending.outcome;
  const report = statement.validation;
  const summary = summariseParse(report, statement.parseStatus);
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
                {statement.parseStatus}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted">{summary}</p>

            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <Stat label="Rows found" value={String(report.extracted)} />
              <Stat label="Resolved" value={String(report.resolved)} />
              <Stat label="Warnings" value={String(report.warnings)} />
              <Stat label="Unresolved" value={String(report.unresolved)} />
            </dl>

            {statement.parseStatus === "UNRESOLVED" ? (
              <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                We could not confidently extract every transaction from this statement. Check the
                column mapping below, or import the statement in CSV/XLSX format from your bank if
                one is available. Importing anyway will give you an incomplete picture.
              </p>
            ) : null}

            {!statement.parserValidated ? (
              <p className="mt-3 rounded-xl bg-cream-paper/70 px-4 py-3 text-sm text-muted">
                {statement.bankName
                  ? `Detected ${statement.bankName}, but the ${statement.bankName} layout parser has not been verified against real statements yet — this file was read with the generic layout engine.`
                  : "Read with the generic layout engine. No bank-specific layout was matched."}
              </p>
            ) : null}

            {report.issues.length > 0 ? (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-semibold text-indigo">
                  {report.issues.length} issue{report.issues.length === 1 ? "" : "s"} to review
                </summary>
                <ul className="mt-2 max-h-52 space-y-1 overflow-y-auto text-xs text-muted">
                  {report.issues.slice(0, 60).map((issue, index) => (
                    <li key={index}>
                      {issue.page ? `Page ${issue.page}, ` : ""}
                      {issue.row ? `row ${issue.row}: ` : ""}
                      {issue.message}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <PrimaryButton onClick={onConfirm} disabled={busy || transactions.length === 0}>
            {statement.parseStatus === "UNRESOLVED"
              ? `Import ${transactions.length} extracted anyway`
              : `Import ${transactions.length} transactions`}
          </PrimaryButton>
          <SecondaryButton onClick={onCancel} disabled={busy}>
            Discard
          </SecondaryButton>
        </div>
      </Card>

      {ambiguousDateFormat ? (
        <Card className="border-amber-200">
          <h3 className="text-lg font-bold text-ink">Which date format does this statement use?</h3>
          <p className="mt-1 text-sm text-muted">
            We found dates that could be read in more than one format, and the difference changes
            the dates on your transactions. Pick the one your bank uses.
          </p>
          <div className="mt-4 max-w-xs">
            <Field label="Date format">
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
          <h3 className="text-lg font-bold text-ink">Column mapping</h3>
          <p className="mt-1 text-sm text-muted">
            {gaps.length === 0
              ? "This is how we read the file. Change anything we got wrong, then re-read."
              : `We could not identify the ${gaps.join(" and ")}. Set it below and re-read the file.`}
          </p>
          <div className="mt-4">
            <ColumnMapper
              headers={headers ?? []}
              sampleRow={rawRows?.[0]?.cells}
              mapping={mapping}
              onChange={onMappingChange}
            />
          </div>
          <div className="mt-4">
            <SecondaryButton onClick={onRemap} disabled={busy || !usable}>
              Re-read with this mapping
            </SecondaryButton>
          </div>
        </Card>
      ) : null}

      {transactions.length > 0 ? (
        <Card>
          <h3 className="mb-3 text-lg font-bold text-ink">Preview</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead>
                <tr className="border-b border-muted-line/30 text-xs uppercase tracking-wide text-muted">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Narration</th>
                  <th className="py-2 pr-3 text-right">Debit</th>
                  <th className="py-2 pr-3 text-right">Credit</th>
                  <th className="py-2 text-right">Balance</th>
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
              Showing the first 10 of {transactions.length.toLocaleString("en-IN")}.
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
