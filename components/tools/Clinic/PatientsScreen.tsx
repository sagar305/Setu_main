"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Upload, UserPlus, Users } from "lucide-react";
import { useClinic } from "@/lib/clinic/store";
import { formatAgeSex, patientDues } from "@/lib/clinic/calc";
import { downloadCsv, patientsCsv } from "@/lib/clinic/csv";
import {
  daysBetween,
  formatDate,
  patientConditions,
  todayIso,
  type Patient,
} from "@/lib/clinic/types";
import { formatCurrency } from "@/lib/format";
import {
  EmptyState,
  Modal,
  SearchInput,
  primaryBtnClass,
  secondaryBtnClass,
} from "@/components/tools/FreePos/ui";
import type { NavigateFn } from "./nav";
import { PatientForm } from "./PatientForm";
import { PatientChart } from "./PatientChart";
import { ImportPatients } from "./ImportPatients";
import { searchPatients } from "./PatientPicker";

type QueryRequest = { screen: string; value: string; nonce: number };
type Filter = "all" | "dues" | "chronic" | "lapsed" | "new";

const PAGE_SIZE = 50;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "dues", label: "Has dues" },
  { id: "chronic", label: "Chronic" },
  { id: "lapsed", label: "Not seen in 6 months" },
  { id: "new", label: "Registered this month" },
];

export function PatientsScreen({
  onNavigate,
  externalQuery,
}: {
  onNavigate: NavigateFn;
  externalQuery: QueryRequest | null;
}) {
  const { patients, visits, bills, business } = useClinic();

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Another screen asked to open a specific chart.
  useEffect(() => {
    if (externalQuery?.value) setSelectedId(externalQuery.value);
  }, [externalQuery]);

  const today = todayIso();
  const currency = business?.currency ?? "INR";

  /** Last visit date per patient, used for ranking and the lapsed filter. */
  const lastVisitByPatient = useMemo(() => {
    const map = new Map<string, string>();
    for (const visit of visits) {
      const current = map.get(visit.patientId);
      if (!current || visit.date > current) map.set(visit.patientId, visit.date);
    }
    return map;
  }, [visits]);

  const filtered = useMemo(() => {
    let rows = query.trim() ? searchPatients(patients, query, 500) : [...patients];

    if (filter === "dues") {
      rows = rows.filter((p) => patientDues(bills, p.id) > 0);
    } else if (filter === "chronic") {
      rows = rows.filter((p) => patientConditions(p).length > 0);
    } else if (filter === "lapsed") {
      rows = rows.filter((p) => {
        const last = lastVisitByPatient.get(p.id);
        return last ? daysBetween(last, today) > 180 : false;
      });
    } else if (filter === "new") {
      rows = rows.filter((p) => p.registeredOn.slice(0, 7) === today.slice(0, 7));
    }

    // Ranked by last-visit recency, so the people the clinic is actually
    // seeing sit at the top rather than whoever is alphabetically first.
    if (!query.trim()) {
      rows.sort((a, b) => {
        const aLast = lastVisitByPatient.get(a.id) ?? "";
        const bLast = lastVisitByPatient.get(b.id) ?? "";
        if (aLast !== bLast) return bLast.localeCompare(aLast);
        return a.name.localeCompare(b.name);
      });
    }
    return rows;
  }, [patients, query, filter, bills, lastVisitByPatient, today]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [query, filter]);

  const selected = patients.find((p) => p.id === selectedId) ?? null;

  if (selected) {
    return (
      <PatientChart
        patient={selected}
        onNavigate={(screen, value) => {
          if (screen === "patients" && value) {
            setSelectedId(value);
            return;
          }
          onNavigate(screen, value);
        }}
        onClose={() => setSelectedId("")}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search by name, phone or file no."
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setAddOpen(true)} className={primaryBtnClass}>
            <UserPlus className="h-4 w-4" />
            Register
          </button>
          <button type="button" onClick={() => setImportOpen(true)} className={secondaryBtnClass}>
            <Upload className="h-4 w-4" />
            Import
          </button>
          <button
            type="button"
            onClick={() => downloadCsv("patients.csv", patientsCsv(patients, bills))}
            disabled={patients.length === 0}
            className={secondaryBtnClass}
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              filter === item.id
                ? "bg-indigo text-white"
                : "border border-muted-line/40 bg-white text-muted hover:text-indigo"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {notice && <p className="text-sm font-semibold text-emerald-700">{notice}</p>}

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title={patients.length === 0 ? "No patients yet" : "No matches"}
          message={
            patients.length === 0
              ? "Register your first patient, or import your existing register from a spreadsheet."
              : "Try a different name, phone number or filter."
          }
          action={
            patients.length === 0 ? (
              <button type="button" onClick={() => setAddOpen(true)} className={primaryBtnClass}>
                <UserPlus className="h-4 w-4" />
                Register a patient
              </button>
            ) : undefined
          }
        />
      ) : (
        <>
          <p className="text-xs text-muted">
            {filtered.length} {filtered.length === 1 ? "patient" : "patients"}
          </p>
          <ul className="space-y-2">
            {filtered.slice(0, visibleCount).map((patient) => (
              <li key={patient.id}>
                <PatientRow
                  patient={patient}
                  dues={patientDues(bills, patient.id)}
                  lastVisit={lastVisitByPatient.get(patient.id) ?? ""}
                  currency={currency}
                  onOpen={() => setSelectedId(patient.id)}
                />
              </li>
            ))}
          </ul>
          {visibleCount < filtered.length && (
            <button
              type="button"
              onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
              className={`${secondaryBtnClass} w-full`}
            >
              Show more ({filtered.length - visibleCount} left)
            </button>
          )}
        </>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Register patient" wide>
        <PatientForm
          onSaved={(patient) => {
            setAddOpen(false);
            setSelectedId(patient.id);
          }}
          onCancel={() => setAddOpen(false)}
        />
      </Modal>

      <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Import patients" wide>
        <ImportPatients
          onDone={(count) => {
            setImportOpen(false);
            setNotice(`Imported ${count} ${count === 1 ? "patient" : "patients"}.`);
          }}
        />
      </Modal>
    </div>
  );
}

function PatientRow({
  patient,
  dues,
  lastVisit,
  currency,
  onOpen,
}: {
  patient: Patient;
  dues: number;
  lastVisit: string;
  currency: string;
  onOpen: () => void;
}) {
  const conditions = patientConditions(patient);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-xl border border-muted-line/30 bg-white px-3 py-2.5 text-left transition hover:border-indigo/40"
    >
      {patient.photoDataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={patient.photoDataUrl} alt="" className="h-9 w-9 rounded-lg object-cover" />
      ) : (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cream text-xs font-bold text-indigo">
          {patient.name.charAt(0).toUpperCase()}
        </span>
      )}

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink">{patient.name}</span>
        <span className="block truncate text-xs text-muted">
          {[patient.code, formatAgeSex(patient), patient.phone].filter(Boolean).join(" · ")}
        </span>
      </span>

      <span className="shrink-0 text-right">
        {dues > 0 && (
          <span className="block text-xs font-semibold text-red-600">
            {formatCurrency(dues, currency)}
          </span>
        )}
        {lastVisit && (
          <span className="block text-[11px] text-muted">{formatDate(lastVisit)}</span>
        )}
        {conditions.length > 0 && (
          <span className="block text-[11px] text-saffron">{conditions[0]}</span>
        )}
      </span>
    </button>
  );
}
