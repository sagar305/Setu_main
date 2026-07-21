"use client";

import { useMemo, useState } from "react";
import { NumberField } from "@/components/calculators/NumberField";
import { ResultStat } from "@/components/calculators/ResultStat";
import { formatCurrency, parseNumber } from "@/lib/format";
import { usePreferredCurrency } from "@/lib/hooks/usePreferredCurrency";

export function AovCalculatorTool() {
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
        <NumberField label="Total revenue (period)" value={revenue} onChange={setRevenue} prefix="₹" />
        <NumberField label="Number of orders" value={orders} onChange={setOrders} />
        <NumberField label="Target AOV increase" value={targetIncrease} onChange={setTargetIncrease} suffix="%" />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <ResultStat label="Current AOV" value={formatCurrency(result.aov)} emphasis />
        <ResultStat label="AOV at target increase" value={formatCurrency(result.newAov)} />
        <ResultStat label="Extra revenue, same order volume" value={formatCurrency(result.extraRevenue)} />
      </div>
    </div>
  );
}
