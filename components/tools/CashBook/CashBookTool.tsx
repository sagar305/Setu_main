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
import { useEntityList } from "@/lib/hooks/useEntityList";
import { getBusiness } from "@/lib/toolkit/workspace";
import type { CashEntry } from "@/lib/toolkit/types";
import { currencySymbol, formatMoney, generateId, nowIso } from "@/lib/pos/types";
import { toCsv, downloadCsv } from "@/lib/pos/csv";

const todayIso = () => new Date().toISOString().split("T")[0];

export function CashBookTool() {
  const { items: entries, loading, error, save, remove } = useEntityList<CashEntry>("cashbook");
  const [currency, setCurrency] = useState("INR");

  const [date, setDate] = useState(todayIso());
  const [type, setType] = useState<"in" | "out">("in");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [viewDate, setViewDate] = useState(todayIso());
  const [deleting, setDeleting] = useState<CashEntry | null>(null);

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
    const sorted = [...entries].sort(
      (a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt)
    );
    let opening = 0;
    const day: CashEntry[] = [];
    let inSum = 0;
    let outSum = 0;
    for (const e of sorted) {
      const signed = e.type === "in" ? e.amount : -e.amount;
      if (e.date < viewDate) opening += signed;
      if (e.date === viewDate) {
        day.push(e);
        if (e.type === "in") inSum += e.amount;
        else outSum += e.amount;
      }
    }
    return { dayEntries: day.reverse(), openingBalance: opening, dayIn: inSum, dayOut: outSum };
  }, [entries, viewDate]);

  const closingBalance = openingBalance + dayIn - dayOut;

  const exportCsv = () => {
    const sorted = [...entries].sort(
      (a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt)
    );
    let running = 0;
    downloadCsv(
      "cash-book.csv",
      toCsv(
        ["Date", "Type", "Description", "In", "Out", "Balance"],
        sorted.map((e) => {
          running += e.type === "in" ? e.amount : -e.amount;
          return [
            e.date,
            e.type === "in" ? "Cash in" : "Cash out",
            e.description,
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
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <Card className="h-fit">
        <h2 className="mb-4 text-lg font-bold text-ink">Record entry</h2>
        <div className="space-y-4">
          <Field label="Date">
            <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Type">
            <Select value={type} onChange={(e) => setType(e.target.value as "in" | "out")}>
              <option value="in">Cash in (+)</option>
              <option value="out">Cash out (−)</option>
            </Select>
          </Field>
          <Field label={`Amount (${currencySymbol(currency)})`}>
            <NumberInput
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </Field>
          <Field label="Description">
            <TextInput
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Day sales, tea, auto fare"
            />
          </Field>
          <PrimaryButton className="w-full" onClick={submit} disabled={!canAdd}>
            Add entry
          </PrimaryButton>
        </div>
      </Card>

      <div className="space-y-6">
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <Field label="Day">
              <TextInput
                type="date"
                value={viewDate}
                onChange={(e) => setViewDate(e.target.value)}
                className="w-auto"
              />
            </Field>
            <SecondaryButton onClick={exportCsv} disabled={entries.length === 0}>
              Export full book (CSV)
            </SecondaryButton>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stat("Opening", openingBalance, "text-ink")}
            {stat("Cash in", dayIn, "text-emerald-600")}
            {stat("Cash out", dayOut, "text-red-600")}
            {stat("Closing", closingBalance, closingBalance >= 0 ? "text-ink" : "text-red-600")}
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {loading ? (
            <p className="py-8 text-center text-sm text-muted">Loading…</p>
          ) : dayEntries.length === 0 ? (
            <EmptyState
              title="No entries on this day"
              subtitle="Record cash in and cash out through the day — opening and closing balances are calculated automatically."
            />
          ) : (
            <div className="space-y-2">
              {dayEntries.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between rounded-lg border border-muted-line/30 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-ink">{e.description || "—"}</p>
                    <p className="text-xs text-muted">
                      {new Date(e.createdAt).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <p
                      className={`font-bold ${
                        e.type === "in" ? "text-emerald-600" : "text-red-600"
                      }`}
                    >
                      {e.type === "in" ? "+" : "−"}
                      {formatMoney(e.amount, currency)}
                    </p>
                    <button
                      type="button"
                      onClick={() => setDeleting(e)}
                      className="text-xs font-semibold text-red-500 hover:text-red-600"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete cash entry?"
        message={
          deleting
            ? `Delete the ${formatMoney(deleting.amount, currency)} ${
                deleting.type === "in" ? "cash-in" : "cash-out"
              } entry? Balances will be recalculated.`
            : ""
        }
        confirmLabel="Delete"
        onConfirm={async () => {
          if (deleting) await remove(deleting.id);
          setDeleting(null);
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
