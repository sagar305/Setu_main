"use client";

import { useMemo, useState } from "react";
import { NumberField } from "@/components/calculators/NumberField";
import { ResultStat } from "@/components/calculators/ResultStat";
import { SegmentedControl } from "@/components/calculators/SegmentedControl";
import { formatCurrency, parseNumber } from "@/lib/format";
import { usePreferredCurrency } from "@/lib/hooks/usePreferredCurrency";

type Mode = "add" | "remove";

const COMMON_RATES = ["5", "10", "12.5", "15", "20", "23"];

export function VatCalculatorTool() {
  usePreferredCurrency(); // re-render when the business currency changes
  const [mode, setMode] = useState<Mode>("add");
  const [amount, setAmount] = useState("1000");
  const [rate, setRate] = useState("20");

  const result = useMemo(() => {
    const value = parseNumber(amount);
    const vatRate = parseNumber(rate) / 100;
    if (mode === "add") {
      const vat = value * vatRate;
      return { net: value, vat, gross: value + vat };
    }
    const net = vatRate > -1 ? value / (1 + vatRate) : 0;
    return { net, vat: value - net, gross: value };
  }, [mode, amount, rate]);

  return (
    <div>
      <SegmentedControl
        options={[
          { label: "Add VAT", value: "add" },
          { label: "Remove VAT", value: "remove" },
        ]}
        value={mode}
        onChange={setMode}
      />

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <NumberField
          label={mode === "add" ? "Amount before VAT" : "Amount including VAT"}
          value={amount}
          onChange={setAmount}
          prefix="₹"
        />
        <NumberField label="VAT rate" value={rate} onChange={setRate} suffix="%" />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {COMMON_RATES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRate(r)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
              rate === r
                ? "border-indigo bg-indigo text-cream-paper"
                : "border-muted-line/40 text-ink/70 hover:border-indigo/40 hover:text-ink"
            }`}
          >
            {r}%
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <ResultStat label="Net amount" value={formatCurrency(result.net)} />
        <ResultStat label="VAT amount" value={formatCurrency(result.vat)} />
        <ResultStat label="Gross amount" value={formatCurrency(result.gross)} emphasis />
      </div>
    </div>
  );
}
