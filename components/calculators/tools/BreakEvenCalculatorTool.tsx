"use client";

import { useMemo, useState } from "react";
import { NumberField } from "@/components/calculators/NumberField";
import { ResultStat } from "@/components/calculators/ResultStat";
import { formatCurrency, formatNumber, parseNumber } from "@/lib/format";
import { usePreferredCurrency } from "@/lib/hooks/usePreferredCurrency";

export function BreakEvenCalculatorTool() {
  usePreferredCurrency(); // re-render when the business currency changes
  const [fixedCosts, setFixedCosts] = useState("50000");
  const [variableCost, setVariableCost] = useState("60");
  const [pricePerUnit, setPricePerUnit] = useState("100");

  const result = useMemo(() => {
    const fixed = parseNumber(fixedCosts);
    const variable = parseNumber(variableCost);
    const price = parseNumber(pricePerUnit);
    const contribution = price - variable;
    const contributionMarginPct = price > 0 ? (contribution / price) * 100 : 0;
    const breakEvenUnits = contribution > 0 ? fixed / contribution : 0;
    const breakEvenRevenue = breakEvenUnits * price;
    return { contribution, contributionMarginPct, breakEvenUnits, breakEvenRevenue };
  }, [fixedCosts, variableCost, pricePerUnit]);

  return (
    <div>
      <div className="grid gap-5 sm:grid-cols-2">
        <NumberField label="Fixed costs (per month)" value={fixedCosts} onChange={setFixedCosts} prefix="₹" />
        <NumberField label="Variable cost per unit" value={variableCost} onChange={setVariableCost} prefix="₹" />
        <NumberField label="Selling price per unit" value={pricePerUnit} onChange={setPricePerUnit} prefix="₹" />
      </div>

      {result.contribution <= 0 ? (
        <p className="mt-6 rounded-xl bg-saffron/15 p-4 text-sm leading-relaxed text-ink">
          Your selling price doesn't cover the variable cost per unit, so there's no break-even point — every unit
          sold loses money. Raise the price or lower the variable cost to make break-even possible.
        </p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <ResultStat label="Break-even units" value={`${formatNumber(result.breakEvenUnits, 0)} units`} emphasis />
          <ResultStat label="Break-even revenue" value={formatCurrency(result.breakEvenRevenue)} />
          <ResultStat label="Contribution margin" value={`${formatNumber(result.contributionMarginPct)}%`} />
        </div>
      )}
    </div>
  );
}
