"use client";

import { useMemo } from "react";
import { Card, NumberInput, PrimaryButton, SecondaryButton, TextInput } from "@/components/toolkit/ui";
import { WorkspaceBanner } from "@/components/toolkit/WorkspaceBanner";
import { useLocalStore, generateLocalId } from "@/lib/hooks/useLocalStore";
import { useFinanceWorkspace } from "@/lib/hooks/useFinanceWorkspace";
import { usePreferredCurrency } from "@/lib/hooks/usePreferredCurrency";
import { formatMoney } from "@/lib/pos/types";
import { toCsv, downloadCsv } from "@/lib/pos/csv";

type AbcItem = { id: string; name: string; annualQty: number; unitCost: number };
type AbcState = { companyName: string; items: AbcItem[] };

type AbcClass = "A" | "B" | "C";

const blankItem = (name = ""): AbcItem => ({
  id: generateLocalId(),
  name,
  annualQty: 0,
  unitCost: 0,
});

// Sequential indigo ramp for the ordinal classes (A most valuable → C least).
// One hue, dark→light — distinguishable by lightness alone, so colourblind-safe.
const CLASS_COLOR: Record<AbcClass, string> = {
  A: "#26306B",
  B: "#6B74A5",
  C: "#AEB4CE",
};
const CLASS_CHIP: Record<AbcClass, string> = {
  A: "bg-indigo/10 text-indigo",
  B: "bg-indigo/5 text-indigo/80",
  C: "bg-cream text-muted",
};
const BAR_COLOR = "#26306B";
const LINE_COLOR = "#F2A03D"; // saffron — distinct hue + line shape + legend

const CLASS_CONTROL: Record<AbcClass, string> = {
  A: "Tight control: review weekly, keep precise stock records, use accurate demand forecasting, and negotiate the best supplier terms — these items drive most of your inventory value.",
  B: "Moderate control: review monthly, use standard reorder points, and apply normal (not intensive) forecasting effort.",
  C: "Loose control: review quarterly or less, order in bulk to reduce administrative overhead, and consider simplified or even automated reordering.",
};
const CLASS_RESTOCK: Record<AbcClass, string> = {
  A: "Highest — reorder promptly and avoid stockouts; consider safety stock and frequent small orders.",
  B: "Medium — standard reorder points; review monthly.",
  C: "Low — bulk order infrequently; simple min/max is enough.",
};

const SAMPLE: AbcItem[] = [
  { name: "Industrial Bearing Assembly", annualQty: 1200, unitCost: 45 },
  { name: "Steel Frame Component", annualQty: 800, unitCost: 60 },
  { name: "Hydraulic Pump Unit", annualQty: 150, unitCost: 220 },
  { name: "Control Circuit Board", annualQty: 900, unitCost: 18 },
  { name: "Rubber Gasket Set", annualQty: 5000, unitCost: 2 },
  { name: "Motor Housing", annualQty: 300, unitCost: 35 },
  { name: "Fastener Kit (Mixed)", annualQty: 8000, unitCost: 0.8 },
  { name: "Sensor Module", annualQty: 600, unitCost: 22 },
  { name: "Packaging Box (Standard)", annualQty: 12000, unitCost: 0.5 },
  { name: "Lubricant (Industrial, 5L)", annualQty: 400, unitCost: 15 },
  { name: "Wiring Harness", annualQty: 700, unitCost: 12 },
  { name: "Cable Ties (Bulk Pack)", annualQty: 20000, unitCost: 0.1 },
].map((s) => ({ id: generateLocalId(), ...s }));

