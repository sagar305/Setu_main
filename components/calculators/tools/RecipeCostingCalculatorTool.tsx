"use client";

import { useMemo, useState } from "react";
import { DynamicRowList, type RowColumn } from "@/components/calculators/DynamicRowList";
import { NumberField } from "@/components/calculators/NumberField";
import { ResultStat } from "@/components/calculators/ResultStat";
import { formatCurrency, parseNumber } from "@/lib/format";
import { usePreferredCurrency } from "@/lib/hooks/usePreferredCurrency";

const COLUMNS: RowColumn[] = [
  { key: "name", label: "Ingredient", type: "text", placeholder: "e.g. Paneer" },
  { key: "cost", label: "Cost used", type: "number", prefix: "₹" },
];

export function RecipeCostingCalculatorTool() {
  usePreferredCurrency(); // re-render when the business currency changes
  const [rows, setRows] = useState<Record<string, string>[]>([
    { name: "Paneer", cost: "60" },
    { name: "Spices & sauces", cost: "15" },
    { name: "Oil & garnish", cost: "10" },
  ]);
  const [servings, setServings] = useState("4");
  const [targetFoodCostPct, setTargetFoodCostPct] = useState("30");

  const result = useMemo(() => {
    const totalCost = rows.reduce((sum, row) => sum + parseNumber(row.cost), 0);
    const servingsNum = parseNumber(servings);
    const costPerServing = servingsNum > 0 ? totalCost / servingsNum : 0;
    const targetPct = parseNumber(targetFoodCostPct);
    const suggestedPrice = targetPct > 0 ? costPerServing / (targetPct / 100) : 0;
    return { totalCost, costPerServing, suggestedPrice };
  }, [rows, servings, targetFoodCostPct]);

  return (
    <div>
      <DynamicRowList rows={rows} columns={COLUMNS} onChange={setRows} addLabel="Add ingredient" minRows={1} />

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <NumberField label="Servings this recipe yields" value={servings} onChange={setServings} />
        <NumberField label="Target food cost %" value={targetFoodCostPct} onChange={setTargetFoodCostPct} suffix="%" />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <ResultStat label="Total recipe cost (all servings)" value={formatCurrency(result.totalCost)} />
        <ResultStat label="Cost per serving" value={formatCurrency(result.costPerServing)} emphasis />
        <ResultStat label="Suggested price per serving" value={formatCurrency(result.suggestedPrice)} />
      </div>
    </div>
  );
}
