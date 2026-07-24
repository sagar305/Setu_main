"use client";

import { useMemo } from "react";
import {
  Card,
  Field,
  NumberInput,
  SecondaryButton,
  TextInput,
} from "@/components/toolkit/ui";
import { WorkspaceBanner } from "@/components/toolkit/WorkspaceBanner";
import { useLocalStore, generateLocalId } from "@/lib/hooks/useLocalStore";
import { useFinanceWorkspace } from "@/lib/hooks/useFinanceWorkspace";
import { usePreferredCurrency } from "@/lib/hooks/usePreferredCurrency";
import { formatMoney } from "@/lib/pos/types";
import { toCsv, downloadCsv } from "@/lib/pos/csv";

type BudgetRow = { id: string; category: string; budget: number; actual: number };

type BvaState = { period: string; rows: BudgetRow[] };

const blankRow = (category = ""): BudgetRow => ({
  id: generateLocalId(),
  category,
  budget: 0,
  actual: 0,
});

const INITIAL: BvaState = {
  period: "",
  rows: [blankRow("Sales"), blankRow("Rent"), blankRow("Salaries"), blankRow("Marketing")],
};

export function BudgetVsActualTool() {
  const { code: currency } = usePreferredCurrency();
  const workspace = useFinanceWorkspace("budget-vs-actual");
  const [state, setState] = useLocalStore<BvaState>("setu-budget-vs-actual", INITIAL);
  const money = (v: number) => formatMoney(v, currency);

  const update = (id: string, patch: Partial<BudgetRow>) =>
    setState((s) => ({ ...s, rows: s.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));

  // Fill the "actual" column from recorded expenses, grouped by category,
  // matching existing rows by name and appending any new categories.
  const pullActuals = () => {
    const byCategory = new Map<string, number>();
    for (const e of workspace.expenses) {
      byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount);
    }
    setState((s) => {
      const rows = s.rows.map((r) =>
        byCategory.has(r.category) ? { ...r, actual: byCategory.get(r.category)! } : r
      );
      const existing = new Set(s.rows.map((r) => r.category.toLowerCase()));
      const added = [...byCategory.entries()]
        .filter(([cat]) => !existing.has(cat.toLowerCase()))
        .map(([cat, amount]) => ({ id: generateLocalId(), category: cat, budget: 0, actual: amount }));
      return { ...s, rows: [...rows, ...added] };
    });
  };

  const computed = useMemo(() => {
    const rows = state.rows.map((r) => {
      const variance = r.actual - r.budget;
      const pct = r.budget !== 0 ? (variance / Math.abs(r.budget)) * 100 : 0;
      return { ...r, variance, pct };
    });
    const totals = rows.reduce(
      (acc, r) => ({ budget: acc.budget + r.budget, actual: acc.actual + r.actual }),
      { budget: 0, actual: 0 }
    );
    return { rows, totals, totalVariance: totals.actual - totals.budget };
  }, [state.rows]);

  const exportCsv = () =>
    downloadCsv(
      "budget-vs-actual.csv",
      toCsv(
        ["Category", "Budget", "Actual", "Variance", "Variance %"],
        [
          ...computed.rows
            .filter((r) => r.category)
            .map((r) => [
              r.category,
              r.budget.toFixed(2),
              r.actual.toFixed(2),
              r.variance.toFixed(2),
              `${r.pct.toFixed(1)}%`,
            ]),
          [
            "TOTAL",
            computed.totals.budget.toFixed(2),
            computed.totals.actual.toFixed(2),
            computed.totalVariance.toFixed(2),
            "",
          ],
        ]
      )
    );

  return (
    <div>
      <WorkspaceBanner
        connection={workspace}
        message="Fill the actual column automatically from your recorded expenses by category."
      />

      <Card>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="w-full max-w-xs">
          <Field label="Period">
            <TextInput
              value={state.period}
              onChange={(e) => setState((s) => ({ ...s, period: e.target.value }))}
              placeholder="e.g. July 2026"
            />
          </Field>
        </div>
        <div className="flex gap-2">
          {workspace.connected ? (
            <SecondaryButton onClick={pullActuals}>↻ Pull actuals from expenses</SecondaryButton>
          ) : null}
          <SecondaryButton onClick={() => setState((s) => ({ ...s, rows: [...s.rows, blankRow()] }))}>
            + Add row
          </SecondaryButton>
          <SecondaryButton onClick={exportCsv} disabled={computed.rows.every((r) => !r.category)}>
            Export CSV
          </SecondaryButton>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="border-b-2 border-indigo/30 text-left text-xs font-semibold uppercase tracking-wide text-muted">
              <th className="py-2 pr-3">Category</th>
              <th className="py-2 pr-3 text-right">Budget</th>
              <th className="py-2 pr-3 text-right">Actual</th>
              <th className="py-2 pr-3 text-right">Variance</th>
              <th className="py-2 pr-3 text-right">Variance %</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {computed.rows.map((row) => (
              <tr key={row.id} className="border-b border-muted-line/30">
                <td className="py-2 pr-3">
                  <TextInput
                    value={row.category}
                    onChange={(e) => update(row.id, { category: e.target.value })}
                    placeholder="Category"
                  />
                </td>
                <td className="py-2 pr-3">
                  <NumberInput
                    step="0.01"
                    className="text-right"
                    value={row.budget || ""}
                    onChange={(e) => update(row.id, { budget: Number(e.target.value) || 0 })}
                  />
                </td>
                <td className="py-2 pr-3">
                  <NumberInput
                    step="0.01"
                    className="text-right"
                    value={row.actual || ""}
                    onChange={(e) => update(row.id, { actual: Number(e.target.value) || 0 })}
                  />
                </td>
                <td
                  className={`py-2 pr-3 text-right font-medium ${
                    row.variance > 0 ? "text-red-600" : row.variance < 0 ? "text-emerald-600" : "text-muted"
                  }`}
                >
                  {money(row.variance)}
                </td>
                <td
                  className={`py-2 pr-3 text-right ${
                    row.variance > 0 ? "text-red-600" : row.variance < 0 ? "text-emerald-600" : "text-muted"
                  }`}
                >
                  {row.budget !== 0 ? `${row.pct.toFixed(1)}%` : "—"}
                </td>
                <td className="py-2 text-right">
                  <button
                    type="button"
                    onClick={() =>
                      setState((s) => ({ ...s, rows: s.rows.filter((r) => r.id !== row.id) }))
                    }
                    disabled={state.rows.length === 1}
                    className="text-xs font-semibold text-red-500 hover:text-red-600 disabled:opacity-40"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-indigo/30 font-bold text-ink">
              <td className="py-2 pr-3">Total</td>
              <td className="py-2 pr-3 text-right">{money(computed.totals.budget)}</td>
              <td className="py-2 pr-3 text-right">{money(computed.totals.actual)}</td>
              <td
                className={`py-2 pr-3 text-right ${
                  computed.totalVariance > 0 ? "text-red-600" : "text-emerald-600"
                }`}
              >
                {money(computed.totalVariance)}
              </td>
              <td className="py-2 pr-3" />
              <td className="py-2" />
            </tr>
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-muted">
        For spending categories, red (actual above budget) means over-spent. For revenue rows, read
        it in reverse — actual above budget is good news. Data saves automatically in this browser.
      </p>
      </Card>
    </div>
  );
}
