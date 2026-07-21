"use client";

import { useMemo, useState } from "react";
import { NumberField } from "@/components/calculators/NumberField";
import { ResultStat } from "@/components/calculators/ResultStat";
import { formatCurrency, formatNumber, parseNumber } from "@/lib/format";
import { usePreferredCurrency } from "@/lib/hooks/usePreferredCurrency";

export function CacCalculatorTool() {
  usePreferredCurrency(); // re-render when the business currency changes
  const [spend, setSpend] = useState("50000");
  const [newCustomers, setNewCustomers] = useState("100");
  const [avgRevenue, setAvgRevenue] = useState("800");

  const result = useMemo(() => {
    const spendNum = parseNumber(spend);
    const customers = parseNumber(newCustomers);
    const revenue = parseNumber(avgRevenue);
    const cac = customers > 0 ? spendNum / customers : 0;
    const ratio = cac > 0 && revenue > 0 ? revenue / cac : 0;
    return { cac, ratio, hasRevenue: revenue > 0 };
  }, [spend, newCustomers, avgRevenue]);

  return (
    <div>
      <div className="grid gap-5 sm:grid-cols-2">
        <NumberField label="Marketing & sales spend" value={spend} onChange={setSpend} prefix="₹" />
        <NumberField label="New customers acquired" value={newCustomers} onChange={setNewCustomers} />
        <NumberField label="Average revenue per customer (optional)" value={avgRevenue} onChange={setAvgRevenue} prefix="₹" />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <ResultStat label="Customer acquisition cost" value={formatCurrency(result.cac)} emphasis />
        <ResultStat label="Revenue-to-CAC ratio" value={result.hasRevenue ? `${formatNumber(result.ratio)}x` : "—"} />
      </div>
    </div>
  );
}
