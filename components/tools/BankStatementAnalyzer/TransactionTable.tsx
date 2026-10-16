"use client";

// The CA review table (spec §14).
// ---------------------------------------------------------------------------
// Virtualised rather than paginated (decision 29): a window of rows is rendered
// inside a scroll container sized to the full list, so 5,000 transactions scroll
// as one continuous ledger with a sticky header. No virtualisation dependency —
// the repo has none, and the windowing this needs is a dozen lines.

import { useI18n } from "@/lib/i18n";
import { useCallback, useMemo, useRef, useState } from "react";
import type { Category, Transaction } from "@/lib/bankStatement/types";
import { formatDate } from "@/lib/bankStatement/utils/dates";
import {
  activeCategories,
  categoryLabel,
  groupLabel,
  GROUP_ORDER,
} from "@/lib/bankStatement/classification/categories";
import { confidenceBand, sourceBadge, sourceLabel } from "@/lib/bankStatement/classification/classifier";
import { transactionIssueLabel } from "@/lib/bankStatement/messages";
import { intlLocaleFor } from "@/lib/i18n/pages";
import type { LanguageCode } from "@/lib/i18n/config";
import { fill, translate, type TKey } from "@/lib/i18n/translate";

/** How a row's parse status reads beside the warning triangle. */
const PARSE_STATUS_KEYS: Record<NonNullable<Transaction["rowStatus"]>, TKey> = {
  VALID: "bsStatusValid",
  WARNING: "bsStatusWarning",
  UNRESOLVED: "bsStatusUnresolved",
};

const ROW_HEIGHT = 56;
const OVERSCAN = 8;

export type SortKey = "date" | "debit" | "credit" | "narration";

const TYPE_KEYS: Record<Transaction["classificationType"], TKey> = {
  BUSINESS: "appBusiness",
  PERSONAL: "bsTypePersonal",
  TRANSFER: "tkCoTransfer",
  UNKNOWN: "bsTypeUnreviewed",
};

export function TransactionTable({
  transactions,
  categories,
  selected,
  onToggle,
  onToggleAll,
  onEdit,
  onCreateRule,
  currency,
  viewportRows = 50,
}: {
  transactions: Transaction[];
  categories: Category[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (ids: string[]) => void;
  onEdit: (transaction: Transaction, patch: Partial<Transaction>) => void;
  onCreateRule: (transaction: Transaction) => void;
  currency: string;
  /** How many rows the viewport shows before scrolling (density, decision 29). */
  viewportRows?: number;
}) {
  const { lang, t } = useI18n();
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const height = Math.min(viewportRows, Math.max(transactions.length, 1)) * ROW_HEIGHT;
  const first = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const last = Math.min(
    transactions.length,
    Math.ceil((scrollTop + height) / ROW_HEIGHT) + OVERSCAN
  );
  const visible = transactions.slice(first, last);

  const options = useMemo(() => activeCategories(categories), [categories]);
  const allSelected =
    transactions.length > 0 && transactions.every((transaction) => selected.has(transaction.id));

  const money = useCallback(
    (value: number) =>
      value
        ? new Intl.NumberFormat(currency === "INR" ? "en-IN" : intlLocaleFor(lang), {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }).format(value)
        : "",
    [currency, lang]
  );

  return (
    <div className="rounded-2xl border border-muted-line/30 bg-white shadow-sm">
      {/* Header is outside the scroll container so it stays put. */}
      <div className="hidden border-b border-muted-line/30 bg-cream-paper/50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted lg:flex lg:items-center lg:gap-3">
        <input
          type="checkbox"
          checked={allSelected}
          onChange={() => onToggleAll(transactions.map((transaction) => transaction.id))}
          className="h-4 w-4 rounded border-muted-line text-indigo focus:ring-indigo"
          aria-label={t("bsSelectAllVisible")}
        />
        <span className="w-20 shrink-0">{t("date")}</span>
        <span className="min-w-0 flex-1">{t("bkNarration")}</span>
        <span className="w-24 shrink-0 text-right">{t("bsColDebits")}</span>
        <span className="w-24 shrink-0 text-right">{t("bsColCredits")}</span>
        <span className="w-40 shrink-0">{t("category")}</span>
        <span className="w-28 shrink-0">{t("typeLabel")}</span>
        <span className="w-28 shrink-0">{t("bsColConfidence")}</span>
        <span className="w-16 shrink-0" />
      </div>

      <div
        ref={containerRef}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        style={{ height }}
        className="overflow-y-auto overflow-x-auto"
        role="region"
        aria-label={`${transactions.length} transactions`}
      >
        <div style={{ height: transactions.length * ROW_HEIGHT, position: "relative" }}>
          <div style={{ transform: `translateY(${first * ROW_HEIGHT}px)` }}>
            {visible.map((transaction) => (
              <Row
                key={transaction.id}
                transaction={transaction}
                categories={options}
                selected={selected.has(transaction.id)}
                onToggle={() => onToggle(transaction.id)}
                onEdit={(patch) => onEdit(transaction, patch)}
                onCreateRule={() => onCreateRule(transaction)}
                money={money}
              />
            ))}
          </div>
        </div>
      </div>

      {transactions.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted">
          No transactions match these filters.
        </p>
      ) : null}
    </div>
  );
}

