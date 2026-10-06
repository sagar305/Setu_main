"use client";

// Trial Balance — an editable worksheet: type each account with its debit or
// credit balance, add/remove rows, and the tool sums both columns and flags any
// imbalance. Users on the bookkeeping suite can also pull the balances straight
// from their posted journal with one click. Everything persists in localStorage.

import { useMemo, useState } from "react";
import { Card, Field, NumberInput, PrimaryButton, SecondaryButton, TextInput } from "@/components/toolkit/ui";
import { useLocalStore, generateLocalId } from "@/lib/hooks/useLocalStore";
import { useEntityList } from "@/lib/hooks/useEntityList";
import { usePreferredCurrency } from "@/lib/hooks/usePreferredCurrency";
import { useI18n } from "@/lib/i18n";
import type { LanguageCode } from "@/lib/i18n/config";
import { fill, translate, type TKey } from "@/lib/i18n/translate";
import { formatMoney } from "@/lib/pos/types";
import { toCsv, downloadCsv } from "@/lib/pos/csv";
import { printStatement, type PrintRow } from "@/components/tools/statements/shared";
import {
  defaultAccounts,
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

/** The worked example the worksheet opens on, in the reader's language. */
const SEED_ROWS: [TKey, number, number][] = [
  ["tbSeedCash", 25000, 0],
  ["tbSeedReceivable", 12000, 0],
  ["tbSeedInventory", 18000, 0],
  ["tbSeedEquipment", 40000, 0],
  ["tbSeedPayable", 0, 15000],
  ["tbSeedDebt", 0, 30000],
  ["tbSeedStock", 0, 20000],
  ["tbSeedRetained", 0, 10000],
  ["tbSeedRevenue", 0, 45000],
  ["tbSeedExpenses", 25000, 0],
];

function initialState(lang: LanguageCode): TbState {
  return {
    businessName: "",
    asOf: todayIso(),
    rows: SEED_ROWS.map(([key, debit, credit]) =>
      row(translate(lang, key), debit, credit)
    ),
  };
}

export function TrialBalanceTool() {
  const { code: currency } = usePreferredCurrency();
  const { t, lang } = useI18n();
  const [initial] = useState<TbState>(() => initialState(lang));
  const [state, setState] = useLocalStore<TbState>("setu-trial-balance", initial);

  // For the optional "pull from journal" action (bookkeeping suite).
  const { items: coaAccounts } = useEntityList<Account>("coa_accounts");
  const { items: entries } = useEntityList<JournalEntry>("journal_entries");
  const hasJournal = entries.length > 0;

  const money = (v: number) => formatMoney(v, currency);
  const patch = (p: Partial<TbState>) => setState((s) => ({ ...s, ...p }));
  const update = (id: string, p: Partial<TbRow>) =>
    setState((s) => ({ ...s, rows: s.rows.map((r) => (r.id === id ? { ...r, ...p } : r)) }));

  const pullFromJournal = () => {
    const accounts = coaAccounts.length > 0 ? coaAccounts : defaultAccounts(lang);
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
      { label: t("bkAccount"), value: t("tbDebitCredit"), kind: "heading" },
      ...namedRows.map((r) => ({
        label: r.account,
        value: r.debit
          ? `${money(r.debit)} ${t("bkDr")}`
          : r.credit
            ? `${money(r.credit)} ${t("bkCr")}`
            : "—",
      })),
      { label: t("tbTotalDebits"), value: money(totals.debit), kind: "subtotal" },
      { label: t("tbTotalCredits"), value: money(totals.credit), kind: "total" },
    ];
    printStatement({
      docTitle: t("tbDocTitle"),
      businessName: state.businessName,
      periodLabel: state.asOf ? fill(t("tbAsAt"), { date: state.asOf }) : t("tbAsAtDate"),
      rows,
      footNote: t(balanced ? "tbFootBalanced" : "tbFootOutOfBalance"),
      lang,
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("tbBusinessName")}>
            <TextInput
              value={state.businessName}
              onChange={(e) => patch({ businessName: e.target.value })}
              placeholder={t("tbBusinessPlaceholder")}
            />
          </Field>
          <Field label={t("tbAsAtDate")}>
            <TextInput type="date" value={state.asOf} onChange={(e) => patch({ asOf: e.target.value })} />
          </Field>
        </div>
        {hasJournal ? (
          <div className="mt-4">
            <SecondaryButton onClick={pullFromJournal}>
              ↻ {t("tbPullFromJournal")}
            </SecondaryButton>
          </div>
        ) : null}
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b-2 border-indigo/30 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                <th className="py-2 pr-3">{t("bkAccount")}</th>
                <th className="py-2 pr-3 text-right">{t("bkDebit")}</th>
                <th className="py-2 pr-3 text-right">{t("bkCredit")}</th>
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
                      placeholder={t("tbAccountPlaceholder")}
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
                      aria-label={t("tbDeleteRow")}
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
          {t("tbAddAccount")}
        </button>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-muted-line/30 bg-white p-5 text-center shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("tbTotalDebits")}</p>
          <p className="mt-1 text-2xl font-bold text-ink">{money(totals.debit)}</p>
        </div>
        <div className="rounded-2xl border border-muted-line/30 bg-white p-5 text-center shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("tbTotalCredits")}</p>
          <p className="mt-1 text-2xl font-bold text-ink">{money(totals.credit)}</p>
        </div>
        <div
          className={`rounded-2xl border p-5 text-center shadow-sm ${
            balanced ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"
          }`}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {t(balanced ? "tbBalanced" : "tbOutOfBalance")}
          </p>
          <p className={`mt-1 text-2xl font-bold ${balanced ? "text-emerald-700" : "text-red-600"}`}>
            {balanced ? "✓" : money(Math.abs(difference))}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <PrimaryButton onClick={print}>{t("abcExportPdf")}</PrimaryButton>
        <SecondaryButton onClick={exportCsv}>{t("exportCsv")}</SecondaryButton>
      </div>

      {!balanced ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {fill(t("tbImbalanceNote"), { amount: money(Math.abs(difference)) })}
        </p>
      ) : null}
    </div>
  );
}
