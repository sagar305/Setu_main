"use client";

import { useMemo, useState } from "react";
import { NumberField } from "@/components/calculators/NumberField";
import { ResultStat } from "@/components/calculators/ResultStat";
import { formatNumber, parseNumber } from "@/lib/format";

export function TableTurnoverCalculatorTool() {
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
        <NumberField label="Covers served" value={covers} onChange={setCovers} />
        <NumberField label="Number of tables" value={tables} onChange={setTables} />
        <NumberField label="Service length" value={hours} onChange={setHours} suffix="hrs" />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <ResultStat label="Table turnover rate" value={`${formatNumber(result.turnoverRate)}x`} emphasis />
        <ResultStat label="Avg. turn time" value={`${formatNumber(result.avgTurnMinutes, 0)} min`} />
      </div>
    </div>
  );
}
