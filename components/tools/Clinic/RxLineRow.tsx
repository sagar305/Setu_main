"use client";

import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { computeQuantity } from "@/lib/clinic/calc";
import {
  MEDICINE_FORMS,
  TIMING_LABELS,
  type MedicineForm,
  type RxLine,
  type RxTiming,
} from "@/lib/clinic/types";
import { inputClass } from "@/components/tools/FreePos/ui";

/** The doses doctors actually write, one tap each. Anything else is typed. */
const FREQUENCY_PRESETS = ["1-0-0", "0-0-1", "1-0-1", "1-1-1", "1-1-0", "SOS"];

const TIMING_OPTIONS: { value: RxTiming; label: string }[] = [
  { value: "", label: "—" },
  { value: "before-food", label: TIMING_LABELS["before-food"] },
  { value: "after-food", label: TIMING_LABELS["after-food"] },
  { value: "with-food", label: TIMING_LABELS["with-food"] },
];

export function RxLineRow({
  line,
  index,
  total,
  onChange,
  onRemove,
  onMove,
}: {
  line: RxLine;
  index: number;
  total: number;
  onChange: (line: RxLine) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  /**
   * Quantity follows frequency × duration until the doctor overrides it. Syrups
   * and injections never match the tablet arithmetic, so the field stays fully
   * editable and a manual value is not recomputed away.
   */
  const patch = (updates: Partial<RxLine>) => {
    const next = { ...line, ...updates };
    if ("frequency" in updates || "durationDays" in updates) {
      next.quantity = computeQuantity(next.frequency, next.durationDays);
    }
    onChange(next);
  };

  return (
    <li className="rounded-xl border border-muted-line/30 bg-white p-3">
      <div className="flex items-start gap-2">
        <span className="mt-2 w-5 shrink-0 text-xs font-semibold text-muted">{index + 1}.</span>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={line.name}
              onChange={(event) => patch({ name: event.target.value })}
              placeholder="Medicine"
              className={`${inputClass} font-semibold`}
              aria-label="Medicine name"
            />
            <input
              type="text"
              value={line.strength}
              onChange={(event) => patch({ strength: event.target.value })}
              placeholder="500 mg"
              className={`${inputClass} w-24 shrink-0`}
              aria-label="Strength"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {FREQUENCY_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => patch({ frequency: preset })}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                  line.frequency === preset
                    ? "bg-indigo text-white"
                    : "border border-muted-line/40 bg-white text-muted hover:text-indigo"
                }`}
              >
                {preset}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <input
              type="text"
              value={line.frequency}
              onChange={(event) => patch({ frequency: event.target.value })}
              placeholder="1-0-1"
              className={inputClass}
              aria-label="Frequency"
            />
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={line.durationDays ?? ""}
              onChange={(event) =>
                patch({
                  durationDays: event.target.value ? Number(event.target.value) : null,
                })
              }
              placeholder="Days"
              className={inputClass}
              aria-label="Duration in days"
            />
            <select
              value={line.timing}
              onChange={(event) => patch({ timing: event.target.value as RxTiming })}
              className={inputClass}
              aria-label="Timing"
            >
              {TIMING_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={line.form}
              onChange={(event) => patch({ form: event.target.value as MedicineForm })}
              className={inputClass}
              aria-label="Form"
            >
              {MEDICINE_FORMS.map((form) => (
                <option key={form} value={form}>
                  {form}
                </option>
              ))}
            </select>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={line.quantity ?? ""}
              onChange={(event) =>
                onChange({
                  ...line,
                  quantity: event.target.value ? Number(event.target.value) : null,
                })
              }
              placeholder="Qty"
              className={inputClass}
              aria-label="Quantity to dispense"
            />
          </div>

          <input
            type="text"
            value={line.instructions}
            onChange={(event) => patch({ instructions: event.target.value })}
            placeholder="Instructions (optional)"
            className={inputClass}
            aria-label="Instructions"
          />
        </div>

        <div className="flex shrink-0 flex-col gap-1">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            aria-label="Move up"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition hover:bg-cream hover:text-indigo disabled:opacity-30"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            aria-label="Move down"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition hover:bg-cream hover:text-indigo disabled:opacity-30"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove medicine"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </li>
  );
}
