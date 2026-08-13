"use client";

// Step 2 — Review.
// The screen a CA actually spends their time on: filter, bulk-categorise,
// create rules from real transactions, override duplicates, undo, and see at a
// glance what still needs attention.

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { Card, ConfirmDialog, Field, PrimaryButton, SecondaryButton, Select, TextInput } from "@/components/toolkit/ui";
import { useAnalyzer } from "@/components/tools/BankStatementAnalyzer/AnalyzerProvider";
import { TransactionTable } from "@/components/tools/BankStatementAnalyzer/TransactionTable";
import { RuleEditor } from "@/components/tools/BankStatementAnalyzer/RuleEditor";
import { CategoryManager } from "@/components/tools/BankStatementAnalyzer/CategoryManager";
import { ActivityLog } from "@/components/tools/BankStatementAnalyzer/ActivityLog";
import { ProgressPanel } from "@/components/tools/BankStatementAnalyzer/ProgressPanel";
import type { ClassificationRule, Transaction } from "@/lib/bankStatement/types";
import { ruleFromTransaction } from "@/lib/bankStatement/classification/rulesEngine";
import { activeCategories, GROUP_LABELS } from "@/lib/bankStatement/classification/categories";
import { usePreferredCurrency } from "@/lib/hooks/usePreferredCurrency";
import { generateLocalId } from "@/lib/hooks/useLocalStore";
import { normaliseText } from "@/lib/bankStatement/utils/text";

