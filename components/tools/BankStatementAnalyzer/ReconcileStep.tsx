"use client";

// Step 4 — Reconcile (spec §17, decisions 7 and 21).
// Bank statement against the books, with flexible column mapping on the ledger
// import. This is the automatic matching engine; the manual BRS workflow lives
// in the existing /tools/bank-reconciliation tool, which we link to rather than
// duplicate.

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { Upload } from "lucide-react";
import { Card, PrimaryButton, SecondaryButton } from "@/components/toolkit/ui";
import { useAnalyzer } from "@/components/tools/BankStatementAnalyzer/AnalyzerProvider";
import { ColumnMapper } from "@/components/tools/BankStatementAnalyzer/ColumnMapper";
import {
  LEDGER_TEMPLATE_HEADERS,
  buildLedger,
  readLedgerFile,
  type LedgerImport,
} from "@/lib/bankStatement/reconciliation/ledgerImport";
import { reconcile, summarise } from "@/lib/bankStatement/reconciliation/matcher";
import type { ColumnMapping, MatchStatus, RawRow } from "@/lib/bankStatement/types";
import { usePreferredCurrency } from "@/lib/hooks/usePreferredCurrency";
import { formatMoney } from "@/lib/pos/types";
import { formatDate } from "@/lib/bankStatement/utils/dates";
import { toCsv, downloadCsv } from "@/lib/pos/csv";
import { generateLocalId } from "@/lib/hooks/useLocalStore";

const STATUS_LABEL: Record<MatchStatus, string> = {
  MATCHED: "Matched",
  LIKELY_MATCH: "Likely match",
  UNMATCHED_BANK: "In bank, not in books",
  UNMATCHED_BOOK: "In books, not in bank",
  AMOUNT_MISMATCH: "Amount mismatch",
  DUPLICATE: "Duplicate",
};

const STATUS_STYLE: Record<MatchStatus, string> = {
  MATCHED: "bg-emerald-100 text-emerald-700",
  LIKELY_MATCH: "bg-amber-100 text-amber-700",
  UNMATCHED_BANK: "bg-red-50 text-red-700",
  UNMATCHED_BOOK: "bg-red-50 text-red-700",
  AMOUNT_MISMATCH: "bg-amber-100 text-amber-700",
  DUPLICATE: "bg-cream text-muted",
};

