"use client";

import { useMemo, useState } from "react";
import {
  Card,
  ConfirmDialog,
  Field,
  NumberInput,
  PrimaryButton,
  SecondaryButton,
  Select,
  TextInput,
} from "@/components/toolkit/ui";
import { useLocalStore, generateLocalId } from "@/lib/hooks/useLocalStore";
import { usePreferredCurrency } from "@/lib/hooks/usePreferredCurrency";
import { useI18n } from "@/lib/i18n";
import { fill, type TKey } from "@/lib/i18n/translate";
import { intlLocaleFor } from "@/lib/i18n/pages";
import { formatMoney } from "@/lib/pos/types";
import { toCsv, downloadCsv } from "@/lib/pos/csv";
import { printStatement, type PrintRow } from "@/components/tools/statements/shared";

// Reconciling items, grouped by which balance they adjust.
type ItemKind =
  | "deposit-in-transit" // + bank side
  | "outstanding-payment" // − bank side
  | "bank-credit" // + book side (interest, direct receipts)
  | "bank-debit"; // − book side (charges, direct debits)

type ReconItem = { id: string; kind: ItemKind; description: string; amount: number };

type ReconState = {
  bankBalance: number;
  bookBalance: number;
  items: ReconItem[];
};

const KIND_OPTIONS: { value: ItemKind; label: TKey; hint: TKey }[] = [
  { value: "deposit-in-transit", label: "brDepositLabel", hint: "brDepositHint" },
  { value: "outstanding-payment", label: "brOutstandingLabel", hint: "brOutstandingHint" },
  { value: "bank-credit", label: "brCreditLabel", hint: "brCreditHint" },
  { value: "bank-debit", label: "brDebitLabel", hint: "brDebitHint" },
];

