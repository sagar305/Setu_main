"use client";

import { useMemo, useState } from "react";
import { NumberField } from "@/components/calculators/NumberField";
import { ResultStat } from "@/components/calculators/ResultStat";
import { formatNumber, parseNumber } from "@/lib/format";

export function StockReorderPointCalculatorTool() {
  const [avgDailySales, setAvgDailySales] = useState("20");
  const [leadTime, setLeadTime] = useState("5");
  const [safetyStock, setSafetyStock] = useState("30");

  const result = useMemo(() => {
    const daily = parseNumber(avgDailySales);
    const lead = parseNumber(leadTime);
    const safety = parseNumber(safetyStock);
    const leadTimeDemand = daily * lead;
    const reorderPoint = leadTimeDemand + safety;
    return { leadTimeDemand, reorderPoint };
  }, [avgDailySales, leadTime, safetyStock]);

  return (
    <div>
      <div className="grid gap-5 sm:grid-cols-2">
        <NumberField label="Average daily sales" value={avgDailySales} onChange={setAvgDailySales} suffix="units" />
        <NumberField label="Supplier lead time" value={leadTime} onChange={setLeadTime} suffix="days" />
        <NumberField label="Safety stock" value={safetyStock} onChange={setSafetyStock} suffix="units" />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <ResultStat label="Reorder at" value={`${formatNumber(result.reorderPoint, 0)} units`} emphasis />
        <ResultStat label="Lead-time demand" value={`${formatNumber(result.leadTimeDemand, 0)} units`} />
      </div>
    </div>
  );
}
