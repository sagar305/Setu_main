"use client";

import { useRef, useState, type ReactNode } from "react";
import {
  Copy,
  Download,
  Lock,
  Plus,
  RefreshCw,
  Sheet,
  Trash2,
  Unlock,
  Upload,
} from "lucide-react";
import { generateId } from "@/lib/pos/types";
import { useClinic } from "@/lib/clinic/store";
import { parseBackupFile, backupSummary, type ClinicBackup } from "@/lib/clinic/backup";
import { APPS_SCRIPT_TEMPLATE } from "@/lib/clinic/sheetSync";
import { CLINIC_PLACEHOLDERS } from "@/lib/clinic/messages";
import { SEED_MEDICINE_COUNT } from "@/lib/clinic/medicines";
import {
  PIN_MAX_LENGTH,
  PIN_MIN_LENGTH,
  generateSalt,
  hashPin,
  isValidPinFormat,
  verifyPin,
} from "@/lib/pos/pin";
import { CURRENCIES } from "@/lib/pos/types";
import {
  DEFAULT_MESSAGE_TEMPLATES,
  DEFAULT_RX_FOOTER,
  MEDICINE_FORMS,
  formatDate,
  formatPatientCode,
  formatReceiptNumber,
  todayIso,
  type ClinicSettings,
  type ClinicTemplateKey,
  type Doctor,
  type MedicineForm,
  type ReceiptPaperSize,
  type RxPaperSize,
  type SlotMinutes,
} from "@/lib/clinic/types";
import {
  ConfirmDialog,
  Field,
  Modal,
  SearchInput,
  dangerBtnClass,
  inputClass,
  primaryBtnClass,
  secondaryBtnClass,
} from "@/components/tools/FreePos/ui";
import { SignaturePad } from "./SignaturePad";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-muted-line/30 bg-white p-5">
      <h3 className="text-base font-bold text-ink">{title}</h3>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function SavedFlash({ show }: { show: boolean }) {
  if (!show) return null;
  return <span className="text-sm font-semibold text-emerald-600">Saved ✓</span>;
}

