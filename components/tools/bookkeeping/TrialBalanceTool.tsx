"use client";

// Trial Balance — an editable worksheet: type each account with its debit or
// credit balance, add/remove rows, and the tool sums both columns and flags any
// imbalance. Users on the bookkeeping suite can also pull the balances straight
// from their posted journal with one click. Everything persists in localStorage.

import { useMemo } from "react";
import { Card, Field, NumberInput, PrimaryButton, SecondaryButton, TextInput } from "@/components/toolkit/ui";
import { useLocalStore, generateLocalId } from "@/lib/hooks/useLocalStore";
import { useEntityList } from "@/lib/hooks/useEntityList";
import { usePreferredCurrency } from "@/lib/hooks/usePreferredCurrency";
import { formatMoney } from "@/lib/pos/types";
import { toCsv, downloadCsv } from "@/lib/pos/csv";
import { printStatement, type PrintRow } from "@/components/tools/statements/shared";
import {
  DEFAULT_ACCOUNTS,
  trialBalance,
  type Account,
  type JournalEntry,
} from "@/lib/bookkeeping";

type TbRow = { id: string; account: string; debit: number; credit: number };

type TbState = { businessName: string; asOf: string; rows: TbRow[] };

const row = (account: string, debit = 0, credit = 0): TbRow => ({
  id: generateLocalId(),
  account,
  debit,
  credit,
});

const todayIso = () => new Date().toISOString().split("T")[0];

function initialState(): TbState {
  return {
    businessName: "",
    asOf: todayIso(),
    rows: [
      row("Cash", 25000),
      row("Accounts Receivable", 12000),
      row("Inventory", 18000),
      row("Equipment", 40000),
      row("Accounts Payable", 0, 15000),
      row("Long-term Debt", 0, 30000),
      row("Common Stock", 0, 20000),
      row("Retained Earnings", 0, 10000),
      row("Revenue", 0, 45000),
      row("Expenses", 25000),
    ],
  };
}

