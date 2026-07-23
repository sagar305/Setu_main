"use client";

import { useMemo, useState } from "react";
import { NumberField } from "@/components/calculators/NumberField";
import { ResultStat } from "@/components/calculators/ResultStat";
import { formatCurrency, formatNumber, parseNumber } from "@/lib/format";
import { usePreferredCurrency } from "@/lib/hooks/usePreferredCurrency";
import { useI18n } from "@/lib/i18n";

export function MarkupCalculatorTool() {
  const { t } = useI18n();
  usePreferredCurrency(); // re-render when the business currency changes
  const [costPrice, setCostPrice] = useState("100");
  const [markupPct, setMarkupPct] = useState("40");

  const result = useMemo(() => {
    const cp = parseNumber(costPrice);
    const markup = parseNumber(markupPct);
    const sellingPrice = cp * (1 + markup / 100);
    const profit = sellingPrice - cp;
    const marginPct = sellingPrice > 0 ? (profit / sellingPrice) * 100 : 0;
    return { sellingPrice, profit, marginPct };
  }, [costPrice, markupPct]);

  return (
    <div>
      <div className="grid gap-5 sm:grid-cols-2">
        <NumberField label={t("mkCostPrice")} value={costPrice} onChange={setCostPrice} prefix="₹" />
        <NumberField label={t("mkTargetMarkup")} value={markupPct} onChange={setMarkupPct} suffix="%" />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <ResultStat label={t("mkSellingPrice")} value={formatCurrency(result.sellingPrice)} emphasis />
        <ResultStat label={t("mkProfitPerUnit")} value={formatCurrency(result.profit)} />
        <ResultStat label={t("mkResultingMargin")} value={`${formatNumber(result.marginPct)}%`} />
      </div>
    </div>
  );
}
