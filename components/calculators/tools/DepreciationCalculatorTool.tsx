"use client";

import { useMemo, useState } from "react";
import { NumberField } from "@/components/calculators/NumberField";
import { ResultStat } from "@/components/calculators/ResultStat";
import { SegmentedControl } from "@/components/calculators/SegmentedControl";
import { formatCurrency, parseNumber } from "@/lib/format";
import { usePreferredCurrency } from "@/lib/hooks/usePreferredCurrency";

type Method = "sl" | "wdv";

type ScheduleRow = { year: number; opening: number; depreciation: number; closing: number };

export function DepreciationCalculatorTool() {
  usePreferredCurrency(); // re-render when the business currency changes
  const [method, setMethod] = useState<Method>("sl");
  const [cost, setCost] = useState("500000");
  const [salvage, setSalvage] = useState("50000");
  const [life, setLife] = useState("5");
  const [rate, setRate] = useState("25");

  const result = useMemo(() => {
    const assetCost = parseNumber(cost);
    const salvageValue = Math.min(parseNumber(salvage), assetCost);
    const lifeYears = Math.min(Math.max(Math.round(parseNumber(life)), 0), 50);
    const wdvRate = Math.min(Math.max(parseNumber(rate), 0), 100) / 100;

    const schedule: ScheduleRow[] = [];
    let book = assetCost;

    if (method === "sl") {
      const annual = lifeYears > 0 ? (assetCost - salvageValue) / lifeYears : 0;
      for (let y = 1; y <= lifeYears; y++) {
        const dep = Math.min(annual, book - salvageValue);
        schedule.push({ year: y, opening: book, depreciation: dep, closing: book - dep });
        book -= dep;
      }
      return { annual, schedule, finalValue: book };
    }

    for (let y = 1; y <= lifeYears; y++) {
      const dep = Math.max(Math.min(book * wdvRate, book - salvageValue), 0);
      schedule.push({ year: y, opening: book, depreciation: dep, closing: book - dep });
      book -= dep;
    }
    return { annual: schedule[0]?.depreciation ?? 0, schedule, finalValue: book };
  }, [method, cost, salvage, life, rate]);

  return (
    <div>
      <SegmentedControl
        options={[
          { label: "Straight line", value: "sl" },
          { label: "Written down value", value: "wdv" },
        ]}
        value={method}
        onChange={setMethod}
      />

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <NumberField label="Asset cost" value={cost} onChange={setCost} prefix="₹" />
        <NumberField label="Salvage value" value={salvage} onChange={setSalvage} prefix="₹" />
        <NumberField label="Useful life" value={life} onChange={setLife} suffix="yrs" />
        {method === "wdv" ? (
          <NumberField label="Depreciation rate" value={rate} onChange={setRate} suffix="%" />
        ) : null}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <ResultStat
          label={method === "sl" ? "Annual depreciation" : "First-year depreciation"}
          value={formatCurrency(result.annual)}
          emphasis
        />
        <ResultStat label="Book value at end of life" value={formatCurrency(result.finalValue)} />
      </div>

      {result.schedule.length > 0 ? (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="border-b-2 border-indigo/30 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                <th className="py-2 pr-3">Year</th>
                <th className="py-2 pr-3 text-right">Opening value</th>
                <th className="py-2 pr-3 text-right">Depreciation</th>
                <th className="py-2 text-right">Closing value</th>
              </tr>
            </thead>
            <tbody>
              {result.schedule.map((row) => (
                <tr key={row.year} className="border-b border-muted-line/30">
                  <td className="py-2 pr-3">{row.year}</td>
                  <td className="py-2 pr-3 text-right">{formatCurrency(row.opening)}</td>
                  <td className="py-2 pr-3 text-right">{formatCurrency(row.depreciation)}</td>
                  <td className="py-2 text-right">{formatCurrency(row.closing)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
