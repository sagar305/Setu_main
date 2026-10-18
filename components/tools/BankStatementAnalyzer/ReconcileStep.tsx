"use client";

// Step 4 — Reconcile (spec §17, decisions 7 and 21).
// Bank statement against the books, with flexible column mapping on the ledger
// import. This is the automatic matching engine; the manual BRS workflow lives
// in the existing /tools/bank-reconciliation tool, which we link to rather than
// duplicate.

import { useI18n } from "@/lib/i18n";
import { fill, translate, type TKey } from "@/lib/i18n/translate";
import { intlLocaleFor } from "@/lib/i18n/pages";
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

const STATUS_KEYS: Record<MatchStatus, TKey> = {
  MATCHED: "bsRcMatched",
  LIKELY_MATCH: "bsRcLikely",
  UNMATCHED_BANK: "bsRcBankOnly",
  UNMATCHED_BOOK: "bsRcBooksOnly",
  AMOUNT_MISMATCH: "bsRcAmountMismatch",
  DUPLICATE: "bsColDuplicate",
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
  const { lang, t } = useI18n();
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
      setError(caught instanceof Error ? caught.message : t("bsRcFileUnreadable"));
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
    actions.log(
      { code: "RECONCILE_RUN", results: matches.length },
      "Reconciliation run",
      `${matches.length} results`
    );
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
    actions.log(
      { code: patch.confirmed ? "RECONCILE_CONFIRMED" : "RECONCILE_REJECTED" },
      patch.confirmed ? "Reconciliation match confirmed" : "Reconciliation match rejected"
    );
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
            translate("en", STATUS_KEYS[match.status]),
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
    actions.log(
      { code: "REPORT_EXPORTED", format: "reconciliation" },
      "Report exported",
      "Reconciliation CSV"
    );
  };

  if (loaded && statements.length === 0) {
    return (
      <Card>
        <h2 className="text-xl font-bold text-ink">{t("bsRcImportFirstTitle")}</h2>
        <p className="mt-2 text-sm text-muted">
          {t("bsRcComparesAgainst")}
        </p>
        <Link
          href="/products/bank-statement-analyzer/import"
          className="mt-4 inline-block rounded-lg bg-indigo px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo/90"
        >
          {t("bsStepImport")}
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-ink">{t("bsRcTitle")}</h2>
        <p className="mt-1 text-sm text-muted">
          {fill(t("bsRcBlurb"), {
            n: activeTransactions.length.toLocaleString(intlLocaleFor(lang)),
          })}
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
            {t("bsRcImportBooks")}
          </label>
          <SecondaryButton
            onClick={() =>
              downloadCsv(
                "setu-ledger-template.csv",
                toCsv(LEDGER_TEMPLATE_HEADERS, [["01/04/2025", "Opening entry", "REF001", "", "10000"]])
              )
            }
          >
            {t("bsRcDownloadTemplate")}
          </SecondaryButton>
          {fileName ? <span className="text-sm text-muted">{fileName}</span> : null}
        </div>
        <p className="mt-3 text-xs text-muted">
          {t("bsRcAnyLayout")}
        </p>
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </Card>

      {ledger && mapping ? (
        <Card>
          <h3 className="text-lg font-bold text-ink">{t("bsRcLedgerColumns")}</h3>
          <p className="mt-1 text-sm text-muted">
            {fill(t("bsRcEntriesRead"), {
              n: ledger.entries.length.toLocaleString(intlLocaleFor(lang)),
            })}
            {ledger.skipped > 0 ? fill(t("bsRcRowsSkipped"), { n: ledger.skipped }) : ""}.
          </p>
          <div className="mt-4">
            <ColumnMapper
              headers={ledger.headers}
              mapping={mapping}
              onChange={setMapping}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <SecondaryButton onClick={remap}>{t("bsGrReRead")}</SecondaryButton>
            <PrimaryButton onClick={run} disabled={ledger.entries.length === 0}>
              {t("bsRcMatchAgainst")}
            </PrimaryButton>
          </div>
        </Card>
      ) : null}

      {reconciliation && summary ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Metric label={t("bsRcMatched")} value={String(summary.matched)} />
            <Metric label={t("bsRcLikelyMatches")} value={String(summary.likely)} />
            <Metric label={t("bsRcBankOnlyShort")} value={String(summary.unmatchedBank)} />
            <Metric label={t("bsRcBooksOnlyShort")} value={String(summary.unmatchedBook)} />
            <Metric
              label={t("bsRcDifference")}
              value={formatMoney(summary.difference, currency)}
              negative={Math.abs(summary.difference) > 0.005}
            />
          </div>

          <Card>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-bold text-ink">{t("bsRcResults")}</h3>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={filter}
                  onChange={(event) => setFilter(event.target.value as MatchStatus | "ALL")}
                  className="rounded-lg border border-muted-line/40 bg-white px-3 py-1.5 text-sm"
                  aria-label={t("bsRcFilterAria")}
                >
                  <option value="ALL">{t("bsRcAllResults")}</option>
                  {(Object.keys(STATUS_KEYS) as MatchStatus[]).map((status) => (
                    <option key={status} value={status}>
                      {t(STATUS_KEYS[status])}
                    </option>
                  ))}
                </select>
                <SecondaryButton onClick={exportCsv}>{t("bsRcExportCsv")}</SecondaryButton>
              </div>
            </div>

            <div className="max-h-[32rem] overflow-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="border-b border-muted-line/30 text-left text-muted">
                    <th className="py-2 pr-3 font-semibold">{t("bsRcStatus")}</th>
                    <th className="py-2 pr-3 font-semibold">{t("bsRcBank")}</th>
                    <th className="py-2 pr-3 font-semibold">{t("bsRcBooks")}</th>
                    <th className="py-2 pr-3 text-right font-semibold">{t("bsRcDifference")}</th>
                    <th className="py-2 font-semibold">{t("bsRcAction")}</th>
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
                            {t(STATUS_KEYS[match.status])}
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
                                {t("bsRcConfirm")}
                              </button>
                              <button
                                type="button"
                                onClick={() => setMatchFlag(match.id, { rejected: true, confirmed: false })}
                                className="text-xs font-semibold text-red-500 hover:underline"
                              >
                                {t("bsRcReject")}
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
                  {fill(t("bsRcShowingFirst"), { n: visible.length })}
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
