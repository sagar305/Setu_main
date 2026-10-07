"use client";

import { useMemo, useState } from "react";
import { NumberField } from "@/components/calculators/NumberField";
import { ResultStat } from "@/components/calculators/ResultStat";
import { formatNumber, parseNumber } from "@/lib/format";
import { usePreferredCurrency } from "@/lib/hooks/usePreferredCurrency";
import { useI18n } from "@/lib/i18n";

export function FinancialRatioCalculatorTool() {
  usePreferredCurrency(); // re-render when the business currency changes
  const { t } = useI18n();
  const [currentAssets, setCurrentAssets] = useState("800000");
  const [inventory, setInventory] = useState("300000");
  const [currentLiabilities, setCurrentLiabilities] = useState("400000");
  const [totalDebt, setTotalDebt] = useState("500000");
  const [equity, setEquity] = useState("1000000");
  const [revenue, setRevenue] = useState("2400000");
  const [cogs, setCogs] = useState("1500000");
  const [netProfit, setNetProfit] = useState("240000");
  const [receivables, setReceivables] = useState("200000");

  const r = useMemo(() => {
    const ca = parseNumber(currentAssets);
    const inv = parseNumber(inventory);
    const cl = parseNumber(currentLiabilities);
    const debt = parseNumber(totalDebt);
    const eq = parseNumber(equity);
    const rev = parseNumber(revenue);
    const cost = parseNumber(cogs);
    const profit = parseNumber(netProfit);
    const ar = parseNumber(receivables);

    const safe = (num: number, den: number) => (den !== 0 ? num / den : 0);
    return {
      current: safe(ca, cl),
      quick: safe(ca - inv, cl),
      debtToEquity: safe(debt, eq),
      grossMargin: safe(rev - cost, rev) * 100,
      netMargin: safe(profit, rev) * 100,
      inventoryTurnover: safe(cost, inv),
      receivableDays: rev > 0 ? (ar / rev) * 365 : 0,
    };
  }, [currentAssets, inventory, currentLiabilities, totalDebt, equity, revenue, cogs, netProfit, receivables]);

  return (
    <div>
      <h3 className="text-sm font-bold uppercase tracking-wide text-muted">
        {t("frBalanceSheetFigures")}
      </h3>
      <div className="mt-3 grid gap-5 sm:grid-cols-2">
        <NumberField
          label={t("frCurrentAssets")}
          value={currentAssets}
          onChange={setCurrentAssets}
          prefix="₹"
        />
        <NumberField
          label={t("frInventory")}
          value={inventory}
          onChange={setInventory}
          prefix="₹"
        />
        <NumberField
          label={t("frCurrentLiabilities")}
          value={currentLiabilities}
          onChange={setCurrentLiabilities}
          prefix="₹"
        />
        <NumberField
          label={t("frReceivables")}
          value={receivables}
          onChange={setReceivables}
          prefix="₹"
        />
        <NumberField
          label={t("frTotalDebt")}
          value={totalDebt}
          onChange={setTotalDebt}
          prefix="₹"
        />
        <NumberField label={t("frEquity")} value={equity} onChange={setEquity} prefix="₹" />
      </div>

      <h3 className="mt-6 text-sm font-bold uppercase tracking-wide text-muted">
        {t("frPlFigures")}
      </h3>
      <div className="mt-3 grid gap-5 sm:grid-cols-3">
        <NumberField label={t("frRevenue")} value={revenue} onChange={setRevenue} prefix="₹" />
        <NumberField label={t("frCogs")} value={cogs} onChange={setCogs} prefix="₹" />
        <NumberField
          label={t("frNetProfit")}
          value={netProfit}
          onChange={setNetProfit}
          prefix="₹"
        />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <ResultStat label={t("frCurrentRatio")} value={formatNumber(r.current, 2)} emphasis />
        <ResultStat label={t("frQuickRatio")} value={formatNumber(r.quick, 2)} />
        <ResultStat label={t("frDebtToEquity")} value={formatNumber(r.debtToEquity, 2)} />
        <ResultStat label={t("frGrossMargin")} value={`${formatNumber(r.grossMargin, 1)}%`} />
        <ResultStat label={t("frNetMargin")} value={`${formatNumber(r.netMargin, 1)}%`} />
        <ResultStat
          label={t("frInventoryTurnover")}
          value={`${formatNumber(r.inventoryTurnover, 1)}×`}
        />
        <ResultStat
          label={t("frReceivableDays")}
          value={`${formatNumber(r.receivableDays, 0)} ${t("unitDays")}`}
        />
      </div>

      <p className="mt-4 text-sm text-muted">{t("frFootnote")}</p>
    </div>
  );
}
