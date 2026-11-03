"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  NumberInput,
  PrimaryButton,
  SecondaryButton,
  Select,
  TextInput,
} from "@/components/toolkit/ui";
import { WorkspaceBanner } from "@/components/toolkit/WorkspaceBanner";
import { useEntityList } from "@/lib/hooks/useEntityList";
import { useFinanceWorkspace } from "@/lib/hooks/useFinanceWorkspace";
import { getBusiness } from "@/lib/toolkit/workspace";
import type { CashEntry } from "@/lib/toolkit/types";
import {
  derivedCashRows,
  isCashMode,
  manualCashRows,
  type CashRow,
  type CashSource,
} from "@/lib/toolkit/cashbook";
import type { DictKey } from "@/lib/i18n";
import { currencySymbol, formatMoney, generateId, nowIso } from "@/lib/pos/types";
import { toCsv, downloadCsv } from "@/lib/pos/csv";
import { useI18n } from "@/lib/i18n";
import { fill } from "@/lib/i18n/translate";
import { intlLocaleFor } from "@/lib/i18n/pages";

const todayIso = () => new Date().toISOString().split("T")[0];

const SOURCE_LABEL: Record<Exclude<CashSource, "manual">, DictKey> = {
  "pos-sale": "cbSrcPos",
  "customer-payment": "cbSrcCustomer",
  purchase: "cbSrcPurchase",
  expense: "cbSrcExpense",
  "supplier-payment": "cbSrcSupplier",
};

