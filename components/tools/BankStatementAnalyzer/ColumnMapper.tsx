"use client";

// Column mapping, shown whenever we import a tabular source or the detector is
// unsure. The CA always gets the last word on which column is which.

import type { ColumnMapping } from "@/lib/bankStatement/types";
import { Field, Select } from "@/components/toolkit/ui";

const FIELDS: { key: keyof ColumnMapping; label: string; hint?: string }[] = [
  { key: "date", label: "Date" },
  { key: "narration", label: "Narration / description" },
  { key: "reference", label: "Reference" },
  { key: "debit", label: "Debit / withdrawal" },
  { key: "credit", label: "Credit / deposit" },
  { key: "amount", label: "Single amount column", hint: "Use only when debit and credit share one column" },
  { key: "direction", label: "Dr/Cr indicator" },
  { key: "balance", label: "Balance" },
];

export function ColumnMapper({
  headers,
  sampleRow,
  mapping,
  onChange,
}: {
  headers: string[];
  sampleRow?: string[];
  mapping: ColumnMapping;
  onChange: (mapping: ColumnMapping) => void;
}) {
  const columnCount = Math.max(headers.length, sampleRow?.length ?? 0);
  const options = Array.from({ length: columnCount }, (_, index) => ({
    value: index,
    label: headers[index]?.trim()
      ? `${index + 1}. ${headers[index]}`
      : `Column ${index + 1}${sampleRow?.[index] ? ` — “${sampleRow[index].slice(0, 24)}”` : ""}`,
  }));

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {FIELDS.map((field) => (
        <Field key={field.key} label={field.label}>
          <Select
            value={mapping[field.key] ?? ""}
            onChange={(event) => {
              const value = event.target.value;
              const next = { ...mapping };
              if (value === "") delete next[field.key];
              else next[field.key] = Number(value);
              onChange(next);
            }}
          >
            <option value="">Not in this file</option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          {field.hint ? <span className="mt-1 block text-xs text-muted">{field.hint}</span> : null}
        </Field>
      ))}
    </div>
  );
}
