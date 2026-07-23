"use client";

import { useMemo, useState } from "react";
import { NumberField } from "@/components/calculators/NumberField";
import { ResultStat } from "@/components/calculators/ResultStat";
import { formatCurrency, formatNumber, parseNumber } from "@/lib/format";
import { usePreferredCurrency } from "@/lib/hooks/usePreferredCurrency";
import { useI18n } from "@/lib/i18n";

export function FoodCostCalculatorTool() {
  const { t } = useI18n();
  usePreferredCurrency(); // re-render when the business currency changes
  const [ingredientCost, setIngredientCost] = useState("70");
  const [menuPrice, setMenuPrice] = useState("250");

  const result = useMemo(() => {
    const cost = parseNumber(ingredientCost);
    const price = parseNumber(menuPrice);
    const foodCostPct = price > 0 ? (cost / price) * 100 : 0;
    const grossProfit = price - cost;
    return { foodCostPct, grossProfit };
  }, [ingredientCost, menuPrice]);

  const note =
    result.foodCostPct === 0
      ? null
      : result.foodCostPct <= 35
        ? t("fcNoteWithin")
        : t("fcNoteAbove");

  return (
    <div>
      <div className="grid gap-5 sm:grid-cols-2">
        <NumberField label={t("fcIngredientCost")} value={ingredientCost} onChange={setIngredientCost} prefix="₹" />
        <NumberField label={t("fcMenuPrice")} value={menuPrice} onChange={setMenuPrice} prefix="₹" />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <ResultStat label={t("fcFoodCostPct")} value={`${formatNumber(result.foodCostPct)}%`} emphasis />
        <ResultStat label={t("fcGrossProfit")} value={formatCurrency(result.grossProfit)} />
      </div>

      {note && <p className="mt-4 text-sm leading-relaxed text-muted">{note}</p>}
    </div>
  );
}
