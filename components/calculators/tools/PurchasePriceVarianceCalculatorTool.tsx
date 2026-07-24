"use client";

import { useMemo, useState } from "react";
import { ResultStat } from "@/components/calculators/ResultStat";
import { formatCurrency, formatNumber } from "@/lib/format";
import { usePreferredCurrency } from "@/lib/hooks/usePreferredCurrency";

type PpvItem = { id: number; name: string; standard: string; actual: string; qty: string };

let nextId = 4;

const INITIAL: PpvItem[] = [
  { id: 1, name: "Raw material A", standard: "100", actual: "110", qty: "500" },
  { id: 2, name: "", standard: "", actual: "", qty: "" },
  { id: 3, name: "", standard: "", actual: "", qty: "" },
];

const num = (v: string) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

export function PurchasePriceVarianceCalculatorTool() {
  usePreferredCurrency(); // re-render when the business currency changes
  const [items, setItems] = useState<PpvItem[]>(INITIAL);

  const update = (id: number, patch: Partial<PpvItem>) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const computed = useMemo(() => {
    const rows = items
      .map((i) => {
        const perUnit = num(i.actual) - num(i.standard);
        const impact = perUnit * num(i.qty);
        const pct = num(i.standard) > 0 ? (perUnit / num(i.standard)) * 100 : 0;
        return { ...i, perUnit, impact, pct, active: i.name.trim().length > 0 && num(i.qty) > 0 };
      })
      .filter((r) => r.active || items.length <= 1);
    const activeRows = rows.filter((r) => r.active);
    const total = activeRows.reduce((s, r) => s + r.impact, 0);
    const worst = activeRows.reduce(
      (acc: (typeof activeRows)[number] | null, r) => (r.impact > (acc?.impact ?? 0) ? r : acc),
      null
    );
    const best = activeRows.reduce(
      (acc: (typeof activeRows)[number] | null, r) => (r.impact < (acc?.impact ?? 0) ? r : acc),
      null
    );
    return { activeRows, total, worst, best };
  }, [items]);

  const inputClass =
    "w-full rounded-lg border border-muted-line/40 bg-white px-2 py-2 text-sm text-ink outline-none focus:border-indigo";

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b-2 border-indigo/30 text-left text-xs font-semibold uppercase tracking-wide text-muted">
              <th className="py-2 pr-2">Item</th>
              <th className="py-2 pr-2 text-right">Standard cost</th>
              <th className="py-2 pr-2 text-right">Actual cost</th>
              <th className="py-2 pr-2 text-right">Qty</th>
              <th className="py-2 pr-2 text-right">Variance impact</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const perUnit = num(item.actual) - num(item.standard);
              const impact = perUnit * num(item.qty);
              const active = item.name.trim().length > 0 && num(item.qty) > 0;
              return (
                <tr key={item.id} className="border-b border-muted-line/30">
                  <td className="py-2 pr-2">
                    <input
                      value={item.name}
                      onChange={(e) => update(item.id, { name: e.target.value })}
                      placeholder="e.g. Steel sheet"
                      className={inputClass}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      inputMode="decimal"
                      value={item.standard}
                      onChange={(e) => update(item.id, { standard: e.target.value })}
                      className={`${inputClass} w-24 text-right`}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      inputMode="decimal"
                      value={item.actual}
                      onChange={(e) => update(item.id, { actual: e.target.value })}
                      className={`${inputClass} w-24 text-right`}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      inputMode="decimal"
                      value={item.qty}
                      onChange={(e) => update(item.id, { qty: e.target.value })}
                      className={`${inputClass} w-20 text-right`}
                    />
                  </td>
                  <td
                    className={`py-2 pr-2 text-right font-semibold ${
                      !active ? "text-muted" : impact > 0 ? "text-red-600" : impact < 0 ? "text-emerald-600" : "text-muted"
                    }`}
                  >
                    {active ? formatCurrency(impact) : "—"}
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
              );
            })}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={() =>
          setItems((prev) => [...prev, { id: nextId++, name: "", standard: "", actual: "", qty: "" }])
        }
        className="mt-3 rounded-lg border border-indigo/30 px-4 py-2 text-sm font-semibold text-indigo transition hover:bg-indigo/5"
      >
        + Add item
      </button>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <ResultStat
          label={computed.total > 0 ? "Total variance (unfavourable)" : "Total variance"}
          value={formatCurrency(computed.total)}
          emphasis
        />
        <ResultStat
          label="Items compared"
          value={String(computed.activeRows.length)}
        />
      </div>

      {computed.worst && computed.worst.impact > 0 ? (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          Biggest overrun: <span className="font-semibold">{computed.worst.name}</span> —{" "}
          {formatCurrency(computed.worst.impact)} above plan ({formatNumber(computed.worst.pct, 1)}%
          per unit). Investigate this one first.
        </p>
      ) : null}
      {computed.best && computed.best.impact < 0 ? (
        <p className="mt-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Biggest saving: <span className="font-semibold">{computed.best.name}</span> —{" "}
          {formatCurrency(Math.abs(computed.best.impact))} below plan. Worth understanding why, so
          you can repeat it.
        </p>
      ) : null}

      <p className="mt-4 text-sm text-muted">
        PPV = (actual price − standard price) × quantity, per item. Red rows cost more than planned
        (unfavourable); green rows beat the plan. Standard price is your budgeted or negotiated
        rate.
      </p>
    </div>
  );
}
