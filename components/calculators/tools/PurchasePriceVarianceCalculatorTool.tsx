"use client";

import { useMemo, useState } from "react";
import { NumberField } from "@/components/calculators/NumberField";
import { ResultStat } from "@/components/calculators/ResultStat";
import { formatCurrency, formatNumber, parseNumber } from "@/lib/format";
import { usePreferredCurrency } from "@/lib/hooks/usePreferredCurrency";

export function PurchasePriceVarianceCalculatorTool() {
  usePreferredCurrency(); // re-render when the business currency changes
  const [standardPrice, setStandardPrice] = useState("100");
  const [actualPrice, setActualPrice] = useState("110");
  const [quantity, setQuantity] = useState("500");

  const result = useMemo(() => {
    const std = parseNumber(standardPrice);
    const actual = parseNumber(actualPrice);
    const qty = parseNumber(quantity);
    const perUnit = actual - std;
    const total = perUnit * qty;
    const pct = std > 0 ? (perUnit / std) * 100 : 0;
    return { perUnit, total, pct };
  }, [standardPrice, actualPrice, quantity]);

  const favourable = result.total <= 0;

  return (
    <div>
      <div className="grid gap-5 sm:grid-cols-3">
        <NumberField
          label="Standard price / unit"
          value={standardPrice}
          onChange={setStandardPrice}
          prefix="₹"
        />
        <NumberField
          label="Actual price / unit"
          value={actualPrice}
          onChange={setActualPrice}
          prefix="₹"
        />
        <NumberField label="Quantity purchased" value={quantity} onChange={setQuantity} />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <ResultStat label="Variance per unit" value={formatCurrency(result.perUnit)} />
        <ResultStat label="Variance %" value={`${formatNumber(result.pct, 2)}%`} />
        <ResultStat label="Total variance" value={formatCurrency(result.total)} emphasis />
      </div>

      <p
        className={`mt-4 rounded-xl px-4 py-3 text-sm font-medium ${
          favourable ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
        }`}
      >
        {favourable
          ? "Favourable — you paid at or below the standard price, saving money against plan."
          : "Unfavourable — you paid above the standard price. Investigate supplier rates, order quantities or market movement."}
      </p>

      <p className="mt-4 text-sm text-muted">
        PPV = (actual price − standard price) × quantity. Standard price is the budgeted or
        negotiated rate you planned to pay; a positive variance means purchasing cost more than
        planned.
      </p>
    </div>
  );
}
