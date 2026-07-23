"use client";

import { useMemo, useState } from "react";
import { NumberField } from "@/components/calculators/NumberField";
import { ResultStat } from "@/components/calculators/ResultStat";
import { formatNumber, parseNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

export function InventoryTurnoverCalculatorTool() {
  const { t } = useI18n();
  const [cogs, setCogs] = useState("600000");
  const [avgInventory, setAvgInventory] = useState("100000");
  const [periodDays, setPeriodDays] = useState("365");

  const result = useMemo(() => {
    const cogsNum = parseNumber(cogs);
    const inventory = parseNumber(avgInventory);
    const days = parseNumber(periodDays);
    const turnoverRatio = inventory > 0 ? cogsNum / inventory : 0;
    const daysOutstanding = turnoverRatio > 0 ? days / turnoverRatio : 0;
    return { turnoverRatio, daysOutstanding };
  }, [cogs, avgInventory, periodDays]);

  return (
    <div>
      <div className="grid gap-5 sm:grid-cols-2">
        <NumberField label={t("invCogs")} value={cogs} onChange={setCogs} prefix="₹" />
        <NumberField label={t("invAvgValue")} value={avgInventory} onChange={setAvgInventory} prefix="₹" />
        <NumberField label={t("invDaysPeriod")} value={periodDays} onChange={setPeriodDays} suffix={t("unitDays")} />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <ResultStat label={t("invRatio")} value={`${formatNumber(result.turnoverRatio)}x`} emphasis />
        <ResultStat label={t("invDio")} value={`${formatNumber(result.daysOutstanding, 0)} ${t("unitDays")}`} />
      </div>
    </div>
  );
}
