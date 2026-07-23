"use client";

import { useMemo, useState } from "react";
import { NumberField } from "@/components/calculators/NumberField";
import { ResultStat } from "@/components/calculators/ResultStat";
import { formatCurrency, parseNumber } from "@/lib/format";
import { usePreferredCurrency } from "@/lib/hooks/usePreferredCurrency";
import { useI18n } from "@/lib/i18n";

const STATUTORY_CEILING = 2000000;

export function GratuityCalculatorTool() {
  const { t } = useI18n();
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
        <NumberField label={t("gratSalary")} value={lastSalary} onChange={setLastSalary} prefix="₹" />
        <NumberField label={t("gratYears")} value={years} onChange={setYears} suffix={t("unitYrs")} />
      </div>

      <div className="mt-6">
        <ResultStat label={t("gratPayable")} value={formatCurrency(result.capped)} emphasis />
      </div>

      {result.exceedsCeiling && (
        <p className="mt-4 rounded-xl bg-saffron/15 p-4 text-xs leading-relaxed text-ink">
          {t("gratNote").replace("{amount}", formatCurrency(result.raw))}
        </p>
      )}
    </div>
  );
}
