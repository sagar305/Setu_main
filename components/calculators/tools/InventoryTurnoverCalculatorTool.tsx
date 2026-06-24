"use client";

import { useMemo, useState } from "react";
import { NumberField } from "@/components/calculators/NumberField";
import { ResultStat } from "@/components/calculators/ResultStat";
import { formatNumber, parseNumber } from "@/lib/format";

export function InventoryTurnoverCalculatorTool() {
  const [cogs, setCogs] = useState("600000");
  const [avgInventory, setAvgInventory] = useState("100000");
  const [periodDays, setPeriodDays] = useState("365");

  const result = useMemo(() => {
    const cogsNum = parseNumber(cogs);
    const inventory = parseNumber(avgInventory);
    const days = parseNumber(periodDays);
    const turnoverRatio = inventory > 0 ? cogsNum / inventory : 0;
    const daysOutstanding = turnoverRatio > 0 ? days / turnoverRatio : 0;
    return { turnoverRatio, daysOutstanding };
  }, [cogs, avgInventory, periodDays]);

  return (
    <div>
      <div className="grid gap-5 sm:grid-cols-2">
        <NumberField label="Cost of goods sold (period)" value={cogs} onChange={setCogs} prefix="₹" />
        <NumberField label="Average inventory value" value={avgInventory} onChange={setAvgInventory} prefix="₹" />
        <NumberField label="Days in period" value={periodDays} onChange={setPeriodDays} suffix="days" />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <ResultStat label="Inventory turnover ratio" value={`${formatNumber(result.turnoverRatio)}x`} emphasis />
        <ResultStat label="Days inventory outstanding" value={`${formatNumber(result.daysOutstanding, 0)} days`} />
      </div>
    </div>
  );
}
