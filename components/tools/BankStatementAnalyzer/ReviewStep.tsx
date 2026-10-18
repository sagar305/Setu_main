"use client";

// Step 2 — Review.
// The screen a CA actually spends their time on: filter, bulk-categorise,
// create rules from real transactions, override duplicates, undo, and see at a
// glance what still needs attention.

import { useI18n } from "@/lib/i18n";
import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Card, ConfirmDialog, Field, PrimaryButton, SecondaryButton, Select, TextInput } from "@/components/toolkit/ui";
import { useAnalyzer } from "@/components/tools/BankStatementAnalyzer/AnalyzerProvider";
import { TransactionTable } from "@/components/tools/BankStatementAnalyzer/TransactionTable";
import { RuleEditor } from "@/components/tools/BankStatementAnalyzer/RuleEditor";
import { CategoryManager } from "@/components/tools/BankStatementAnalyzer/CategoryManager";
import { ActivityLog } from "@/components/tools/BankStatementAnalyzer/ActivityLog";
import { ProgressPanel } from "@/components/tools/BankStatementAnalyzer/ProgressPanel";
import type { BulkEdit, ClassificationRule, Transaction } from "@/lib/bankStatement/types";
import { describeCondition, ruleFromTransaction } from "@/lib/bankStatement/classification/rulesEngine";
import {
  GROUP_ORDER,
  activeCategories,
  categoryLabel,
  groupLabel,
} from "@/lib/bankStatement/classification/categories";
import { intlLocaleFor } from "@/lib/i18n/pages";
import { fill } from "@/lib/i18n/translate";
import { usePreferredCurrency } from "@/lib/hooks/usePreferredCurrency";
import { generateLocalId } from "@/lib/hooks/useLocalStore";
import { normaliseText } from "@/lib/bankStatement/utils/text";

// Loaded on the client, and only with this tab. Everything the AI feature needs
// — the worker, the library, the model — hangs off this panel, so keeping it in
// its own chunk is what stops the analyzer's first load from growing at all.
const AiCategorisationPanel = dynamic(
  () =>
    import("@/components/tools/BankStatementAnalyzer/AiCategorisationPanel").then(
      (module) => module.AiCategorisationPanel
    ),
  { ssr: false }
);

type Tab = "transactions" | "rules" | "categories" | "activity";

/**
 * Rows the CA still has to look at: nothing categorised, a confidence below
 * their threshold, or a category the semantic model applied in its middle band
 * and explicitly flagged.
 */
function needsAttention(transaction: Transaction, threshold: number): boolean {
  if (!transaction.category) return true;
  if (transaction.needsReview) return true;
  return (transaction.confidence ?? 0) < threshold;
}

type Filters = {
  search: string;
  category: string;
  type: string;
  direction: string;
  status: string;
};

const EMPTY_FILTERS: Filters = {
  search: "",
  category: "",
  type: "",
  direction: "",
  status: "",
};