export function TrialBalanceTool() {
  const { code: currency } = usePreferredCurrency();
  const [state, setState] = useLocalStore<TbState>("setu-trial-balance", initialState());

  // For the optional "pull from journal" action (bookkeeping suite).
  const { items: coaAccounts } = useEntityList<Account>("coa_accounts");
  const { items: entries } = useEntityList<JournalEntry>("journal_entries");
  const hasJournal = entries.length > 0;

  const money = (v: number) => formatMoney(v, currency);
  const patch = (p: Partial<TbState>) => setState((s) => ({ ...s, ...p }));
  const update = (id: string, p: Partial<TbRow>) =>
    setState((s) => ({ ...s, rows: s.rows.map((r) => (r.id === id ? { ...r, ...p } : r)) }));

  const pullFromJournal = () => {
    const accounts = coaAccounts.length > 0 ? coaAccounts : DEFAULT_ACCOUNTS;
    const derived = trialBalance(entries, accounts);
    setState((s) => ({
      ...s,
      rows: derived.map((d) => row(`${d.account.code} · ${d.account.name}`, d.debit, d.credit)),
    }));
  };

  const totals = useMemo(
    () =>
      state.rows.reduce(
        (acc, r) => ({ debit: acc.debit + (r.debit || 0), credit: acc.credit + (r.credit || 0) }),
        { debit: 0, credit: 0 }
      ),
    [state.rows]
  );
  const difference = totals.debit - totals.credit;
  const balanced = Math.abs(difference) < 0.005;

  const namedRows = state.rows.filter((r) => r.account.trim());

  const exportCsv = () =>
    downloadCsv(
      "trial-balance.csv",
      toCsv(
        ["Account", "Debit", "Credit"],
        [
          ...namedRows.map((r) => [r.account, r.debit ? r.debit.toFixed(2) : "", r.credit ? r.credit.toFixed(2) : ""]),
          ["TOTAL", totals.debit.toFixed(2), totals.credit.toFixed(2)],
        ]
      )
    );

  const print = () => {
    const rows: PrintRow[] = [
      { label: "Account", value: "Debit / Credit", kind: "heading" },
      ...namedRows.map((r) => ({
        label: r.account,
        value: r.debit ? `${money(r.debit)} Dr` : r.credit ? `${money(r.credit)} Cr` : "—",
      })),
      { label: `Total debits`, value: money(totals.debit), kind: "subtotal" },
      { label: `Total credits`, value: money(totals.credit), kind: "total" },
    ];
    printStatement({
      docTitle: "Trial Balance",
      businessName: state.businessName,
      periodLabel: state.asOf ? `As at ${state.asOf}` : "As at date",
      rows,
      footNote: balanced ? "Balanced — debits equal credits." : "Out of balance — review the postings.",
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Your business name">
            <TextInput
              value={state.businessName}
              onChange={(e) => patch({ businessName: e.target.value })}
              placeholder="Acme Inc."
            />
          </Field>
          <Field label="As at date">
            <TextInput type="date" value={state.asOf} onChange={(e) => patch({ asOf: e.target.value })} />
          </Field>
        </div>
        {hasJournal ? (
          <div className="mt-4">
            <SecondaryButton onClick={pullFromJournal}>
              ↻ Pull balances from my journal
            </SecondaryButton>
          </div>
        ) : null}
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b-2 border-indigo/30 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                <th className="py-2 pr-3">Account</th>
                <th className="py-2 pr-3 text-right">Debit</th>
                <th className="py-2 pr-3 text-right">Credit</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {state.rows.map((r) => (
                <tr key={r.id} className="border-b border-muted-line/30">
                  <td className="py-2 pr-3">
                    <TextInput
                      value={r.account}
                      onChange={(e) => update(r.id, { account: e.target.value })}
                      placeholder="Account name"
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <NumberInput
                      step="0.01"
                      className="text-right"
                      value={r.debit || ""}
                      onChange={(e) =>
                        update(r.id, { debit: Number(e.target.value) || 0, credit: 0 })
                      }
                      placeholder="0.00"
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <NumberInput
                      step="0.01"
                      className="text-right"
                      value={r.credit || ""}
                      onChange={(e) =>
                        update(r.id, { credit: Number(e.target.value) || 0, debit: 0 })
                      }
                      placeholder="0.00"
                    />
                  </td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      onClick={() =>
                        setState((s) => ({ ...s, rows: s.rows.filter((x) => x.id !== r.id) }))
                      }
                      disabled={state.rows.length === 1}
                      className="text-sm font-semibold text-red-500 hover:text-red-600 disabled:opacity-40"
                      aria-label="Delete row"
                    >
                      🗑
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          onClick={() => setState((s) => ({ ...s, rows: [...s.rows, row("")] }))}
          className="mt-3 text-sm font-semibold text-indigo hover:underline"
        >
          + Add account
        </button>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-muted-line/30 bg-white p-5 text-center shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Total debits</p>
          <p className="mt-1 text-2xl font-bold text-ink">{money(totals.debit)}</p>
        </div>
        <div className="rounded-2xl border border-muted-line/30 bg-white p-5 text-center shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Total credits</p>
          <p className="mt-1 text-2xl font-bold text-ink">{money(totals.credit)}</p>
        </div>
        <div
          className={`rounded-2xl border p-5 text-center shadow-sm ${
            balanced ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"
          }`}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {balanced ? "Balanced" : "Out of balance"}
          </p>
          <p className={`mt-1 text-2xl font-bold ${balanced ? "text-emerald-700" : "text-red-600"}`}>
            {balanced ? "✓" : money(Math.abs(difference))}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <PrimaryButton onClick={print}>Export PDF</PrimaryButton>
        <SecondaryButton onClick={exportCsv}>Export CSV</SecondaryButton>
      </div>

      {!balanced ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          Debits and credits differ by {money(Math.abs(difference))}. A difference divisible by 9
          often means transposed digits; also check for a missing account or a balance on the wrong
          side.
        </p>
      ) : null}
    </div>
  );
}