export function AbcAnalysisTool() {
  const { code: currency } = usePreferredCurrency();
  const workspace = useFinanceWorkspace("abc-analysis");
  const [state, setState] = useLocalStore<AbcState>("setu-abc-analysis-v2", {
    companyName: "",
    items: [blankItem(), blankItem(), blankItem()],
  });
  const money = (v: number) => formatMoney(v, currency);
  const items = state.items;

  const update = (id: string, patch: Partial<AbcItem>) =>
    setState((s) => ({ ...s, items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
  const setItems = (next: AbcItem[]) => setState((s) => ({ ...s, items: next }));

  const pullProducts = () => {
    const pulled: AbcItem[] = workspace.products.map((p) => ({
      id: generateLocalId(),
      name: p.name,
      annualQty: 0,
      unitCost: p.costPrice ?? p.sellingPrice ?? 0,
    }));
    if (pulled.length > 0) setItems(pulled);
  };

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
      const cls: AbcClass = cumPct <= 80 ? "A" : cumPct <= 95 ? "B" : "C";
      return { ...i, sharePct: total > 0 ? (i.value / total) * 100 : 0, cumPct, cls };
    });
    const counts = { A: 0, B: 0, C: 0 } as Record<AbcClass, number>;
    const values = { A: 0, B: 0, C: 0 } as Record<AbcClass, number>;
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
        ["Rank", "Item", "Annual Qty", "Unit Cost", "Usage Value", "% of Total", "Cumulative %", "Class", "Restock Priority"],
        analysis.rows.map((r, i) => [
          i + 1,
          r.name,
          r.annualQty,
          r.unitCost.toFixed(2),
          r.value.toFixed(2),
          `${r.sharePct.toFixed(1)}%`,
          `${r.cumPct.toFixed(1)}%`,
          r.cls,
          CLASS_RESTOCK[r.cls],
        ])
      )
    );

  const exportPdf = () => {
    const esc = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const classRows = (["A", "B", "C"] as const)
      .map((c) => {
        const pct = analysis.total > 0 ? (analysis.values[c] / analysis.total) * 100 : 0;
        return `<tr><td>Class ${c}</td><td class="r">${analysis.counts[c]}</td><td class="r">${money(analysis.values[c])}</td><td class="r">${pct.toFixed(1)}%</td></tr>`;
      })
      .join("");
    const itemRows = analysis.rows
      .map(
        (r, i) =>
          `<tr><td class="r">${i + 1}</td><td>${esc(r.name)}</td><td class="r">${money(r.value)}</td><td class="r">${r.sharePct.toFixed(1)}%</td><td class="r">${r.cumPct.toFixed(1)}%</td><td class="c">${r.cls}</td></tr>`
      )
      .join("");
    const html = `<!doctype html><html><head><title>ABC Analysis</title><style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:Georgia,"Times New Roman",serif;color:#1a1a2e;padding:40px 48px}
      h1{font-size:20px;color:#26306B}h2{font-size:13px;text-transform:uppercase;letter-spacing:1.5px;color:#8a8a9a;margin:24px 0 8px}
      .biz{font-size:13px;color:#55556a;margin-bottom:4px}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#8a8a9a;border-bottom:2px solid #26306B;padding:6px 6px}
      td{padding:5px 6px;border-bottom:1px solid #ececf2}
      .r{text-align:right}.c{text-align:center;font-weight:bold}
    </style></head><body>
      <h1>Inventory ABC Analysis</h1>
      <p class="biz">${esc(state.companyName || "Your Business")} · ${new Date().toLocaleDateString("en-IN")}</p>
      <h2>Class summary</h2>
      <table><thead><tr><th>Class</th><th class="r">Items</th><th class="r">Usage value</th><th class="r">Share</th></tr></thead><tbody>${classRows}</tbody></table>
      <h2>Item ranking &amp; restocking priority</h2>
      <table><thead><tr><th>Rank</th><th>Item</th><th class="r">Usage value</th><th class="r">% of total</th><th class="r">Cumulative</th><th class="c">Class</th></tr></thead><tbody>${itemRows}</tbody></table>
      <script>window.onload=()=>window.print()</script>
    </body></html>`;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
  };

  const hasData = analysis.rows.length > 0;

  return (
    <div className="space-y-6">
      <WorkspaceBanner
        connection={workspace}
        message="Load your product list from the workspace, then fill in each item's annual usage."
      />

      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput
            value={state.companyName}
            onChange={(e) => setState((s) => ({ ...s, companyName: e.target.value }))}
            placeholder="Company name"
          />
          <div className="flex flex-wrap gap-2">
            <SecondaryButton onClick={() => setItems(SAMPLE.map((s) => ({ ...s, id: generateLocalId() })))}>
              Load sample inventory
            </SecondaryButton>
            <SecondaryButton onClick={() => setItems([blankItem(), blankItem(), blankItem()])}>
              Reset
            </SecondaryButton>
            {workspace.connected ? (
              <SecondaryButton onClick={pullProducts}>↻ Pull products</SecondaryButton>
            ) : null}
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-bold text-ink">Inventory items</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b-2 border-indigo/30 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                <th className="py-2 pr-3">Item name</th>
                <th className="py-2 pr-3 text-right">Annual qty used/sold</th>
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
                      placeholder="e.g. Industrial Bearing Assembly"
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
                      onClick={() => setItems(items.filter((i) => i.id !== item.id))}
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
        <button
          type="button"
          onClick={() => setItems([...items, blankItem()])}
          className="mt-3 text-sm font-semibold text-indigo hover:underline"
        >
          + Add item
        </button>
      </Card>

      {!hasData ? (
        <Card>
          <p className="text-sm text-muted">
            Add inventory items with their annual quantity and unit cost (or load the sample) to see
            your ABC classification, Pareto chart and restocking priorities.
          </p>
        </Card>
      ) : (
        <>
          {/* Class summary cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            {(["A", "B", "C"] as const).map((cls) => {
              const pct = analysis.total > 0 ? (analysis.values[cls] / analysis.total) * 100 : 0;
              return (
                <Card key={cls}>
                  <div className="flex items-center justify-between">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${CLASS_CHIP[cls]}`}>
                      Class {cls}
                    </span>
                    <span className="text-xs text-muted">{analysis.counts[cls]} items</span>
                  </div>
                  <p className="mt-2 text-3xl font-bold text-ink">{pct.toFixed(0)}%</p>
                  <p className="text-xs text-muted">of total usage value ({money(analysis.values[cls])})</p>
                  <p className="mt-2 text-xs leading-relaxed text-muted">{CLASS_CONTROL[cls]}</p>
                </Card>
              );
            })}
          </div>

          {/* Charts */}
          <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
            <Card>
              <h2 className="mb-4 text-lg font-bold text-ink">Pareto chart (usage value)</h2>
              <ParetoChart rows={analysis.rows} money={money} />
            </Card>
            <Card>
              <h2 className="mb-4 text-lg font-bold text-ink">Value by class</h2>
              <ClassPie values={analysis.values} total={analysis.total} money={money} />
            </Card>
          </div>

          {/* Ranking table */}
          <Card>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-ink">Item ranking &amp; restocking priority</h2>
              <div className="flex gap-2">
                <PrimaryButton onClick={exportPdf}>Export PDF</PrimaryButton>
                <SecondaryButton onClick={exportCsv}>Export CSV</SecondaryButton>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b-2 border-indigo/30 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                    <th className="py-2 pr-3">Rank</th>
                    <th className="py-2 pr-3">Item</th>
                    <th className="py-2 pr-3 text-right">Usage value</th>
                    <th className="py-2 pr-3 text-right">% of total</th>
                    <th className="py-2 pr-3 text-right">Cumulative %</th>
                    <th className="py-2 pr-3 text-center">Class</th>
                    <th className="py-2">Restock priority</th>
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
                      <td className="py-2 pr-3 text-center">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${CLASS_CHIP[row.cls]}`}>
                          {row.cls}
                        </span>
                      </td>
                      <td className="py-2 text-xs text-muted">{CLASS_RESTOCK[row.cls]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

type Row = {
  id: string;
  name: string;
  value: number;
  cumPct: number;
  cls: AbcClass;
};

function ParetoChart({ rows, money }: { rows: Row[]; money: (v: number) => string }) {
  const W = 800;
  const H = 340;
  const padL = 64;
  const padR = 48;
  const padT = 16;
  const padB = 96;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const maxValue = Math.max(...rows.map((r) => r.value), 1);
  const n = rows.length;
  const bandW = plotW / n;
  const barW = Math.min(bandW * 0.6, 46);

  const x = (i: number) => padL + bandW * i + bandW / 2;
  const yVal = (v: number) => padT + plotH - (v / maxValue) * plotH;
  const yPct = (p: number) => padT + plotH - (p / 100) * plotH;

  const linePts = rows.map((r, i) => `${x(i)},${yPct(r.cumPct)}`).join(" ");

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[560px]" role="img" aria-label="Pareto chart of usage value by item">
        {/* gridlines + left axis (usage value) */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line
              x1={padL}
              x2={padL + plotW}
              y1={padT + plotH * (1 - t)}
              y2={padT + plotH * (1 - t)}
              stroke="#ECEAE3"
              strokeWidth={1}
            />
            <text x={padL - 8} y={padT + plotH * (1 - t) + 4} textAnchor="end" fontSize={10} fill="#9A8F7A">
              {Math.round((maxValue * t) / 1000)}k
            </text>
            <text x={padL + plotW + 8} y={padT + plotH * (1 - t) + 4} fontSize={10} fill="#F2A03D">
              {Math.round(t * 100)}%
            </text>
          </g>
        ))}

        {/* bars */}
        {rows.map((r, i) => (
          <rect
            key={r.id}
            x={x(i) - barW / 2}
            y={yVal(r.value)}
            width={barW}
            height={padT + plotH - yVal(r.value)}
            rx={3}
            fill={BAR_COLOR}
          >
            <title>
              {r.name}: {money(r.value)} · cumulative {r.cumPct.toFixed(1)}%
            </title>
          </rect>
        ))}

        {/* cumulative % line */}
        <polyline points={linePts} fill="none" stroke={LINE_COLOR} strokeWidth={2} />
        {rows.map((r, i) => (
          <circle key={r.id} cx={x(i)} cy={yPct(r.cumPct)} r={4} fill="#fff" stroke={LINE_COLOR} strokeWidth={2}>
            <title>
              {r.name}: cumulative {r.cumPct.toFixed(1)}%
            </title>
          </circle>
        ))}

        {/* x labels (rotated) */}
        {rows.map((r, i) => (
          <text
            key={r.id}
            x={x(i)}
            y={padT + plotH + 12}
            fontSize={9}
            fill="#5F6478"
            textAnchor="end"
            transform={`rotate(-40 ${x(i)} ${padT + plotH + 12})`}
          >
            {r.name.length > 22 ? r.name.slice(0, 21) + "…" : r.name}
          </text>
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-5 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: BAR_COLOR }} /> Usage value
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4" style={{ background: LINE_COLOR }} /> Cumulative %
        </span>
      </div>
    </div>
  );
}

function ClassPie({
  values,
  total,
  money,
}: {
  values: Record<AbcClass, number>;
  total: number;
  money: (v: number) => string;
}) {
  const R = 90;
  const cx = 110;
  const cy = 110;
  const classes: AbcClass[] = ["A", "B", "C"];
  let angle = -Math.PI / 2; // start at top

  const slices = classes.map((c) => {
    const frac = total > 0 ? values[c] / total : 0;
    const start = angle;
    const end = angle + frac * Math.PI * 2;
    angle = end;
    const large = end - start > Math.PI ? 1 : 0;
    const x1 = cx + R * Math.cos(start);
    const y1 = cy + R * Math.sin(start);
    const x2 = cx + R * Math.cos(end);
    const y2 = cy + R * Math.sin(end);
    const path =
      frac >= 0.9999
        ? `M ${cx} ${cy - R} A ${R} ${R} 0 1 1 ${cx - 0.01} ${cy - R} Z`
        : `M ${cx} ${cy} L ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} Z`;
    return { c, frac, path };
  });

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <svg viewBox="0 0 220 220" className="h-48 w-48 shrink-0" role="img" aria-label="Value by class pie chart">
        {slices.map((s) =>
          s.frac > 0 ? (
            <path key={s.c} d={s.path} fill={CLASS_COLOR[s.c]} stroke="#fff" strokeWidth={2}>
              <title>
                Class {s.c}: {(s.frac * 100).toFixed(1)}% ({money(values[s.c])})
              </title>
            </path>
          ) : null
        )}
      </svg>
      <div className="space-y-2 text-sm">
        {classes.map((c) => (
          <div key={c} className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ background: CLASS_COLOR[c] }} />
            <span className="font-semibold text-ink">Class {c}</span>
            <span className="text-muted">
              {total > 0 ? ((values[c] / total) * 100).toFixed(1) : "0"}% · {money(values[c])}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
