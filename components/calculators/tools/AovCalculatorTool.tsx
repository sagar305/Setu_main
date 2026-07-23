"use client";

import { useMemo, useState } from "react";
import { NumberField } from "@/components/calculators/NumberField";
import { ResultStat } from "@/components/calculators/ResultStat";
import { formatCurrency, parseNumber } from "@/lib/format";
import { usePreferredCurrency } from "@/lib/hooks/usePreferredCurrency";
import { useI18n } from "@/lib/i18n";

export function AovCalculatorTool() {
  const { t } = useI18n();
  usePreferredCurrency(); // re-render when the business currency changes
  const [revenue, setRevenue] = useState("500000");
  const [orders, setOrders] = useState("1000");
  const [targetIncrease, setTargetIncrease] = useState("10");

  const result = useMemo(() => {
    const revenueNum = parseNumber(revenue);
    const ordersNum = parseNumber(orders);
    const aov = ordersNum > 0 ? revenueNum / ordersNum : 0;
    const newAov = aov * (1 + parseNumber(targetIncrease) / 100);
    const extraRevenue = (newAov - aov) * ordersNum;
    return { aov, newAov, extraRevenue };
  }, [revenue, orders, targetIncrease]);

  return (
    <div>
      <div className="grid gap-5 sm:grid-cols-2">
        <NumberField label={t("aovTotalRevenue")} value={revenue} onChange={setRevenue} prefix="₹" />
        <NumberField label={t("aovNumOrders")} value={orders} onChange={setOrders} />
        <NumberField label={t("aovTargetIncrease")} value={targetIncrease} onChange={setTargetIncrease} suffix="%" />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <ResultStat label={t("aovCurrent")} value={formatCurrency(result.aov)} emphasis />
        <ResultStat label={t("aovAtTarget")} value={formatCurrency(result.newAov)} />
        <ResultStat label={t("aovExtraRevenue")} value={formatCurrency(result.extraRevenue)} />
      </div>
    </div>
  );
}
