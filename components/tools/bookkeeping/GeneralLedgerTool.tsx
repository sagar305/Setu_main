"use client";

import { useMemo, useState } from "react";
import { Card, EmptyState, Field, SecondaryButton, Select } from "@/components/toolkit/ui";
import { useEntityList } from "@/lib/hooks/useEntityList";
import { usePreferredCurrency } from "@/lib/hooks/usePreferredCurrency";
import { formatMoney } from "@/lib/pos/types";
import { toCsv, downloadCsv } from "@/lib/pos/csv";
import {
  DEFAULT_ACCOUNTS,
  isDebitNormal,
  ledgerRows,
  type Account,
  type JournalEntry,
} from "@/lib/bookkeeping";

export function GeneralLedgerTool() {
  const { code: currency } = usePreferredCurrency();
  const { items: coaAccounts } = useEntityList<Account>("coa_accounts");
  const accounts = coaAccounts.length > 0 ? coaAccounts : DEFAULT_ACCOUNTS;
  const { items: entries, loading } = useEntityList<JournalEntry>("journal_entries");
  const loaded = !loading;
  const [accountId, setAccountId] = useState("");

  const sortedAccounts = useMemo(
    () => [...accounts].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })),
    [accounts]
  );

  const account = accounts.find((a) => a.id === accountId);
  const rows = useMemo(
    () => (accountId ? ledgerRows(entries, accounts, accountId) : []),
    [entries, accounts, accountId]
  );

  const closing = rows.length > 0 ? rows[rows.length - 1].balance : 0;
  const side = account ? (isDebitNormal(account.type) ? "Dr" : "Cr") : "";

  const exportCsv = () => {
    if (!account) return;
    downloadCsv(
      `ledger-${account.code}.csv`,
      toCsv(
        ["Date", "Narration", "Debit", "Credit", "Balance"],
        rows.map((r) => [
          r.date,
          r.narration,
          r.debit ? r.debit.toFixed(2) : "",
          r.credit ? r.credit.toFixed(2) : "",
          r.balance.toFixed(2),
        ])
      )
    );
  };

  return (
    <Card>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="w-full max-w-sm">
          <Field label="Account">
            <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">Choose an account…</option>
              {sortedAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} · {a.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <SecondaryButton onClick={exportCsv} disabled={rows.length === 0}>
          Export CSV
        </SecondaryButton>
      </div>

      {!loaded ? (
        <p className="py-8 text-center text-sm text-muted">Loading…</p>
      ) : !accountId ? (
        <EmptyState
          title="Pick an account"
          subtitle="The ledger shows every journal posting to that account with a running balance. Post entries in the Journal Entry tool first."
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No postings yet"
          subtitle="Nothing has been posted to this account. Record transactions in the Journal Entry tool and they appear here instantly."
        />
      ) : (
        <>
          <div className="mb-4 rounded-xl bg-cream-paper/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Closing balance — {account?.name}
            </p>
            <p className="mt-1 text-2xl font-bold text-ink">
              {formatMoney(Math.abs(closing), currency)}{" "}
              <span className="text-base font-semibold text-muted">
                {closing >= 0 ? side : side === "Dr" ? "Cr" : "Dr"}
              </span>
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b-2 border-indigo/30 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Narration</th>
                  <th className="py-2 pr-3 text-right">Debit</th>
                  <th className="py-2 pr-3 text-right">Credit</th>
                  <th className="py-2 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b border-muted-line/30">
                    <td className="py-2 pr-3 whitespace-nowrap">{row.date}</td>
                    <td className="py-2 pr-3">{row.narration}</td>
                    <td className="py-2 pr-3 text-right">
                      {row.debit ? formatMoney(row.debit, currency) : "—"}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      {row.credit ? formatMoney(row.credit, currency) : "—"}
                    </td>
                    <td className="py-2 text-right font-medium">
                      {formatMoney(Math.abs(row.balance), currency)}{" "}
                      <span className="text-xs text-muted">
                        {row.balance >= 0 ? side : side === "Dr" ? "Cr" : "Dr"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}
