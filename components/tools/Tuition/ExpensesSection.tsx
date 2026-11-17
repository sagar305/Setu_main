"use client";

// What the class cost to run in a month. The rows live in the shared Expense
// Tracker store, so an expense added here shows there (and in the Cash Book
// and Profit Dashboard) and the other way round — nothing is kept twice.

import { useI18n } from "@/lib/i18n";
import { fill } from "@/lib/i18n/translate";
import { useLocalizedHref } from "@/lib/i18n/use-localized-href";
import { useEffect, useState } from "react";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { currencySymbol, formatMoney, generateId, nowIso } from "@/lib/pos/types";
import { EXPENSE_CATEGORY_KEYS } from "@/lib/toolkit/category-labels";
import { EXPENSE_CATEGORIES, type Expense } from "@/lib/toolkit/types";
import { currentMonthKey, formatDate, formatMonth, todayIso } from "@/lib/tuition/types";
import {
  ConfirmDialog,
  Field,
  inputClass,
  Modal,
  primaryBtnClass,
  secondaryBtnClass,
} from "@/components/tools/FreePos/ui";

// Stored as the Expense Tracker stores them, so both tools group alike.
const PAYMENT_MODES = ["Cash", "UPI", "Card", "Bank transfer"];

export function ExpensesSection({
  period,
  currency,
  expenses,
  byCategory,
  total,
  onSave,
  onRemove,
}: {
  period: string;
  currency: string;
  /** This month's expenses, newest first. */
  expenses: Expense[];
  byCategory: { category: string; amount: number }[];
  total: number;
  onSave: (expense: Expense) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const { t, lang } = useI18n();
  const href = useLocalizedHref();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayIso());
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [paymentMode, setPaymentMode] = useState(PAYMENT_MODES[0]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Expense | null>(null);

  // A new expense defaults into the month being looked at.
  useEffect(() => {
    if (open) setDate(period === currentMonthKey() ? todayIso() : `${period}-01`);
  }, [open, period]);

  const categoryLabel = (name: string) =>
    EXPENSE_CATEGORY_KEYS[name] ? t(EXPENSE_CATEGORY_KEYS[name]) : name;

  const amountNum = Number(amount);
  const canSave = Number.isFinite(amountNum) && amountNum > 0 && Boolean(date);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await onSave({
        id: generateId(),
        date,
        category,
        description: description.trim(),
        amount: amountNum,
        paymentMode,
        supplierId: null,
        createdByTool: "tuition-manager",
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
      setAmount("");
      setDescription("");
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mt-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-bold text-ink">
            {fill(t("tuRpExpensesFor"), { month: formatMonth(period, lang) })}
          </h3>
          <p className="mt-1 max-w-xl text-xs text-muted">{t("tuRpExpensesBlurb")}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <a href={href("/tools/expense-tracker")} className={secondaryBtnClass}>
            <ExternalLink className="h-4 w-4" />
            {t("openExpenseTracker")}
          </a>
          <button type="button" onClick={() => setOpen(true)} className={primaryBtnClass}>
            <Plus className="h-4 w-4" />
            {t("addExpense")}
          </button>
        </div>
      </div>

      {expenses.length === 0 ? (
        <p className="mt-3 rounded-xl bg-cream-paper p-4 text-sm text-muted">{t("pdNoExpenses")}</p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            {byCategory.map((row) => (
              <span
                key={row.category}
                className="rounded-full bg-cream-paper px-3 py-1 text-xs font-semibold text-ink"
              >
                {categoryLabel(row.category)}
                <span className="ml-1.5 font-normal text-muted">
                  {formatMoney(row.amount, currency)}
                </span>
              </span>
            ))}
          </div>
          <ul className="mt-3 divide-y divide-muted-line/20 rounded-xl border border-muted-line/30 bg-white">
            {expenses.map((expense) => (
              <li key={expense.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">
                    {categoryLabel(expense.category)}
                    {expense.description ? (
                      <span className="font-normal text-muted"> — {expense.description}</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted">
                    {[formatDate(expense.date, lang), expense.paymentMode]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-sm font-semibold text-ink">
                    {formatMoney(expense.amount, currency)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setDeleting(expense)}
                    className="rounded-lg p-2 text-muted transition hover:bg-red-50 hover:text-red-600"
                    aria-label={fill(t("appDeleteNamed"), {
                      name: categoryLabel(expense.category),
                    })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
            <li className="flex items-center justify-between gap-3 bg-cream-paper px-3 py-2 text-sm font-bold text-ink">
              <span>{t("tuRpExpenses")}</span>
              <span className="pr-10">{formatMoney(total, currency)}</span>
            </li>
          </ul>
        </>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={t("addExpense")}>
        <form onSubmit={(event) => void submit(event)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("date")} required>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label={`${t("amount")} (${currencySymbol(currency)})`} required>
              <input
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.00"
                className={inputClass}
              />
            </Field>
            <Field label={t("category")}>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className={inputClass}
              >
                {EXPENSE_CATEGORIES.map((name) => (
                  <option key={name} value={name}>
                    {categoryLabel(name)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("paymentMode")}>
              <select
                value={paymentMode}
                onChange={(event) => setPaymentMode(event.target.value)}
                className={inputClass}
              >
                {PAYMENT_MODES.map((mode) => (
                  <option key={mode}>{mode}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label={t("description")}>
            <input
              type="text"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t("etDescPlaceholder")}
              className={inputClass}
            />
          </Field>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setOpen(false)} className={secondaryBtnClass}>
              {t("cancel")}
            </button>
            <button type="submit" disabled={!canSave || saving} className={primaryBtnClass}>
              {t("addExpense")}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title={t("etDeleteTitle")}
        message={
          deleting
            ? fill(t("etDeleteMessage"), {
                amount: formatMoney(deleting.amount, currency),
                date: formatDate(deleting.date, lang),
              })
            : ""
        }
        confirmLabel={t("delete")}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) void onRemove(deleting.id);
          setDeleting(null);
        }}
      />
    </section>
  );
}
