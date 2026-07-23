"use client";

import { useMemo, useState } from "react";
import { NumberField } from "@/components/calculators/NumberField";
import { ResultStat } from "@/components/calculators/ResultStat";
import { formatCurrency, parseNumber } from "@/lib/format";
import { usePreferredCurrency } from "@/lib/hooks/usePreferredCurrency";
import { useI18n } from "@/lib/i18n";

export function TakeHomeSalaryCalculatorTool() {
  const { t } = useI18n();
  usePreferredCurrency(); // re-render when the business currency changes
  const [annualCtc, setAnnualCtc] = useState("600000");
  const [basicPct, setBasicPct] = useState("40");
  const [professionalTax, setProfessionalTax] = useState("200");

  const result = useMemo(() => {
    const ctc = parseNumber(annualCtc);
    const monthlyCtc = ctc / 12;
    const basic = monthlyCtc * (parseNumber(basicPct) / 100);
    const employerPf = basic * 0.12;
    const employeePf = basic * 0.12;
    const ptax = parseNumber(professionalTax);
    const grossMonthly = monthlyCtc - employerPf;
    const monthlyTakeHome = grossMonthly - employeePf - ptax;
    return { monthlyTakeHome, employeePf, annualTakeHome: monthlyTakeHome * 12 };
  }, [annualCtc, basicPct, professionalTax]);

  return (
    <div>
      <div className="grid gap-5 sm:grid-cols-2">
        <NumberField label={t("thCtc")} value={annualCtc} onChange={setAnnualCtc} prefix="₹" />
        <NumberField label={t("thBasic")} value={basicPct} onChange={setBasicPct} suffix="%" />
        <NumberField label={t("thProfTax")} value={professionalTax} onChange={setProfessionalTax} prefix="₹" />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <ResultStat label={t("thMonthly")} value={formatCurrency(result.monthlyTakeHome)} emphasis />
        <ResultStat label={t("thPf")} value={formatCurrency(result.employeePf)} />
        <ResultStat label={t("thAnnual")} value={formatCurrency(result.annualTakeHome)} />
      </div>

      <p className="mt-4 text-xs leading-relaxed text-muted-warm">
        {t("thNote")}
      </p>
    </div>
  );
}
