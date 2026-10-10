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
import { clinicPlaceholders } from "@/lib/clinic/messages";
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
  defaultMessageTemplates,
  defaultRxFooter,
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
  formName,
  paymentModeLabel,
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
import { useI18n } from "@/lib/i18n";
import { fill, translate, type TKey } from "@/lib/i18n/translate";
import { intlLocaleFor } from "@/lib/i18n/pages";
import type { LanguageCode } from "@/lib/i18n/config";

/** Short weekday names from Intl, so the weekly-off chips follow the reader. */
function shortWeekdays(lang: LanguageCode): string[] {
  const format = new Intl.DateTimeFormat(intlLocaleFor(lang), { weekday: "short" });
  // 2023-01-01 was a Sunday — index 0, matching Date.getDay().
  return Array.from({ length: 7 }, (_, i) => format.format(new Date(2023, 0, 1 + i)));
}

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
  const { t } = useI18n();
  if (!show) return null;
  return <span className="text-sm font-semibold text-emerald-600">{t("clStSaved")}</span>;
}

export function SettingsScreen({ onLockNow }: { onLockNow?: () => void }) {
  const { t, lang } = useI18n();
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
        title={t("clStRxTitle")}
        description={t("clStRxDesc")}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("clStPaperSize")}>
            <select
              value={settings.rxPaperSize}
              onChange={(event) =>
                patch({ rxPaperSize: event.target.value as RxPaperSize }, "rx")
              }
              className={inputClass}
            >
              <option value="a4">{t("clStPaperA4")}</option>
              <option value="a5">{t("clStPaperA5")}</option>
            </select>
          </Field>
          <Field label={t("clStFooterText")} hint={t("clStFooterHint")}>
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
            {t("clStPrintHeader")}
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={settings.showVitalsOnRx}
              onChange={(event) => patch({ showVitalsOnRx: event.target.checked }, "rx")}
              className="h-4 w-4 rounded border-muted-line/50"
            />
            {t("clStShowVitals")}
          </label>
          <button
            type="button"
            onClick={() => patch({ rxFooterText: defaultRxFooter(lang) }, "rx")}
            className="text-xs font-semibold text-indigo underline"
          >
            {t("clStResetFooter")}
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
        title={t("clStProtocolsTitle")}
        description={t("clStProtocolsDesc")}
      >
        {protocols.length === 0 ? (
          <p className="text-sm text-muted">{t("clStNoProtocols")}</p>
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
                    {(protocol.medicines ?? []).map((line) => line.name).join(", ") ||
                      t("clCsNoMedicines")}
                    {protocol.timesUsed
                      ? ` ${fill(t("clCsUsedTimes"), { count: protocol.timesUsed })}`
                      : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteProtocol(protocol.id)}
                  aria-label={fill(t("appDeleteNamed"), { name: protocol.name })}
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
  const { t } = useI18n();
  if (!business) return null;
  return (
    <Section
      title={t("clStClinicTitle")}
      description={t("clStClinicDesc")}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("clSetClinicName")}>
          <input
            type="text"
            defaultValue={business.name}
            onBlur={(event) => onSave({ name: event.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label={t("phone")}>
          <input
            type="tel"
            defaultValue={business.phone}
            onBlur={(event) => onSave({ phone: event.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label={t("address")}>
          <input
            type="text"
            defaultValue={business.address}
            onBlur={(event) => onSave({ address: event.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label={t("upiId")} hint={t("clStUpiHint")}>
          <input
            type="text"
            defaultValue={business.upiId ?? ""}
            onBlur={(event) => onSave({ upiId: event.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label={t("currency")}>
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
  const { t } = useI18n();
  const [editing, setEditing] = useState<Doctor | null>(null);
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<Doctor | null>(null);

  return (
    <Section
      title={t("clStDoctorsTitle")}
      description={t("clStDoctorsDesc")}
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
                    {t("clStInactive")}
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
                {t("edit")}
              </button>
              {doctors.length > 1 && (
                <button
                  type="button"
                  onClick={() => setRemoving(doctor)}
                  aria-label={fill(t("appRemoveNamed"), { name: doctor.name })}
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
            <b>{t("clStMultiDoctorQuestion")}</b> {t("clStMultiDoctorNote")}{" "}
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
            {t("clStAddAnotherDoctor")}
          </button>
        </div>
      )}

      <Modal
        open={creating || Boolean(editing)}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        title={t(editing ? "clStEditDoctor" : "clStAddDoctor")}
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
        title={fill(t("clStRemoveDoctorQ"), { name: removing?.name ?? "" })}
        message={t("clStRemoveDoctorMsg")}
        confirmLabel={t("remove")}
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
  const { t } = useI18n();
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
      <Field label={t("name")} required>
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className={inputClass}
          autoFocus
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("clSetQualifications")}>
          <input
            type="text"
            value={qualifications}
            onChange={(event) => setQualifications(event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label={t("clSetSpeciality")}>
          <input
            type="text"
            value={speciality}
            onChange={(event) => setSpeciality(event.target.value)}
            className={inputClass}
          />
        </Field>
      </div>
      <Field label={t("clSetRegNo")}>
        <input
          type="text"
          value={registrationNo}
          onChange={(event) => setRegistrationNo(event.target.value)}
          className={inputClass}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t("clSetConsultFee")}>
          <input
            type="number"
            min={0}
            value={consultationFee}
            onChange={(event) => setConsultationFee(event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label={t("clSetFollowUpFee")} hint={t("clSetFreeHintZero")}>
          <input
            type="number"
            min={0}
            value={followUpFee}
            onChange={(event) => setFollowUpFee(event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label={t("clSetFreeWithin")} hint={t("clSetNeverHint")}>
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
          {t("clStSignature")}
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
        {t("clStSeeingPatients")}
      </label>

      <div className="flex justify-end gap-3">
        <button type="button" onClick={onCancel} className={secondaryBtnClass}>
          {t("cancel")}
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
          {t("clStSaveDoctor")}
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
  const { t, lang } = useI18n();
  const [breakLabel, setBreakLabel] = useState("Lunch");
  const [breakStart, setBreakStart] = useState("13:00");
  const [breakEnd, setBreakEnd] = useState("14:00");
  const [holidayDate, setHolidayDate] = useState(todayIso());
  const [holidayReason, setHolidayReason] = useState("");

  return (
    <Section title={t("clStScheduleTitle")} description={t("clStScheduleDesc")}>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t("clStOpens")}>
          <input
            type="time"
            value={settings.openTime}
            onChange={(event) => onPatch({ openTime: event.target.value }, "schedule")}
            className={inputClass}
          />
        </Field>
        <Field label={t("clStCloses")}>
          <input
            type="time"
            value={settings.closeTime}
            onChange={(event) => onPatch({ closeTime: event.target.value }, "schedule")}
            className={inputClass}
          />
        </Field>
        <Field label={t("clStSlotLength")}>
          <select
            value={settings.slotMinutes}
            onChange={(event) =>
              onPatch({ slotMinutes: Number(event.target.value) as SlotMinutes }, "schedule")
            }
            className={inputClass}
          >
            {[10, 15, 20, 30].map((minutes) => (
              <option key={minutes} value={minutes}>
                {fill(t("clStMinutesN"), { n: minutes })}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="mt-4">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
          {t("clStWeeklyOff")}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {shortWeekdays(lang).map((label, index) => {
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
          {t("clStBreaks")}
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
                aria-label={fill(t("appRemoveNamed"), { name: item.label })}
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
            placeholder={t("clPfLabelPh")}
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
                      label: breakLabel.trim() || t("clApBreak"),
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
            {t("clStAddBreak")}
          </button>
        </div>
      </div>

      <div className="mt-5">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
          {t("clStHolidays")}
        </span>
        <ul className="space-y-1.5">
          {settings.holidays.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-muted-line/30 px-3 py-1.5 text-sm"
            >
              <span className="text-ink">
                {formatDate(item.date, lang)}
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
                aria-label={t("clStRemoveHoliday")}
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
            placeholder={t("clTdReason")}
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
            {t("clStAddHoliday")}
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
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");

  return (
    <Section
      title={t("clStChargesTitle")}
      description={t("clStChargesDesc")}
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
              aria-label={fill(t("appRemoveNamed"), { name: charge.name })}
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
          placeholder={t("clStChargePh")}
          className={`${inputClass} w-44`}
        />
        <input
          type="number"
          min={0}
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder={t("clBlAmount")}
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
          {t("clStAddCharge")}
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
  const { t, lang } = useI18n();
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
      title={t("clStMedicinesTitle")}
      description={t("clStMedicinesDesc")}
    >
      <div className="rounded-xl border border-muted-line/30 bg-cream/40 p-3">
        <p className="text-sm text-ink">
          <b>{t("clStStarterLabel")}</b>{" "}
          {fill(t("clStStarterNote"), { count: SEED_MEDICINE_COUNT })}
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
                  ? t("clStAlreadyHaveAll")
                  : fill(t("clStAddedN"), { count: added })
              );
            } finally {
              setSeeding(false);
            }
          }}
          className={`${secondaryBtnClass} mt-2`}
        >
          {seeding ? t("clStAdding") : t("clStAddStarter")}
        </button>
        {notice && <p className="mt-2 text-sm font-semibold text-emerald-700">{notice}</p>}
      </div>

      <div className="mt-4">
        <SearchInput value={query} onChange={setQuery} placeholder={t("clStSearchMedicines")} />
      </div>

      <p className="mt-2 text-xs text-muted">
        {fill(t("clStInYourList"), { count: medicines.length })}
        {!needle && medicines.length > 25 ? ` ${t("clStShowing25")}` : ""}
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
                {[formName(medicine.form, lang), medicine.composition]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onDelete(medicine.id)}
              aria-label={fill(t("appRemoveNamed"), { name: medicine.name })}
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
          placeholder={t("clDocMedicine")}
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
              {formName(option, lang)}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={composition}
          onChange={(event) => setComposition(event.target.value)}
          placeholder={t("clStSaltComposition")}
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
          {t("clStAdd")}
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
  const { t, lang } = useI18n();
  const [mode, setMode] = useState("");

  return (
    <Section title={t("clStBillingTitle")} description={t("clStBillingDesc")}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t("clStFilePrefix")}
          hint={fill(t("clStNextValue"), {
            value: formatPatientCode(settings.patientCodePrefix, settings.nextPatientSerial),
          })}
        >
          <input
            type="text"
            value={settings.patientCodePrefix}
            onChange={(event) => onPatch({ patientCodePrefix: event.target.value }, "billing")}
            className={inputClass}
          />
        </Field>
        <Field
          label={t("clStNextFileNumber")}
          hint={patientCount > 0 ? t("clStNeverReused") : undefined}
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
          label={t("clStReceiptPrefix")}
          hint={fill(t("clStNextValue"), {
            value: formatReceiptNumber(settings.receiptPrefix, settings.nextReceiptNumber),
          })}
        >
          <input
            type="text"
            value={settings.receiptPrefix}
            onChange={(event) => onPatch({ receiptPrefix: event.target.value }, "billing")}
            className={inputClass}
          />
        </Field>
        <Field label={t("clStNextReceiptNumber")}>
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
        <Field label={t("clStReceiptPaper")}>
          <select
            value={settings.receiptPaperSize}
            onChange={(event) =>
              onPatch({ receiptPaperSize: event.target.value as ReceiptPaperSize }, "billing")
            }
            className={inputClass}
          >
            <option value="58mm">{fill(t("clStThermalRoll"), { mm: 58 })}</option>
            <option value="80mm">{fill(t("clStThermalRoll"), { mm: 80 })}</option>
            <option value="a4">A4</option>
          </select>
        </Field>
      </div>

      <div className="mt-4">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
          {t("clStPaymentModes")}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {settings.paymentModes.map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-1.5 rounded-full border border-muted-line/40 bg-white px-3 py-1.5 text-xs font-semibold text-ink"
            >
              {paymentModeLabel(item, lang)}
              {settings.paymentModes.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    onPatch(
                      { paymentModes: settings.paymentModes.filter((m) => m !== item) },
                      "billing"
                    )
                  }
                  aria-label={fill(t("appRemoveNamed"), { name: paymentModeLabel(item, lang) })}
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
            placeholder={t("clStModePh")}
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
            {t("clStAdd")}
          </button>
        </div>
      </div>

      <div className="mt-3">
        <SavedFlash show={flash === "billing"} />
      </div>
    </Section>
  );
}

const TEMPLATE_LABELS: Record<ClinicTemplateKey, TKey> = {
  appointmentConfirmed: "clStTplApptConfirmed",
  appointmentReminder: "clStTplApptReminder",
  followUpDue: "clStTplFollowUpDue",
  reportReady: "clStTplReportReady",
  duesReminder: "clStTplDuesReminder",
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
  const { t, lang } = useI18n();
  return (
    <Section
      title={t("clStTemplatesTitle")}
      description={t("clStTemplatesDesc")}
    >
      <div className="space-y-3">
        {(Object.keys(TEMPLATE_LABELS) as ClinicTemplateKey[]).map((key) => (
          <Field key={key} label={t(TEMPLATE_LABELS[key])}>
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
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          {t("clStVariables")}
        </p>
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          {clinicPlaceholders(lang).map((item) => (
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
          onClick={() => onPatch({ messageTemplates: defaultMessageTemplates(lang) }, "templates")}
          className="text-xs font-semibold text-indigo underline"
        >
          {t("clStResetAllDefaults")}
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
  const { t, lang } = useI18n();
  const [url, setUrl] = useState(settings.sheetSyncUrl);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [scriptOpen, setScriptOpen] = useState(false);
  const connected = Boolean(settings.sheetSyncUrl);

  return (
    <Section
      title={t("clStSheetTitle")}
      description={t("clStSheetDesc")}
    >
      <div className="rounded-lg border border-saffron/40 bg-saffron/10 px-3 py-2 text-sm text-ink">
        <b>{t("clStSheetWarnLabel")}</b> {t("clStSheetWarnBody")}
      </div>

      {connected ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-ink">
            {t("clStConnected")}{" "}
            {sheetSync.lastSyncAt
              ? fill(t("clStLastSynced"), {
                  when: new Date(sheetSync.lastSyncAt).toLocaleString(intlLocaleFor(lang)),
                })
              : t("clStNotSyncedYet")}
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
                ? t("clStSyncing")
                : sheetSync.dirtyCount === 0
                  ? t("clStUpToDate")
                  : fill(
                      t(
                        sheetSync.dirtyCount === 1
                          ? "clStSyncChangeOne"
                          : "clStSyncChangeMany"
                      ),
                      { count: sheetSync.dirtyCount }
                    )}
            </button>
            <button type="button" onClick={onResyncAll} className={secondaryBtnClass}>
              {t("clStResyncAll")}
            </button>
            <button type="button" onClick={onDisconnect} className={dangerBtnClass}>
              {t("clStDisconnect")}
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
            {t("clStShowSetupSteps")}
          </button>
          <Field label={t("clStScriptUrl")}>
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
                setError(caught instanceof Error ? caught.message : t("clStCouldNotConnect"));
              } finally {
                setBusy(false);
              }
            }}
            className={primaryBtnClass}
          >
            {busy ? t("clStConnecting") : t("clStConnect")}
          </button>
        </div>
      )}

      <Modal open={scriptOpen} onClose={() => setScriptOpen(false)} title={t("clStSetupSheetSync")} wide>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-ink">
          <li>{t("clStStep1")}</li>
          <li>{fill(t("clStStep2"), { menu: "Extensions → Apps Script" })}</li>
          <li>
            {fill(t("clStStep3"), {
              deploy: "Deploy → New deployment → Web app",
              executeAs: "Execute as",
              access: "Who has access",
              anyone: "Anyone",
            })}
          </li>
          <li>{t("clStStep4")}</li>
        </ol>
        <div className="mt-3">
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(APPS_SCRIPT_TEMPLATE)}
            className={secondaryBtnClass}
          >
            <Copy className="h-4 w-4" />
            {t("clStCopyScript")}
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
  const { t, lang } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<ClinicBackup | null>(null);
  const [error, setError] = useState("");

  const lastBackup = settings.lastBackupAt ? new Date(settings.lastBackupAt) : null;
  const stale =
    !lastBackup || Date.now() - lastBackup.getTime() > 14 * 24 * 60 * 60 * 1000;

  return (
    <Section
      title={t("clStBackupTitle")}
      description={t("clStBackupDesc")}
    >
      {stale && (
        <p className="mb-3 rounded-lg border border-saffron/40 bg-saffron/10 px-3 py-2 text-sm font-semibold text-ink">
          {lastBackup
            ? fill(t("clStLastBackupWas"), {
                date: lastBackup.toLocaleDateString(intlLocaleFor(lang)),
              })
            : t("clStNeverBackedUp")}{" "}
          {t("clStTakeOneNow")}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onExport} className={primaryBtnClass}>
          <Download className="h-4 w-4" />
          {t("clStDownloadBackup")}
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={secondaryBtnClass}
        >
          <Upload className="h-4 w-4" />
          {t("clStRestoreFromFile")}
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
            setError(translate(lang, result.error));
            return;
          }
          setPending(result.backup);
        }}
      />

      <Modal open={Boolean(pending)} onClose={() => setPending(null)} title={t("clStRestoreQuestion")}>
        {pending && (
          <>
            <p className="text-sm text-muted">
              {fill(t("clStRestoreBlurb"), {
                when: new Date(pending.exportedAt).toLocaleString(intlLocaleFor(lang)),
              })}
            </p>
            <ul className="mt-3 space-y-1 text-sm text-ink">
              {backupSummary(pending, lang).map((row) => (
                <li key={row.label} className="flex justify-between">
                  <span>{row.label}</span>
                  <span className="font-semibold">{row.count}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setPending(null)} className={secondaryBtnClass}>
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={async () => {
                  await onRestore(pending);
                  setPending(null);
                }}
                className={primaryBtnClass}
              >
                {t("clWelRestore")}
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
  const { t } = useI18n();
  const hasPin = Boolean(settings.pinHash && settings.pinSalt);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [error, setError] = useState("");

  const setNewPin = async () => {
    if (!isValidPinFormat(pin)) {
      setError(fill(t("appPinLengthError"), { min: PIN_MIN_LENGTH, max: PIN_MAX_LENGTH }));
      return;
    }
    if (pin !== confirmPin) {
      setError(t("clStPinMismatch"));
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
      setError(t("clStPinWrong"));
      return;
    }
    await onPatch({ pinHash: "", pinSalt: "" }, "lock");
    setCurrentPin("");
    setError("");
  };

  return (
    <Section
      title={t("clStLockTitle")}
      description={t("clStLockDesc")}
    >
      {hasPin ? (
        <div className="space-y-3">
          <p className="text-sm text-ink">{t("clStPinIsSet")}</p>
          <div className="flex flex-wrap gap-2">
            {onLockNow && (
              <button type="button" onClick={onLockNow} className={secondaryBtnClass}>
                <Lock className="h-4 w-4" />
                {t("clStLockNow")}
              </button>
            )}
          </div>
          <Field label={t("clStAutoLockAfter")} hint={t("clSetNeverHint")}>
            <select
              value={settings.autoLockMinutes ?? 0}
              onChange={(event) =>
                onPatch({ autoLockMinutes: Number(event.target.value) }, "lock")
              }
              className={inputClass}
            >
              {[0, 1, 2, 5, 10, 15, 30].map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes === 0 ? t("clStNever") : fill(t("clStMinutesIdle"), { n: minutes })}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex flex-wrap items-end gap-2">
            <Field label={t("clStRemoveThePin")}>
              <input
                type="password"
                inputMode="numeric"
                value={currentPin}
                onChange={(event) => setCurrentPin(event.target.value)}
                placeholder={t("clStCurrentPin")}
                className={`${inputClass} w-40`}
              />
            </Field>
            <button type="button" onClick={removePin} className={dangerBtnClass}>
              <Unlock className="h-4 w-4" />
              {t("remove")}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <Field label={t("clStNewPin")}>
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(event) => setPin(event.target.value)}
              placeholder={fill(t("clStPinDigitsPh"), {
                min: PIN_MIN_LENGTH,
                max: PIN_MAX_LENGTH,
              })}
              className={`${inputClass} w-40`}
            />
          </Field>
          <Field label={t("clStConfirmPin")}>
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
            {t("clStSetPin")}
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </Section>
  );
}

function ResetSection({ onReset }: { onReset: () => Promise<void> }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <Section
      title={t("clStResetTitle")}
      description={t("clStResetDesc")}
    >
      <button type="button" onClick={() => setOpen(true)} className={dangerBtnClass}>
        <Trash2 className="h-4 w-4" />
        {t("clStDeleteAllData")}
      </button>
      <ConfirmDialog
        open={open}
        title={t("clStDeleteEverythingQ")}
        message={t("clStDeleteEverythingMsg")}
        confirmLabel={t("clStDeleteEverything")}
        onCancel={() => setOpen(false)}
        onConfirm={async () => {
          await onReset();
          setOpen(false);
        }}
      />
    </Section>
  );
}
