"use client";

import { Plus, X } from "lucide-react";
import { usePreferredCurrencySymbol } from "@/lib/hooks/usePreferredCurrency";

export type RowColumn = {
  key: string;
  label: string;
  type?: "text" | "number";
  prefix?: string;
  suffix?: string;
  placeholder?: string;
};

export function DynamicRowList({
  rows,
  columns,
  onChange,
  addLabel = "Add row",
  minRows = 1,
}: {
  rows: Record<string, string>[];
  columns: RowColumn[];
  onChange: (rows: Record<string, string>[]) => void;
  addLabel?: string;
  minRows?: number;
}) {
  const currencySym = usePreferredCurrencySymbol();
  const updateRow = (index: number, key: string, value: string) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  };

  const addRow = () => {
    const blank = Object.fromEntries(columns.map((column) => [column.key, ""]));
    onChange([...rows, blank]);
  };

  const removeRow = (index: number) => {
    onChange(rows.filter((_, i) => i !== index));
  };

  return (
    <div>
      <div className="flex gap-2">
        {columns.map((column) => (
          <span key={column.key} className="flex-1 text-sm font-semibold text-ink">
            {column.label}
          </span>
        ))}
        <span className="w-9 shrink-0" />
      </div>

      <div className="mt-2 space-y-2">
        {rows.map((row, index) => (
          <div key={index} className="flex items-center gap-2">
            {columns.map((column) => (
              <div
                key={column.key}
                className="flex flex-1 items-center rounded-xl border border-muted-line/40 bg-white px-3 transition focus-within:border-indigo"
              >
                {column.prefix && (
                  <span className="mr-1 text-sm text-muted-warm">
                    {column.prefix === "₹" ? currencySym : column.prefix}
                  </span>
                )}
                <input
                  type={column.type === "number" ? "number" : "text"}
                  inputMode={column.type === "number" ? "decimal" : undefined}
                  value={row[column.key] ?? ""}
                  onChange={(e) => updateRow(index, column.key, e.target.value)}
                  placeholder={column.placeholder}
                  className="w-full bg-transparent py-2.5 text-sm text-ink outline-none placeholder:text-muted-line"
                />
                {column.suffix && <span className="ml-1 text-sm text-muted-warm">{column.suffix}</span>}
              </div>
            ))}
            <button
              type="button"
              onClick={() => removeRow(index)}
              disabled={rows.length <= minRows}
              aria-label="Remove row"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-warm transition hover:bg-cream hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addRow}
        className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-indigo/30 px-4 py-1.5 text-sm font-semibold text-indigo transition hover:bg-indigo/5"
      >
        <Plus className="h-3.5 w-3.5" /> {addLabel}
      </button>
    </div>
  );
}
