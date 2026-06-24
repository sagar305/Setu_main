"use client";

import { useMemo, useState } from "react";
import { NumberField } from "@/components/calculators/NumberField";
import { ResultStat } from "@/components/calculators/ResultStat";
import { formatCurrency, formatNumber, parseNumber } from "@/lib/format";

export function FoodCostCalculatorTool() {
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
        ? "This is within the typical 28-35% range most restaurants target."
        : "This is above the typical 28-35% range — check portioning, wastage or whether the price needs to move.";

  return (
    <div>
      <div className="grid gap-5 sm:grid-cols-2">
        <NumberField label="Ingredient cost per dish" value={ingredientCost} onChange={setIngredientCost} prefix="₹" />
        <NumberField label="Menu selling price" value={menuPrice} onChange={setMenuPrice} prefix="₹" />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <ResultStat label="Food cost %" value={`${formatNumber(result.foodCostPct)}%`} emphasis />
        <ResultStat label="Gross profit per dish" value={formatCurrency(result.grossProfit)} />
      </div>

      {note && <p className="mt-4 text-sm leading-relaxed text-muted">{note}</p>}
    </div>
  );
}
