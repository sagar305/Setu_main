"use client";

import { useMemo, useState } from "react";
import { NumberField } from "@/components/calculators/NumberField";
import { ResultStat } from "@/components/calculators/ResultStat";
import { formatCurrency, parseNumber } from "@/lib/format";
import { usePreferredCurrency } from "@/lib/hooks/usePreferredCurrency";

type Bracket = { upTo: number; rate: number };

const NEW_REGIME_BRACKETS: Bracket[] = [
  { upTo: 400000, rate: 0 },
  { upTo: 800000, rate: 0.05 },
  { upTo: 1200000, rate: 0.1 },
  { upTo: 1600000, rate: 0.15 },
  { upTo: 2000000, rate: 0.2 },
  { upTo: 2400000, rate: 0.25 },
  { upTo: Infinity, rate: 0.3 },
];

const OLD_REGIME_BRACKETS: Bracket[] = [
  { upTo: 250000, rate: 0 },
  { upTo: 500000, rate: 0.05 },
  { upTo: 1000000, rate: 0.2 },
  { upTo: Infinity, rate: 0.3 },
];

function slabTax(income: number, brackets: Bracket[]): number {
  let tax = 0;
  let prev = 0;
  for (const bracket of brackets) {
    if (income <= prev) break;
    const slice = Math.min(income, bracket.upTo) - prev;
    tax += slice * bracket.rate;
    prev = bracket.upTo;
  }
  return tax;
}

function calcNewRegime(grossIncome: number) {
  const taxable = Math.max(grossIncome - 75000, 0);
  let tax = 0;
  if (taxable > 1200000) {
    const computed = slabTax(taxable, NEW_REGIME_BRACKETS);
    tax = Math.min(computed, taxable - 1200000);
  }
  return { taxable, tax: tax * 1.04 };
}

function calcOldRegime(grossIncome: number, deductions: number) {
  const taxable = Math.max(grossIncome - 50000 - deductions, 0);
  const tax = taxable <= 500000 ? 0 : slabTax(taxable, OLD_REGIME_BRACKETS);
  return { taxable, tax: tax * 1.04 };
}

export function IncomeTaxCalculatorTool() {
  usePreferredCurrency(); // re-render when the business currency changes
  const [grossIncome, setGrossIncome] = useState("1200000");
  const [deductions, setDeductions] = useState("150000");

  const result = useMemo(() => {
    const gross = parseNumber(grossIncome);
    const newRegime = calcNewRegime(gross);
    const oldRegime = calcOldRegime(gross, parseNumber(deductions));
    const better = newRegime.tax <= oldRegime.tax ? "new" : "old";
    const savings = Math.abs(newRegime.tax - oldRegime.tax);
    return { newRegime, oldRegime, better, savings };
  }, [grossIncome, deductions]);

  return (
    <div>
      <div className="grid gap-5 sm:grid-cols-2">
        <NumberField label="Annual gross income" value={grossIncome} onChange={setGrossIncome} prefix="₹" />
        <NumberField
          label="Deductions claimed (old regime — 80C, HRA, etc.)"
          value={deductions}
          onChange={setDeductions}
          prefix="₹"
        />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <ResultStat label="Old regime tax (incl. cess)" value={formatCurrency(result.oldRegime.tax)} />
        <ResultStat label="New regime tax (incl. cess)" value={formatCurrency(result.newRegime.tax)} />
      </div>

      <div className="mt-4">
        <ResultStat
          label={`${result.better === "new" ? "New" : "Old"} regime saves you`}
          value={formatCurrency(result.savings)}
          emphasis
        />
      </div>

      <p className="mt-4 rounded-xl bg-saffron/15 p-4 text-xs leading-relaxed text-ink">
        Estimate only, using FY 2025-26 (AY 2026-27) slabs and a simplified Section 87A rebate — it excludes
        surcharge and several itemised deductions. Tax slabs typically change with each Union Budget, so verify
        against the latest official slabs or a chartered accountant before filing or making a regime decision.
      </p>
    </div>
  );
}
