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
import { getBusiness, getSuppliers } from "@/lib/toolkit/workspace";
import type { Expense, Supplier } from "@/lib/toolkit/types";
import { EXPENSE_CATEGORIES } from "@/lib/toolkit/types";
import { currencySymbol, formatMoney, generateId, nowIso } from "@/lib/pos/types";
import { toCsv, downloadCsv } from "@/lib/pos/csv";
import { useI18n } from "@/lib/i18n";

const todayIso = () => new Date().toISOString().split("T")[0];
const monthOf = (isoDate: string) => isoDate.slice(0, 7);

export function ExpenseTrackerTool() {
  const { t } = useI18n();
  const { items: expenses, loading, error, save, remove } = useEntityList<Expense>("expenses");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [currency, setCurrency] = useState("INR");

  const [date, setDate] = useState(todayIso());
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [supplierId, setSupplierId] = useState("");

  const [month, setMonth] = useState(monthOf(todayIso()));
  const [deleting, setDeleting] = useState<Expense | null>(null);

  useEffect(() => {
    getSuppliers().then(setSuppliers).catch(() => {});
    getBusiness()
      .then((b) => b && setCurrency(b.currency))
      .catch(() => {});
  }, []);

  const amountNum = Number(amount);
  const canAdd = Number.isFinite(amountNum) && amountNum > 0 && date;

  const submit = async () => {
    if (!canAdd) return;
    const record: Expense = {
      id: generateId(),
      date,
      category,
      description: description.trim(),
      amount: amountNum,
      paymentMode,
      supplierId: supplierId || null,
      createdByTool: "expense-tracker",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    await save(record);
    setDescription("");
    setAmount("");
  };

  const inMonth = useMemo(
    () =>
      expenses
        .filter((e) => monthOf(e.date) === month)
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    [expenses, month]
  );

  const monthTotal = inMonth.reduce((s, e) => s + e.amount, 0);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of inMonth) map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [inMonth]);

  const months = useMemo(() => {
    const set = new Set(expenses.map((e) => monthOf(e.date)));
    set.add(monthOf(todayIso()));
    return Array.from(set).sort().reverse();
  }, [expenses]);

  const exportCsv = () =>
    downloadCsv(
      `expenses-${month}.csv`,
      toCsv(
        ["Date", "Category", "Description", "Amount", "Payment mode", "Supplier"],
        inMonth.map((e) => [
          e.date,
          e.category,
          e.description,
          e.amount.toFixed(2),
          e.paymentMode,
          suppliers.find((s) => s.id === e.supplierId)?.name ?? "",
        ])
      )
    );

  const monthLabel = (m: string) =>
    new Date(`${m}-01T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <Card className="h-fit">
        <h2 className="mb-4 text-lg font-bold text-ink">{t("addExpense")}</h2>
        <div className="space-y-4">
          <Field label={t("date")}>
            <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label={t("category")}>
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
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
              placeholder="e.g. Shop rent for July"
            />
          </Field>
          <Field label={t("paymentMode")}>
            <Select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
              {["Cash", "UPI", "Card", "Bank transfer"].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </Select>
          </Field>
          {suppliers.length > 0 ? (
            <Field label={t("supplier")}>
              <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <option value="">—</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          <PrimaryButton className="w-full" onClick={submit} disabled={!canAdd}>
            {t("addExpense")}
          </PrimaryButton>
        </div>
      </Card>

      <div className="space-y-6">
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <Select value={month} onChange={(e) => setMonth(e.target.value)} className="w-auto">
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </Select>
            <div className="flex items-center gap-3">
              <p className="text-sm text-muted">
                {t("total")}:{" "}
                <span className="text-base font-bold text-ink">
                  {formatMoney(monthTotal, currency)}
                </span>
              </p>
              <SecondaryButton onClick={exportCsv} disabled={inMonth.length === 0}>
                {t("exportCsv")}
              </SecondaryButton>
            </div>
          </div>

          {byCategory.length > 0 ? (
            <div className="mb-4 flex flex-wrap gap-2">
              {byCategory.map(([cat, total]) => (
                <span
                  key={cat}
                  className="rounded-full bg-cream px-3 py-1 text-xs font-semibold text-ink"
                >
                  {cat}: {formatMoney(total, currency)}
                </span>
              ))}
            </div>
          ) : null}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {loading ? (
            <p className="py-8 text-center text-sm text-muted">{t("loading")}</p>
          ) : inMonth.length === 0 ? (
            <EmptyState
              title={t("noEntries")}
              subtitle="Record rent, salaries, purchases and bills — the Profit Dashboard uses them to show your real profit."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-muted-line/30 text-left text-muted">
                    <th className="py-2 pr-4 font-semibold">{t("date")}</th>
                    <th className="py-2 pr-4 font-semibold">{t("category")}</th>
                    <th className="py-2 pr-4 font-semibold">{t("description")}</th>
                    <th className="py-2 pr-4 text-right font-semibold">{t("amount")}</th>
                    <th className="py-2 font-semibold" />
                  </tr>
                </thead>
                <tbody>
                  {inMonth.map((e) => (
                    <tr key={e.id} className="border-b border-muted-line/20">
                      <td className="py-2.5 pr-4 text-muted">{e.date.slice(8)}</td>
                      <td className="py-2.5 pr-4 font-medium text-ink">{e.category}</td>
                      <td className="py-2.5 pr-4 text-muted">{e.description || "—"}</td>
                      <td className="py-2.5 pr-4 text-right font-semibold text-ink">
                        {formatMoney(e.amount, currency)}
                      </td>
                      <td className="py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => setDeleting(e)}
                          className="text-xs font-semibold text-red-500 hover:text-red-600"
                        >
                          {t("delete")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete expense?"
        message={
          deleting
            ? `Delete the ${formatMoney(deleting.amount, currency)} ${deleting.category} expense from ${deleting.date}?`
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
