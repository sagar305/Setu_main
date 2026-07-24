"use client";

import { useMemo } from "react";
import { Card, Field, NumberInput, SecondaryButton, TextInput } from "@/components/toolkit/ui";
import { useLocalStore, generateLocalId } from "@/lib/hooks/useLocalStore";
import { usePreferredCurrency } from "@/lib/hooks/usePreferredCurrency";
import { formatMoney } from "@/lib/pos/types";
import { toCsv, downloadCsv } from "@/lib/pos/csv";

type Vendor = {
  id: string;
  name: string;
  price: number; // total quoted price — lower is better
  deliveryDays: number; // lower is better
  creditDays: number; // higher is better
  quality: number; // 1–5 rating — higher is better
};

type Weights = { price: number; delivery: number; credit: number; quality: number };

type VcState = { item: string; vendors: Vendor[]; weights: Weights };

const blankVendor = (): Vendor => ({
  id: generateLocalId(),
  name: "",
  price: 0,
  deliveryDays: 0,
  creditDays: 0,
  quality: 3,
});

const INITIAL: VcState = {
  item: "",
  vendors: [blankVendor(), blankVendor()],
  weights: { price: 40, delivery: 20, credit: 15, quality: 25 },
};

export function VendorComparisonTool() {
  const { code: currency } = usePreferredCurrency();
  const [state, setState] = useLocalStore<VcState>("setu-vendor-comparison", INITIAL);
  const money = (v: number) => formatMoney(v, currency);

  const update = (id: string, patch: Partial<Vendor>) =>
    setState((s) => ({
      ...s,
      vendors: s.vendors.map((v) => (v.id === id ? { ...v, ...patch } : v)),
    }));

  const setWeight = (key: keyof Weights, value: number) =>
    setState((s) => ({ ...s, weights: { ...s.weights, [key]: value } }));

  const scored = useMemo(() => {
    const active = state.vendors.filter((v) => v.name.trim());
    if (active.length === 0) return { rows: [], bestId: null as string | null };

    // Normalize each criterion to 0–1 across vendors (best = 1), then weight.
    const prices = active.map((v) => v.price).filter((p) => p > 0);
    const minPrice = prices.length ? Math.min(...prices) : 0;
    const deliveries = active.map((v) => v.deliveryDays).filter((d) => d > 0);
    const minDelivery = deliveries.length ? Math.min(...deliveries) : 0;
    const maxCredit = Math.max(...active.map((v) => v.creditDays), 0);

    const w = state.weights;
    const totalWeight = w.price + w.delivery + w.credit + w.quality || 1;

    const rows = active
      .map((v) => {
        const priceScore = v.price > 0 && minPrice > 0 ? minPrice / v.price : 0;
        const deliveryScore =
          v.deliveryDays > 0 && minDelivery > 0 ? minDelivery / v.deliveryDays : 0;
        const creditScore = maxCredit > 0 ? v.creditDays / maxCredit : 0;
        const qualityScore = Math.min(Math.max(v.quality, 0), 5) / 5;
        const score =
          ((priceScore * w.price +
            deliveryScore * w.delivery +
            creditScore * w.credit +
            qualityScore * w.quality) /
            totalWeight) *
          100;
        return { ...v, score };
      })
      .sort((a, b) => b.score - a.score);

    return { rows, bestId: rows[0]?.id ?? null };
  }, [state.vendors, state.weights]);

  const exportCsv = () =>
    downloadCsv(
      "vendor-comparison.csv",
      toCsv(
        ["Vendor", "Price", "Delivery (days)", "Credit (days)", "Quality (1-5)", "Score /100"],
        scored.rows.map((v) => [
          v.name,
          v.price.toFixed(2),
          v.deliveryDays,
          v.creditDays,
          v.quality,
          v.score.toFixed(1),
        ])
      )
    );

  return (
    <div className="space-y-6">
      <Card>
        <div className="mb-4 grid gap-4 sm:grid-cols-2">
          <Field label="What are you buying?">
            <TextInput
              value={state.item}
              onChange={(e) => setState((s) => ({ ...s, item: e.target.value }))}
              placeholder="e.g. Cooking oil 15L tins, monthly supply"
            />
          </Field>
        </div>

        <h3 className="mb-2 text-sm font-bold text-ink">Criteria weights (importance out of 100)</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Price">
            <NumberInput
              min={0}
              max={100}
              value={state.weights.price}
              onChange={(e) => setWeight("price", Number(e.target.value) || 0)}
            />
          </Field>
          <Field label="Delivery speed">
            <NumberInput
              min={0}
              max={100}
              value={state.weights.delivery}
              onChange={(e) => setWeight("delivery", Number(e.target.value) || 0)}
            />
          </Field>
          <Field label="Credit terms">
            <NumberInput
              min={0}
              max={100}
              value={state.weights.credit}
              onChange={(e) => setWeight("credit", Number(e.target.value) || 0)}
            />
          </Field>
          <Field label="Quality">
            <NumberInput
              min={0}
              max={100}
              value={state.weights.quality}
              onChange={(e) => setWeight("quality", Number(e.target.value) || 0)}
            />
          </Field>
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-ink">Vendors</h2>
          <div className="flex gap-2">
            <SecondaryButton
              onClick={() => setState((s) => ({ ...s, vendors: [...s.vendors, blankVendor()] }))}
            >
              + Add vendor
            </SecondaryButton>
            <SecondaryButton onClick={exportCsv} disabled={scored.rows.length === 0}>
              Export CSV
            </SecondaryButton>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b-2 border-indigo/30 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                <th className="py-2 pr-3">Vendor</th>
                <th className="py-2 pr-3 text-right">Quoted price</th>
                <th className="py-2 pr-3 text-right">Delivery days</th>
                <th className="py-2 pr-3 text-right">Credit days</th>
                <th className="py-2 pr-3 text-right">Quality (1–5)</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {state.vendors.map((v) => (
                <tr key={v.id} className="border-b border-muted-line/30">
                  <td className="py-2 pr-3">
                    <TextInput
                      value={v.name}
                      onChange={(e) => update(v.id, { name: e.target.value })}
                      placeholder="Vendor name"
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <NumberInput
                      min={0}
                      step="0.01"
                      className="text-right"
                      value={v.price || ""}
                      onChange={(e) => update(v.id, { price: Number(e.target.value) || 0 })}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <NumberInput
                      min={0}
                      className="text-right"
                      value={v.deliveryDays || ""}
                      onChange={(e) => update(v.id, { deliveryDays: Number(e.target.value) || 0 })}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <NumberInput
                      min={0}
                      className="text-right"
                      value={v.creditDays || ""}
                      onChange={(e) => update(v.id, { creditDays: Number(e.target.value) || 0 })}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <NumberInput
                      min={1}
                      max={5}
                      className="text-right"
                      value={v.quality || ""}
                      onChange={(e) => update(v.id, { quality: Number(e.target.value) || 0 })}
                    />
                  </td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      onClick={() =>
                        setState((s) => ({ ...s, vendors: s.vendors.filter((x) => x.id !== v.id) }))
                      }
                      disabled={state.vendors.length <= 2}
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
        <h2 className="mb-4 text-lg font-bold text-ink">Ranking</h2>
        {scored.rows.length === 0 ? (
          <p className="text-sm text-muted">
            Name at least one vendor and fill in their numbers — the weighted score ranks them
            instantly.
          </p>
        ) : (
          <div className="space-y-3">
            {scored.rows.map((v, i) => (
              <div
                key={v.id}
                className={`rounded-xl border p-4 ${
                  v.id === scored.bestId
                    ? "border-emerald-300 bg-emerald-50"
                    : "border-muted-line/30"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-muted">#{i + 1}</span>
                    <div>
                      <p className="font-semibold text-ink">
                        {v.name}
                        {v.id === scored.bestId ? (
                          <span className="ml-2 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                            Best value
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs text-muted">
                        {v.price ? `${money(v.price)} · ` : ""}
                        {v.deliveryDays ? `${v.deliveryDays}d delivery · ` : ""}
                        {v.creditDays ? `${v.creditDays}d credit · ` : ""}quality {v.quality}/5
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-ink">{v.score.toFixed(0)}</p>
                    <p className="text-xs text-muted">/ 100</p>
                  </div>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted-line/30">
                  <div
                    className={`h-full rounded-full ${v.id === scored.bestId ? "bg-emerald-500" : "bg-indigo"}`}
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
