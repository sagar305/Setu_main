"use client";

import { useMemo, useState } from "react";
import { Plus, Search, Sparkles } from "lucide-react";
import { generateId } from "@/lib/pos/types";
import { useClinic, useFrequentMedicines } from "@/lib/clinic/store";
import { FORM_SHORT, type Medicine, type RxLine } from "@/lib/clinic/types";
import { inputClass } from "@/components/tools/FreePos/ui";

function label(medicine: Medicine): string {
  return [FORM_SHORT[medicine.form] ?? "", medicine.name, medicine.strength]
    .filter(Boolean)
    .join(" ");
}

/** Selecting a master medicine pre-fills the line with that medicine's defaults. */
export function lineFromMedicine(medicine: Medicine): RxLine {
  return {
    id: generateId(),
    medicineId: medicine.id,
    name: medicine.name,
    strength: medicine.strength,
    form: medicine.form,
    frequency: medicine.defaultFrequency,
    durationDays: medicine.defaultDurationDays,
    timing: medicine.defaultTiming,
    quantity: null,
    instructions: "",
  };
}

/**
 * Searches name and composition, so a doctor who thinks in salts finds the
 * brand and vice versa. With an empty box it shows what this clinic prescribes
 * most, which after a week is the fastest way to write a prescription.
 */
export function MedicinePicker({ onPick }: { onPick: (line: RxLine) => void }) {
  const { medicines } = useClinic();
  const frequent = useFrequentMedicines(10);
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return medicines
      .filter(
        (medicine) =>
          medicine.name.toLowerCase().includes(needle) ||
          medicine.composition.toLowerCase().includes(needle)
      )
      .sort((a, b) => {
        const aStarts = a.name.toLowerCase().startsWith(needle) ? 0 : 1;
        const bStarts = b.name.toLowerCase().startsWith(needle) ? 0 : 1;
        if (aStarts !== bStarts) return aStarts - bStarts;
        return (b.timesUsed ?? 0) - (a.timesUsed ?? 0);
      })
      .slice(0, 10);
  }, [medicines, query]);

  const addAdHoc = () => {
    const typed = query.trim();
    if (!typed) return;
    // Typing a name with no match still prescribes — the master list is a
    // convenience, never a gate on what a doctor may write.
    onPick({
      id: generateId(),
      medicineId: null,
      name: typed,
      strength: "",
      form: "tablet",
      frequency: "",
      durationDays: null,
      timing: "",
      quantity: null,
      instructions: "",
    });
    setQuery("");
  };

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted/60" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              if (matches.length > 0) {
                onPick(lineFromMedicine(matches[0]));
                setQuery("");
              } else {
                addAdHoc();
              }
            }
          }}
          placeholder="Search medicine or salt…"
          className={`${inputClass} pl-9`}
        />
      </div>

      {query.trim() ? (
        <div className="mt-2 overflow-hidden rounded-xl border border-muted-line/30 bg-white">
          {matches.map((medicine) => (
            <button
              key={medicine.id}
              type="button"
              onClick={() => {
                onPick(lineFromMedicine(medicine));
                setQuery("");
              }}
              className="flex w-full items-center justify-between gap-3 border-b border-muted-line/20 px-3 py-2 text-left transition last:border-b-0 hover:bg-cream"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-ink">
                  {label(medicine)}
                </span>
                {medicine.composition && (
                  <span className="block truncate text-xs text-muted">
                    {medicine.composition}
                  </span>
                )}
              </span>
              <Plus className="h-4 w-4 shrink-0 text-indigo" />
            </button>
          ))}
          <button
            type="button"
            onClick={addAdHoc}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-indigo transition hover:bg-cream"
          >
            <Plus className="h-4 w-4" />
            Prescribe “{query.trim()}”
            {matches.length === 0 && (
              <span className="font-normal text-muted">— not in your list</span>
            )}
          </button>
        </div>
      ) : (
        frequent.length > 0 && (
          <div className="mt-2">
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
              <Sparkles className="h-3 w-3" />
              Frequently prescribed
            </p>
            <div className="flex flex-wrap gap-1.5">
              {frequent.map((medicine) => (
                <button
                  key={medicine.id}
                  type="button"
                  onClick={() => onPick(lineFromMedicine(medicine))}
                  className="rounded-full border border-muted-line/40 bg-white px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-indigo/40 hover:text-indigo"
                >
                  {label(medicine)}
                </button>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  );
}
