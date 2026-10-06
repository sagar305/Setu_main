"use client";

// Vendor Comparison — a weighted decision matrix. Criteria are fully
// user-defined (add / rename / delete, each with its own weight); vendors are
// columns scored 1–10 against every criterion. The weighted score ranks them
// live. Everything persists in localStorage; vendor names can be pulled from
// the workspace supplier book.

import { useMemo, useState } from "react";
import { Card, NumberInput, SecondaryButton, TextInput } from "@/components/toolkit/ui";
import { WorkspaceBanner } from "@/components/toolkit/WorkspaceBanner";
import { useLocalStore, generateLocalId } from "@/lib/hooks/useLocalStore";
import { useFinanceWorkspace } from "@/lib/hooks/useFinanceWorkspace";
import { useI18n } from "@/lib/i18n";
import { fill, type TKey } from "@/lib/i18n/translate";
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

/** The starter criteria, each with its weight. */
const INITIAL_CRITERIA: [TKey, number][] = [
  ["vcCritPrice", 30],
  ["vcCritQuality", 25],
  ["vcCritDelivery", 20],
  ["vcCritCreditTerms", 15],
  ["vcCritSupport", 10],
];

/** A fuller set, offered behind "load sample criteria". */
const SAMPLE_CRITERIA: [TKey, number][] = [
  ["vcCritPrice", 20],
  ["vcCritQuality", 20],
  ["vcCritDelivery", 15],
  ["vcCritLeadTime", 10],
  ["vcCritCreditTerms", 10],
  ["vcCritSupport", 10],
  ["vcCritWarranty", 5],
  ["vcCritMoq", 5],
  ["vcCritShipping", 3],
  ["vcCritTaxCompliance", 2],
];

/** Vendor A, Vendor B, Vendor C — the column headings before they are renamed. */
const vendorLetter = (index: number) => String.fromCharCode(65 + index);

export function VendorComparisonTool() {
  const workspace = useFinanceWorkspace("vendor-comparison");
  const { t } = useI18n();

  // Criteria and vendor names are editable text, so both starter sets are
  // built in the reader's language: storing them in English and translating
  // them for display would leave each box showing one wording and keeping
  // another the moment it was edited.
  const initialState = (): VcState => ({
    item: "",
    vendors: [0, 1, 2].map((i) => vendor(fill(t("vcVendorName"), { letter: vendorLetter(i) }))),
    criteria: INITIAL_CRITERIA.map(([key, weight]) => criterion(t(key), weight)),
  });

  const [initial] = useState<VcState>(initialState);
  const [state, setState] = useLocalStore<VcState>("setu-vendor-comparison-v2", initial);

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
      vendors: [
        ...s.vendors,
        vendor(fill(t("vcVendorName"), { letter: vendorLetter(s.vendors.length) })),
      ],
    }));

  const removeVendor = (id: string) =>
    setState((s) => ({ ...s, vendors: s.vendors.filter((v) => v.id !== id) }));

  const addCriterion = () =>
    setState((s) => ({ ...s, criteria: [...s.criteria, criterion(t("vcNewCriterion"), 5)] }));

  const removeCriterion = (id: string) =>
    setState((s) => ({ ...s, criteria: s.criteria.filter((c) => c.id !== id) }));

  const pullSuppliers = () => {
    if (workspace.suppliers.length === 0) return;
    setState((s) => ({ ...s, vendors: workspace.suppliers.map((sup) => vendor(sup.name)) }));
  };

  const loadSample = () =>
    setState((s) => ({
      ...s,
      criteria: SAMPLE_CRITERIA.map(([key, weight]) => criterion(t(key), weight)),
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
        message={t("vcConnectHint")}
      />

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-ink">{t("vcVendors")}</h2>
          <div className="flex flex-wrap gap-2">
            {workspace.connected && workspace.suppliers.length > 0 ? (
              <SecondaryButton onClick={pullSuppliers}>↻ {t("vcLoadSuppliers")}</SecondaryButton>
            ) : null}
            <SecondaryButton onClick={loadSample}>{t("vcLoadSample")}</SecondaryButton>
            <SecondaryButton onClick={reset}>{t("resetLabel")}</SecondaryButton>
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
                aria-label={fill(t("vcRemoveAria"), { name: v.name })}
              >
                ✕
              </button>
            </div>
          ))}
          <SecondaryButton onClick={addVendor}>{t("vcAddVendor")}</SecondaryButton>
        </div>
        <div className="mt-4 max-w-md">
          <TextInput
            value={state.item}
            onChange={(e) => setState((s) => ({ ...s, item: e.target.value }))}
            placeholder={t("vcItemPlaceholder")}
          />
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-ink">{t("vcCriteriaHeading")}</h2>
          <span
            className={`text-sm font-semibold ${
              Math.round(totalWeight) === 100 ? "text-emerald-600" : "text-amber-600"
            }`}
          >
            {fill(t("vcTotalWeight"), { pct: totalWeight })}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b-2 border-indigo/30 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                <th className="py-2 pr-3">{t("vcCriterion")}</th>
                <th className="py-2 pr-3 text-right">{t("vcWeightPct")}</th>
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
                      aria-label={fill(t("vcRemoveAria"), { name: c.name })}
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
          <SecondaryButton onClick={addCriterion}>{t("vcAddCriterion")}</SecondaryButton>
          <SecondaryButton onClick={exportCsv}>{t("exportCsv")}</SecondaryButton>
        </div>
        {Math.round(totalWeight) !== 100 ? (
          <p className="mt-3 text-xs text-amber-600">
            {fill(t("vcWeightNote"), { pct: totalWeight })}
          </p>
        ) : null}
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-bold text-ink">{t("vcRanking")}</h2>
        {ranking.bestId === null ? (
          <p className="text-sm text-muted">{t("vcRankingHint")}</p>
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
                          {t("vcBestValue")}
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
