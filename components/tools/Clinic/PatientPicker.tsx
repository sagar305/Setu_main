"use client";

import { useMemo, useState } from "react";
import { Search, UserPlus } from "lucide-react";
import { useClinic } from "@/lib/clinic/store";
import { formatAgeSex } from "@/lib/clinic/calc";
import { phoneKey, type Patient } from "@/lib/clinic/types";
import { Modal, inputClass } from "@/components/tools/FreePos/ui";
import { PatientForm } from "./PatientForm";

/** Rank matches so the person the desk means is first: code, then phone, then name. */
export function searchPatients(patients: Patient[], query: string, limit = 8): Patient[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const digits = needle.replace(/\D/g, "");
  const scored: { patient: Patient; score: number }[] = [];

  for (const patient of patients) {
    const name = patient.name.toLowerCase();
    const code = patient.code.toLowerCase();
    const phone = phoneKey(patient.phone);
    let score = -1;

    if (code === needle) score = 100;
    else if (digits && phone === digits) score = 90;
    else if (digits.length >= 4 && phone.includes(digits)) score = 80;
    else if (name.startsWith(needle)) score = 70;
    else if (name.includes(needle)) score = 60;
    else if (code.includes(needle)) score = 50;

    if (score >= 0) scored.push({ patient, score });
  }

  return scored
    .sort((a, b) => b.score - a.score || a.patient.name.localeCompare(b.patient.name))
    .slice(0, limit)
    .map((row) => row.patient);
}

/**
 * One field that finds an existing patient or registers a new one without
 * leaving the screen. This is the front desk's main input — spec §3.1.
 */
export function PatientPicker({
  placeholder = "Search by name, phone or file no.",
  autoFocus,
  onPick,
  label,
}: {
  placeholder?: string;
  autoFocus?: boolean;
  onPick: (patient: Patient) => void;
  label?: string;
}) {
  const { patients } = useClinic();
  const [query, setQuery] = useState("");
  const [registerOpen, setRegisterOpen] = useState(false);

  const matches = useMemo(() => searchPatients(patients, query), [patients, query]);
  const looksLikePhone = /^\d{4,}$/.test(query.trim());

  const pick = (patient: Patient) => {
    setQuery("");
    onPick(patient);
  };

  return (
    <div>
      {label && (
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
          {label}
        </span>
      )}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted/60" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className={`${inputClass} pl-9`}
        />
      </div>

      {query.trim() && (
        <div className="mt-2 overflow-hidden rounded-xl border border-muted-line/30 bg-white">
          {matches.map((patient) => (
            <button
              key={patient.id}
              type="button"
              onClick={() => pick(patient)}
              className="flex w-full items-center justify-between gap-3 border-b border-muted-line/20 px-3 py-2.5 text-left transition last:border-b-0 hover:bg-cream"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-ink">
                  {patient.name}
                </span>
                <span className="block truncate text-xs text-muted">
                  {[patient.code, formatAgeSex(patient), patient.phone]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setRegisterOpen(true)}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold text-indigo transition hover:bg-cream"
          >
            <UserPlus className="h-4 w-4" />
            Register new patient
            {matches.length === 0 && <span className="font-normal text-muted">— no match</span>}
          </button>
        </div>
      )}

      <Modal
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        title="Register new patient"
        wide
      >
        <PatientForm
          initialPhone={looksLikePhone ? query.trim() : ""}
          initialName={looksLikePhone ? "" : query.trim()}
          onSaved={(patient) => {
            setRegisterOpen(false);
            pick(patient);
          }}
          onCancel={() => setRegisterOpen(false)}
        />
      </Modal>
    </div>
  );
}