export function ReviewStep() {
  const { t, lang } = useI18n();
  const { activeTransactions, categories, rules, settings, actions, loaded, statements } =
    useAnalyzer();
  const { code: currency } = usePreferredCurrency();

  const [tab, setTab] = useState<Tab>("transactions");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCategory, setBulkCategory] = useState("");
  const [editingRule, setEditingRule] = useState<ClassificationRule | null>(null);
  const [density, setDensity] = useState(50);
  const [reclassifying, setReclassifying] = useState<{ current: number; total: number } | null>(null);
  const [undoStack, setUndoStack] = useState<Transaction[][]>([]);
  const [deletingRule, setDeletingRule] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const search = normaliseText(filters.search);
    return activeTransactions.filter((transaction) => {
      if (search && !normaliseText(transaction.narration).includes(search)) {
        if (!normaliseText(transaction.partyName ?? "").includes(search)) return false;
      }
      if (filters.category === "__none__" && transaction.category) return false;
      if (filters.category && filters.category !== "__none__" && transaction.category !== filters.category) {
        return false;
      }
      if (filters.type && transaction.classificationType !== filters.type) return false;
      if (filters.direction && transaction.transactionType !== filters.direction) return false;
      if (filters.status === "duplicates" && !transaction.isDuplicate) return false;
      if (filters.status === "needs-review" && !needsAttention(transaction, settings.reviewConfidenceThreshold)) {
        return false;
      }
      if (filters.status === "issues" && (transaction.rowStatus ?? "VALID") === "VALID") return false;
      if (filters.status === "high-value" && !transaction.isHighValue) return false;
      return true;
    });
  }, [activeTransactions, filters, settings.reviewConfidenceThreshold]);

  const needsReview = useMemo(
    () =>
      activeTransactions.filter((transaction) =>
        needsAttention(transaction, settings.reviewConfidenceThreshold)
      ).length,
    [activeTransactions, settings.reviewConfidenceThreshold]
  );

  const pushUndo = useCallback(
    (ids: string[]) => {
      const snapshot = activeTransactions
        .filter((transaction) => ids.includes(transaction.id))
        .map((transaction) => ({ ...transaction }));
      setUndoStack((stack) => [...stack.slice(-9), snapshot]);
    },
    [activeTransactions]
  );

  const edit = useCallback(
    async (transaction: Transaction, patch: Partial<Transaction>) => {
      pushUndo([transaction.id]);
      await actions.updateTransactions((current) => ({ ...current, ...patch }), [transaction.id]);
      actions.log(
        { code: "TRANSACTION_EDITED", fields: Object.keys(patch) },
        "Transaction edited",
        Object.keys(patch).join(", ")
      );
    },
    [actions, pushUndo]
  );

  const bulkApply = useCallback(
    async (patch: Partial<Transaction>, edit: BulkEdit, label: string) => {
      const ids = [...selected];
      if (ids.length === 0) return;
      pushUndo(ids);
      await actions.updateTransactions((current) => ({ ...current, ...patch }), ids);
      actions.log(
        { code: "BULK_EDIT", edit, count: ids.length },
        label,
        `${ids.length} transactions`
      );
      setSelected(new Set());
    },
    [actions, pushUndo, selected]
  );

  const undo = useCallback(async () => {
    const snapshot = undoStack[undoStack.length - 1];
    if (!snapshot) return;
    setUndoStack((stack) => stack.slice(0, -1));
    const byId = new Map(snapshot.map((transaction) => [transaction.id, transaction]));
    await actions.updateTransactions(
      (current) => byId.get(current.id) ?? current,
      snapshot.map((transaction) => transaction.id)
    );
    actions.log(
      { code: "CHANGE_UNDONE", count: snapshot.length },
      "Change undone",
      `${snapshot.length} transactions`
    );
  }, [actions, undoStack]);

  const runClassification = useCallback(async () => {
    setReclassifying({ current: 0, total: activeTransactions.length });
    await actions.reclassifyAll((current, total) => setReclassifying({ current, total }));
    setReclassifying(null);
    actions.log({ code: "TRANSACTIONS_CLASSIFIED" }, "Transactions classified");
  }, [actions, activeTransactions.length]);

  if (loaded && statements.length === 0) {
    return (
      <Card>
        <h2 className="text-xl font-bold text-ink">{t("bsRvNothingTitle")}</h2>
        <p className="mt-2 text-sm text-muted">{t("bsRvNothingBody")}</p>
        <Link
          href="/products/bank-statement-analyzer/import"
          className="mt-4 inline-block rounded-lg bg-indigo px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo/90"
        >
          {t("bsRvGoToImport")}
        </Link>
      </Card>
    );
  }

  const options = activeCategories(categories);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-ink">{t("bsRvTitle")}</h2>
        <div className="flex flex-wrap gap-2">
          <SecondaryButton onClick={runClassification} disabled={reclassifying !== null}>
            {reclassifying ? t("bsRvClassifying") : t("bsRvRunClassification")}
          </SecondaryButton>
          <SecondaryButton onClick={undo} disabled={undoStack.length === 0}>
            {t("clTdUndo")}
          </SecondaryButton>
          <Link
            href="/products/bank-statement-analyzer/analyze"
            className="rounded-lg bg-indigo px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo/90"
          >
            {t("bsStepAnalyze")}
          </Link>
        </div>
      </div>

      {reclassifying ? (
        <ProgressPanel
          progress={{
            label: t("bsRvClassifyingProgress"),
            current: reclassifying.current,
            total: reclassifying.total,
          }}
        />
      ) : null}

      {needsReview > 0 ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {/* The count is bold wherever the sentence puts it, so the placeholder
              splits the line rather than the English word order. */}
          {(() => {
            const [before, after] = fill(
              t(needsReview === 1 ? "bsRvNeedsReview1" : "bsRvNeedsReviewN"),
              { n: "\u0000", pct: settings.reviewConfidenceThreshold }
            ).split("\u0000");
            return (
              <>
                {before}
                <strong>{needsReview.toLocaleString(intlLocaleFor(lang))}</strong>
                {after}
              </>
            );
          })()}{" "}
          <button
            type="button"
            className="font-semibold underline"
            onClick={() => setFilters({ ...EMPTY_FILTERS, status: "needs-review" })}
          >
            {t("bsRvShowThem")}
          </button>
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 border-b border-muted-line/30">
        {(
          [
            [
              "transactions",
              fill(t("bsRvTabTransactions"), {
                n: activeTransactions.length.toLocaleString(intlLocaleFor(lang)),
              }),
            ],
            ["rules", fill(t("bsRvTabRules"), { n: rules.length })],
            ["categories", t("dnMnCategories")],
            ["activity", t("bsActTitle")],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition ${
              tab === key
                ? "border-indigo text-indigo"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "transactions" ? (
        <>
          <AiCategorisationPanel />

          <Card>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Field label={t("bsRvSearch")}>
                <TextInput
                  value={filters.search}
                  onChange={(event) => setFilters({ ...filters, search: event.target.value })}
                  placeholder={t("bsRvSearchPlaceholder")}
                />
              </Field>
              <Field label={t("category")}>
                <Select
                  value={filters.category}
                  onChange={(event) => setFilters({ ...filters, category: event.target.value })}
                >
                  <option value="">{t("bsRvAll")}</option>
                  <option value="__none__">{t("bsUncategorised")}</option>
                  {GROUP_ORDER.map((group) => (
                    <optgroup key={group} label={groupLabel(group, lang)}>
                      {options
                        .filter((category) => category.group === group)
                        .map((category) => (
                          <option key={category.id} value={category.id}>
                            {categoryLabel(category, lang)}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </Select>
              </Field>
              <Field label={t("bsRvMarkedAs")}>
                <Select
                  value={filters.type}
                  onChange={(event) => setFilters({ ...filters, type: event.target.value })}
                >
                  <option value="">{t("bsRvAll")}</option>
                  <option value="BUSINESS">{t("appBusiness")}</option>
                  <option value="PERSONAL">{t("bsTypePersonal")}</option>
                  <option value="TRANSFER">{t("tkCoTransfer")}</option>
                  <option value="UNKNOWN">{t("bsTypeUnreviewed")}</option>
                </Select>
              </Field>
              <Field label={t("bsRuDebitCredit")}>
                <Select
                  value={filters.direction}
                  onChange={(event) => setFilters({ ...filters, direction: event.target.value })}
                >
                  <option value="">{t("bsRvAll")}</option>
                  <option value="DEBIT">{t("bkDebit")}</option>
                  <option value="CREDIT">{t("bkCredit")}</option>
                </Select>
              </Field>
              <Field label={t("bsRvFlags")}>
                <Select
                  value={filters.status}
                  onChange={(event) => setFilters({ ...filters, status: event.target.value })}
                >
                  <option value="">{t("bsRvAll")}</option>
                  <option value="needs-review">{t("bsNeedsReview")}</option>
                  <option value="duplicates">{t("bsRvPossibleDuplicates")}</option>
                  <option value="high-value">{t("bsExHighValue")}</option>
                  <option value="issues">{t("bsRvExtractionIssues")}</option>
                </Select>
              </Field>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted">
                {fill(t("bsRvShowing"), {
                  n: filtered.length.toLocaleString(intlLocaleFor(lang)),
                  total: activeTransactions.length.toLocaleString(intlLocaleFor(lang)),
                })}
              </p>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted" htmlFor="density">
                  {t("bsRvRowsInView")}
                </label>
                <select
                  id="density"
                  value={density}
                  onChange={(event) => setDensity(Number(event.target.value))}
                  className="rounded-lg border border-muted-line/40 bg-white px-2 py-1 text-xs"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <SecondaryButton className="!px-3 !py-1.5 !text-xs" onClick={() => setFilters(EMPTY_FILTERS)}>
                  {t("bsRvClearFilters")}
                </SecondaryButton>
              </div>
            </div>
          </Card>

          {selected.size > 0 ? (
            <Card className="border-indigo/30">
              <div className="flex flex-wrap items-end gap-3">
                <p className="text-sm font-semibold text-ink">
                  {fill(t("bsRvSelected"), {
                    n: selected.size.toLocaleString(intlLocaleFor(lang)),
                  })}
                </p>
                <div className="w-52">
                  <Field label={t("bsRvSetCategory")}>
                    <Select
                      value={bulkCategory}
                      onChange={(event) => setBulkCategory(event.target.value)}
                    >
                      <option value="">{t("chooseEllipsis")}</option>
                      {options.map((category) => (
                        <option key={category.id} value={category.id}>
                          {categoryLabel(category, lang)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <PrimaryButton
                  disabled={bulkCategory === ""}
                  onClick={() =>
                    bulkApply(
                      { category: bulkCategory, classificationSource: "MANUAL", confidence: 100 },
                      "categorised",
                      "Bulk categorised"
                    )
                  }
                >
                  {t("bsRvApply")}
                </PrimaryButton>
                <SecondaryButton
                  onClick={() =>
                    bulkApply(
                      { classificationType: "BUSINESS", classificationSource: "MANUAL" },
                      "business",
                      "Marked business"
                    )
                  }
                >
                  {t("bsRvMarkBusiness")}
                </SecondaryButton>
                <SecondaryButton
                  onClick={() =>
                    bulkApply(
                      { classificationType: "PERSONAL", classificationSource: "MANUAL" },
                      "personal",
                      "Marked personal"
                    )
                  }
                >
                  {t("bsRvMarkPersonal")}
                </SecondaryButton>
                <SecondaryButton
                  onClick={() =>
                    bulkApply(
                      { classificationType: "TRANSFER", isTransfer: true, classificationSource: "MANUAL" },
                      "transfer",
                      "Marked transfer"
                    )
                  }
                >
                  {t("bsRvMarkTransfer")}
                </SecondaryButton>
                <SecondaryButton
                  onClick={() => bulkApply({ duplicateOverride: "KEEP" }, "duplicateOverride", "Duplicate override")}
                >
                  {t("bsRvKeepInTotals")}
                </SecondaryButton>
                <SecondaryButton
                  onClick={() => bulkApply({ duplicateOverride: "EXCLUDE" }, "duplicateOverride", "Duplicate override")}
                >
                  {t("bsRvExcludeFromTotals")}
                </SecondaryButton>
                <SecondaryButton onClick={() => setSelected(new Set())}>{t("bsRvClearSelection")}</SecondaryButton>
              </div>
            </Card>
          ) : null}

          <TransactionTable
            transactions={filtered}
            categories={categories}
            currency={currency}
            viewportRows={density}
            selected={selected}
            onToggle={(id) =>
              setSelected((current) => {
                const next = new Set(current);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              })
            }
            onToggleAll={(ids) =>
              setSelected((current) =>
                ids.every((id) => current.has(id)) ? new Set() : new Set(ids)
              )
            }
            onEdit={(transaction, patch) => void edit(transaction, patch)}
            onCreateRule={(transaction) =>
              setEditingRule(ruleFromTransaction(transaction, generateLocalId(), new Date().toISOString()))
            }
          />

          {editingRule ? (
            <RuleEditor
              rule={editingRule}
              categories={categories}
              transactions={activeTransactions}
              onCancel={() => setEditingRule(null)}
              onSave={async (rule) => {
                await actions.saveRule(rule);
                setEditingRule(null);
                await runClassification();
              }}
            />
          ) : null}
        </>
      ) : null}

      {tab === "rules" ? (
        <div className="space-y-4">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-ink">{t("bsRvRulesTitle")}</h3>
                <p className="mt-1 text-sm text-muted">{t("bsRvRulesBlurb")}</p>
              </div>
              <PrimaryButton
                onClick={() =>
                  setEditingRule({
                    id: generateLocalId(),
                    name: "",
                    conditions: [{ field: "narration", operator: "contains", value: "", values: [] }],
                    result: {},
                    priority: 100,
                    enabled: true,
                    createdAt: new Date().toISOString(),
                  })
                }
              >
                {t("bsRuNewRule")}
              </PrimaryButton>
            </div>

            {rules.length === 0 ? (
              <p className="mt-4 rounded-xl bg-cream-paper/60 px-4 py-3 text-sm text-muted">
                {(() => {
                  const [before, after] = fill(t("bsRvNoRules"), { strong: "\u0000" }).split(
                    "\u0000"
                  );
                  return (
                    <>
                      {before}
                      <strong>{t("bsRuRule")}</strong>
                      {after}
                    </>
                  );
                })()}
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {[...rules]
                  .sort((a, b) => b.priority - a.priority)
                  .map((rule) => (
                    <li
                      key={rule.id}
                      className="flex flex-wrap items-center gap-3 rounded-xl border border-muted-line/30 px-4 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">
                          {rule.name}
                          {rule.origin === "AI_APPROVED" ? (
                            <span
                              className="ml-2 rounded-full bg-indigo/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo"
                              title={t("bsRvFromReviewTitle")}
                            >
                              {t("bsRvFromReview")}
                            </span>
                          ) : null}
                        </p>
                        <p className="truncate text-xs text-muted">
                          {rule.conditions
                            .map((condition) => describeCondition(condition, lang))
                            .join(` ${t("bsRvCondAnd")} `)}
                        </p>
                      </div>
                      <span className="text-xs text-muted">
                        {fill(t("bsRvPriorityValue"), { n: rule.priority })}
                      </span>
                      <label className="flex items-center gap-1.5 text-xs text-muted">
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          onChange={() => void actions.saveRule({ ...rule, enabled: !rule.enabled })}
                          className="h-4 w-4 rounded border-muted-line text-indigo focus:ring-indigo"
                        />
                        {t("bsRvEnabled")}
                      </label>
                      <button
                        type="button"
                        onClick={() => setEditingRule(rule)}
                        className="text-xs font-semibold text-indigo hover:underline"
                      >
                        {t("edit")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingRule(rule.id)}
                        className="text-xs font-semibold text-red-500 hover:text-red-600"
                      >
                        {t("delete")}
                      </button>
                    </li>
                  ))}
              </ul>
            )}
          </Card>

          {editingRule ? (
            <RuleEditor
              rule={editingRule}
              categories={categories}
              transactions={activeTransactions}
              onCancel={() => setEditingRule(null)}
              onSave={async (rule) => {
                await actions.saveRule(rule);
                setEditingRule(null);
                await runClassification();
              }}
            />
          ) : null}
        </div>
      ) : null}

      {tab === "categories" ? <CategoryManager /> : null}
      {tab === "activity" ? <ActivityLog /> : null}

      <ConfirmDialog
        open={deletingRule !== null}
        title={t("bsRvDeleteRuleTitle")}
        message={t("bsRvDeleteRuleBody")}
        confirmLabel={t("delete")}
        onConfirm={() => {
          if (deletingRule) actions.deleteRule(deletingRule);
          setDeletingRule(null);
        }}
        onCancel={() => setDeletingRule(null)}
      />
    </div>
  );
}