export function BankReconciliationTool() {
  const { code: currency } = usePreferredCurrency();
  const { t, lang } = useI18n();
  const [state, setState, loaded] = useLocalStore<ReconState>("setu-bank-recon", {
    bankBalance: 0,
    bookBalance: 0,
    items: [],
  });

  const [kind, setKind] = useState<ItemKind>("deposit-in-transit");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [deleting, setDeleting] = useState<ReconItem | null>(null);

  const amountNum = Number(amount);
  const canAdd = Number.isFinite(amountNum) && amountNum > 0;

  const addItem = () => {
    if (!canAdd) return;
    setState((s) => ({
      ...s,
      items: [
        ...s.items,
        { id: generateLocalId(), kind, description: description.trim(), amount: amountNum },
      ],
    }));
    setDescription("");
    setAmount("");
  };

  const result = useMemo(() => {
    let adjustedBank = state.bankBalance;
    let adjustedBook = state.bookBalance;
    for (const item of state.items) {
      if (item.kind === "deposit-in-transit") adjustedBank += item.amount;
      if (item.kind === "outstanding-payment") adjustedBank -= item.amount;
      if (item.kind === "bank-credit") adjustedBook += item.amount;
      if (item.kind === "bank-debit") adjustedBook -= item.amount;
    }
    const difference = adjustedBank - adjustedBook;
    return { adjustedBank, adjustedBook, difference, reconciled: Math.abs(difference) < 0.005 };
  }, [state]);

  const kindLabel = (k: ItemKind) => {
    const key = KIND_OPTIONS.find((o) => o.value === k)?.label;
    return key ? t(key) : k;
  };

  const exportCsv = () =>
    downloadCsv(
      "bank-reconciliation.csv",
      toCsv(
        ["Item", "Type", "Amount"],
        [
          ["Bank statement balance", "", state.bankBalance.toFixed(2)],
          ["Book balance", "", state.bookBalance.toFixed(2)],
          ...state.items.map((i) => [i.description, kindLabel(i.kind), i.amount.toFixed(2)]),
          ["Adjusted bank balance", "", result.adjustedBank.toFixed(2)],
          ["Adjusted book balance", "", result.adjustedBook.toFixed(2)],
          ["Difference", "", result.difference.toFixed(2)],
        ]
      )
    );

  const printRecon = () => {
    const money = (v: number) => formatMoney(v, currency);
    const section = (kind: ItemKind, heading: string): PrintRow[] => {
      const rows = state.items.filter((i) => i.kind === kind);
      if (rows.length === 0) return [];
      return [
        { label: heading, value: "", kind: "heading" },
        ...rows.map((i) => ({ label: i.description || kindLabel(i.kind), value: money(i.amount) })),
      ];
    };
    printStatement({
      docTitle: t("brDocTitle"),
      businessName: "",
      periodLabel: fill(t("brAsOf"), {
        date: new Date().toLocaleDateString(intlLocaleFor(lang)),
      }),
      rows: [
        { label: t("brBankStatementBalance"), value: money(state.bankBalance), kind: "subtotal" },
        ...section("deposit-in-transit", t("brAddDeposits")),
        ...section("outstanding-payment", t("brLessOutstanding")),
        { label: t("brAdjustedBankRow"), value: money(result.adjustedBank), kind: "total" },
        { label: t("brBookBalanceRow"), value: money(state.bookBalance), kind: "subtotal" },
        ...section("bank-credit", t("brAddCredits")),
        ...section("bank-debit", t("brLessCharges")),
        { label: t("brAdjustedBookRow"), value: money(result.adjustedBook), kind: "total" },
        {
          label: t(result.reconciled ? "brReconciled" : "brUnreconciled"),
          value: result.reconciled ? "✓" : money(result.difference),
          kind: "subtotal",
        },
      ],
      lang,
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <div className="space-y-6">
        <Card>
          <h2 className="mb-4 text-lg font-bold text-ink">{t("brBalances")}</h2>
          <div className="space-y-4">
            <Field label={t("brBankClosing")}>
              <NumberInput
                step="0.01"
                value={state.bankBalance || ""}
                onChange={(e) =>
                  setState((s) => ({ ...s, bankBalance: Number(e.target.value) || 0 }))
                }
                placeholder={t("brBankClosingPlaceholder")}
              />
            </Field>
            <Field label={t("brBookBalance")}>
              <NumberInput
                step="0.01"
                value={state.bookBalance || ""}
                onChange={(e) =>
                  setState((s) => ({ ...s, bookBalance: Number(e.target.value) || 0 }))
                }
                placeholder={t("brBookPlaceholder")}
              />
            </Field>
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-bold text-ink">{t("brAddItemHeading")}</h2>
          <div className="space-y-4">
            <Field label={t("typeLabel")}>
              <Select value={kind} onChange={(e) => setKind(e.target.value as ItemKind)}>
                {KIND_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {t(o.label)}
                  </option>
                ))}
              </Select>
            </Field>
            <p className="text-xs text-muted">
              {(() => {
                const hint = KIND_OPTIONS.find((o) => o.value === kind)?.hint;
                return hint ? t(hint) : "";
              })()}
            </p>
            <Field label={t("description")}>
              <TextInput
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("brDescPlaceholder")}
              />
            </Field>
            <Field label={t("amount")}>
              <NumberInput
                min={0}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </Field>
            <PrimaryButton className="w-full" onClick={addItem} disabled={!canAdd}>
              {t("brAddItem")}
            </PrimaryButton>
          </div>
        </Card>
      </div>

      <Card className="h-fit">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-ink">{t("brReconciliation")}</h2>
          <div className="flex gap-2">
            <SecondaryButton onClick={printRecon}>{t("qgPrintPdf")}</SecondaryButton>
            <SecondaryButton onClick={exportCsv}>{t("exportCsv")}</SecondaryButton>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-cream-paper/70 p-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("brAdjustedBank")}</p>
            <p className="mt-1 text-lg font-bold text-ink">
              {formatMoney(result.adjustedBank, currency)}
            </p>
          </div>
          <div className="rounded-xl bg-cream-paper/70 p-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("brAdjustedBook")}</p>
            <p className="mt-1 text-lg font-bold text-ink">
              {formatMoney(result.adjustedBook, currency)}
            </p>
          </div>
          <div
            className={`rounded-xl p-4 text-center ${
              result.reconciled ? "bg-emerald-100" : "bg-red-50"
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {t(result.reconciled ? "brReconciled" : "brDifference")}
            </p>
            <p
              className={`mt-1 text-lg font-bold ${
                result.reconciled ? "text-emerald-700" : "text-red-600"
              }`}
            >
              {result.reconciled ? "✓" : formatMoney(result.difference, currency)}
            </p>
          </div>
        </div>

        {!loaded ? (
          <p className="py-8 text-center text-sm text-muted">{t("loading")}</p>
        ) : state.items.length === 0 ? (
          <p className="rounded-xl bg-cream-paper/50 p-4 text-sm text-muted">{t("brEmptyHint")}</p>
        ) : (
          <div className="space-y-2">
            {state.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-lg border border-muted-line/30 px-4 py-2.5"
              >
                <div>
                  <p className="text-sm font-medium text-ink">{item.description || "—"}</p>
                  <p className="text-xs text-muted">{kindLabel(item.kind)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-bold text-ink">{formatMoney(item.amount, currency)}</p>
                  <button
                    type="button"
                    onClick={() => setDeleting(item)}
                    className="text-xs font-semibold text-red-500 hover:text-red-600"
                  >
                    {t("delete")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!result.reconciled && state.items.length > 0 ? (
          <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {fill(t("brStillApart"), {
              amount: formatMoney(Math.abs(result.difference), currency),
            })}
          </p>
        ) : null}
      </Card>

      <ConfirmDialog
        open={deleting !== null}
        title={t("brDeleteTitle")}
        message={
          deleting
            ? fill(t("brDeleteMessage"), {
                name: deleting.description || kindLabel(deleting.kind),
              })
            : ""
        }
        confirmLabel={t("delete")}
        onConfirm={() => {
          if (deleting)
            setState((s) => ({ ...s, items: s.items.filter((i) => i.id !== deleting.id) }));
          setDeleting(null);
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