export function CashBookTool() {
  const { t, lang } = useI18n();
  const { items: entries, loading, error, save, remove } = useEntityList<CashEntry>("cashbook");
  const workspace = useFinanceWorkspace("cash-book");
  const [currency, setCurrency] = useState("INR");
  const [cashOnly, setCashOnly] = useState(false);

  const [date, setDate] = useState(todayIso());
  const [type, setType] = useState<"in" | "out">("in");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [viewDate, setViewDate] = useState(todayIso());
  const [deleting, setDeleting] = useState<CashEntry | null>(null);

  const { connected } = workspace;

  // Manual entries plus the money in/out recorded by the POS and linked tools.
  const rows = useMemo(() => {
    const all: CashRow[] = manualCashRows(entries);
    if (connected) {
      all.push(
        ...derivedCashRows({
          orders: workspace.orders,
          ledger: workspace.ledger,
          purchases: workspace.purchases,
          expenses: workspace.expenses,
          supplierLedger: workspace.supplierLedger,
        }),
      );
    }
    return (cashOnly ? all.filter(isCashMode) : all).sort(
      (a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt),
    );
  }, [
    entries,
    connected,
    cashOnly,
    workspace.orders,
    workspace.ledger,
    workspace.purchases,
    workspace.expenses,
    workspace.supplierLedger,
  ]);

  useEffect(() => {
    getBusiness()
      .then((b) => b && setCurrency(b.currency))
      .catch(() => {});
  }, []);

  const amountNum = Number(amount);
  const canAdd = Number.isFinite(amountNum) && amountNum > 0;

  const submit = async () => {
    if (!canAdd) return;
    await save({
      id: generateId(),
      date,
      type,
      amount: amountNum,
      description: description.trim(),
      createdByTool: "cash-book",
      createdAt: nowIso(),
    });
    setAmount("");
    setDescription("");
  };

  // Running balance across ALL entries up to (and including) the viewed day.
  const { dayEntries, openingBalance, dayIn, dayOut } = useMemo(() => {
    let opening = 0;
    const day: CashRow[] = [];
    let inSum = 0;
    let outSum = 0;
    for (const e of rows) {
      const signed = e.type === "in" ? e.amount : -e.amount;
      if (e.date < viewDate) opening += signed;
      if (e.date === viewDate) {
        day.push(e);
        if (e.type === "in") inSum += e.amount;
        else outSum += e.amount;
      }
    }
    return { dayEntries: day.reverse(), openingBalance: opening, dayIn: inSum, dayOut: outSum };
  }, [rows, viewDate]);

  const closingBalance = openingBalance + dayIn - dayOut;

  const sourceLabel = (source: CashSource) =>
    source === "manual" ? t("cbSrcManual") : t(SOURCE_LABEL[source]);

  const exportCsv = () => {
    let running = 0;
    downloadCsv(
      "cash-book.csv",
      toCsv(
        ["Date", "Type", "Description", "Source", "Mode", "In", "Out", "Balance"],
        rows.map((e) => {
          running += e.type === "in" ? e.amount : -e.amount;
          return [
            e.date,
            e.type === "in" ? "Cash in" : "Cash out",
            e.description,
            sourceLabel(e.source),
            e.mode,
            e.type === "in" ? e.amount.toFixed(2) : "",
            e.type === "out" ? e.amount.toFixed(2) : "",
            running.toFixed(2),
          ];
        })
      )
    );
  };

  const stat = (label: string, value: number, tone: string) => (
    <div className="rounded-xl bg-cream-paper/70 p-4 text-center">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 text-lg font-bold ${tone}`}>{formatMoney(value, currency)}</p>
    </div>
  );

  return (
    <div>
      <WorkspaceBanner connection={workspace} message={t("cbConnectHint")} />
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <Card className="h-fit">
        <h2 className="mb-4 text-lg font-bold text-ink">{t("addEntry")}</h2>
        <div className="space-y-4">
          <Field label={t("date")}>
            <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label={t("category")}>
            <Select value={type} onChange={(e) => setType(e.target.value as "in" | "out")}>
              <option value="in">{t("cashIn")} (+)</option>
              <option value="out">{t("cashOut")} (−)</option>
            </Select>
          </Field>
          <Field label={`${t("amount")} (${currencySymbol(currency)})`}>
            <NumberInput
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </Field>
          <Field label={t("description")}>
            <TextInput
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("cbDescPlaceholder")}
            />
          </Field>
          <PrimaryButton className="w-full" onClick={submit} disabled={!canAdd}>
            {t("addEntry")}
          </PrimaryButton>
        </div>
      </Card>

      <div className="space-y-6">
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <Field label={t("day")}>
              <TextInput
                type="date"
                value={viewDate}
                onChange={(e) => setViewDate(e.target.value)}
                className="w-auto"
              />
            </Field>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-lg border border-muted-line/40 p-0.5" role="group">
                {([
                  [false, t("cbModeAll")],
                  [true, t("cbModeCash")],
                ] as const).map(([value, label]) => (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={cashOnly === value}
                    onClick={() => setCashOnly(value)}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                      cashOnly === value ? "bg-indigo text-white" : "text-muted hover:text-indigo"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <SecondaryButton onClick={exportCsv} disabled={rows.length === 0}>
                {t("exportCsv")}
              </SecondaryButton>
            </div>
          </div>
          {connected ? <p className="-mt-2 mb-4 text-xs text-muted">{t("cbAutoNote")}</p> : null}

          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stat(t("opening"), openingBalance, "text-ink")}
            {stat(t("cashIn"), dayIn, "text-emerald-600")}
            {stat(t("cashOut"), dayOut, "text-red-600")}
            {stat(t("closing"), closingBalance, closingBalance >= 0 ? "text-ink" : "text-red-600")}
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {loading ? (
            <p className="py-8 text-center text-sm text-muted">{t("loading")}</p>
          ) : dayEntries.length === 0 ? (
            <EmptyState
              title={t("noEntries")}
              subtitle={t("cbEmptyHint")}
            />
          ) : (
            <div className="space-y-2">
              {dayEntries.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-muted-line/30 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="break-words text-sm font-medium text-ink">{e.description || "—"}</p>
                    <p className="text-xs text-muted">
                      {new Date(e.createdAt).toLocaleTimeString(intlLocaleFor(lang), {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {e.source !== "manual" ? (
                        <span className="ml-2 rounded-full bg-indigo/10 px-2 py-0.5 font-semibold text-indigo">
                          {sourceLabel(e.source)}
                        </span>
                      ) : null}
                      {e.mode ? <span className="ml-2">{e.mode}</span> : null}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-4">
                    <p
                      className={`font-bold ${
                        e.type === "in" ? "text-emerald-600" : "text-red-600"
                      }`}
                    >
                      {e.type === "in" ? "+" : "−"}
                      {formatMoney(e.amount, currency)}
                    </p>
                    {e.source === "manual" ? (
                      <button
                        type="button"
                        onClick={() => setDeleting(entries.find((x) => x.id === e.id) ?? null)}
                        className="text-xs font-semibold text-red-500 hover:text-red-600"
                      >
                        {t("delete")}
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={deleting !== null}
        title={t("cbDeleteTitle")}
        message={
          deleting
            ? fill(t(deleting.type === "in" ? "cbDeleteInMessage" : "cbDeleteOutMessage"), {
                amount: formatMoney(deleting.amount, currency),
              })
            : ""
        }
        confirmLabel={t("delete")}
        onConfirm={async () => {
          if (deleting) await remove(deleting.id);
          setDeleting(null);
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
    </div>
  );
}
