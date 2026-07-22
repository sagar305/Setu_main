"use client";

import { useMemo, useState } from "react";
import { NumberField } from "@/components/calculators/NumberField";
import { ResultStat } from "@/components/calculators/ResultStat";
import { formatNumber, parseNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

export function TableTurnoverCalculatorTool() {
  const { t } = useI18n();
  const [covers, setCovers] = useState("120");
  const [tables, setTables] = useState("20");
  const [hours, setHours] = useState("4");

  const result = useMemo(() => {
    const coversNum = parseNumber(covers);
    const tablesNum = parseNumber(tables);
    const hoursNum = parseNumber(hours);
    const turnoverRate = tablesNum > 0 ? coversNum / tablesNum : 0;
    const avgTurnMinutes = turnoverRate > 0 ? (hoursNum * 60) / turnoverRate : 0;
    return { turnoverRate, avgTurnMinutes };
  }, [covers, tables, hours]);

  return (
    <div>
      <div className="grid gap-5 sm:grid-cols-3">
        <NumberField label={t("ttCovers")} value={covers} onChange={setCovers} />
        <NumberField label={t("ttTables")} value={tables} onChange={setTables} />
        <NumberField label={t("ttServiceLength")} value={hours} onChange={setHours} suffix={t("unitHrs")} />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <ResultStat label={t("ttRate")} value={`${formatNumber(result.turnoverRate)}x`} emphasis />
        <ResultStat label={t("ttAvgTurn")} value={`${formatNumber(result.avgTurnMinutes, 0)} ${t("unitMin")}`} />
      </div>
    </div>
  );
}
