"use client";

import { useMemo, useState } from "react";
import { NumberField } from "@/components/calculators/NumberField";
import { ResultStat } from "@/components/calculators/ResultStat";
import { formatNumber, parseNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

export function StockReorderPointCalculatorTool() {
  const { t } = useI18n();
  const [avgDailySales, setAvgDailySales] = useState("20");
  const [leadTime, setLeadTime] = useState("5");
  const [safetyStock, setSafetyStock] = useState("30");

  const result = useMemo(() => {
    const daily = parseNumber(avgDailySales);
    const lead = parseNumber(leadTime);
    const safety = parseNumber(safetyStock);
    const leadTimeDemand = daily * lead;
    const reorderPoint = leadTimeDemand + safety;
    return { leadTimeDemand, reorderPoint };
  }, [avgDailySales, leadTime, safetyStock]);

  return (
    <div>
      <div className="grid gap-5 sm:grid-cols-2">
        <NumberField label={t("srDailySales")} value={avgDailySales} onChange={setAvgDailySales} suffix={t("unitUnits")} />
        <NumberField label={t("srLeadTime")} value={leadTime} onChange={setLeadTime} suffix={t("unitDays")} />
        <NumberField label={t("srSafetyStock")} value={safetyStock} onChange={setSafetyStock} suffix={t("unitUnits")} />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <ResultStat label={t("srReorderAt")} value={`${formatNumber(result.reorderPoint, 0)} ${t("unitUnits")}`} emphasis />
        <ResultStat label={t("srLeadDemand")} value={`${formatNumber(result.leadTimeDemand, 0)} ${t("unitUnits")}`} />
      </div>
    </div>
  );
}
