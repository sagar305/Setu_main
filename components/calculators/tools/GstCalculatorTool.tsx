"use client";

import { useMemo, useState } from "react";
import { NumberField } from "@/components/calculators/NumberField";
import { ResultStat } from "@/components/calculators/ResultStat";
import { SegmentedControl } from "@/components/calculators/SegmentedControl";
import { formatCurrency, parseNumber } from "@/lib/format";
import { usePreferredCurrency } from "@/lib/hooks/usePreferredCurrency";
import { useI18n } from "@/lib/i18n";

const GST_PRESETS = [5, 12, 18, 28];

export function GstCalculatorTool() {
  const { t } = useI18n();
  usePreferredCurrency(); // re-render when the business currency changes
  const [mode, setMode] = useState<"add" | "remove">("add");
  const [amount, setAmount] = useState("1000");
  const [rate, setRate] = useState("18");

  const result = useMemo(() => {
    const amountNum = parseNumber(amount);
    const rateNum = parseNumber(rate);

    if (mode === "add") {
      const gstAmount = amountNum * (rateNum / 100);
      return { base: amountNum, gstAmount, total: amountNum + gstAmount };
    }

    const base = amountNum / (1 + rateNum / 100);
    const gstAmount = amountNum - base;
    return { base, gstAmount, total: amountNum };
  }, [mode, amount, rate]);

  return (
    <div>
      <SegmentedControl
        value={mode}
        onChange={setMode}
        options={[
          { label: t("gstAdd"), value: "add" },
          { label: t("gstRemove"), value: "remove" },
        ]}
      />

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <NumberField
          label={mode === "add" ? t("gstAmountBefore") : t("gstAmountIncl")}
          value={amount}
          onChange={setAmount}
          prefix="₹"
        />
        <div>
          <NumberField label={t("gstRate")} value={rate} onChange={setRate} suffix="%" />
          <div className="mt-2 flex gap-2">
            {GST_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setRate(String(preset))}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  rate === String(preset)
                    ? "border-indigo bg-indigo text-cream-paper"
                    : "border-muted-line/40 text-muted hover:border-indigo/40"
                }`}
              >
                {preset}%
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <ResultStat label={t("gstBaseAmount")} value={formatCurrency(result.base)} />
        <ResultStat label={t("gstAmountLabel")} value={formatCurrency(result.gstAmount)} />
        <ResultStat label={t("gstTotalAmount")} value={formatCurrency(result.total)} emphasis />
      </div>
    </div>
  );
}
