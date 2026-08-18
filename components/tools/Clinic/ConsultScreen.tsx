"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookmarkPlus,
  CheckCircle2,
  Eye,
  FileText,
  FlaskConical,
  Layers,
  MessageCircle,
  Printer,
  Receipt,
  Stethoscope,
} from "lucide-react";
import { useClinic, newRxLine, useHistorySuggestions } from "@/lib/clinic/store";
import {
  buildPrescriptionHtml,
  printInvestigationSlip,
  printPrescription,
} from "@/lib/clinic/print";
import { whatsAppLink } from "@/lib/clinic/messages";
import { computeBmi, formatAgeSex, parseBp } from "@/lib/clinic/calc";
import {
  EMPTY_VITALS,
  addDays,
  formatDate,
  patientAllergies,
  patientConditions,
  visitVitals,
  type Protocol,
  type RxLine,
  type Visit,
  type Vitals,
} from "@/lib/clinic/types";
import {
  EmptyState,
  Modal,
  SearchInput,
  inputClass,
  primaryBtnClass,
  secondaryBtnClass,
} from "@/components/tools/FreePos/ui";
import type { NavigateFn } from "./nav";
import { MedicinePicker } from "./MedicinePicker";
import { RxLineRow } from "./RxLineRow";

type QueryRequest = { screen: string; value: string; nonce: number };

