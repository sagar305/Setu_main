"use client";

// Step 3 — Analyze. The CA dashboard (spec §15) plus the report tables (§16).
// Any statement that did not parse cleanly is declared above the numbers, not
// buried under them.

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Card, Field, NumberInput, SecondaryButton } from "@/components/toolkit/ui";
import { useAnalyzer } from "@/components/tools/BankStatementAnalyzer/AnalyzerProvider";
import { CategoryBars, MonthlyFlowChart, PartyTable } from "@/components/tools/BankStatementAnalyzer/Charts";
import { usePreferredCurrency } from "@/lib/hooks/usePreferredCurrency";
import { formatMoney } from "@/lib/pos/types";
import { formatDate } from "@/lib/bankStatement/utils/dates";
import { summariseParse } from "@/lib/bankStatement/normalization/validation";
import type { Transaction } from "@/lib/bankStatement/types";

export function AnalyzeStep() {
  const { analysis, activeStatements, settings, actions, loaded, statements, activeTransactions } =
    useAnalyzer();
  const { code: currency } = usePreferredCurrency();
  const [threshold, setThreshold] = useState(String(settings.highValueThreshold));

  if (loaded && statements.length === 0) {
    return (
      <Card>
        <h2 className="text-xl font-bold text-ink">Nothing to analyse yet</h2>
        <p className="mt-2 text-sm text-muted">Import a statement first.</p>
        <Link
          href="/tools/bank-statement-analyzer/import"
          className="mt-4 inline-block rounded-lg bg-indigo px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo/90"
        >
          Go to import
        </Link>
      </Card>
    );
  }

  const flagged = activeStatements.filter((statement) => statement.parseStatus !== "VALID");
  const unverified = activeStatements.filter((statement) => !statement.parserValidated);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-ink">Dashboard</h2>
          <p className="mt-1 text-sm text-muted">
            {activeStatements.length} statement{activeStatements.length === 1 ? "" : "s"} ·{" "}
            {activeTransactions.length.toLocaleString("en-IN")} transactions
          </p>
        </div>
        <Link
          href="/tools/bank-statement-analyzer/export"
          className="rounded-lg bg-indigo px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo/90"
        >
          Export reports
        </Link>
      </div>

      {flagged.length > 0 ? (
        <Card className="border-red-200">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" aria-hidden="true" />
            <div>
              <h3 className="font-bold text-ink">These figures may be incomplete</h3>
              <ul className="mt-2 space-y-1 text-sm text-muted">
                {flagged.map((statement) => (
                  <li key={statement.id}>
                    <strong className="text-ink">{statement.fileName}</strong> —{" "}
                    {summariseParse(statement.validation, statement.parseStatus)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      ) : null}

      {unverified.length > 0 ? (
        <p className="rounded-xl bg-cream-paper/70 px-4 py-3 text-sm text-muted">
          Read with the generic layout engine — bank-specific parsers have not been verified against
          real statements yet. Spot-check a few rows against your PDF before filing anything.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Total credits" value={formatMoney(analysis.totals.credits, currency)} />
        <SummaryCard label="Total debits" value={formatMoney(analysis.totals.debits, currency)} />
        <SummaryCard
          label="Net cash flow"
          value={formatMoney(analysis.totals.net, currency)}
          negative={analysis.totals.net < 0}
          strong
        />
        <SummaryCard
          label="Transactions"
          value={analysis.totals.count.toLocaleString("en-IN")}
          hint={
            analysis.totals.excludedDuplicates > 0
              ? `${analysis.totals.excludedDuplicates} excluded as duplicates`
              : undefined
          }
        />
      </div>

      <MonthlyFlowChart rows={analysis.monthly} currency={currency} />

      <div className="grid gap-6 lg:grid-cols-2">
        <CategoryBars
          title="Expenses by category"
          rows={analysis.expenseCategories}
          currency={currency}
          direction="DEBIT"
          emptyMessage="No debits in this period."
        />
        <CategoryBars
          title="Income by category"
          rows={analysis.incomeCategories}
          currency={currency}
          direction="CREDIT"
          emptyMessage="No credits in this period."
        />
      </div>

      <PartyTable rows={analysis.parties} currency={currency} />

      {analysis.anomalies.length > 0 ? (
        <Card>
          <h3 className="mb-3 text-base font-bold text-ink">Worth a look</h3>
          <ul className="space-y-2">
            {analysis.anomalies.map((anomaly) => (
              <li
                key={anomaly.id}
                className={`rounded-xl px-4 py-3 text-sm ${
                  anomaly.severity === "warning"
                    ? "bg-amber-50 text-amber-800"
                    : "bg-cream-paper/70 text-muted"
                }`}
              >
                {anomaly.message}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <h3 className="mb-4 text-base font-bold text-ink">Monthly summary</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-muted-line/30 text-left text-muted">
                <th className="py-2 pr-4 font-semibold">Month</th>
                <th className="py-2 pr-4 text-right font-semibold">Opening</th>
                <th className="py-2 pr-4 text-right font-semibold">Credits</th>
                <th className="py-2 pr-4 text-right font-semibold">Debits</th>
                <th className="py-2 text-right font-semibold">Closing</th>
              </tr>
            </thead>
            <tbody>
              {analysis.monthly.map((row) => (
                <tr key={row.month} className="border-b border-muted-line/20">
                  <td className="py-2 pr-4 text-ink">{row.label}</td>
                  <td className="py-2 pr-4 text-right text-muted">
                    {row.openingBalance === undefined ? "—" : formatMoney(row.openingBalance, currency)}
                  </td>
                  <td className="py-2 pr-4 text-right text-ink">{formatMoney(row.credits, currency)}</td>
                  <td className="py-2 pr-4 text-right text-ink">{formatMoney(row.debits, currency)}</td>
                  <td className="py-2 text-right text-muted">
                    {row.closingBalance === undefined ? "—" : formatMoney(row.closingBalance, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <ReportCard
          title="Cash transactions"
          subtitle={`In ${formatMoney(analysis.cash.deposits, currency)} · out ${formatMoney(analysis.cash.withdrawals, currency)}`}
          rows={analysis.cash.transactions}
          currency={currency}
          empty="No cash transactions identified."
        />
        <ReportCard
          title="High value transactions"
          subtitle={`At or above ${formatMoney(settings.highValueThreshold, currency)}`}
          rows={analysis.highValue}
          currency={currency}
          empty="Nothing above the threshold."
          action={
            <form
              className="flex items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const value = Number(threshold);
                if (Number.isFinite(value) && value > 0) {
                  void actions.updateSettings({ ...settings, highValueThreshold: value });
                }
              }}
            >
              <div className="w-32">
                <Field label="Threshold">
                  <NumberInput
                    value={threshold}
                    onChange={(event) => setThreshold(event.target.value)}
                    min={0}
                  />
                </Field>
              </div>
              <SecondaryButton type="submit" className="!py-2">
                Set
              </SecondaryButton>
            </form>
          }
        />
        <ReportCard
          title="Bank charges"
          subtitle={formatMoney(analysis.bankCharges.total, currency)}
          rows={analysis.bankCharges.transactions}
          currency={currency}
          empty="No bank charges identified."
        />
        <ReportCard
          title="Interest"
          subtitle={formatMoney(analysis.interest.total, currency)}
          rows={analysis.interest.transactions}
          currency={currency}
          empty="No interest entries identified."
        />
        <ReportCard
          title="Possible transfers"
          subtitle={formatMoney(analysis.transfers.total, currency)}
          rows={analysis.transfers.transactions}
          currency={currency}
          empty="No transfers identified."
        />
        <ReportCard
          title="Uncategorised — needs review"
          subtitle={`${analysis.uncategorised.length} transactions`}
          rows={analysis.uncategorised}
          currency={currency}
          empty="Everything is categorised."
          action={
            <Link
              href="/tools/bank-statement-analyzer/review"
              className="text-sm font-semibold text-indigo hover:underline"
            >
              Review them
            </Link>
          }
        />
      </div>

      <Card>
        <h3 className="mb-2 text-base font-bold text-ink">GST-relevant transactions</h3>
        <p className="mb-4 text-sm text-muted">
          Identification only. This tool does not calculate ITC eligibility, tax liability, place of
          supply or reverse charge — those need context it does not have.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-cream-paper/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">GST relevant</p>
            <p className="mt-1 text-2xl font-bold text-ink">{analysis.gst.relevant.length}</p>
          </div>
          <div className="rounded-xl bg-cream-paper/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Potentially relevant
            </p>
            <p className="mt-1 text-2xl font-bold text-ink">{analysis.gst.potential.length}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  negative,
  strong,
}: {
  label: string;
  value: string;
  hint?: string;
  negative?: boolean;
  strong?: boolean;
}) {
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p
        className={`mt-1 font-bold ${strong ? "text-2xl" : "text-xl"} ${
          negative ? "text-red-600" : "text-ink"
        }`}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </Card>
  );
}

function ReportCard({
  title,
  subtitle,
  rows,
  currency,
  empty,
  action,
}: {
  title: string;
  subtitle: string;
  rows: Transaction[];
  currency: string;
  empty: string;
  action?: React.ReactNode;
}) {
  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-ink">{title}</h3>
          <p className="text-sm text-muted">{subtitle}</p>
        </div>
        {action}
      </div>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">{empty}</p>
      ) : (
        <div className="max-h-64 overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-muted-line/30 text-left text-muted">
                <th className="py-1.5 pr-3 font-semibold">Date</th>
                <th className="py-1.5 pr-3 font-semibold">Narration</th>
                <th className="py-1.5 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 100).map((transaction) => (
                <tr key={transaction.id} className="border-b border-muted-line/20">
                  <td className="whitespace-nowrap py-1.5 pr-3 text-xs text-muted">
                    {formatDate(transaction.date)}
                  </td>
                  <td className="max-w-[220px] truncate py-1.5 pr-3 text-ink">
                    {transaction.narration}
                  </td>
                  <td className="py-1.5 text-right text-ink">
                    {formatMoney(Math.max(transaction.debit, transaction.credit), currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 100 ? (
            <p className="pt-2 text-xs text-muted">Showing the first 100 of {rows.length}.</p>
          ) : null}
        </div>
      )}
    </Card>
  );
}
