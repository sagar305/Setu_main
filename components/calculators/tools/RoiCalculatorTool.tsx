"use client";

import { useMemo, useState } from "react";
import { NumberField } from "@/components/calculators/NumberField";
import { ResultStat } from "@/components/calculators/ResultStat";
import { formatCurrency, formatNumber, parseNumber } from "@/lib/format";
import { usePreferredCurrency } from "@/lib/hooks/usePreferredCurrency";
import { useI18n } from "@/lib/i18n";

export function RoiCalculatorTool() {
  usePreferredCurrency(); // re-render when the business currency changes
  const { t } = useI18n();
  const [invested, setInvested] = useState("100000");
  const [returned, setReturned] = useState("140000");
  const [years, setYears] = useState("2");

  const result = useMemo(() => {
    const cost = parseNumber(invested);
    const value = parseNumber(returned);
    const period = parseNumber(years);
    const gain = value - cost;
    const roi = cost > 0 ? (gain / cost) * 100 : 0;
    const annualized =
      cost > 0 && period > 0 && value > 0
        ? (Math.pow(value / cost, 1 / period) - 1) * 100
        : 0;
    return { gain, roi, annualized, hasPeriod: period > 0 };
  }, [invested, returned, years]);

  return (
    <div>
      <div className="grid gap-5 sm:grid-cols-3">
        <NumberField
          label={t("roiInvested")}
          value={invested}
          onChange={setInvested}
          prefix="₹"
        />
        <NumberField
          label={t("roiReturned")}
          value={returned}
          onChange={setReturned}
          prefix="₹"
        />
        <NumberField
          label={t("roiHoldingPeriod")}
          value={years}
          onChange={setYears}
          suffix={t("unitYrs")}
          placeholder={t("roiOptional")}
        />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <ResultStat
          label={t(result.gain >= 0 ? "roiNetProfit" : "roiNetLoss")}
          value={formatCurrency(result.gain)}
        />
        <ResultStat label={t("roiRoi")} value={`${formatNumber(result.roi, 2)}%`} emphasis />
        <ResultStat
          label={t("roiAnnualized")}
          value={result.hasPeriod ? `${formatNumber(result.annualized, 2)}%` : "—"}
        />
      </div>

      <p className="mt-4 text-sm text-muted">{t("roiFootnote")}</p>
    </div>
  );
}