/**
 * What the confidence pill means on hover. An AI row also reports the raw
 * cosine similarity, because the percentage beside it is a calibrated score
 * rather than the model's own number and the two should never be confused.
 */
function confidenceTitle(transaction: Transaction, lang: LanguageCode): string {
  const base = `${sourceLabel(transaction.classificationSource, lang)} · ${transaction.confidence ?? 0}%`;
  if (transaction.classificationSource !== "AI" || transaction.aiSimilarity === undefined) return base;
  return fill(translate(lang, "bsSimilarity"), {
    base,
    score: transaction.aiSimilarity.toFixed(2),
  });
}

function Row({
  transaction,
  categories,
  selected,
  onToggle,
  onEdit,
  onCreateRule,
  money,
}: {
  transaction: Transaction;
  categories: Category[];
  selected: boolean;
  onToggle: () => void;
  onEdit: (patch: Partial<Transaction>) => void;
  onCreateRule: () => void;
  money: (value: number) => string;
}) {
  const { lang, t } = useI18n();
  const band = confidenceBand(transaction.confidence);
  const bandStyle =
    band === "high"
      ? "bg-emerald-100 text-emerald-700"
      : band === "medium"
        ? "bg-amber-100 text-amber-700"
        : "bg-cream text-muted";

  return (
    <div
      style={{ height: ROW_HEIGHT }}
      className={`flex items-center gap-3 border-b border-muted-line/20 px-4 text-sm ${
        selected ? "bg-indigo/5" : ""
      }`}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        className="h-4 w-4 shrink-0 rounded border-muted-line text-indigo focus:ring-indigo"
        aria-label={fill(t("bsSelectRowAria"), { date: formatDate(transaction.date) })}
      />

      <span className="w-20 shrink-0 whitespace-nowrap text-xs text-muted">
        {formatDate(transaction.date)}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-ink" title={transaction.narration}>
          {transaction.narration}
        </p>
        <p className="truncate text-xs text-muted">
          {transaction.partyName ?? "—"}
          {transaction.isDuplicate && transaction.duplicateOverride !== "KEEP" ? (
            <span className="ml-2 font-semibold text-amber-700">⚠ {t("bsPossibleDuplicate")}</span>
          ) : null}
          {transaction.needsReview ? (
            <span className="ml-2 font-semibold text-amber-700">{t("bsNeedsReview")}</span>
          ) : null}
          {transaction.rowStatus && transaction.rowStatus !== "VALID" ? (
            <span
              className="ml-2 font-semibold text-red-600"
              title={transactionIssueLabel(transaction, lang)}
            >
              ⚠ {t(PARSE_STATUS_KEYS[transaction.rowStatus])}
            </span>
          ) : null}
        </p>
      </div>

      <span className="w-24 shrink-0 text-right font-medium text-ink">
        {money(transaction.debit)}
      </span>
      <span className="w-24 shrink-0 text-right font-medium text-emerald-700">
        {money(transaction.credit)}
      </span>

      <select
        value={transaction.category ?? ""}
        onChange={(event) =>
          onEdit({
            category: event.target.value || undefined,
            classificationSource: "MANUAL",
            confidence: 100,
            // The CA has spoken: the row is no longer anything to review, and
            // the model's own score no longer describes it.
            needsReview: false,
            aiSimilarity: undefined,
          })
        }
        className="w-40 shrink-0 rounded-lg border border-muted-line/40 bg-white px-2 py-1.5 text-xs text-ink outline-none focus:border-indigo"
        aria-label={t("category")}
      >
        <option value="">{t("bsUncategorised")}</option>
        {GROUP_ORDER.map((group) => (
          <optgroup key={group} label={groupLabel(group, lang)}>
            {categories
              .filter((category) => category.group === group)
              .map((category) => (
                <option key={category.id} value={category.id}>
                  {categoryLabel(category, lang)}
                </option>
              ))}
          </optgroup>
        ))}
      </select>

      <select
        value={transaction.classificationType}
        onChange={(event) =>
          onEdit({
            classificationType: event.target.value as Transaction["classificationType"],
            classificationSource: "MANUAL",
          })
        }
        className="w-28 shrink-0 rounded-lg border border-muted-line/40 bg-white px-2 py-1.5 text-xs text-ink outline-none focus:border-indigo"
        aria-label={t("bsTypeAria")}
      >
        {(Object.keys(TYPE_KEYS) as Transaction["classificationType"][]).map((type) => (
          <option key={type} value={type}>
            {t(TYPE_KEYS[type])}
          </option>
        ))}
      </select>

      <span className="flex w-28 shrink-0 items-center gap-1.5">
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${bandStyle}`}
          title={confidenceTitle(transaction, lang)}
        >
          {transaction.confidence ?? 0}%
        </span>
        <span
          className="truncate text-[11px] text-muted"
          title={sourceLabel(transaction.classificationSource, lang)}
        >
          {sourceBadge(transaction.classificationSource, lang)}
        </span>
      </span>

      <button
        type="button"
        onClick={onCreateRule}
        className="w-16 shrink-0 text-left text-xs font-semibold text-indigo hover:underline"
      >
        {t("bsRuleShort")}
      </button>
    </div>
  );
}
