"use client";

import { useMemo, useState } from "react";
import { NumberField } from "@/components/calculators/NumberField";
import { ResultStat } from "@/components/calculators/ResultStat";
import { formatCurrency, formatNumber, parseNumber } from "@/lib/format";
import { usePreferredCurrency } from "@/lib/hooks/usePreferredCurrency";
import { useI18n } from "@/lib/i18n";

export function LiquorCostCalculatorTool() {
  const { t } = useI18n();
  usePreferredCurrency(); // re-render when the business currency changes
  const [bottleCost, setBottleCost] = useState("1200");
  const [bottleSize, setBottleSize] = useState("750");
  const [pourSize, setPourSize] = useState("30");
  const [sellingPrice, setSellingPrice] = useState("250");

  const result = useMemo(() => {
    const cost = parseNumber(bottleCost);
    const size = parseNumber(bottleSize);
    const pour = parseNumber(pourSize);
    const price = parseNumber(sellingPrice);
    const poursPerBottle = pour > 0 ? size / pour : 0;
    const costPerPour = poursPerBottle > 0 ? cost / poursPerBottle : 0;
    const pourCostPct = price > 0 ? (costPerPour / price) * 100 : 0;
    const profitPerPour = price - costPerPour;
    return { poursPerBottle, costPerPour, pourCostPct, profitPerPour };
  }, [bottleCost, bottleSize, pourSize, sellingPrice]);

  return (
    <div>
      <div className="grid gap-5 sm:grid-cols-2">
        <NumberField label={t("lcBottleCost")} value={bottleCost} onChange={setBottleCost} prefix="₹" />
        <NumberField label={t("lcBottleSize")} value={bottleSize} onChange={setBottleSize} suffix={t("unitMl")} />
        <NumberField label={t("lcPourSize")} value={pourSize} onChange={setPourSize} suffix={t("unitMl")} />
        <NumberField label={t("lcSellPrice")} value={sellingPrice} onChange={setSellingPrice} prefix="₹" />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <ResultStat label={t("lcPourCostPct")} value={`${formatNumber(result.pourCostPct)}%`} />
        <ResultStat label={t("lcProfitPerPour")} value={formatCurrency(result.profitPerPour)} emphasis />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <ResultStat label={t("lcCostPerPour")} value={formatCurrency(result.costPerPour)} />
        <ResultStat label={t("lcPoursPerBottle")} value={formatNumber(result.poursPerBottle, 0)} />
      </div>
    </div>
  );
}