export function ReconcileStep() {
  const { activeTransactions, reconciliation, actions, statements, loaded } = useAnalyzer();
  const { code: currency } = usePreferredCurrency();

  const [rows, setRows] = useState<RawRow[] | null>(null);
  const [ledger, setLedger] = useState<LedgerImport | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<MatchStatus | "ALL">("ALL");

  const onFile = useCallback(async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const { rows: parsed } = await readLedgerFile(file);
      const built = buildLedger(parsed);
      setRows(parsed);
      setLedger(built);
      setMapping(built.mapping);
      setFileName(file.name);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That file could not be read.");
    }
  }, []);

  const remap = useCallback(() => {
    if (!rows || !mapping) return;
    setLedger(buildLedger(rows, { mapping }));
  }, [mapping, rows]);

  const run = useCallback(() => {
    if (!ledger) return;
    const matches = reconcile(activeTransactions, ledger.entries);
    actions.saveReconciliation({
      id: generateLocalId(),
      statementIds: [...new Set(activeTransactions.map((t) => t.statementId))],
      ledgerFileName: fileName,
      entries: ledger.entries,
      matches,
      createdAt: new Date().toISOString(),
    });
    actions.log("Reconciliation run", `${matches.length} results`);
  }, [actions, activeTransactions, fileName, ledger]);

  const summary = useMemo(
    () =>
      reconciliation
        ? summarise(reconciliation.matches, activeTransactions, reconciliation.entries)
        : null,
    [activeTransactions, reconciliation]
  );

  const bankById = useMemo(
    () => new Map(activeTransactions.map((transaction) => [transaction.id, transaction])),
    [activeTransactions]
  );
  const bookById = useMemo(
    () => new Map((reconciliation?.entries ?? []).map((entry) => [entry.id, entry])),
    [reconciliation]
  );

  const visible = useMemo(() => {
    if (!reconciliation) return [];
    return filter === "ALL"
      ? reconciliation.matches
      : reconciliation.matches.filter((match) => match.status === filter);
  }, [filter, reconciliation]);

  const setMatchFlag = (matchId: string, patch: { confirmed?: boolean; rejected?: boolean }) => {
    if (!reconciliation) return;
    actions.saveReconciliation({
      ...reconciliation,
      matches: reconciliation.matches.map((match) =>
        match.id === matchId ? { ...match, ...patch } : match
      ),
    });
    actions.log(patch.confirmed ? "Reconciliation match confirmed" : "Reconciliation match rejected");
  };

  const exportCsv = () => {
    if (!reconciliation) return;
    downloadCsv(
      "bank-reconciliation-matches.csv",
      toCsv(
        ["Status", "Bank date", "Bank narration", "Bank debit", "Bank credit", "Book date", "Book narration", "Book debit", "Book credit", "Difference"],
        reconciliation.matches.map((match) => {
          const bank = match.bankTransactionId ? bankById.get(match.bankTransactionId) : undefined;
          const book = match.ledgerEntryId ? bookById.get(match.ledgerEntryId) : undefined;
          return [
            STATUS_LABEL[match.status],
            bank ? formatDate(bank.date) : "",
            bank?.narration ?? "",
            bank?.debit ?? "",
            bank?.credit ?? "",
            book ? formatDate(book.date) : "",
            book?.narration ?? "",
            book?.debit ?? "",
            book?.credit ?? "",
            match.difference ?? "",
          ];
        })
      )
    );
    actions.log("Report exported", "Reconciliation CSV");
  };

  if (loaded && statements.length === 0) {
    return (
      <Card>
        <h2 className="text-xl font-bold text-ink">Import a statement first</h2>
        <p className="mt-2 text-sm text-muted">
          Reconciliation compares an imported bank statement against your books.
        </p>
        <Link
          href="/products/bank-statement-analyzer/import"
          className="mt-4 inline-block rounded-lg bg-indigo px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo/90"
        >
          Go to import
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-ink">Reconcile against your books</h2>
        <p className="mt-1 text-sm text-muted">
          Import your ledger export and we will match it against the{" "}
          {activeTransactions.length.toLocaleString("en-IN")} bank transactions loaded — exact
          reference matches first, then date windows, then similar narrations.
        </p>
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-indigo px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo/90">
            <Upload className="h-4 w-4" aria-hidden="true" />
            <input
              type="file"
              accept=".csv,.xls,.xlsx"
              className="sr-only"
              onChange={(event) => void onFile(event.target.files?.[0])}
            />
            Import books (CSV, XLS, XLSX)
          </label>
          <SecondaryButton
            onClick={() =>
              downloadCsv(
                "setu-ledger-template.csv",
                toCsv(LEDGER_TEMPLATE_HEADERS, [["01/04/2025", "Opening entry", "REF001", "", "10000"]])
              )
            }
          >
            Download optional template
          </SecondaryButton>
          {fileName ? <span className="text-sm text-muted">{fileName}</span> : null}
        </div>
        <p className="mt-3 text-xs text-muted">
          Any column layout works — we detect the columns and you can correct them below. Your ledger
          is read in this browser too.
        </p>
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </Card>

      {ledger && mapping ? (
        <Card>
          <h3 className="text-lg font-bold text-ink">Ledger columns</h3>
          <p className="mt-1 text-sm text-muted">
            {ledger.entries.length.toLocaleString("en-IN")} entries read
            {ledger.skipped > 0 ? `, ${ledger.skipped} rows skipped (no date or amount)` : ""}.
          </p>
          <div className="mt-4">
            <ColumnMapper
              headers={ledger.headers}
              mapping={mapping}
              onChange={setMapping}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <SecondaryButton onClick={remap}>Re-read with this mapping</SecondaryButton>
            <PrimaryButton onClick={run} disabled={ledger.entries.length === 0}>
              Match against the statement
            </PrimaryButton>
          </div>
        </Card>
      ) : null}

      {reconciliation && summary ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Metric label="Matched" value={String(summary.matched)} />
            <Metric label="Likely matches" value={String(summary.likely)} />
            <Metric label="In bank only" value={String(summary.unmatchedBank)} />
            <Metric label="In books only" value={String(summary.unmatchedBook)} />
            <Metric
              label="Difference"
              value={formatMoney(summary.difference, currency)}
              negative={Math.abs(summary.difference) > 0.005}
            />
          </div>

          <Card>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-bold text-ink">Match results</h3>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={filter}
                  onChange={(event) => setFilter(event.target.value as MatchStatus | "ALL")}
                  className="rounded-lg border border-muted-line/40 bg-white px-3 py-1.5 text-sm"
                  aria-label="Filter matches"
                >
                  <option value="ALL">All results</option>
                  {(Object.keys(STATUS_LABEL) as MatchStatus[]).map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABEL[status]}
                    </option>
                  ))}
                </select>
                <SecondaryButton onClick={exportCsv}>Export CSV</SecondaryButton>
              </div>
            </div>

            <div className="max-h-[32rem] overflow-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="border-b border-muted-line/30 text-left text-muted">
                    <th className="py-2 pr-3 font-semibold">Status</th>
                    <th className="py-2 pr-3 font-semibold">Bank</th>
                    <th className="py-2 pr-3 font-semibold">Books</th>
                    <th className="py-2 pr-3 text-right font-semibold">Difference</th>
                    <th className="py-2 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.slice(0, 400).map((match) => {
                    const bank = match.bankTransactionId ? bankById.get(match.bankTransactionId) : undefined;
                    const book = match.ledgerEntryId ? bookById.get(match.ledgerEntryId) : undefined;
                    return (
                      <tr
                        key={match.id}
                        className={`border-b border-muted-line/20 ${match.rejected ? "opacity-50" : ""}`}
                      >
                        <td className="py-2 pr-3">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[match.status]}`}
                          >
                            {STATUS_LABEL[match.status]}
                          </span>
                          {match.confirmed ? (
                            <span className="ml-1 text-xs font-semibold text-emerald-700">✓</span>
                          ) : null}
                        </td>
                        <td className="max-w-[240px] py-2 pr-3">
                          {bank ? (
                            <>
                              <p className="truncate text-ink">{bank.narration}</p>
                              <p className="text-xs text-muted">
                                {formatDate(bank.date)} ·{" "}
                                {formatMoney(Math.max(bank.debit, bank.credit), currency)}
                              </p>
                            </>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td className="max-w-[240px] py-2 pr-3">
                          {book ? (
                            <>
                              <p className="truncate text-ink">{book.narration}</p>
                              <p className="text-xs text-muted">
                                {formatDate(book.date)} ·{" "}
                                {formatMoney(Math.max(book.debit, book.credit), currency)}
                              </p>
                            </>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-right text-ink">
                          {match.difference ? formatMoney(match.difference, currency) : ""}
                        </td>
                        <td className="py-2">
                          {match.status === "LIKELY_MATCH" || match.status === "AMOUNT_MISMATCH" ? (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => setMatchFlag(match.id, { confirmed: true, rejected: false })}
                                className="text-xs font-semibold text-emerald-700 hover:underline"
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                onClick={() => setMatchFlag(match.id, { rejected: true, confirmed: false })}
                                className="text-xs font-semibold text-red-500 hover:underline"
                              >
                                Reject
                              </button>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {visible.length > 400 ? (
                <p className="pt-2 text-xs text-muted">
                  Showing the first 400 of {visible.length}. Export the CSV for the full list.
                </p>
              ) : null}
            </div>
          </Card>
        </>
      ) : null}

      <Card>
        <p className="text-sm text-muted">
          Need a manual bank reconciliation statement instead — uncleared cheques, deposits in
          transit, charges?{" "}
          <Link href="/tools/bank-reconciliation" className="font-semibold text-indigo hover:underline">
            Open Bank Reconciliation
          </Link>
          .
        </p>
      </Card>
    </div>
  );
}

function Metric({ label, value, negative }: { label: string; value: string; negative?: boolean }) {
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 text-xl font-bold ${negative ? "text-red-600" : "text-ink"}`}>{value}</p>
    </Card>
  );
}
