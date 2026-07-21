"use client";

import { useMemo, useState } from "react";
import { NumberField } from "@/components/calculators/NumberField";
import { ResultStat } from "@/components/calculators/ResultStat";
import { formatCurrency, parseNumber } from "@/lib/format";
import { usePreferredCurrency } from "@/lib/hooks/usePreferredCurrency";

const STATUTORY_CEILING = 2000000;

export function GratuityCalculatorTool() {
  usePreferredCurrency(); // re-render when the business currency changes
  const [lastSalary, setLastSalary] = useState("30000");
  const [years, setYears] = useState("7");

  const result = useMemo(() => {
    const salary = parseNumber(lastSalary);
    const yearsOfService = parseNumber(years);
    const raw = (salary * 15 * yearsOfService) / 26;
    const capped = Math.min(raw, STATUTORY_CEILING);
    return { raw, capped, exceedsCeiling: raw > STATUTORY_CEILING };
  }, [lastSalary, years]);

  return (
    <div>
      <div className="grid gap-5 sm:grid-cols-2">
        <NumberField label="Last drawn monthly salary (basic + DA)" value={lastSalary} onChange={setLastSalary} prefix="₹" />
        <NumberField label="Years of service" value={years} onChange={setYears} suffix="yrs" />
      </div>

      <div className="mt-6">
        <ResultStat label="Estimated gratuity payable" value={formatCurrency(result.capped)} emphasis />
      </div>

      {result.exceedsCeiling && (
        <p className="mt-4 rounded-xl bg-saffron/15 p-4 text-xs leading-relaxed text-ink">
          Your uncapped calculation works out to {formatCurrency(result.raw)}, above the statutory tax-exempt ceiling
          of ₹20,00,000. This ceiling is revised periodically by the government — confirm the current limit before
          treating this as a final figure.
        </p>
      )}
    </div>
  );
}