/** Textarea that offers what this clinic has typed before, ranked by frequency. */
function SuggestField({
  label,
  field,
  value,
  onChange,
  onBlur,
  rows = 2,
}: {
  label: string;
  field: "complaints" | "findings" | "diagnosis" | "advice";
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  rows?: number;
}) {
  const [focused, setFocused] = useState(false);
  const suggestions = useHistorySuggestions(field, value);
  const showSuggestions = focused && suggestions.length > 0 && suggestions[0] !== value.trim();

  return (
    <div className="relative">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </span>
      <textarea
        value={value}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          // Let a suggestion click land before the list unmounts.
          window.setTimeout(() => setFocused(false), 150);
          onBlur();
        }}
        className={`${inputClass} resize-y`}
      />
      {showSuggestions && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-muted-line/40 bg-white shadow-lg">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(suggestion);
                setFocused(false);
              }}
              className="block w-full truncate border-b border-muted-line/20 px-3 py-2 text-left text-sm text-ink transition last:border-b-0 hover:bg-cream"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ConsultScreen({
  onNavigate,
  visitRequest,
}: {
  onNavigate: NavigateFn;
  visitRequest: QueryRequest | null;
}) {
  const {
    visits,
    patients,
    doctors,
    protocols,
    business,
    settings,
    activeDoctor,
    saveVisit,
    finaliseVisit,
    saveProtocol,
    useProtocol,
    addMedicine,
    bookAppointment,
  } = useClinic();

  const [visitId, setVisitId] = useState("");
  useEffect(() => {
    if (visitRequest?.value) setVisitId(visitRequest.value);
  }, [visitRequest]);

  const visit = useMemo(() => visits.find((v) => v.id === visitId) ?? null, [visits, visitId]);
  const patient = useMemo(
    () => (visit ? patients.find((p) => p.id === visit.patientId) ?? null : null),
    [visit, patients]
  );
  const doctor = useMemo(
    () => (visit ? doctors.find((d) => d.id === visit.doctorId) ?? activeDoctor : activeDoctor),
    [visit, doctors, activeDoctor]
  );

  // Local draft state. Written back on blur so a closed tab never loses work,
  // rather than on every keystroke, which would thrash IndexedDB.
  const [vitals, setVitals] = useState<Vitals>({ ...EMPTY_VITALS });
  const [complaints, setComplaints] = useState("");
  const [findings, setFindings] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [advice, setAdvice] = useState("");
  const [investigations, setInvestigations] = useState("");
  const [medicines, setMedicines] = useState<RxLine[]>([]);
  const [followUpDays, setFollowUpDays] = useState("");
  const [internalNotes, setInternalNotes] = useState("");

  const loadedVisitRef = useRef("");
  useEffect(() => {
    if (!visit || loadedVisitRef.current === visit.id) return;
    loadedVisitRef.current = visit.id;
    setVitals(visitVitals(visit));
    setComplaints(visit.complaints);
    setFindings(visit.findings);
    setDiagnosis(visit.diagnosis);
    setAdvice(visit.advice);
    setInvestigations((visit.investigations ?? []).join("\n"));
    setMedicines(visit.medicines ?? []);
    setFollowUpDays(visit.followUpDays != null ? String(visit.followUpDays) : "");
    setInternalNotes(visit.internalNotes);
  }, [visit]);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [protocolOpen, setProtocolOpen] = useState(false);
  const [protocolQuery, setProtocolQuery] = useState("");
  const [saveProtocolOpen, setSaveProtocolOpen] = useState(false);
  const [protocolName, setProtocolName] = useState("");
  const [doneOpen, setDoneOpen] = useState(false);
  const [offerMedicine, setOfferMedicine] = useState<RxLine | null>(null);
  const [notice, setNotice] = useState("");

  /** Everything the pad currently holds, in Visit shape. */
  const draft = useMemo(
    () => ({
      vitals,
      complaints,
      findings,
      diagnosis,
      advice,
      investigations: investigations
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
      medicines,
      followUpDays: followUpDays ? Number(followUpDays) : null,
      internalNotes,
    }),
    [
      vitals,
      complaints,
      findings,
      diagnosis,
      advice,
      investigations,
      medicines,
      followUpDays,
      internalNotes,
    ]
  );

  const persist = () => {
    if (!visit) return;
    saveVisit(visit.id, draft);
  };

  // Medicine edits are structural rather than typed, so they are written
  // immediately instead of waiting for a blur that may never come.
  const updateMedicines = (next: RxLine[]) => {
    setMedicines(next);
    if (visit) saveVisit(visit.id, { ...draft, medicines: next });
  };

  const previewVisit: Visit | null = useMemo(
    () => (visit ? { ...visit, ...draft } : null),
    [visit, draft]
  );

  const previewHtml = useMemo(() => {
    if (!previewVisit || !patient) return "";
    return buildPrescriptionHtml({
      business,
      settings,
      doctor,
      patient,
      visit: previewVisit,
    });
  }, [previewVisit, patient, business, settings, doctor]);

  const setVital = (updates: Partial<Vitals>) => {
    setVitals((prev) => {
      const next = { ...prev, ...updates };
      const bp = parseBp(next.bp);
      next.bpSystolic = bp.systolic;
      next.bpDiastolic = bp.diastolic;
      next.bmi = computeBmi(next.weightKg, next.heightCm);
      return next;
    });
  };

  /** Last recorded value for each vital, shown as the placeholder. */
  const lastVitals = useMemo(() => {
    if (!visit) return null;
    const previous = visits
      .filter((v) => v.patientId === visit.patientId && v.id !== visit.id && v.finalisedAt)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    return previous ? visitVitals(previous) : null;
  }, [visits, visit]);

  const applyProtocol = async (protocol: Protocol) => {
    const loaded = (await useProtocol(protocol.id)) ?? protocol;
    setComplaints(loaded.complaints);
    setDiagnosis(loaded.diagnosis);
    setAdvice(loaded.advice);
    setInvestigations((loaded.investigations ?? []).join("\n"));
    // Fresh ids so editing one line here never mutates the saved protocol.
    const lines = (loaded.medicines ?? []).map((line) => ({ ...newRxLine(), ...line, id: newRxLine().id }));
    setMedicines(lines);
    setFollowUpDays(loaded.followUpDays != null ? String(loaded.followUpDays) : "");
    setProtocolOpen(false);
    if (visit) {
      saveVisit(visit.id, {
        complaints: loaded.complaints,
        diagnosis: loaded.diagnosis,
        advice: loaded.advice,
        investigations: loaded.investigations ?? [],
        medicines: lines,
        followUpDays: loaded.followUpDays,
      });
    }
  };

  const handleFinalise = async () => {
    if (!visit) return;
    await saveVisit(visit.id, draft);
    await finaliseVisit(visit.id);
    // Anything typed ad hoc is worth offering to the master list once.
    const adHoc = medicines.find((line) => !line.medicineId && line.name.trim());
    setOfferMedicine(adHoc ?? null);
    setDoneOpen(true);
  };

  const handleBookFollowUp = async () => {
    if (!visit || !patient || !draft.followUpDays) return;
    const date = addDays(visit.date, draft.followUpDays);
    await bookAppointment({
      patientId: patient.id,
      doctorId: visit.doctorId,
      date,
      startTime: settings.openTime,
      durationMinutes: settings.slotMinutes,
      reason: "Follow-up",
    });
    setNotice(`Follow-up booked for ${formatDate(date)}.`);
  };

  const shareOnWhatsApp = () => {
    if (!patient || !previewVisit) return;
    const lines = (previewVisit.medicines ?? [])
      .map(
        (line, index) =>
          `${index + 1}. ${[line.name, line.strength, line.frequency, line.durationDays ? `${line.durationDays} days` : ""]
            .filter(Boolean)
            .join(" ")}`
      )
      .join("\n");
    const message = [
      `Namaste ${patient.name},`,
      previewVisit.diagnosis ? `Diagnosis: ${previewVisit.diagnosis}` : "",
      lines ? `\nRx:\n${lines}` : "",
      previewVisit.advice ? `\nAdvice: ${previewVisit.advice}` : "",
      previewVisit.followUpDays ? `\nReview after ${previewVisit.followUpDays} days.` : "",
      `\n— ${business?.name ?? ""}`,
    ]
      .filter(Boolean)
      .join("\n");
    window.open(whatsAppLink(patient.phone, message), "_blank", "noopener");
  };

  if (!visit || !patient) {
    return (
      <EmptyState
        icon={<Stethoscope className="h-6 w-6" />}
        title="No consultation open"
        message="Start a consult from the Today queue, or from a patient's chart."
        action={
          <button type="button" onClick={() => onNavigate("today")} className={primaryBtnClass}>
            Go to Today
          </button>
        }
      />
    );
  }

  const allergies = patientAllergies(patient);
  const conditions = patientConditions(patient);
  const lastVisit = visits
    .filter((v) => v.patientId === patient.id && v.id !== visit.id && v.finalisedAt)
    .sort((a, b) => b.date.localeCompare(a.date))[0];

  const visibleProtocols = protocols
    .filter((p) => !p.doctorId || p.doctorId === visit.doctorId)
    .filter((p) => p.name.toLowerCase().includes(protocolQuery.trim().toLowerCase()));

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
      <div className="space-y-4">
        {/* 1. Patient strip */}
        <div className="rounded-2xl border border-muted-line/30 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-base font-bold text-ink">{patient.name}</h3>
              <p className="truncate text-xs text-muted">
                {[patient.code, formatAgeSex(patient), patient.phone].filter(Boolean).join(" · ")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onNavigate("patients", patient.id)}
                className={secondaryBtnClass}
              >
                Full chart
              </button>
              <button
                type="button"
                onClick={() => setProtocolOpen(true)}
                className={secondaryBtnClass}
              >
                <Layers className="h-4 w-4" />
                Load protocol
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

          {lastVisit && (
            <p className="mt-2 text-xs text-muted">
              Last visit {formatDate(lastVisit.date)}
              {lastVisit.diagnosis ? ` — ${lastVisit.diagnosis}` : ""}
            </p>
          )}
          {visit.finalisedAt && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
              <CheckCircle2 className="h-3 w-3" />
              Finalised {formatDate(visit.date)}
              {visit.editedAfterFinaliseAt ? " · edited" : ""}
            </p>
          )}
        </div>

        {/* 2. Vitals */}
        <section className="rounded-2xl border border-muted-line/30 bg-white p-4">
          <h4 className="text-sm font-bold text-ink">Vitals</h4>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase text-muted">BP</span>
              <input
                type="text"
                value={vitals.bp}
                onChange={(event) => setVital({ bp: event.target.value })}
                onBlur={persist}
                placeholder={lastVitals?.bp || "120/80"}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase text-muted">
                Pulse
              </span>
              <input
                type="number"
                inputMode="numeric"
                value={vitals.pulse ?? ""}
                onChange={(event) =>
                  setVital({ pulse: event.target.value ? Number(event.target.value) : null })
                }
                onBlur={persist}
                placeholder={lastVitals?.pulse ? String(lastVitals.pulse) : "/min"}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase text-muted">
                Temp °F
              </span>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                value={vitals.tempF ?? ""}
                onChange={(event) =>
                  setVital({ tempF: event.target.value ? Number(event.target.value) : null })
                }
                onBlur={persist}
                placeholder={lastVitals?.tempF ? String(lastVitals.tempF) : "98.6"}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase text-muted">
                SpO₂ %
              </span>
              <input
                type="number"
                inputMode="numeric"
                value={vitals.spo2 ?? ""}
                onChange={(event) =>
                  setVital({ spo2: event.target.value ? Number(event.target.value) : null })
                }
                onBlur={persist}
                placeholder={lastVitals?.spo2 ? String(lastVitals.spo2) : "98"}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase text-muted">
                Weight kg
              </span>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                value={vitals.weightKg ?? ""}
                onChange={(event) =>
                  setVital({ weightKg: event.target.value ? Number(event.target.value) : null })
                }
                onBlur={persist}
                placeholder={lastVitals?.weightKg ? String(lastVitals.weightKg) : ""}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase text-muted">
                Height cm
              </span>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                value={vitals.heightCm ?? ""}
                onChange={(event) =>
                  setVital({ heightCm: event.target.value ? Number(event.target.value) : null })
                }
                onBlur={persist}
                placeholder={lastVitals?.heightCm ? String(lastVitals.heightCm) : ""}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase text-muted">
                BMI
              </span>
              <input
                type="text"
                value={vitals.bmi ?? ""}
                readOnly
                placeholder="—"
                className={`${inputClass} bg-cream/60`}
              />
            </label>
          </div>
        </section>

        {/* 3. The narrative */}
        <section className="space-y-3 rounded-2xl border border-muted-line/30 bg-white p-4">
          <SuggestField
            label="Complaints"
            field="complaints"
            value={complaints}
            onChange={setComplaints}
            onBlur={persist}
          />
          <SuggestField
            label="Findings"
            field="findings"
            value={findings}
            onChange={setFindings}
            onBlur={persist}
          />
          <SuggestField
            label="Diagnosis"
            field="diagnosis"
            value={diagnosis}
            onChange={setDiagnosis}
            onBlur={persist}
          />
          <SuggestField
            label="Advice"
            field="advice"
            value={advice}
            onChange={setAdvice}
            onBlur={persist}
          />
        </section>

        {/* 4. Medicines */}
        <section className="rounded-2xl border border-muted-line/30 bg-white p-4">
          <h4 className="text-sm font-bold text-ink">Medicines</h4>
          <div className="mt-3">
            <MedicinePicker onPick={(line) => updateMedicines([...medicines, line])} />
          </div>
          {medicines.length > 0 && (
            <ul className="mt-3 space-y-2">
              {medicines.map((line, index) => (
                <RxLineRow
                  key={line.id}
                  line={line}
                  index={index}
                  total={medicines.length}
                  onChange={(next) =>
                    updateMedicines(medicines.map((item, i) => (i === index ? next : item)))
                  }
                  onRemove={() =>
                    updateMedicines(medicines.filter((_, i) => i !== index))
                  }
                  onMove={(direction) => {
                    const target = index + direction;
                    if (target < 0 || target >= medicines.length) return;
                    const next = [...medicines];
                    [next[index], next[target]] = [next[target], next[index]];
                    updateMedicines(next);
                  }}
                />
              ))}
            </ul>
          )}
        </section>

        {/* 5 & 6. Investigations and follow-up */}
        <section className="grid gap-4 rounded-2xl border border-muted-line/30 bg-white p-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
              Investigations
            </span>
            <textarea
              value={investigations}
              onChange={(event) => setInvestigations(event.target.value)}
              onBlur={persist}
              rows={3}
              placeholder="One per line — CBC&#10;Fasting blood sugar"
              className={`${inputClass} resize-y`}
            />
          </label>
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
                Review after (days)
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={followUpDays}
                onChange={(event) => setFollowUpDays(event.target.value)}
                onBlur={persist}
                placeholder="e.g. 5"
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
                Internal notes
              </span>
              <textarea
                value={internalNotes}
                onChange={(event) => setInternalNotes(event.target.value)}
                onBlur={persist}
                rows={2}
                placeholder="Not printed"
                className={`${inputClass} resize-y`}
              />
            </label>
          </div>
        </section>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={handleFinalise} className={primaryBtnClass}>
            <CheckCircle2 className="h-4 w-4" />
            {visit.finalisedAt ? "Save & reprint" : "Finalise"}
          </button>
          <button
            type="button"
            onClick={() => {
              setProtocolName(diagnosis.trim());
              setSaveProtocolOpen(true);
            }}
            className={secondaryBtnClass}
          >
            <BookmarkPlus className="h-4 w-4" />
            Save as protocol
          </button>
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className={`${secondaryBtnClass} lg:hidden`}
          >
            <Eye className="h-4 w-4" />
            Preview
          </button>
        </div>

        {notice && <p className="text-sm font-semibold text-emerald-700">{notice}</p>}
      </div>

      {/* Live preview — what the printer will be handed. */}
      <aside className="hidden lg:block">
        <div className="sticky top-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Prescription preview · {settings.rxPaperSize.toUpperCase()}
          </p>
          <div className="max-h-[75vh] overflow-y-auto rounded-2xl border border-muted-line/30 bg-white p-5 shadow-sm">
            <div className="rx" dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </div>
        </div>
      </aside>

      <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} title="Prescription preview" wide>
        <div className="rx" dangerouslySetInnerHTML={{ __html: previewHtml }} />
      </Modal>

      {/* Load protocol */}
      <Modal open={protocolOpen} onClose={() => setProtocolOpen(false)} title="Load a protocol">
        <SearchInput
          value={protocolQuery}
          onChange={setProtocolQuery}
          placeholder="Search protocols…"
          autoFocus
        />
        {visibleProtocols.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            No saved protocols yet. Write a prescription, then “Save as protocol” to reuse it in
            one tap.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {visibleProtocols.map((protocol) => (
              <li key={protocol.id}>
                <button
                  type="button"
                  onClick={() => applyProtocol(protocol)}
                  className="w-full rounded-xl border border-muted-line/30 bg-white px-3 py-2.5 text-left transition hover:border-indigo/40"
                >
                  <span className="block text-sm font-semibold text-ink">{protocol.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {(protocol.medicines ?? []).map((line) => line.name).join(", ") ||
                      "No medicines"}
                    {protocol.timesUsed ? ` · used ${protocol.timesUsed}×` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      {/* Save protocol */}
      <Modal
        open={saveProtocolOpen}
        onClose={() => setSaveProtocolOpen(false)}
        title="Save as protocol"
      >
        <p className="text-sm text-muted">
          Saves the complaints, diagnosis, advice, investigations, medicines and follow-up as a
          template you can load in one tap.
        </p>
        <label className="mt-4 block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
            Name
          </span>
          <input
            type="text"
            value={protocolName}
            onChange={(event) => setProtocolName(event.target.value)}
            placeholder="e.g. Viral fever – adult"
            className={inputClass}
            autoFocus
          />
        </label>
        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setSaveProtocolOpen(false)}
            className={secondaryBtnClass}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!protocolName.trim()}
            onClick={async () => {
              await saveProtocol({
                name: protocolName.trim(),
                doctorId: visit.doctorId,
                complaints,
                diagnosis,
                advice,
                investigations: draft.investigations,
                medicines,
                followUpDays: draft.followUpDays,
              });
              setSaveProtocolOpen(false);
              setNotice(`Saved “${protocolName.trim()}” as a protocol.`);
            }}
            className={primaryBtnClass}
          >
            Save protocol
          </button>
        </div>
      </Modal>

      {/* After finalise */}
      <Modal open={doneOpen} onClose={() => setDoneOpen(false)} title="Consultation finalised">
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() =>
              patient &&
              previewVisit &&
              printPrescription({ business, settings, doctor, patient, visit: previewVisit })
            }
            className={primaryBtnClass}
          >
            <Printer className="h-4 w-4" />
            Print prescription
          </button>
          <button type="button" onClick={shareOnWhatsApp} className={secondaryBtnClass}>
            <MessageCircle className="h-4 w-4" />
            Share on WhatsApp
          </button>
          {draft.investigations.length > 0 && (
            <button
              type="button"
              onClick={() =>
                patient &&
                previewVisit &&
                printInvestigationSlip({
                  business,
                  settings,
                  doctor,
                  patient,
                  visit: previewVisit,
                })
              }
              className={secondaryBtnClass}
            >
              <FlaskConical className="h-4 w-4" />
              Investigation slip
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setDoneOpen(false);
              onNavigate("billing", visit.id);
            }}
            className={secondaryBtnClass}
          >
            <Receipt className="h-4 w-4" />
            Add bill
          </button>
          {draft.followUpDays ? (
            <button
              type="button"
              onClick={async () => {
                await handleBookFollowUp();
                setDoneOpen(false);
              }}
              className={secondaryBtnClass}
            >
              <FileText className="h-4 w-4" />
              Book follow-up
            </button>
          ) : null}
        </div>

        {offerMedicine && (
          <div className="mt-5 rounded-xl border border-muted-line/30 bg-cream/50 p-3">
            <p className="text-sm text-ink">
              <b>{offerMedicine.name}</b> is not in your medicine list. Add it so it comes up next
              time?
            </p>
            <button
              type="button"
              onClick={async () => {
                await addMedicine({
                  name: offerMedicine.name,
                  strength: offerMedicine.strength,
                  form: offerMedicine.form,
                  composition: "",
                  defaultFrequency: offerMedicine.frequency,
                  defaultDurationDays: offerMedicine.durationDays,
                  defaultTiming: offerMedicine.timing,
                });
                setOfferMedicine(null);
              }}
              className={`${secondaryBtnClass} mt-2`}
            >
              Add to my medicines
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