type Tab = "transactions" | "rules" | "categories" | "activity";

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
      if (filters.status === "needs-review") {
        const needsReview =
          !transaction.category || (transaction.confidence ?? 0) < settings.reviewConfidenceThreshold;
        if (!needsReview) return false;
      }
      if (filters.status === "issues" && (transaction.rowStatus ?? "VALID") === "VALID") return false;
      if (filters.status === "high-value" && !transaction.isHighValue) return false;
      return true;
    });
  }, [activeTransactions, filters, settings.reviewConfidenceThreshold]);

  const needsReview = useMemo(
    () =>
      activeTransactions.filter(
        (transaction) =>
          !transaction.category || (transaction.confidence ?? 0) < settings.reviewConfidenceThreshold
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
      actions.log("Transaction edited", Object.keys(patch).join(", "));
    },
    [actions, pushUndo]
  );

  const bulkApply = useCallback(
    async (patch: Partial<Transaction>, label: string) => {
      const ids = [...selected];
      if (ids.length === 0) return;
      pushUndo(ids);
      await actions.updateTransactions((current) => ({ ...current, ...patch }), ids);
      actions.log(label, `${ids.length} transactions`);
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
    actions.log("Change undone", `${snapshot.length} transactions`);
  }, [actions, undoStack]);

  const runClassification = useCallback(async () => {
    setReclassifying({ current: 0, total: activeTransactions.length });
    await actions.reclassifyAll((current, total) => setReclassifying({ current, total }));
    setReclassifying(null);
    actions.log("Transactions classified");
  }, [actions, activeTransactions.length]);

  if (loaded && statements.length === 0) {
    return (
      <Card>
        <h2 className="text-xl font-bold text-ink">Nothing to review yet</h2>
        <p className="mt-2 text-sm text-muted">
          Import a statement — or load the demo — and it will appear here.
        </p>
        <Link
          href="/tools/bank-statement-analyzer/import"
          className="mt-4 inline-block rounded-lg bg-indigo px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo/90"
        >
          Go to import
        </Link>
      </Card>
    );
  }

  const options = activeCategories(categories);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-ink">Review transactions</h2>
        <div className="flex flex-wrap gap-2">
          <SecondaryButton onClick={runClassification} disabled={reclassifying !== null}>
            {reclassifying ? "Classifying…" : "Run classification"}
          </SecondaryButton>
          <SecondaryButton onClick={undo} disabled={undoStack.length === 0}>
            Undo
          </SecondaryButton>
          <Link
            href="/tools/bank-statement-analyzer/analyze"
            className="rounded-lg bg-indigo px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo/90"
          >
            Analyze
          </Link>
        </div>
      </div>

      {reclassifying ? (
        <ProgressPanel
          progress={{
            label: "Classifying transactions",
            current: reclassifying.current,
            total: reclassifying.total,
          }}
        />
      ) : null}

      {needsReview > 0 ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>{needsReview.toLocaleString("en-IN")}</strong> transaction
          {needsReview === 1 ? "" : "s"} are uncategorised or below {settings.reviewConfidenceThreshold}%
          confidence.{" "}
          <button
            type="button"
            className="font-semibold underline"
            onClick={() => setFilters({ ...EMPTY_FILTERS, status: "needs-review" })}
          >
            Show them
          </button>
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 border-b border-muted-line/30">
        {(
          [
            ["transactions", `Transactions (${activeTransactions.length.toLocaleString("en-IN")})`],
            ["rules", `Rules (${rules.length})`],
            ["categories", "Categories"],
            ["activity", "Activity"],
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
          <Card>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Field label="Search">
                <TextInput
                  value={filters.search}
                  onChange={(event) => setFilters({ ...filters, search: event.target.value })}
                  placeholder="Narration or party"
                />
              </Field>
              <Field label="Category">
                <Select
                  value={filters.category}
                  onChange={(event) => setFilters({ ...filters, category: event.target.value })}
                >
                  <option value="">All</option>
                  <option value="__none__">Uncategorised</option>
                  {(["INCOME", "EXPENSE", "TRANSFER", "CASH"] as const).map((group) => (
                    <optgroup key={group} label={GROUP_LABELS[group]}>
                      {options
                        .filter((category) => category.group === group)
                        .map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </Select>
              </Field>
              <Field label="Marked as">
                <Select
                  value={filters.type}
                  onChange={(event) => setFilters({ ...filters, type: event.target.value })}
                >
                  <option value="">All</option>
                  <option value="BUSINESS">Business</option>
                  <option value="PERSONAL">Personal</option>
                  <option value="TRANSFER">Transfer</option>
                  <option value="UNKNOWN">Unreviewed</option>
                </Select>
              </Field>
              <Field label="Direction">
                <Select
                  value={filters.direction}
                  onChange={(event) => setFilters({ ...filters, direction: event.target.value })}
                >
                  <option value="">All</option>
                  <option value="DEBIT">Debit</option>
                  <option value="CREDIT">Credit</option>
                </Select>
              </Field>
              <Field label="Flags">
                <Select
                  value={filters.status}
                  onChange={(event) => setFilters({ ...filters, status: event.target.value })}
                >
                  <option value="">All</option>
                  <option value="needs-review">Needs review</option>
                  <option value="duplicates">Possible duplicates</option>
                  <option value="high-value">High value</option>
                  <option value="issues">Extraction issues</option>
                </Select>
              </Field>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted">
                Showing {filtered.length.toLocaleString("en-IN")} of{" "}
                {activeTransactions.length.toLocaleString("en-IN")}
              </p>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted" htmlFor="density">
                  Rows in view
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
                  Clear filters
                </SecondaryButton>
              </div>
            </div>
          </Card>

          {selected.size > 0 ? (
            <Card className="border-indigo/30">
              <div className="flex flex-wrap items-end gap-3">
                <p className="text-sm font-semibold text-ink">
                  {selected.size} selected
                </p>
                <div className="w-52">
                  <Field label="Set category">
                    <Select
                      value={bulkCategory}
                      onChange={(event) => setBulkCategory(event.target.value)}
                    >
                      <option value="">Choose…</option>
                      {options.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
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
                      "Bulk categorised"
                    )
                  }
                >
                  Apply
                </PrimaryButton>
                <SecondaryButton
                  onClick={() =>
                    bulkApply(
                      { classificationType: "BUSINESS", classificationSource: "MANUAL" },
                      "Marked business"
                    )
                  }
                >
                  Mark business
                </SecondaryButton>
                <SecondaryButton
                  onClick={() =>
                    bulkApply(
                      { classificationType: "PERSONAL", classificationSource: "MANUAL" },
                      "Marked personal"
                    )
                  }
                >
                  Mark personal
                </SecondaryButton>
                <SecondaryButton
                  onClick={() =>
                    bulkApply(
                      { classificationType: "TRANSFER", isTransfer: true, classificationSource: "MANUAL" },
                      "Marked transfer"
                    )
                  }
                >
                  Mark transfer
                </SecondaryButton>
                <SecondaryButton
                  onClick={() => bulkApply({ duplicateOverride: "KEEP" }, "Duplicate override")}
                >
                  Keep in totals
                </SecondaryButton>
                <SecondaryButton
                  onClick={() => bulkApply({ duplicateOverride: "EXCLUDE" }, "Duplicate override")}
                >
                  Exclude from totals
                </SecondaryButton>
                <SecondaryButton onClick={() => setSelected(new Set())}>Clear selection</SecondaryButton>
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
                <h3 className="text-lg font-bold text-ink">Classification rules</h3>
                <p className="mt-1 text-sm text-muted">
                  Rules run before pattern matching and always win. They are stored on this device.
                </p>
              </div>
              <PrimaryButton
                onClick={() =>
                  setEditingRule({
                    id: generateLocalId(),
                    name: "",
                    conditions: [{ field: "narration", operator: "contains", value: "" }],
                    result: {},
                    priority: 100,
                    enabled: true,
                    createdAt: new Date().toISOString(),
                  })
                }
              >
                New rule
              </PrimaryButton>
            </div>

            {rules.length === 0 ? (
              <p className="mt-4 rounded-xl bg-cream-paper/60 px-4 py-3 text-sm text-muted">
                No rules yet. Open any transaction&apos;s <strong>Rule</strong> link to build one from a
                narration you have already seen.
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
                        <p className="truncate text-sm font-semibold text-ink">{rule.name}</p>
                        <p className="truncate text-xs text-muted">
                          {rule.conditions
                            .map((condition) => `${condition.field} ${condition.operator} "${condition.value}"`)
                            .join(" and ")}
                        </p>
                      </div>
                      <span className="text-xs text-muted">Priority {rule.priority}</span>
                      <label className="flex items-center gap-1.5 text-xs text-muted">
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          onChange={() => void actions.saveRule({ ...rule, enabled: !rule.enabled })}
                          className="h-4 w-4 rounded border-muted-line text-indigo focus:ring-indigo"
                        />
                        Enabled
                      </label>
                      <button
                        type="button"
                        onClick={() => setEditingRule(rule)}
                        className="text-xs font-semibold text-indigo hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingRule(rule.id)}
                        className="text-xs font-semibold text-red-500 hover:text-red-600"
                      >
                        Delete
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
        title="Delete this rule?"
        message="Transactions it classified keep their category until you run classification again."
        confirmLabel="Delete"
        onConfirm={() => {
          if (deletingRule) actions.deleteRule(deletingRule);
          setDeletingRule(null);
        }}
        onCancel={() => setDeletingRule(null)}
      />
    </div>
  );
}
