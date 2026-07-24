"use client";

import { useMemo, useState } from "react";
import { NumberField } from "@/components/calculators/NumberField";
import { ResultStat } from "@/components/calculators/ResultStat";
import { SegmentedControl } from "@/components/calculators/SegmentedControl";
import { formatCurrency, parseNumber } from "@/lib/format";
import { usePreferredCurrency } from "@/lib/hooks/usePreferredCurrency";

type Mode = "add" | "extract";

export function SalesTaxCalculatorTool() {
  usePreferredCurrency(); // re-render when the business currency changes
  const [mode, setMode] = useState<Mode>("add");
  const [amount, setAmount] = useState("100");
  const [stateRate, setStateRate] = useState("6");
  const [localRate, setLocalRate] = useState("2");

  const result = useMemo(() => {
    const value = parseNumber(amount);
    const combined = (parseNumber(stateRate) + parseNumber(localRate)) / 100;
    if (mode === "add") {
      const tax = value * combined;
      return { combinedPct: combined * 100, preTax: value, tax, total: value + tax };
    }
    const preTax = combined > -1 ? value / (1 + combined) : 0;
    return { combinedPct: combined * 100, preTax, tax: value - preTax, total: value };
  }, [mode, amount, stateRate, localRate]);

  return (
    <div>
      <SegmentedControl
        options={[
          { label: "Add tax to price", value: "add" },
          { label: "Extract tax from total", value: "extract" },
        ]}
        value={mode}
        onChange={setMode}
      />

      <div className="mt-5 grid gap-5 sm:grid-cols-3">
        <NumberField
          label={mode === "add" ? "Pre-tax price" : "Total paid (with tax)"}
          value={amount}
          onChange={setAmount}
          prefix="₹"
        />
        <NumberField label="State tax rate" value={stateRate} onChange={setStateRate} suffix="%" />
        <NumberField
          label="Local / city rate"
          value={localRate}
          onChange={setLocalRate}
          suffix="%"
          placeholder="0"
        />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <ResultStat label="Combined rate" value={`${result.combinedPct.toFixed(2)}%`} />
        <ResultStat label="Pre-tax price" value={formatCurrency(result.preTax)} />
        <ResultStat label="Sales tax" value={formatCurrency(result.tax)} />
        <ResultStat label="Total price" value={formatCurrency(result.total)} emphasis />
      </div>
    </div>
  );
}