export function SettingsScreen({ onLockNow }: { onLockNow?: () => void }) {
  const {
    business,
    settings,
    doctors,
    medicines,
    protocols,
    charges,
    patients,
    updateBusiness,
    updateSettings,
    createDoctor,
    updateDoctor,
    deleteDoctor,
    saveMedicine,
    addMedicine,
    deleteMedicine,
    seedMedicines,
    deleteProtocol,
    saveCharge,
    deleteCharge,
    sheetSync,
    connectSheet,
    disconnectSheet,
    syncSheetNow,
    resyncSheetAll,
    exportBackup,
    applyRestoredBackup,
    resetAll,
  } = useClinic();

  const [flash, setFlash] = useState("");
  const showFlash = (key: string) => {
    setFlash(key);
    window.setTimeout(() => setFlash(""), 2000);
  };

  const patch = async (updates: Partial<Omit<ClinicSettings, "id">>, key: string) => {
    await updateSettings(updates);
    showFlash(key);
  };

  return (
    <div className="space-y-4">
      <ClinicDetails
        business={business}
        onSave={async (updates) => {
          await updateBusiness(updates);
          showFlash("clinic");
        }}
        flash={flash === "clinic"}
      />

      <DoctorsSection
        doctors={doctors}
        onCreate={createDoctor}
        onUpdate={updateDoctor}
        onDelete={deleteDoctor}
      />

      <ScheduleSection settings={settings} onPatch={patch} flash={flash} />

      <Section
        title="Prescription"
        description="How the printed prescription looks. Turn the header off if you print onto a pre-printed letterhead pad."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Paper size">
            <select
              value={settings.rxPaperSize}
              onChange={(event) =>
                patch({ rxPaperSize: event.target.value as RxPaperSize }, "rx")
              }
              className={inputClass}
            >
              <option value="a4">A4 — what most home printers hold</option>
              <option value="a5">A5 — the usual prescription pad size</option>
            </select>
          </Field>
          <Field label="Footer text" hint="Prints small at the foot of every prescription.">
            <input
              type="text"
              value={settings.rxFooterText}
              onChange={(event) => updateSettings({ rxFooterText: event.target.value })}
              onBlur={() => showFlash("rx")}
              className={inputClass}
            />
          </Field>
        </div>

        <div className="mt-4 space-y-2">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={settings.printClinicHeader}
              onChange={(event) => patch({ printClinicHeader: event.target.checked }, "rx")}
              className="h-4 w-4 rounded border-muted-line/50"
            />
            Print the clinic and doctor header
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={settings.showVitalsOnRx}
              onChange={(event) => patch({ showVitalsOnRx: event.target.checked }, "rx")}
              className="h-4 w-4 rounded border-muted-line/50"
            />
            Show the vitals row on the prescription
          </label>
          <button
            type="button"
            onClick={() => patch({ rxFooterText: DEFAULT_RX_FOOTER }, "rx")}
            className="text-xs font-semibold text-indigo underline"
          >
            Reset footer to the default wording
          </button>
        </div>
        <div className="mt-3">
          <SavedFlash show={flash === "rx"} />
        </div>
      </Section>

      <ChargesSection charges={charges} onSave={saveCharge} onDelete={deleteCharge} />

      <MedicinesSection
        medicines={medicines}
        onSave={saveMedicine}
        onAdd={addMedicine}
        onDelete={deleteMedicine}
        onSeed={seedMedicines}
      />

      <Section
        title="Protocols"
        description="Saved prescriptions you can load in one tap. Create them from the Consult screen."
      >
        {protocols.length === 0 ? (
          <p className="text-sm text-muted">
            No protocols yet. Write a prescription, then “Save as protocol”.
          </p>
        ) : (
          <ul className="space-y-2">
            {protocols.map((protocol) => (
              <li
                key={protocol.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-muted-line/30 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{protocol.name}</p>
                  <p className="truncate text-xs text-muted">
                    {(protocol.medicines ?? []).map((line) => line.name).join(", ") || "No medicines"}
                    {protocol.timesUsed ? ` · used ${protocol.timesUsed}×` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteProtocol(protocol.id)}
                  aria-label={`Delete ${protocol.name}`}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <BillingSection
        settings={settings}
        patientCount={patients.length}
        onPatch={patch}
        flash={flash}
      />

      <TemplatesSection settings={settings} onPatch={patch} flash={flash} />

      <SheetSyncSection
        settings={settings}
        sheetSync={sheetSync}
        onConnect={connectSheet}
        onDisconnect={disconnectSheet}
        onSyncNow={syncSheetNow}
        onResyncAll={resyncSheetAll}
      />

      <BackupSection
        settings={settings}
        onExport={exportBackup}
        onRestore={applyRestoredBackup}
      />

      <ScreenLockSection settings={settings} onPatch={patch} onLockNow={onLockNow} />

      <ResetSection onReset={resetAll} />
    </div>
  );
}

// ---------------------------------------------------------------------------

function ClinicDetails({
  business,
  onSave,
  flash,
}: {
  business: ReturnType<typeof useClinic>["business"];
  onSave: (updates: Record<string, string>) => Promise<void>;
  flash: boolean;
}) {
  if (!business) return null;
  return (
    <Section
      title="Clinic details"
      description="These print on prescriptions and receipts, and fill the messages you send patients."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Clinic name">
          <input
            type="text"
            defaultValue={business.name}
            onBlur={(event) => onSave({ name: event.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="Phone">
          <input
            type="tel"
            defaultValue={business.phone}
            onBlur={(event) => onSave({ phone: event.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="Address">
          <input
            type="text"
            defaultValue={business.address}
            onBlur={(event) => onSave({ address: event.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="UPI ID" hint="Adds a payment QR to receipts.">
          <input
            type="text"
            defaultValue={business.upiId ?? ""}
            onBlur={(event) => onSave({ upiId: event.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="Currency">
          <select
            defaultValue={business.currency}
            onChange={(event) => onSave({ currency: event.target.value })}
            className={inputClass}
          >
            {CURRENCIES.map((item) => (
              <option key={item.code} value={item.code}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="mt-3">
        <SavedFlash show={flash} />
      </div>
    </Section>
  );
}

function DoctorsSection({
  doctors,
  onCreate,
  onUpdate,
  onDelete,
}: {
  doctors: Doctor[];
  onCreate: ReturnType<typeof useClinic>["createDoctor"];
  onUpdate: ReturnType<typeof useClinic>["updateDoctor"];
  onDelete: ReturnType<typeof useClinic>["deleteDoctor"];
}) {
  const [editing, setEditing] = useState<Doctor | null>(null);
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<Doctor | null>(null);

  return (
    <Section
      title="Doctors"
      description="Name, qualification, registration number and signature print on every prescription."
    >
      <ul className="space-y-2">
        {doctors.map((doctor) => (
          <li
            key={doctor.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-muted-line/30 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">
                {doctor.name}
                {!doctor.active && (
                  <span className="ml-2 rounded-full bg-muted-line/20 px-2 py-0.5 text-[10px] font-semibold text-muted">
                    Inactive
                  </span>
                )}
              </p>
              <p className="truncate text-xs text-muted">
                {[doctor.qualifications, doctor.registrationNo].filter(Boolean).join(" · ")}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                onClick={() => setEditing(doctor)}
                className={secondaryBtnClass}
              >
                Edit
              </button>
              {doctors.length > 1 && (
                <button
                  type="button"
                  onClick={() => setRemoving(doctor)}
                  aria-label={`Remove ${doctor.name}`}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {doctors.length >= 1 && (
        <div className="mt-4 rounded-xl border border-indigo/20 bg-indigo/5 p-3">
          <p className="text-sm text-ink">
            <b>More than one doctor?</b> The free app manages a single doctor&apos;s list. Multi-doctor
            columns, per-doctor queues and split revenue are part of{" "}
            <a href="/products/clinic" className="font-semibold text-indigo underline">
              Setu Clinic
            </a>
            .
          </p>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className={`${secondaryBtnClass} mt-2`}
          >
            <Plus className="h-4 w-4" />
            Add another doctor anyway
          </button>
        </div>
      )}

      <Modal
        open={creating || Boolean(editing)}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        title={editing ? "Edit doctor" : "Add doctor"}
        wide
      >
        <DoctorForm
          doctor={editing ?? undefined}
          onSubmit={async (input) => {
            if (editing) await onUpdate(editing.id, input);
            else await onCreate(input);
            setCreating(false);
            setEditing(null);
          }}
          onCancel={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(removing)}
        title={`Remove ${removing?.name ?? ""}?`}
        message="Their past consultations and bills are kept. This only removes them from the doctor list."
        confirmLabel="Remove"
        onCancel={() => setRemoving(null)}
        onConfirm={async () => {
          if (removing) await onDelete(removing.id);
          setRemoving(null);
        }}
      />
    </Section>
  );
}

function DoctorForm({
  doctor,
  onSubmit,
  onCancel,
}: {
  doctor?: Doctor;
  onSubmit: (input: Omit<Doctor, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(doctor?.name ?? "");
  const [qualifications, setQualifications] = useState(doctor?.qualifications ?? "");
  const [registrationNo, setRegistrationNo] = useState(doctor?.registrationNo ?? "");
  const [speciality, setSpeciality] = useState(doctor?.speciality ?? "");
  const [consultationFee, setConsultationFee] = useState(String(doctor?.consultationFee ?? ""));
  const [followUpFee, setFollowUpFee] = useState(String(doctor?.followUpFee ?? ""));
  const [followUpFreeDays, setFollowUpFreeDays] = useState(
    String(doctor?.followUpFreeDays ?? 7)
  );
  const [signature, setSignature] = useState(doctor?.signatureDataUrl ?? "");
  const [active, setActive] = useState(doctor?.active ?? true);

  return (
    <div className="space-y-4">
      <Field label="Name" required>
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className={inputClass}
          autoFocus
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Qualifications">
          <input
            type="text"
            value={qualifications}
            onChange={(event) => setQualifications(event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Speciality">
          <input
            type="text"
            value={speciality}
            onChange={(event) => setSpeciality(event.target.value)}
            className={inputClass}
          />
        </Field>
      </div>
      <Field label="Medical council registration no.">
        <input
          type="text"
          value={registrationNo}
          onChange={(event) => setRegistrationNo(event.target.value)}
          className={inputClass}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Consultation fee">
          <input
            type="number"
            min={0}
            value={consultationFee}
            onChange={(event) => setConsultationFee(event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Follow-up fee" hint="0 = free">
          <input
            type="number"
            min={0}
            value={followUpFee}
            onChange={(event) => setFollowUpFee(event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Free within (days)" hint="0 = never">
          <input
            type="number"
            min={0}
            value={followUpFreeDays}
            onChange={(event) => setFollowUpFreeDays(event.target.value)}
            className={inputClass}
          />
        </Field>
      </div>

      <div>
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
          Signature
        </span>
        <SignaturePad value={signature} onChange={setSignature} />
      </div>

      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={active}
          onChange={(event) => setActive(event.target.checked)}
          className="h-4 w-4 rounded border-muted-line/50"
        />
        Currently seeing patients
      </label>

      <div className="flex justify-end gap-3">
        <button type="button" onClick={onCancel} className={secondaryBtnClass}>
          Cancel
        </button>
        <button
          type="button"
          disabled={!name.trim()}
          onClick={() =>
            onSubmit({
              name: name.trim(),
              qualifications: qualifications.trim(),
              registrationNo: registrationNo.trim(),
              speciality: speciality.trim(),
              consultationFee: Number(consultationFee) || 0,
              followUpFee: Number(followUpFee) || 0,
              followUpFreeDays: Number(followUpFreeDays) || 0,
              signatureDataUrl: signature,
              active,
            })
          }
          className={primaryBtnClass}
        >
          Save doctor
        </button>
      </div>
    </div>
  );
}

function ScheduleSection({
  settings,
  onPatch,
  flash,
}: {
  settings: ClinicSettings;
  onPatch: (updates: Partial<Omit<ClinicSettings, "id">>, key: string) => Promise<void>;
  flash: string;
}) {
  const [breakLabel, setBreakLabel] = useState("Lunch");
  const [breakStart, setBreakStart] = useState("13:00");
  const [breakEnd, setBreakEnd] = useState("14:00");
  const [holidayDate, setHolidayDate] = useState(todayIso());
  const [holidayReason, setHolidayReason] = useState("");

  return (
    <Section title="Schedule" description="Opening hours, slot length, breaks and closures.">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Opens">
          <input
            type="time"
            value={settings.openTime}
            onChange={(event) => onPatch({ openTime: event.target.value }, "schedule")}
            className={inputClass}
          />
        </Field>
        <Field label="Closes">
          <input
            type="time"
            value={settings.closeTime}
            onChange={(event) => onPatch({ closeTime: event.target.value }, "schedule")}
            className={inputClass}
          />
        </Field>
        <Field label="Slot length">
          <select
            value={settings.slotMinutes}
            onChange={(event) =>
              onPatch({ slotMinutes: Number(event.target.value) as SlotMinutes }, "schedule")
            }
            className={inputClass}
          >
            {[10, 15, 20, 30].map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes} minutes
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="mt-4">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
          Weekly off
        </span>
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAY_LABELS.map((label, index) => {
            const on = settings.weeklyOffDays.includes(index);
            return (
              <button
                key={label}
                type="button"
                onClick={() =>
                  onPatch(
                    {
                      weeklyOffDays: on
                        ? settings.weeklyOffDays.filter((day) => day !== index)
                        : [...settings.weeklyOffDays, index],
                    },
                    "schedule"
                  )
                }
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  on
                    ? "bg-indigo text-white"
                    : "border border-muted-line/40 bg-white text-muted hover:text-indigo"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
          Breaks
        </span>
        <ul className="space-y-1.5">
          {settings.breaks.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-muted-line/30 px-3 py-1.5 text-sm"
            >
              <span className="text-ink">
                {item.label} · {item.start}–{item.end}
              </span>
              <button
                type="button"
                onClick={() =>
                  onPatch(
                    { breaks: settings.breaks.filter((b) => b.id !== item.id) },
                    "schedule"
                  )
                }
                aria-label={`Remove ${item.label}`}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            type="text"
            value={breakLabel}
            onChange={(event) => setBreakLabel(event.target.value)}
            placeholder="Label"
            className={`${inputClass} w-32`}
          />
          <input
            type="time"
            value={breakStart}
            onChange={(event) => setBreakStart(event.target.value)}
            className={`${inputClass} w-32`}
          />
          <input
            type="time"
            value={breakEnd}
            onChange={(event) => setBreakEnd(event.target.value)}
            className={`${inputClass} w-32`}
          />
          <button
            type="button"
            onClick={() =>
              onPatch(
                {
                  breaks: [
                    ...settings.breaks,
                    {
                      id: generateId(),
                      label: breakLabel.trim() || "Break",
                      start: breakStart,
                      end: breakEnd,
                    },
                  ],
                },
                "schedule"
              )
            }
            className={secondaryBtnClass}
          >
            <Plus className="h-4 w-4" />
            Add break
          </button>
        </div>
      </div>

      <div className="mt-5">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
          Holidays
        </span>
        <ul className="space-y-1.5">
          {settings.holidays.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-muted-line/30 px-3 py-1.5 text-sm"
            >
              <span className="text-ink">
                {formatDate(item.date)}
                {item.reason ? ` · ${item.reason}` : ""}
              </span>
              <button
                type="button"
                onClick={() =>
                  onPatch(
                    { holidays: settings.holidays.filter((h) => h.id !== item.id) },
                    "schedule"
                  )
                }
                aria-label="Remove holiday"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            type="date"
            value={holidayDate}
            onChange={(event) => setHolidayDate(event.target.value)}
            className={`${inputClass} w-44`}
          />
          <input
            type="text"
            value={holidayReason}
            onChange={(event) => setHolidayReason(event.target.value)}
            placeholder="Reason"
            className={`${inputClass} w-44`}
          />
          <button
            type="button"
            onClick={() =>
              onPatch(
                {
                  holidays: [
                    ...settings.holidays,
                    { id: generateId(), date: holidayDate, reason: holidayReason.trim() },
                  ],
                },
                "schedule"
              )
            }
            className={secondaryBtnClass}
          >
            <Plus className="h-4 w-4" />
            Add holiday
          </button>
        </div>
      </div>

      <div className="mt-3">
        <SavedFlash show={flash === "schedule"} />
      </div>
    </Section>
  );
}

function ChargesSection({
  charges,
  onSave,
  onDelete,
}: {
  charges: ReturnType<typeof useClinic>["charges"];
  onSave: ReturnType<typeof useClinic>["saveCharge"];
  onDelete: ReturnType<typeof useClinic>["deleteCharge"];
}) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");

  return (
    <Section
      title="Charges"
      description="Procedures you bill for, so they are one tap on a bill instead of typing."
    >
      <ul className="space-y-1.5">
        {charges.map((charge) => (
          <li
            key={charge.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-muted-line/30 px-3 py-1.5 text-sm"
          >
            <span className="text-ink">
              {charge.name} · {charge.amount}
            </span>
            <button
              type="button"
              onClick={() => onDelete(charge.id)}
              aria-label={`Remove ${charge.name}`}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap gap-2">
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Dressing"
          className={`${inputClass} w-44`}
        />
        <input
          type="number"
          min={0}
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="Amount"
          className={`${inputClass} w-32`}
        />
        <button
          type="button"
          disabled={!name.trim()}
          onClick={async () => {
            await onSave({
              id: generateId(),
              name: name.trim(),
              amount: Number(amount) || 0,
              active: true,
            });
            setName("");
            setAmount("");
          }}
          className={secondaryBtnClass}
        >
          <Plus className="h-4 w-4" />
          Add charge
        </button>
      </div>
    </Section>
  );
}

function MedicinesSection({
  medicines,
  onSave,
  onAdd,
  onDelete,
  onSeed,
}: {
  medicines: ReturnType<typeof useClinic>["medicines"];
  onSave: ReturnType<typeof useClinic>["saveMedicine"];
  onAdd: ReturnType<typeof useClinic>["addMedicine"];
  onDelete: ReturnType<typeof useClinic>["deleteMedicine"];
  onSeed: ReturnType<typeof useClinic>["seedMedicines"];
}) {
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [strength, setStrength] = useState("");
  const [form, setForm] = useState<MedicineForm>("tablet");
  const [composition, setComposition] = useState("");
  const [seeding, setSeeding] = useState(false);
  const [notice, setNotice] = useState("");

  const needle = query.trim().toLowerCase();
  const visible = needle
    ? medicines.filter(
        (medicine) =>
          medicine.name.toLowerCase().includes(needle) ||
          medicine.composition.toLowerCase().includes(needle)
      )
    : medicines.slice(0, 25);

  return (
    <Section
      title="Medicines"
      description="Your prescribing list. Search matches the name and the salt."
    >
      <div className="rounded-xl border border-muted-line/30 bg-cream/40 p-3">
        <p className="text-sm text-ink">
          <b>Starter list.</b> {SEED_MEDICINE_COUNT} generics commonly stocked in Indian practice,
          with their salt and a usual strength. It carries <b>no doses</b> — you set those when you
          prescribe. Every row is yours to edit or delete.
        </p>
        <button
          type="button"
          disabled={seeding}
          onClick={async () => {
            setSeeding(true);
            try {
              const added = await onSeed();
              setNotice(
                added === 0
                  ? "Your list already has all of these."
                  : `Added ${added} medicines.`
              );
            } finally {
              setSeeding(false);
            }
          }}
          className={`${secondaryBtnClass} mt-2`}
        >
          {seeding ? "Adding…" : "Add starter list"}
        </button>
        {notice && <p className="mt-2 text-sm font-semibold text-emerald-700">{notice}</p>}
      </div>

      <div className="mt-4">
        <SearchInput value={query} onChange={setQuery} placeholder="Search your medicines…" />
      </div>

      <p className="mt-2 text-xs text-muted">
        {medicines.length} in your list{!needle && medicines.length > 25 ? " — showing 25" : ""}
      </p>

      <ul className="mt-2 max-h-72 space-y-1.5 overflow-y-auto">
        {visible.map((medicine) => (
          <li
            key={medicine.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-muted-line/30 px-3 py-1.5"
          >
            <div className="min-w-0">
              <p className="truncate text-sm text-ink">
                {[medicine.name, medicine.strength].filter(Boolean).join(" ")}
              </p>
              <p className="truncate text-xs text-muted">
                {[medicine.form, medicine.composition].filter(Boolean).join(" · ")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onDelete(medicine.id)}
              aria-label={`Remove ${medicine.name}`}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap gap-2">
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Medicine"
          className={`${inputClass} w-40`}
        />
        <input
          type="text"
          value={strength}
          onChange={(event) => setStrength(event.target.value)}
          placeholder="500 mg"
          className={`${inputClass} w-28`}
        />
        <select
          value={form}
          onChange={(event) => setForm(event.target.value as MedicineForm)}
          className={`${inputClass} w-32`}
        >
          {MEDICINE_FORMS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={composition}
          onChange={(event) => setComposition(event.target.value)}
          placeholder="Salt / composition"
          className={`${inputClass} w-44`}
        />
        <button
          type="button"
          disabled={!name.trim()}
          onClick={async () => {
            await onAdd({
              name: name.trim(),
              strength: strength.trim(),
              form,
              composition: composition.trim(),
              defaultFrequency: "",
              defaultDurationDays: null,
              defaultTiming: "",
            });
            setName("");
            setStrength("");
            setComposition("");
          }}
          className={secondaryBtnClass}
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </div>
    </Section>
  );
}

function BillingSection({
  settings,
  patientCount,
  onPatch,
  flash,
}: {
  settings: ClinicSettings;
  patientCount: number;
  onPatch: (updates: Partial<Omit<ClinicSettings, "id">>, key: string) => Promise<void>;
  flash: string;
}) {
  const [mode, setMode] = useState("");

  return (
    <Section title="Billing & numbering" description="Receipt numbers, patient file numbers and payment modes.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Patient file prefix"
          hint={`Next: ${formatPatientCode(settings.patientCodePrefix, settings.nextPatientSerial)}`}
        >
          <input
            type="text"
            value={settings.patientCodePrefix}
            onChange={(event) => onPatch({ patientCodePrefix: event.target.value }, "billing")}
            className={inputClass}
          />
        </Field>
        <Field
          label="Next file number"
          hint={patientCount > 0 ? "Numbers are never reused." : undefined}
        >
          <input
            type="number"
            min={1}
            value={settings.nextPatientSerial}
            onChange={(event) =>
              onPatch({ nextPatientSerial: Number(event.target.value) || 1 }, "billing")
            }
            className={inputClass}
          />
        </Field>
        <Field
          label="Receipt prefix"
          hint={`Next: ${formatReceiptNumber(settings.receiptPrefix, settings.nextReceiptNumber)}`}
        >
          <input
            type="text"
            value={settings.receiptPrefix}
            onChange={(event) => onPatch({ receiptPrefix: event.target.value }, "billing")}
            className={inputClass}
          />
        </Field>
        <Field label="Next receipt number">
          <input
            type="number"
            min={1}
            value={settings.nextReceiptNumber}
            onChange={(event) =>
              onPatch({ nextReceiptNumber: Number(event.target.value) || 1 }, "billing")
            }
            className={inputClass}
          />
        </Field>
        <Field label="Receipt paper">
          <select
            value={settings.receiptPaperSize}
            onChange={(event) =>
              onPatch({ receiptPaperSize: event.target.value as ReceiptPaperSize }, "billing")
            }
            className={inputClass}
          >
            <option value="58mm">58 mm thermal roll</option>
            <option value="80mm">80 mm thermal roll</option>
            <option value="a4">A4</option>
          </select>
        </Field>
      </div>

      <div className="mt-4">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
          Payment modes
        </span>
        <div className="flex flex-wrap gap-1.5">
          {settings.paymentModes.map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-1.5 rounded-full border border-muted-line/40 bg-white px-3 py-1.5 text-xs font-semibold text-ink"
            >
              {item}
              {settings.paymentModes.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    onPatch(
                      { paymentModes: settings.paymentModes.filter((m) => m !== item) },
                      "billing"
                    )
                  }
                  aria-label={`Remove ${item}`}
                  className="text-muted hover:text-red-600"
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={mode}
            onChange={(event) => setMode(event.target.value)}
            placeholder="e.g. Insurance"
            className={`${inputClass} w-44`}
          />
          <button
            type="button"
            disabled={!mode.trim()}
            onClick={async () => {
              await onPatch(
                { paymentModes: [...settings.paymentModes, mode.trim()] },
                "billing"
              );
              setMode("");
            }}
            className={secondaryBtnClass}
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>
      </div>

      <div className="mt-3">
        <SavedFlash show={flash === "billing"} />
      </div>
    </Section>
  );
}

const TEMPLATE_LABELS: Record<ClinicTemplateKey, string> = {
  appointmentConfirmed: "Appointment confirmed",
  appointmentReminder: "Appointment reminder",
  followUpDue: "Follow-up due",
  reportReady: "Reports ready",
  duesReminder: "Payment reminder",
};

function TemplatesSection({
  settings,
  onPatch,
  flash,
}: {
  settings: ClinicSettings;
  onPatch: (updates: Partial<Omit<ClinicSettings, "id">>, key: string) => Promise<void>;
  flash: string;
}) {
  return (
    <Section
      title="Message templates"
      description="The WhatsApp messages the app prepares for you. Nothing is ever sent automatically."
    >
      <div className="space-y-3">
        {(Object.keys(TEMPLATE_LABELS) as ClinicTemplateKey[]).map((key) => (
          <Field key={key} label={TEMPLATE_LABELS[key]}>
            <textarea
              rows={2}
              value={settings.messageTemplates[key]}
              onChange={(event) =>
                onPatch(
                  {
                    messageTemplates: {
                      ...settings.messageTemplates,
                      [key]: event.target.value,
                    },
                  },
                  "templates"
                )
              }
              className={`${inputClass} resize-y`}
            />
          </Field>
        ))}
      </div>

      <div className="mt-4 rounded-lg bg-cream/50 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Variables</p>
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          {CLINIC_PLACEHOLDERS.map((item) => (
            <li key={item.token} className="text-xs text-muted">
              <code className="rounded bg-white px-1 py-0.5 text-ink">{item.token}</code>{" "}
              {item.meaning}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => onPatch({ messageTemplates: { ...DEFAULT_MESSAGE_TEMPLATES } }, "templates")}
          className="text-xs font-semibold text-indigo underline"
        >
          Reset all to defaults
        </button>
        <SavedFlash show={flash === "templates"} />
      </div>
    </Section>
  );
}

function SheetSyncSection({
  settings,
  sheetSync,
  onConnect,
  onDisconnect,
  onSyncNow,
  onResyncAll,
}: {
  settings: ClinicSettings;
  sheetSync: ReturnType<typeof useClinic>["sheetSync"];
  onConnect: (url: string) => Promise<void>;
  onDisconnect: () => Promise<void>;
  onSyncNow: () => Promise<void>;
  onResyncAll: () => Promise<void>;
}) {
  const [url, setUrl] = useState(settings.sheetSyncUrl);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [scriptOpen, setScriptOpen] = useState(false);
  const connected = Boolean(settings.sheetSyncUrl);

  return (
    <Section
      title="Google Sheet sync"
      description="An optional off-device copy of your clinic data in your own Google Sheet."
    >
      <div className="rounded-lg border border-saffron/40 bg-saffron/10 px-3 py-2 text-sm text-ink">
        <b>Read this before connecting.</b> Unlike the rest of Setu, a clinic&apos;s records include
        diagnoses and prescriptions. Turning this on copies them to a Google Sheet in your Google
        account. Leave it off and everything stays on this device.
      </div>

      {connected ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-ink">
            Connected.{" "}
            {sheetSync.lastSyncAt
              ? `Last synced ${new Date(sheetSync.lastSyncAt).toLocaleString()}.`
              : "Not synced yet."}
          </p>
          {sheetSync.lastError && (
            <p className="text-sm text-red-600">{sheetSync.lastError}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onSyncNow}
              disabled={sheetSync.syncing || sheetSync.dirtyCount === 0}
              className={primaryBtnClass}
            >
              <RefreshCw className="h-4 w-4" />
              {sheetSync.syncing
                ? "Syncing…"
                : sheetSync.dirtyCount === 0
                  ? "Up to date"
                  : `Sync ${sheetSync.dirtyCount} change${sheetSync.dirtyCount === 1 ? "" : "s"}`}
            </button>
            <button type="button" onClick={onResyncAll} className={secondaryBtnClass}>
              Re-sync everything
            </button>
            <button type="button" onClick={onDisconnect} className={dangerBtnClass}>
              Disconnect
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <button
            type="button"
            onClick={() => setScriptOpen(true)}
            className={secondaryBtnClass}
          >
            <Sheet className="h-4 w-4" />
            Show me the setup steps
          </button>
          <Field label="Apps Script web-app URL">
            <input
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://script.google.com/macros/s/…/exec"
              className={inputClass}
            />
          </Field>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="button"
            disabled={busy || !url.trim()}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await onConnect(url);
              } catch (caught) {
                setError(caught instanceof Error ? caught.message : "Could not connect.");
              } finally {
                setBusy(false);
              }
            }}
            className={primaryBtnClass}
          >
            {busy ? "Connecting…" : "Connect"}
          </button>
        </div>
      )}

      <Modal open={scriptOpen} onClose={() => setScriptOpen(false)} title="Set up Sheet sync" wide>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-ink">
          <li>Create a new Google Sheet.</li>
          <li>
            Open <b>Extensions → Apps Script</b> and replace everything with the code below.
          </li>
          <li>
            Click <b>Deploy → New deployment → Web app</b>. Set <b>Execute as</b> to yourself and{" "}
            <b>Who has access</b> to <b>Anyone</b>.
          </li>
          <li>Copy the web-app URL and paste it here.</li>
        </ol>
        <div className="mt-3">
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(APPS_SCRIPT_TEMPLATE)}
            className={secondaryBtnClass}
          >
            <Copy className="h-4 w-4" />
            Copy the script
          </button>
        </div>
        <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-ink/5 p-3 text-[11px] leading-relaxed">
          {APPS_SCRIPT_TEMPLATE}
        </pre>
      </Modal>
    </Section>
  );
}

function BackupSection({
  settings,
  onExport,
  onRestore,
}: {
  settings: ClinicSettings;
  onExport: () => Promise<void>;
  onRestore: (backup: ClinicBackup) => Promise<void>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<ClinicBackup | null>(null);
  const [error, setError] = useState("");

  const lastBackup = settings.lastBackupAt ? new Date(settings.lastBackupAt) : null;
  const stale =
    !lastBackup || Date.now() - lastBackup.getTime() > 14 * 24 * 60 * 60 * 1000;

  return (
    <Section
      title="Backup & restore"
      description="This browser holds the only copy of your patient records. Download a backup regularly."
    >
      {stale && (
        <p className="mb-3 rounded-lg border border-saffron/40 bg-saffron/10 px-3 py-2 text-sm font-semibold text-ink">
          {lastBackup
            ? `Your last backup was ${lastBackup.toLocaleDateString()}.`
            : "You have never taken a backup."}{" "}
          Take one now.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onExport} className={primaryBtnClass}>
          <Download className="h-4 w-4" />
          Download backup
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={secondaryBtnClass}
        >
          <Upload className="h-4 w-4" />
          Restore from file
        </button>
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          setError("");
          const result = parseBackupFile(await file.text());
          if (!result.ok) {
            setError(result.error);
            return;
          }
          setPending(result.backup);
        }}
      />

      <Modal open={Boolean(pending)} onClose={() => setPending(null)} title="Restore this backup?">
        {pending && (
          <>
            <p className="text-sm text-muted">
              Taken {new Date(pending.exportedAt).toLocaleString()}. Restoring replaces everything
              currently in the clinic app on this device.
            </p>
            <ul className="mt-3 space-y-1 text-sm text-ink">
              {backupSummary(pending).map((row) => (
                <li key={row.label} className="flex justify-between">
                  <span>{row.label}</span>
                  <span className="font-semibold">{row.count}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setPending(null)} className={secondaryBtnClass}>
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await onRestore(pending);
                  setPending(null);
                }}
                className={primaryBtnClass}
              >
                Restore
              </button>
            </div>
          </>
        )}
      </Modal>
    </Section>
  );
}

function ScreenLockSection({
  settings,
  onPatch,
  onLockNow,
}: {
  settings: ClinicSettings;
  onPatch: (updates: Partial<Omit<ClinicSettings, "id">>, key: string) => Promise<void>;
  onLockNow?: () => void;
}) {
  const hasPin = Boolean(settings.pinHash && settings.pinSalt);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [error, setError] = useState("");

  const setNewPin = async () => {
    if (!isValidPinFormat(pin)) {
      setError(`The PIN must be ${PIN_MIN_LENGTH}–${PIN_MAX_LENGTH} digits.`);
      return;
    }
    if (pin !== confirmPin) {
      setError("The two PINs do not match.");
      return;
    }
    const salt = generateSalt();
    await onPatch({ pinHash: await hashPin(pin, salt), pinSalt: salt }, "lock");
    setPin("");
    setConfirmPin("");
    setError("");
  };

  const removePin = async () => {
    const ok = await verifyPin(currentPin, settings.pinSalt ?? "", settings.pinHash ?? "");
    if (!ok) {
      setError("That PIN is not correct.");
      return;
    }
    await onPatch({ pinHash: "", pinSalt: "" }, "lock");
    setCurrentPin("");
    setError("");
  };

  return (
    <Section
      title="Screen lock"
      description="A PIN on the app, so a patient record is not left open on the front desk."
    >
      {hasPin ? (
        <div className="space-y-3">
          <p className="text-sm text-ink">A PIN is set on this device.</p>
          <div className="flex flex-wrap gap-2">
            {onLockNow && (
              <button type="button" onClick={onLockNow} className={secondaryBtnClass}>
                <Lock className="h-4 w-4" />
                Lock now
              </button>
            )}
          </div>
          <Field label="Auto-lock after" hint="0 = never">
            <select
              value={settings.autoLockMinutes ?? 0}
              onChange={(event) =>
                onPatch({ autoLockMinutes: Number(event.target.value) }, "lock")
              }
              className={inputClass}
            >
              {[0, 1, 2, 5, 10, 15, 30].map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes === 0 ? "Never" : `${minutes} minutes idle`}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Remove the PIN">
              <input
                type="password"
                inputMode="numeric"
                value={currentPin}
                onChange={(event) => setCurrentPin(event.target.value)}
                placeholder="Current PIN"
                className={`${inputClass} w-40`}
              />
            </Field>
            <button type="button" onClick={removePin} className={dangerBtnClass}>
              <Unlock className="h-4 w-4" />
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <Field label="New PIN">
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(event) => setPin(event.target.value)}
              placeholder={`${PIN_MIN_LENGTH}–${PIN_MAX_LENGTH} digits`}
              className={`${inputClass} w-40`}
            />
          </Field>
          <Field label="Confirm PIN">
            <input
              type="password"
              inputMode="numeric"
              value={confirmPin}
              onChange={(event) => setConfirmPin(event.target.value)}
              className={`${inputClass} w-40`}
            />
          </Field>
          <button type="button" onClick={setNewPin} className={primaryBtnClass}>
            <Lock className="h-4 w-4" />
            Set PIN
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </Section>
  );
}

function ResetSection({ onReset }: { onReset: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  return (
    <Section
      title="Reset"
      description="Deletes every patient, consultation and bill from this device. Your other Setu tools are untouched."
    >
      <button type="button" onClick={() => setOpen(true)} className={dangerBtnClass}>
        <Trash2 className="h-4 w-4" />
        Delete all clinic data
      </button>
      <ConfirmDialog
        open={open}
        title="Delete everything?"
        message="Every patient record, consultation and bill will be removed from this browser. Download a backup first — this cannot be undone."
        confirmLabel="Delete everything"
        onCancel={() => setOpen(false)}
        onConfirm={async () => {
          await onReset();
          setOpen(false);
        }}
      />
    </Section>
  );
}
