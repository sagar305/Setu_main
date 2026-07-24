"use client";

import { useMemo } from "react";
import { Card, NumberInput, SecondaryButton, TextInput } from "@/components/toolkit/ui";
import { useLocalStore, generateLocalId } from "@/lib/hooks/useLocalStore";
import { usePreferredCurrency } from "@/lib/hooks/usePreferredCurrency";
import { formatMoney } from "@/lib/pos/types";
import { toCsv, downloadCsv } from "@/lib/pos/csv";

type AbcItem = { id: string; name: string; annualQty: number; unitCost: number };

const blankItem = (name = ""): AbcItem => ({
  id: generateLocalId(),
  name,
  annualQty: 0,
  unitCost: 0,
});

const CLASS_STYLES: Record<string, string> = {
  A: "bg-red-100 text-red-600",
  B: "bg-amber-100 text-amber-700",
  C: "bg-emerald-100 text-emerald-700",
};

export function AbcAnalysisTool() {
  const { code: currency } = usePreferredCurrency();
  const [items, setItems] = useLocalStore<AbcItem[]>("setu-abc-analysis", [
    blankItem(),
    blankItem(),
    blankItem(),
  ]);
  const money = (v: number) => formatMoney(v, currency);

  const update = (id: string, patch: Partial<AbcItem>) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const analysis = useMemo(() => {
    const valued = items
      .filter((i) => i.name.trim())
      .map((i) => ({ ...i, value: (i.annualQty || 0) * (i.unitCost || 0) }))
      .sort((a, b) => b.value - a.value);
    const total = valued.reduce((acc, i) => acc + i.value, 0);
    let cumulative = 0;
    const rows = valued.map((i) => {
      cumulative += i.value;
      const cumPct = total > 0 ? (cumulative / total) * 100 : 0;
      // Standard cut-offs: A ≈ top 80% of value, B next 15%, C last 5%.
      const cls = cumPct <= 80 ? "A" : cumPct <= 95 ? "B" : "C";
      return { ...i, sharePct: total > 0 ? (i.value / total) * 100 : 0, cumPct, cls };
    });
    const counts = { A: 0, B: 0, C: 0 } as Record<string, number>;
    const values = { A: 0, B: 0, C: 0 } as Record<string, number>;
    for (const r of rows) {
      counts[r.cls]++;
      values[r.cls] += r.value;
    }
    return { rows, total, counts, values };
  }, [items]);

  const exportCsv = () =>
    downloadCsv(
      "abc-analysis.csv",
      toCsv(
        ["Item", "Annual Qty", "Unit Cost", "Annual Value", "Share %", "Cumulative %", "Class"],
        analysis.rows.map((r) => [
          r.name,
          r.annualQty,
          r.unitCost.toFixed(2),
          r.value.toFixed(2),
          `${r.sharePct.toFixed(1)}%`,
          `${r.cumPct.toFixed(1)}%`,
          r.cls,
        ])
      )
    );

  return (
    <div className="space-y-6">
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-ink">Inventory items</h2>
          <div className="flex gap-2">
            <SecondaryButton onClick={() => setItems((prev) => [...prev, blankItem()])}>
              + Add item
            </SecondaryButton>
            <SecondaryButton onClick={exportCsv} disabled={analysis.rows.length === 0}>
              Export CSV
            </SecondaryButton>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b-2 border-indigo/30 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                <th className="py-2 pr-3">Item name</th>
                <th className="py-2 pr-3 text-right">Annual quantity</th>
                <th className="py-2 pr-3 text-right">Unit cost</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-muted-line/30">
                  <td className="py-2 pr-3">
                    <TextInput
                      value={item.name}
                      onChange={(e) => update(item.id, { name: e.target.value })}
                      placeholder="e.g. Basmati rice 25kg"
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <NumberInput
                      min={0}
                      className="text-right"
                      value={item.annualQty || ""}
                      onChange={(e) => update(item.id, { annualQty: Number(e.target.value) || 0 })}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <NumberInput
                      min={0}
                      step="0.01"
                      className="text-right"
                      value={item.unitCost || ""}
                      onChange={(e) => update(item.id, { unitCost: Number(e.target.value) || 0 })}
                    />
                  </td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      onClick={() => setItems((prev) => prev.filter((i) => i.id !== item.id))}
                      disabled={items.length === 1}
                      className="text-xs font-semibold text-red-500 hover:text-red-600 disabled:opacity-40"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-bold text-ink">ABC classification</h2>

        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          {(["A", "B", "C"] as const).map((cls) => (
            <div key={cls} className="rounded-xl bg-cream-paper/70 p-4">
              <div className="flex items-center justify-between">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${CLASS_STYLES[cls]}`}>
                  Class {cls}
                </span>
                <span className="text-xs text-muted">{analysis.counts[cls]} items</span>
              </div>
              <p className="mt-2 text-lg font-bold text-ink">{money(analysis.values[cls])}</p>
              <p className="text-xs text-muted">
                {cls === "A"
                  ? "Top ~80% of value — control tightly, count often"
                  : cls === "B"
                    ? "Next ~15% — moderate controls"
                    : "Last ~5% — simple controls, bulk ordering"}
              </p>
            </div>
          ))}
        </div>

        {analysis.rows.length === 0 ? (
          <p className="text-sm text-muted">
            Add items with their annual usage and unit cost — they&apos;ll be ranked by annual
            consumption value and classified A, B or C.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b-2 border-indigo/30 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                  <th className="py-2 pr-3">#</th>
                  <th className="py-2 pr-3">Item</th>
                  <th className="py-2 pr-3 text-right">Annual value</th>
                  <th className="py-2 pr-3 text-right">Share</th>
                  <th className="py-2 pr-3 text-right">Cumulative</th>
                  <th className="py-2 text-right">Class</th>
                </tr>
              </thead>
              <tbody>
                {analysis.rows.map((row, i) => (
                  <tr key={row.id} className="border-b border-muted-line/30">
                    <td className="py-2 pr-3 text-muted">{i + 1}</td>
                    <td className="py-2 pr-3 font-medium text-ink">{row.name}</td>
                    <td className="py-2 pr-3 text-right">{money(row.value)}</td>
                    <td className="py-2 pr-3 text-right">{row.sharePct.toFixed(1)}%</td>
                    <td className="py-2 pr-3 text-right">{row.cumPct.toFixed(1)}%</td>
                    <td className="py-2 text-right">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${CLASS_STYLES[row.cls]}`}>
                        {row.cls}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
