"use client";

import { useMemo, useState } from "react";
import { NumberField } from "@/components/calculators/NumberField";
import { ResultStat } from "@/components/calculators/ResultStat";
import { formatCurrency, parseNumber } from "@/lib/format";

export function TakeHomeSalaryCalculatorTool() {
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
        <NumberField label="Annual CTC" value={annualCtc} onChange={setAnnualCtc} prefix="₹" />
        <NumberField label="Basic salary (% of CTC)" value={basicPct} onChange={setBasicPct} suffix="%" />
        <NumberField label="Monthly professional tax" value={professionalTax} onChange={setProfessionalTax} prefix="₹" />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <ResultStat label="Monthly take-home" value={formatCurrency(result.monthlyTakeHome)} emphasis />
        <ResultStat label="Employee PF deducted" value={formatCurrency(result.employeePf)} />
        <ResultStat label="Annual take-home" value={formatCurrency(result.annualTakeHome)} />
      </div>

      <p className="mt-4 text-xs leading-relaxed text-muted-warm">
        Estimate based on typical PF and professional tax assumptions — actual take-home depends on your exact salary
        structure and any income tax TDS deducted.
      </p>
    </div>
  );
}
