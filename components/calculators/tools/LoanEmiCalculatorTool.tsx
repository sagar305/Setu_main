"use client";

import { useMemo, useState } from "react";
import { NumberField } from "@/components/calculators/NumberField";
import { ResultStat } from "@/components/calculators/ResultStat";
import { SegmentedControl } from "@/components/calculators/SegmentedControl";
import { formatCurrency, parseNumber } from "@/lib/format";
import { usePreferredCurrency } from "@/lib/hooks/usePreferredCurrency";

export function LoanEmiCalculatorTool() {
  usePreferredCurrency(); // re-render when the business currency changes
  const [loanAmount, setLoanAmount] = useState("500000");
  const [interestRate, setInterestRate] = useState("12");
  const [tenure, setTenure] = useState("24");
  const [tenureUnit, setTenureUnit] = useState<"months" | "years">("months");

  const result = useMemo(() => {
    const principal = parseNumber(loanAmount);
    const annualRate = parseNumber(interestRate);
    const tenureNum = parseNumber(tenure);
    const months = tenureUnit === "years" ? tenureNum * 12 : tenureNum;
    const monthlyRate = annualRate / 12 / 100;

    if (months <= 0) {
      return { emi: 0, totalPayment: 0, totalInterest: 0 };
    }

    const emi =
      monthlyRate > 0
        ? (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1)
        : principal / months;
    const totalPayment = emi * months;
    const totalInterest = totalPayment - principal;
    return { emi, totalPayment, totalInterest };
  }, [loanAmount, interestRate, tenure, tenureUnit]);

  return (
    <div>
      <div className="grid gap-5 sm:grid-cols-2">
        <NumberField label="Loan amount" value={loanAmount} onChange={setLoanAmount} prefix="₹" />
        <NumberField label="Annual interest rate" value={interestRate} onChange={setInterestRate} suffix="%" />
        <div>
          <NumberField label="Tenure" value={tenure} onChange={setTenure} />
          <div className="mt-2">
            <SegmentedControl
              value={tenureUnit}
              onChange={setTenureUnit}
              options={[
                { label: "Months", value: "months" },
                { label: "Years", value: "years" },
              ]}
            />
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <ResultStat label="Monthly EMI" value={formatCurrency(result.emi)} emphasis />
        <ResultStat label="Total interest" value={formatCurrency(result.totalInterest)} />
        <ResultStat label="Total payment" value={formatCurrency(result.totalPayment)} />
      </div>
    </div>
  );
}
