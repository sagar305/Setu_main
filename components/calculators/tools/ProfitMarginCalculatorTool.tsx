"use client";

import { useMemo, useState } from "react";
import { NumberField } from "@/components/calculators/NumberField";
import { ResultStat } from "@/components/calculators/ResultStat";
import { formatCurrency, formatNumber, parseNumber } from "@/lib/format";
import { usePreferredCurrency } from "@/lib/hooks/usePreferredCurrency";

export function ProfitMarginCalculatorTool() {
  usePreferredCurrency(); // re-render when the business currency changes
  const [costPrice, setCostPrice] = useState("100");
  const [sellingPrice, setSellingPrice] = useState("150");

  const result = useMemo(() => {
    const cp = parseNumber(costPrice);
    const sp = parseNumber(sellingPrice);
    const profit = sp - cp;
    const marginPct = sp > 0 ? (profit / sp) * 100 : 0;
    const markupPct = cp > 0 ? (profit / cp) * 100 : 0;
    return { profit, marginPct, markupPct };
  }, [costPrice, sellingPrice]);

  return (
    <div>
      <div className="grid gap-5 sm:grid-cols-2">
        <NumberField label="Cost price" value={costPrice} onChange={setCostPrice} prefix="₹" />
        <NumberField label="Selling price" value={sellingPrice} onChange={setSellingPrice} prefix="₹" />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <ResultStat label="Profit" value={formatCurrency(result.profit)} />
        <ResultStat label="Profit margin" value={`${formatNumber(result.marginPct)}%`} emphasis />
        <ResultStat label="Markup" value={`${formatNumber(result.markupPct)}%`} />
      </div>
    </div>
  );
}
