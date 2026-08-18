"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Download,
  MessageCircle,
  Pencil,
  Phone,
  Play,
  Receipt,
  Users,
} from "lucide-react";
import { useClinic } from "@/lib/clinic/store";
import { billDue, formatAgeSex, patientDues } from "@/lib/clinic/calc";
import { printChart } from "@/lib/clinic/print";
import { whatsAppLink } from "@/lib/clinic/messages";
import {
  FORM_SHORT,
  formatDate,
  patientAllergies,
  patientConditions,
  patientCustomFields,
  visitMedicines,
  visitVitals,
  whatsAppNumber,
  type Patient,
} from "@/lib/clinic/types";
import { formatCurrency } from "@/lib/format";
import { Modal, primaryBtnClass, secondaryBtnClass } from "@/components/tools/FreePos/ui";
import type { NavigateFn } from "./nav";
import { PatientForm } from "./PatientForm";
import { VitalsTrend } from "./VitalsTrend";

type Tab = "visits" | "bills" | "vitals" | "details";

export function PatientChart({
  patient,
  onNavigate,
  onClose,
}: {
  patient: Patient;
  onNavigate: NavigateFn;
  onClose: () => void;
}) {
  const {
    visits,
    bills,
    doctors,
    patients,
    business,
    settings,
    activeDoctor,
    startConsultForPatient,
  } = useClinic();

  const [tab, setTab] = useState<Tab>("visits");
  const [expanded, setExpanded] = useState<string>("");
  const [editOpen, setEditOpen] = useState(false);

  const patientVisits = useMemo(
    () =>
      visits
        .filter((v) => v.patientId === patient.id)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [visits, patient.id]
  );
  const patientBills = useMemo(
    () =>
      bills
        .filter((b) => b.patientId === patient.id)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [bills, patient.id]
  );
  const family = useMemo(
    () =>
      patient.familyId
        ? patients.filter((p) => p.familyId === patient.familyId && p.id !== patient.id)
        : [],
    [patients, patient]
  );

  const doctorName = (id: string) => doctors.find((d) => d.id === id)?.name ?? "";
  const currency = business?.currency ?? "INR";
  const dues = patientDues(bills, patient.id);
  const allergies = patientAllergies(patient);
  const conditions = patientConditions(patient);

  const startConsult = async () => {
    if (!activeDoctor) return;
    const visit = await startConsultForPatient(patient.id, activeDoctor.id);
    onNavigate("consult", visit.id);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-muted-line/30 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {patient.photoDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={patient.photoDataUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
            ) : null}
            <div className="min-w-0">
              <h3 className="truncate text-lg font-bold text-ink">{patient.name}</h3>
              <p className="truncate text-xs text-muted">
                {[patient.code, formatAgeSex(patient), patient.bloodGroup]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {patient.phone && (
              <>
                <a
                  href={`tel:${patient.phone}`}
                  className={secondaryBtnClass}
                  aria-label="Call patient"
                >
                  <Phone className="h-4 w-4" />
                  Call
                </a>
                <a
                  href={whatsAppLink(patient.phone, "")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={secondaryBtnClass}
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </a>
              </>
            )}
            <button type="button" onClick={startConsult} className={primaryBtnClass}>
              <Play className="h-4 w-4" />
              Start consult
            </button>
          </div>
        </div>

        {(allergies.length > 0 || conditions.length > 0) && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
            {allergies.length > 0 && <div>Allergies: {allergies.join(", ")}</div>}
            {conditions.length > 0 && (
              <div className="font-normal">Chronic: {conditions.join(", ")}</div>
            )}
          </div>
        )}

        {dues > 0 && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-saffron/20 px-3 py-1 text-xs font-semibold text-ink">
            {formatCurrency(dues, currency)} outstanding
          </p>
        )}

        {family.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted">
              <Users className="h-3.5 w-3.5" />
              Family
            </span>
            {family.map((member) => (
              <button
                key={member.id}
                type="button"
                onClick={() => onNavigate("patients", member.id)}
                className="rounded-full border border-muted-line/40 bg-white px-3 py-1 text-xs font-semibold text-ink transition hover:border-indigo/40 hover:text-indigo"
              >
                {member.name}
              </button>
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => setEditOpen(true)} className={secondaryBtnClass}>
            <Pencil className="h-4 w-4" />
            Edit
          </button>
          <button
            type="button"
            onClick={() => onNavigate("billing", patient.id)}
            className={secondaryBtnClass}
          >
            <Receipt className="h-4 w-4" />
            Add bill
          </button>
          <button
            type="button"
            onClick={() => printChart(business, settings, patient, patientVisits, doctors)}
            className={secondaryBtnClass}
          >
            <Download className="h-4 w-4" />
            Export chart
          </button>
          <button type="button" onClick={onClose} className={secondaryBtnClass}>
            Back to list
          </button>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto">
        {(
          [
            ["visits", `Visits (${patientVisits.length})`],
            ["bills", `Bills (${patientBills.length})`],
            ["vitals", "Vitals trend"],
            ["details", "Details"],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
              tab === id ? "bg-indigo text-white" : "text-muted hover:bg-white hover:text-indigo"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "visits" && (
        <div className="space-y-2">
          {patientVisits.length === 0 && (
            <p className="text-sm text-muted">No consultations recorded yet.</p>
          )}
          {patientVisits.map((visit) => {
            const open = expanded === visit.id;
            const vitals = visitVitals(visit);
            const meds = visitMedicines(visit);
            return (
              <div
                key={visit.id}
                className="overflow-hidden rounded-xl border border-muted-line/30 bg-white"
              >
                <button
                  type="button"
                  onClick={() => setExpanded(open ? "" : visit.id)}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition hover:bg-cream"
                >
                  {open ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">
                      {formatDate(visit.date)}
                      {!visit.finalisedAt && (
                        <span className="ml-2 rounded-full bg-saffron/20 px-2 py-0.5 text-[10px] font-semibold">
                          Draft
                        </span>
                      )}
                      {visit.editedAfterFinaliseAt && (
                        <span className="ml-2 rounded-full bg-muted-line/20 px-2 py-0.5 text-[10px] font-semibold text-muted">
                          Edited
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {[visit.diagnosis || "No diagnosis recorded", doctorName(visit.doctorId)]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                </button>

                {open && (
                  <div className="space-y-2 border-t border-muted-line/20 px-3 py-3 text-sm">
                    {visit.complaints && (
                      <p>
                        <b className="text-muted">Complaints:</b> {visit.complaints}
                      </p>
                    )}
                    {visit.findings && (
                      <p>
                        <b className="text-muted">Findings:</b> {visit.findings}
                      </p>
                    )}
                    {(vitals.bp || vitals.weightKg || vitals.pulse) && (
                      <p className="text-xs text-muted">
                        {[
                          vitals.bp ? `BP ${vitals.bp}` : "",
                          vitals.pulse ? `Pulse ${vitals.pulse}` : "",
                          vitals.tempF ? `Temp ${vitals.tempF}°F` : "",
                          vitals.weightKg ? `Wt ${vitals.weightKg} kg` : "",
                          vitals.bmi ? `BMI ${vitals.bmi}` : "",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                    {meds.length > 0 && (
                      <ol className="list-decimal space-y-0.5 pl-5">
                        {meds.map((line) => (
                          <li key={line.id}>
                            {[FORM_SHORT[line.form], line.name, line.strength, line.frequency]
                              .filter(Boolean)
                              .join(" ")}
                            {line.durationDays ? ` × ${line.durationDays} days` : ""}
                          </li>
                        ))}
                      </ol>
                    )}
                    {visit.advice && (
                      <p>
                        <b className="text-muted">Advice:</b> {visit.advice}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => onNavigate("consult", visit.id)}
                      className={secondaryBtnClass}
                    >
                      Open &amp; print again
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === "bills" && (
        <div className="space-y-2">
          {patientBills.length === 0 && <p className="text-sm text-muted">No bills yet.</p>}
          {patientBills.map((bill) => (
            <div
              key={bill.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-muted-line/30 bg-white px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">{bill.receiptNo}</p>
                <p className="text-xs text-muted">
                  {formatDate(bill.date)} · {bill.paymentMode}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-ink">
                  {formatCurrency(bill.total, currency)}
                </p>
                {billDue(bill) > 0 && (
                  <p className="text-xs font-semibold text-red-600">
                    {formatCurrency(billDue(bill), currency)} due
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "vitals" && (
        <div className="rounded-2xl border border-muted-line/30 bg-white p-4">
          <VitalsTrend visits={patientVisits} />
        </div>
      )}

      {tab === "details" && (
        <div className="space-y-2 rounded-2xl border border-muted-line/30 bg-white p-4 text-sm">
          <Detail label="Phone" value={patient.phone} />
          <Detail label="Alternate phone" value={patient.altPhone} />
          <Detail label="Address" value={patient.address} />
          <Detail label="Registered" value={formatDate(patient.registeredOn)} />
          <Detail label="WhatsApp number" value={whatsAppNumber(patient.phone)} />
          {patientCustomFields(patient).map((field) => (
            <Detail key={field.id} label={field.label} value={field.value} />
          ))}
          <Detail label="Notes" value={patient.notes} />
        </div>
      )}

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit patient" wide>
        <PatientForm
          patient={patient}
          onSaved={() => setEditOpen(false)}
          onCancel={() => setEditOpen(false)}
        />
      </Modal>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <p className="flex flex-wrap gap-2">
      <span className="w-36 shrink-0 text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </span>
      <span className="min-w-0 flex-1 text-ink">{value}</span>
    </p>
  );
}
