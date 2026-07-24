"use client";

// Vendor Comparison — a weighted decision matrix. Criteria are fully
// user-defined (add / rename / delete, each with its own weight); vendors are
// columns scored 1–10 against every criterion. The weighted score ranks them
// live. Everything persists in localStorage; vendor names can be pulled from
// the workspace supplier book.

import { useMemo } from "react";
import { Card, NumberInput, SecondaryButton, TextInput } from "@/components/toolkit/ui";
import { WorkspaceBanner } from "@/components/toolkit/WorkspaceBanner";
import { useLocalStore, generateLocalId } from "@/lib/hooks/useLocalStore";
import { useFinanceWorkspace } from "@/lib/hooks/useFinanceWorkspace";
import { toCsv, downloadCsv } from "@/lib/pos/csv";

type Vendor = { id: string; name: string };
// scores keyed by vendorId; missing = unscored.
type Criterion = { id: string; name: string; weight: number; scores: Record<string, number> };

type VcState = { item: string; vendors: Vendor[]; criteria: Criterion[] };

const vendor = (name: string): Vendor => ({ id: generateLocalId(), name });
const criterion = (name: string, weight: number): Criterion => ({
  id: generateLocalId(),
  name,
  weight,
  scores: {},
});

function initialState(): VcState {
  const vendors = [vendor("Vendor A"), vendor("Vendor B"), vendor("Vendor C")];
  return {
    item: "",
    vendors,
    criteria: [
      criterion("Price", 30),
      criterion("Quality", 25),
      criterion("Delivery reliability", 20),
      criterion("Credit terms", 15),
      criterion("Support", 10),
    ],
  };
}

const SAMPLE_CRITERIA: [string, number][] = [
  ["Price", 20],
  ["Quality", 20],
  ["Delivery reliability", 15],
  ["Lead time", 10],
  ["Credit terms", 10],
  ["Support", 10],
  ["Warranty", 5],
  ["MOQ (min. order qty)", 5],
  ["Shipping cost", 3],
  ["Tax / GST compliance", 2],
];

