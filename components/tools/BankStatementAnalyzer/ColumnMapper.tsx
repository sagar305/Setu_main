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
  sampleRows = [],
  mapping,
  onChange,
}: {
  headers: string[];
  /** Extracted data rows, used both to size the list and to label it. */
  sampleRows?: string[][];
  mapping: ColumnMapping;
  onChange: (mapping: ColumnMapping) => void;
}) {
  // Every column that exists anywhere in the file, not just in the header or
  // the first row — a narrow first row must never hide the later columns.
  const columnCount = Math.max(
    headers.length,
    ...sampleRows.map((row) => row.length),
    0
  );

  const options = Array.from({ length: columnCount }, (_, index) => {
    // Label by header where we have one; otherwise by what the column holds,
    // taking the first couple of non-empty values from anywhere in the sample.
    const samples: string[] = [];
    for (const row of sampleRows) {
      const value = row[index]?.trim();
      if (value && !samples.includes(value)) samples.push(value);
      if (samples.length === 2) break;
    }
    const header = headers[index]?.trim();
    const preview = samples.length > 0 ? ` — ${samples.map((s) => `“${s.slice(0, 18)}”`).join(", ")}` : "";
    return {
      value: index,
      label: header ? `${index + 1}. ${header}` : `Column ${index + 1}${preview}`,
    };
  });

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
