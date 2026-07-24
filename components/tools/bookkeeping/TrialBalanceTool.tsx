"use client";

import { useMemo } from "react";
import { Card, EmptyState, SecondaryButton } from "@/components/toolkit/ui";
import { useLocalStore } from "@/lib/hooks/useLocalStore";
import { usePreferredCurrency } from "@/lib/hooks/usePreferredCurrency";
import { formatMoney } from "@/lib/pos/types";
import { toCsv, downloadCsv } from "@/lib/pos/csv";
import {
  COA_STORAGE_KEY,
  DEFAULT_ACCOUNTS,
  JOURNAL_STORAGE_KEY,
  trialBalance,
  type Account,
  type JournalEntry,
} from "@/lib/bookkeeping";

export function TrialBalanceTool() {
  const { code: currency } = usePreferredCurrency();
  const [accounts] = useLocalStore<Account[]>(COA_STORAGE_KEY, DEFAULT_ACCOUNTS);
  const [entries, , loaded] = useLocalStore<JournalEntry[]>(JOURNAL_STORAGE_KEY, []);

  const rows = useMemo(() => trialBalance(entries, accounts), [entries, accounts]);
  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({ debit: acc.debit + r.debit, credit: acc.credit + r.credit }),
        { debit: 0, credit: 0 }
      ),
    [rows]
  );
  const balanced = Math.abs(totals.debit - totals.credit) < 0.005;

  const exportCsv = () =>
    downloadCsv(
      "trial-balance.csv",
      toCsv(
        ["Code", "Account", "Debit", "Credit"],
        [
          ...rows.map((r) => [
            r.account.code,
            r.account.name,
            r.debit ? r.debit.toFixed(2) : "",
            r.credit ? r.credit.toFixed(2) : "",
          ]),
          ["", "TOTAL", totals.debit.toFixed(2), totals.credit.toFixed(2)],
        ]
      )
    );

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-ink">Trial balance</h2>
        <div className="flex items-center gap-3">
          {rows.length > 0 ? (
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                balanced ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"
              }`}
            >
              {balanced ? "Balanced ✓" : "Out of balance"}
            </span>
          ) : null}
          <SecondaryButton onClick={exportCsv} disabled={rows.length === 0}>
            Export CSV
          </SecondaryButton>
        </div>
      </div>

      {!loaded ? (
        <p className="py-8 text-center text-sm text-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState
          title="Nothing to balance yet"
          subtitle="The trial balance builds itself from your journal. Post entries in the Journal Entry tool and every account's net balance appears here."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b-2 border-indigo/30 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                <th className="py-2 pr-3">Code</th>
                <th className="py-2 pr-3">Account</th>
                <th className="py-2 pr-3 text-right">Debit</th>
                <th className="py-2 text-right">Credit</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.account.id} className="border-b border-muted-line/30">
                  <td className="py-2 pr-3 text-muted">{row.account.code}</td>
                  <td className="py-2 pr-3 font-medium text-ink">{row.account.name}</td>
                  <td className="py-2 pr-3 text-right">
                    {row.debit ? formatMoney(row.debit, currency) : "—"}
                  </td>
                  <td className="py-2 text-right">
                    {row.credit ? formatMoney(row.credit, currency) : "—"}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-indigo/30 font-bold text-ink">
                <td className="py-2 pr-3" />
                <td className="py-2 pr-3">Total</td>
                <td className="py-2 pr-3 text-right">{formatMoney(totals.debit, currency)}</td>
                <td className="py-2 text-right">{formatMoney(totals.credit, currency)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {rows.length > 0 && !balanced ? (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          Debits and credits differ by{" "}
          {formatMoney(Math.abs(totals.debit - totals.credit), currency)}. Check recent journal
          entries — every entry must have equal debits and credits.
        </p>
      ) : null}
    </Card>
  );
}
