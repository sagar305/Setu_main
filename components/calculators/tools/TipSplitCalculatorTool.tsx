"use client";

import { useMemo, useState } from "react";
import { DynamicRowList, type RowColumn } from "@/components/calculators/DynamicRowList";
import { NumberField } from "@/components/calculators/NumberField";
import { SegmentedControl } from "@/components/calculators/SegmentedControl";
import { formatCurrency, parseNumber } from "@/lib/format";
import { usePreferredCurrency } from "@/lib/hooks/usePreferredCurrency";
import { useI18n } from "@/lib/i18n";

export function TipSplitCalculatorTool() {
  const { t } = useI18n();
  usePreferredCurrency(); // re-render when the business currency changes
  const columns: RowColumn[] = [
    { key: "name", label: t("name"), type: "text", placeholder: t("tsNamePlaceholder") },
    { key: "weight", label: t("tsHoursShares"), type: "number" },
  ];
  const [method, setMethod] = useState<"equal" | "weighted">("equal");
  const [pool, setPool] = useState("5000");
  const [rows, setRows] = useState<Record<string, string>[]>([
    { name: "Staff 1", weight: "8" },
    { name: "Staff 2", weight: "6" },
    { name: "Staff 3", weight: "4" },
  ]);

  const splits = useMemo(() => {
    const total = parseNumber(pool);
    if (method === "equal") {
      const share = rows.length > 0 ? total / rows.length : 0;
      return rows.map((row, index) => ({ name: row.name || `${t("tsStaff")} ${index + 1}`, amount: share }));
    }
    const totalWeight = rows.reduce((sum, row) => sum + parseNumber(row.weight), 0);
    return rows.map((row, index) => ({
      name: row.name || `${t("tsStaff")} ${index + 1}`,
      amount: totalWeight > 0 ? total * (parseNumber(row.weight) / totalWeight) : 0,
    }));
  }, [method, pool, rows, t]);

  return (
    <div>
      <SegmentedControl
        value={method}
        onChange={setMethod}
        options={[
          { label: t("tsEqual"), value: "equal" },
          { label: t("tsWeighted"), value: "weighted" },
        ]}
      />

      <div className="mt-6">
        <NumberField label={t("tsPool")} value={pool} onChange={setPool} prefix="₹" />
      </div>

      <div className="mt-6">
        <DynamicRowList rows={rows} columns={columns} onChange={setRows} addLabel={t("tsAddStaff")} minRows={1} />
      </div>

      <div className="mt-6 space-y-2">
        {splits.map((split, index) => (
          <div key={index} className="flex items-center justify-between rounded-xl bg-cream px-4 py-3">
            <span className="text-sm font-semibold text-ink">{split.name}</span>
            <span className="text-sm font-bold text-ink">{formatCurrency(split.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
