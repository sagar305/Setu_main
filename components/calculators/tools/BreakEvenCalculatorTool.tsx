"use client";

import { useMemo, useState } from "react";
import { NumberField } from "@/components/calculators/NumberField";
import { ResultStat } from "@/components/calculators/ResultStat";
import { formatCurrency, formatNumber, parseNumber } from "@/lib/format";
import { usePreferredCurrency } from "@/lib/hooks/usePreferredCurrency";
import { useI18n } from "@/lib/i18n";

export function BreakEvenCalculatorTool() {
  const { t } = useI18n();
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
        <NumberField label={t("beFixedCosts")} value={fixedCosts} onChange={setFixedCosts} prefix="₹" />
        <NumberField label={t("beVarCost")} value={variableCost} onChange={setVariableCost} prefix="₹" />
        <NumberField label={t("beSellPrice")} value={pricePerUnit} onChange={setPricePerUnit} prefix="₹" />
      </div>

      {result.contribution <= 0 ? (
        <p className="mt-6 rounded-xl bg-saffron/15 p-4 text-sm leading-relaxed text-ink">
          {t("beNote")}
        </p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <ResultStat label={t("beUnits")} value={`${formatNumber(result.breakEvenUnits, 0)} ${t("unitUnits")}`} emphasis />
          <ResultStat label={t("beRevenue")} value={formatCurrency(result.breakEvenRevenue)} />
          <ResultStat label={t("beContribution")} value={`${formatNumber(result.contributionMarginPct)}%`} />
        </div>
      )}
    </div>
  );
}