export function VendorComparisonTool() {
  const workspace = useFinanceWorkspace("vendor-comparison");
  const [state, setState] = useLocalStore<VcState>("setu-vendor-comparison-v2", initialState());

  const setCriterion = (id: string, patch: Partial<Criterion>) =>
    setState((s) => ({
      ...s,
      criteria: s.criteria.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));

  const setScore = (criterionId: string, vendorId: string, value: number) =>
    setState((s) => ({
      ...s,
      criteria: s.criteria.map((c) =>
        c.id === criterionId ? { ...c, scores: { ...c.scores, [vendorId]: value } } : c
      ),
    }));

  const addVendor = () =>
    setState((s) => ({
      ...s,
      vendors: [...s.vendors, vendor(`Vendor ${String.fromCharCode(65 + s.vendors.length)}`)],
    }));

  const removeVendor = (id: string) =>
    setState((s) => ({ ...s, vendors: s.vendors.filter((v) => v.id !== id) }));

  const addCriterion = () =>
    setState((s) => ({ ...s, criteria: [...s.criteria, criterion("New criterion", 5)] }));

  const removeCriterion = (id: string) =>
    setState((s) => ({ ...s, criteria: s.criteria.filter((c) => c.id !== id) }));

  const pullSuppliers = () => {
    if (workspace.suppliers.length === 0) return;
    setState((s) => ({ ...s, vendors: workspace.suppliers.map((sup) => vendor(sup.name)) }));
  };

  const loadSample = () =>
    setState((s) => ({
      ...s,
      criteria: SAMPLE_CRITERIA.map(([name, weight]) => criterion(name, weight)),
    }));

  const reset = () => setState(initialState());

  const totalWeight = useMemo(
    () => state.criteria.reduce((sum, c) => sum + (c.weight || 0), 0),
    [state.criteria]
  );

  const ranking = useMemo(() => {
    const rows = state.vendors.map((v) => {
      let weighted = 0;
      for (const c of state.criteria) {
        const score = c.scores[v.id] || 0;
        weighted += score * (c.weight || 0);
      }
      // Normalise to a 0–100 scale: weighted average score (out of 10) × 10.
      const score = totalWeight > 0 ? (weighted / totalWeight) * 10 : 0;
      return { ...v, score };
    });
    rows.sort((a, b) => b.score - a.score);
    return { rows, bestId: rows[0]?.score > 0 ? rows[0].id : null };
  }, [state.vendors, state.criteria, totalWeight]);

  const exportCsv = () =>
    downloadCsv(
      "vendor-comparison.csv",
      toCsv(
        ["Criterion", "Weight %", ...state.vendors.map((v) => v.name)],
        [
          ...state.criteria.map((c) => [
            c.name,
            c.weight,
            ...state.vendors.map((v) => c.scores[v.id] || ""),
          ]),
          ["Weighted score /100", "", ...ranking.rows
            .slice()
            .sort((a, b) => state.vendors.findIndex((v) => v.id === a.id) - state.vendors.findIndex((v) => v.id === b.id))
            .map((v) => v.score.toFixed(1))],
        ]
      )
    );

  const scoreOf = (criterionId: string, vendorId: string) => {
    const c = state.criteria.find((x) => x.id === criterionId);
    return c?.scores[vendorId] ?? 0;
  };

  return (
    <div className="space-y-6">
      <WorkspaceBanner
        connection={workspace}
        message="Load your saved suppliers as the vendors to compare."
      />

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-ink">Vendors</h2>
          <div className="flex flex-wrap gap-2">
            {workspace.connected && workspace.suppliers.length > 0 ? (
              <SecondaryButton onClick={pullSuppliers}>↻ Load suppliers</SecondaryButton>
            ) : null}
            <SecondaryButton onClick={loadSample}>Load sample criteria</SecondaryButton>
            <SecondaryButton onClick={reset}>Reset</SecondaryButton>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {state.vendors.map((v) => (
            <div
              key={v.id}
              className="flex items-center gap-2 rounded-lg border border-muted-line/40 bg-cream-paper/50 px-3 py-1.5"
            >
              <input
                value={v.name}
                onChange={(e) =>
                  setState((s) => ({
                    ...s,
                    vendors: s.vendors.map((x) => (x.id === v.id ? { ...x, name: e.target.value } : x)),
                  }))
                }
                className="w-28 bg-transparent text-sm font-semibold text-ink outline-none"
              />
              <button
                type="button"
                onClick={() => removeVendor(v.id)}
                disabled={state.vendors.length <= 2}
                className="text-xs font-semibold text-red-500 hover:text-red-600 disabled:opacity-30"
                aria-label={`Remove ${v.name}`}
              >
                ✕
              </button>
            </div>
          ))}
          <SecondaryButton onClick={addVendor}>+ Add vendor</SecondaryButton>
        </div>
        <div className="mt-4 max-w-md">
          <TextInput
            value={state.item}
            onChange={(e) => setState((s) => ({ ...s, item: e.target.value }))}
            placeholder="What are you buying? e.g. Cooking oil 15L tins, monthly"
          />
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-ink">Criteria, weights &amp; scores (1–10 per vendor)</h2>
          <span
            className={`text-sm font-semibold ${
              Math.round(totalWeight) === 100 ? "text-emerald-600" : "text-amber-600"
            }`}
          >
            Total weight: {totalWeight}%
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b-2 border-indigo/30 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                <th className="py-2 pr-3">Criterion</th>
                <th className="py-2 pr-3 text-right">Weight %</th>
                {state.vendors.map((v) => (
                  <th key={v.id} className="py-2 pr-3 text-center">
                    {v.name}
                  </th>
                ))}
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {state.criteria.map((c) => (
                <tr key={c.id} className="border-b border-muted-line/30">
                  <td className="py-2 pr-3">
                    <TextInput
                      value={c.name}
                      onChange={(e) => setCriterion(c.id, { name: e.target.value })}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <NumberInput
                      min={0}
                      className="w-20 text-right"
                      value={c.weight || ""}
                      onChange={(e) => setCriterion(c.id, { weight: Number(e.target.value) || 0 })}
                    />
                  </td>
                  {state.vendors.map((v) => (
                    <td key={v.id} className="py-2 pr-3">
                      <NumberInput
                        min={0}
                        max={10}
                        className="w-16 text-center"
                        value={scoreOf(c.id, v.id) || ""}
                        onChange={(e) =>
                          setScore(c.id, v.id, Math.min(10, Math.max(0, Number(e.target.value) || 0)))
                        }
                      />
                    </td>
                  ))}
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      onClick={() => removeCriterion(c.id)}
                      disabled={state.criteria.length === 1}
                      className="text-xs font-semibold text-red-500 hover:text-red-600 disabled:opacity-40"
                      aria-label={`Remove ${c.name}`}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <SecondaryButton onClick={addCriterion}>+ Add criterion</SecondaryButton>
          <SecondaryButton onClick={exportCsv}>Export CSV</SecondaryButton>
        </div>
        {Math.round(totalWeight) !== 100 ? (
          <p className="mt-3 text-xs text-amber-600">
            Weights total {totalWeight}%. They don&apos;t have to sum to 100 — scores are normalised
            by the total either way — but 100 keeps them easy to read.
          </p>
        ) : null}
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-bold text-ink">Ranking</h2>
        {ranking.bestId === null ? (
          <p className="text-sm text-muted">
            Score each vendor from 1–10 on every criterion — the weighted ranking appears here.
          </p>
        ) : (
          <div className="space-y-3">
            {ranking.rows.map((v, i) => (
              <div
                key={v.id}
                className={`rounded-xl border p-4 ${
                  v.id === ranking.bestId ? "border-emerald-300 bg-emerald-50" : "border-muted-line/30"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-muted">#{i + 1}</span>
                    <p className="font-semibold text-ink">
                      {v.name}
                      {v.id === ranking.bestId ? (
                        <span className="ml-2 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                          Best value
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-ink">{v.score.toFixed(0)}</p>
                    <p className="text-xs text-muted">/ 100</p>
                  </div>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted-line/30">
                  <div
                    className={`h-full rounded-full ${v.id === ranking.bestId ? "bg-emerald-500" : "bg-indigo"}`}
                    style={{ width: `${Math.min(v.score, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
