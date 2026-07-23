"use client";

import { useMemo, useState } from "react";
import { DynamicRowList, type RowColumn } from "@/components/calculators/DynamicRowList";
import { NumberField } from "@/components/calculators/NumberField";
import { ResultStat } from "@/components/calculators/ResultStat";
import { formatCurrency, parseNumber } from "@/lib/format";
import { usePreferredCurrency } from "@/lib/hooks/usePreferredCurrency";
import { useI18n } from "@/lib/i18n";

export function RecipeCostingCalculatorTool() {
  const { t } = useI18n();
  usePreferredCurrency(); // re-render when the business currency changes
  const columns: RowColumn[] = [
    { key: "name", label: t("rcIngredient"), type: "text", placeholder: t("rcIngredientPlaceholder") },
    { key: "cost", label: t("rcCostUsed"), type: "number", prefix: "₹" },
  ];
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
      <DynamicRowList rows={rows} columns={columns} onChange={setRows} addLabel={t("rcAddIngredient")} minRows={1} />

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <NumberField label={t("rcServings")} value={servings} onChange={setServings} />
        <NumberField label={t("rcTargetFoodCost")} value={targetFoodCostPct} onChange={setTargetFoodCostPct} suffix="%" />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <ResultStat label={t("rcTotalCost")} value={formatCurrency(result.totalCost)} />
        <ResultStat label={t("rcCostPerServing")} value={formatCurrency(result.costPerServing)} emphasis />
        <ResultStat label={t("rcSuggestedPrice")} value={formatCurrency(result.suggestedPrice)} />
      </div>
    </div>
  );
}
