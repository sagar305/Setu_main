"use client";

import { useMemo, useState } from "react";
import { NumberField } from "@/components/calculators/NumberField";
import { ResultStat } from "@/components/calculators/ResultStat";
import { formatCurrency, formatNumber, parseNumber } from "@/lib/format";

export function MarkupCalculatorTool() {
  const [costPrice, setCostPrice] = useState("100");
  const [markupPct, setMarkupPct] = useState("40");

  const result = useMemo(() => {
    const cp = parseNumber(costPrice);
    const markup = parseNumber(markupPct);
    const sellingPrice = cp * (1 + markup / 100);
    const profit = sellingPrice - cp;
    const marginPct = sellingPrice > 0 ? (profit / sellingPrice) * 100 : 0;
    return { sellingPrice, profit, marginPct };
  }, [costPrice, markupPct]);

  return (
    <div>
      <div className="grid gap-5 sm:grid-cols-2">
        <NumberField label="Cost price" value={costPrice} onChange={setCostPrice} prefix="₹" />
        <NumberField label="Target markup" value={markupPct} onChange={setMarkupPct} suffix="%" />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <ResultStat label="Selling price" value={formatCurrency(result.sellingPrice)} emphasis />
        <ResultStat label="Profit per unit" value={formatCurrency(result.profit)} />
        <ResultStat label="Resulting margin" value={`${formatNumber(result.marginPct)}%`} />
      </div>
    </div>
  );
}
