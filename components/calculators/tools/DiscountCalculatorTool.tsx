"use client";

import { useMemo, useState } from "react";
import { NumberField } from "@/components/calculators/NumberField";
import { ResultStat } from "@/components/calculators/ResultStat";
import { formatCurrency, parseNumber } from "@/lib/format";
import { usePreferredCurrency } from "@/lib/hooks/usePreferredCurrency";
import { useI18n } from "@/lib/i18n";

export function DiscountCalculatorTool() {
  const { t } = useI18n();
  usePreferredCurrency(); // re-render when the business currency changes
  const [originalPrice, setOriginalPrice] = useState("1000");
  const [discountPct, setDiscountPct] = useState("20");

  const result = useMemo(() => {
    const price = parseNumber(originalPrice);
    const discount = parseNumber(discountPct);
    const discountAmount = price * (discount / 100);
    const finalPrice = price - discountAmount;
    return { discountAmount, finalPrice };
  }, [originalPrice, discountPct]);

  return (
    <div>
      <div className="grid gap-5 sm:grid-cols-2">
        <NumberField label={t("discOriginalPrice")} value={originalPrice} onChange={setOriginalPrice} prefix="₹" />
        <NumberField label={t("discDiscount")} value={discountPct} onChange={setDiscountPct} suffix="%" />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <ResultStat label={t("discYouSave")} value={formatCurrency(result.discountAmount)} />
        <ResultStat label={t("discFinalPrice")} value={formatCurrency(result.finalPrice)} emphasis />
      </div>
    </div>
  );
}
