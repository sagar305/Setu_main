"use client";

import { useI18n } from "@/lib/i18n";
import { intlLocaleFor } from "@/lib/i18n/pages";
import { fill, type TKey } from "@/lib/i18n/translate";
import { useRef, useState, type ReactNode } from "react";
import {
  Copy,
  Download,
  ExternalLink,
  Lock,
  Plus,
  RefreshCw,
  Sheet,
  Trash2,
  Unlock,
  Upload,
} from "lucide-react";
import { useTuition } from "@/lib/tuition/store";
import { parseBackupFile, type TuitionBackup } from "@/lib/tuition/backup";
import { APPS_SCRIPT_TEMPLATE } from "@/lib/tuition/sheetSync";
import {
  blockingConflicts,
  describeConflict,
  findBatchConflicts,
} from "@/lib/tuition/batchRules";
import { messagePlaceholders } from "@/lib/tuition/messages";
import {
  PIN_MAX_LENGTH,
  PIN_MIN_LENGTH,
  generateSalt,
  hashPin,
  isValidPinFormat,
  verifyPin,
} from "@/lib/pos/pin";
import { CURRENCIES, formatMoney } from "@/lib/pos/types";
import {
  defaultTemplates,
  describeDays,
  formatDate,
  formatReceiptNumber,
  todayIso,
  weekdayNames,
  type Batch,
  type MessageTemplates,
  type TuitionSettings,
} from "@/lib/tuition/types";
import {
  ConfirmDialog,
  Field,
  Modal,
  dangerBtnClass,
  inputClass,
  primaryBtnClass,
  secondaryBtnClass,
} from "@/components/tools/FreePos/ui";

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
  const { t, lang } = useI18n();
  if (!show) return null;
  return <span className="text-sm font-semibold text-emerald-600">{t("tuStgSaved")}</span>;
}

export function SettingsScreen({ onLockNow }: { onLockNow?: () => void }) {
  const {
    business,
    settings,
    batches,
    students,
    holidays,
    sheetSync,
    updateBusiness,
    updateSettings,
    addHoliday,
    removeHoliday,
    connectSheet,
    disconnectSheet,
    syncSheetNow,
    resyncSheetAll,
    exportBackup,
    applyRestoredBackup,
    resetAll,
  } = useTuition();

  return (
    <div className="space-y-5">
      <ProfileSection
        business={business}
        onSave={updateBusiness}
      />

      <BatchesSection />

      <FeesSection settings={settings} onSave={updateSettings} currency={business?.currency ?? "INR"} />

      <TemplatesSection settings={settings} onSave={updateSettings} />

      <HolidaysSection
        holidays={holidays}
        onAdd={addHoliday}
        onRemove={removeHoliday}
      />

      <SheetSyncSection
        settings={settings}
        sheetSync={sheetSync}
        onConnect={connectSheet}
        onDisconnect={disconnectSheet}
        onSyncNow={syncSheetNow}
        onResync={resyncSheetAll}
      />

      <BackupSection
        settings={settings}
        onExport={exportBackup}
        onRestore={applyRestoredBackup}
        counts={{ students: students.length, batches: batches.length }}
      />

      <PinSection settings={settings} onSave={updateSettings} onLockNow={onLockNow} />

      <DangerSection onReset={resetAll} />
    </div>
  );
}

// ---------------------------------------------------------------------------

function ProfileSection({
  business,
  onSave,
}: {
  business: ReturnType<typeof useTuition>["business"];
  onSave: (updates: Record<string, string>) => Promise<void>;
}) {
  const { t, lang } = useI18n();
  const [form, setForm] = useState({
    name: business?.name ?? "",
    phone: business?.phone ?? "",
    address: business?.address ?? "",
    email: business?.email ?? "",
    upiId: business?.upiId ?? "",
    currency: business?.currency ?? "INR",
  });
  const [saved, setSaved] = useState(false);

  const save = async () => {
    await onSave(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <Section
      title={t("tuSetTitle")}
      description={t("tuStgDetailsBlurb")}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("tuStgNameLabel")}>
          <input
            type="text"
            value={form.name}
            onChange={(event) => setForm((p) => ({ ...p, name: event.target.value }))}
            className={inputClass}
          />
        </Field>
        <Field label={t("phone")}>
          <input
            type="tel"
            value={form.phone}
            onChange={(event) => setForm((p) => ({ ...p, phone: event.target.value }))}
            className={inputClass}
          />
        </Field>
        <Field label={t("email")}>
          <input
            type="email"
            value={form.email}
            onChange={(event) => setForm((p) => ({ ...p, email: event.target.value }))}
            className={inputClass}
          />
        </Field>
        <Field label={t("tuSetUpiOptional")} hint={t("tuStgUpiHint")}>
          <input
            type="text"
            value={form.upiId}
            onChange={(event) => setForm((p) => ({ ...p, upiId: event.target.value }))}
            placeholder="yourname@okhdfcbank"
            className={inputClass}
          />
        </Field>
        <Field label={t("currency")}>
          <select
            value={form.currency}
            onChange={(event) => setForm((p) => ({ ...p, currency: event.target.value }))}
            className={inputClass}
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("address")}>
          <input
            type="text"
            value={form.address}
            onChange={(event) => setForm((p) => ({ ...p, address: event.target.value }))}
            className={inputClass}
          />
        </Field>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button type="button" onClick={() => void save()} className={primaryBtnClass}>
          {t("tuStgSaveDetails")}
        </button>
        <SavedFlash show={saved} />
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------

const EMPTY_BATCH: Omit<Batch, "id" | "createdAt" | "updatedAt"> = {
  name: "",
  subject: "",
  classLevel: "",
  days: [1, 3, 5],
  startTime: "17:00",
  endTime: "18:00",
  monthlyFee: 0,
  venue: "",
  active: true,
};

function BatchesSection() {
  const { t, lang } = useI18n();
  const { batches, students, business, createBatch, updateBatch, deleteBatch } = useTuition();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Batch | null>(null);
  const [form, setForm] = useState(EMPTY_BATCH);
  const [confirmDelete, setConfirmDelete] = useState<Batch | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [acceptedWarning, setAcceptedWarning] = useState(false);
  const currency = business?.currency ?? "INR";

  // Checked as the teacher types, so a clash is visible before they save.
  const conflicts = findBatchConflicts(batches, form, editing?.id);
  const blocking = blockingConflicts(conflicts);
  const warning = conflicts.find((conflict) => conflict.kind === "same-subject");

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_BATCH);
    setError("");
    setAcceptedWarning(false);
    setOpen(true);
  };

  const openEdit = (batch: Batch) => {
    const { id, createdAt, updatedAt, ...rest } = batch;
    void id;
    void createdAt;
    void updatedAt;
    setEditing(batch);
    setForm(rest);
    setError("");
    setAcceptedWarning(false);
    setOpen(true);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    if (blocking.length > 0) {
      setError(describeConflict(blocking[0], lang));
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = { ...form, name: form.name.trim(), monthlyFee: Number(form.monthlyFee) || 0 };
      if (editing) await updateBatch(editing.id, payload);
      else await createBatch(payload);
      setOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("tuStgBatchSaveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (day: number) => {
    setForm((prev) => ({
      ...prev,
      days: prev.days.includes(day)
        ? prev.days.filter((d) => d !== day)
        : [...prev.days, day].sort((a, b) => a - b),
    }));
  };

  return (
    <Section
      title={t("tuAtBatches")}
      description={t("tuStgBatchesBlurb")}
    >
      {batches.length === 0 ? (
        <p className="rounded-xl bg-cream-paper p-4 text-sm text-muted">
          {t("tuStgNoBatches")}
        </p>
      ) : (
        <ul className="space-y-2">
          {batches.map((batch) => {
            const count = students.filter(
              (s) => s.status === "active" && s.batchIds.includes(batch.id)
            ).length;
            return (
              <li
                key={batch.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-muted-line/30 p-3"
              >
                <button type="button" onClick={() => openEdit(batch)} className="min-w-0 text-left">
                  <p className="truncate text-sm font-bold text-ink">
                    {batch.name}
                    {!batch.active && (
                      <span className="ml-2 rounded-full bg-cream-paper px-2 py-0.5 text-[10px] font-semibold uppercase text-muted">
                        {t("clStInactive")}
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {[
                      batch.subject,
                      describeDays(batch.days, lang),
                      `${batch.startTime}–${batch.endTime}`,
                      fill(t(count === 1 ? "tuStCountOne" : "tuStCountMany"), { count }),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </button>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm font-semibold text-ink">
                    {formatMoney(batch.monthlyFee, currency)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(batch)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-muted-line/40 text-muted transition hover:border-red-300 hover:text-red-600"
                    aria-label={fill(t("appDeleteNamed"), { name: batch.name })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <button type="button" onClick={openNew} className={`${primaryBtnClass} mt-4`}>
        <Plus className="h-4 w-4" />
        {t("tuStgAddBatch")}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={t(editing ? "tuStgEditBatch" : "tuStgAddBatch")}>
        <form onSubmit={submit} className="space-y-4">
          <Field label={t("tuStgBatchName")} required>
            <input
              type="text"
              value={form.name}
              onChange={(event) => setForm((p) => ({ ...p, name: event.target.value }))}
              placeholder={t("tuStgBatchNamePh")}
              className={inputClass}
              autoFocus
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("tuPhSubject")}>
              <input
                type="text"
                value={form.subject}
                onChange={(event) => setForm((p) => ({ ...p, subject: event.target.value }))}
                className={inputClass}
              />
            </Field>
            <Field label={t("tuSfClassGrade")}>
              <input
                type="text"
                value={form.classLevel}
                onChange={(event) => setForm((p) => ({ ...p, classLevel: event.target.value }))}
                className={inputClass}
              />
            </Field>
          </div>
          <div>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
              {t("dgUnitDays")}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {weekdayNames(lang).map((label, day) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggleDay(day)}
                  aria-pressed={form.days.includes(day)}
                  className={`h-9 w-11 rounded-lg text-xs font-bold transition ${
                    form.days.includes(day)
                      ? "bg-indigo text-white"
                      : "bg-cream-paper text-muted hover:text-ink"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t("tuStgStarts")}>
              <input
                type="time"
                value={form.startTime}
                onChange={(event) => setForm((p) => ({ ...p, startTime: event.target.value }))}
                className={inputClass}
              />
            </Field>
            <Field label={t("tuStgEnds")}>
              <input
                type="time"
                value={form.endTime}
                onChange={(event) => setForm((p) => ({ ...p, endTime: event.target.value }))}
                className={inputClass}
              />
            </Field>
            <Field label={t("tuSfFeePerMonth")} required>
              <input
                type="number"
                min={0}
                value={form.monthlyFee || ""}
                onChange={(event) =>
                  setForm((p) => ({ ...p, monthlyFee: Number(event.target.value) || 0 }))
                }
                className={inputClass}
              />
            </Field>
          </div>
          <Field label={t("tuStgVenueOptional")}>
            <input
              type="text"
              value={form.venue}
              onChange={(event) => setForm((p) => ({ ...p, venue: event.target.value }))}
              className={inputClass}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) => setForm((p) => ({ ...p, active: event.target.checked }))}
              className="h-4 w-4 rounded border-muted-line/40 text-indigo focus:ring-indigo"
            />
            {t("tuStgBatchRunning")}
          </label>

          {blocking.length > 0 && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {describeConflict(blocking[0], lang)}
            </p>
          )}

          {blocking.length === 0 && warning && (
            <div className="rounded-lg border border-saffron/40 bg-saffron/10 px-4 py-3">
              <p className="text-sm text-ink">{describeConflict(warning, lang)}</p>
              <label className="mt-2 flex items-center gap-2 text-sm text-muted">
                <input
                  type="checkbox"
                  checked={acceptedWarning}
                  onChange={(event) => setAcceptedWarning(event.target.checked)}
                  className="h-4 w-4 rounded border-muted-line/40 text-indigo focus:ring-indigo"
                />
                {t("tuStgSeparateGroup")}
              </label>
            </div>
          )}

          {error && blocking.length === 0 && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setOpen(false)} className={secondaryBtnClass}>
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={saving || blocking.length > 0 || (Boolean(warning) && !acceptedWarning)}
              className={primaryBtnClass}
            >
              {saving ? t("clPfSaving") : t(editing ? "saveChanges" : "tuStgAddBatch")}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title={fill(t("tuStgDeleteNamedQ"), {
          name: confirmDelete?.name ?? t("tuStgThisBatch"),
        })}
        message={t("tuStgDeleteBatchBody")}
        confirmLabel={t("tuStgDeleteBatch")}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) void deleteBatch(confirmDelete.id);
          setConfirmDelete(null);
        }}
      />
    </Section>
  );
}

// ---------------------------------------------------------------------------

function FeesSection({
  settings,
  onSave,
  currency,
}: {
  settings: TuitionSettings;
  onSave: (updates: Partial<TuitionSettings>) => Promise<void>;
  currency: string;
}) {
  const { t, lang } = useI18n();
  const [prefix, setPrefix] = useState(settings.receiptPrefix);
  const [next, setNext] = useState(String(settings.nextReceiptNumber));
  const [dueDay, setDueDay] = useState(String(settings.feeDueDay));
  const [modes, setModes] = useState(settings.paymentModes.join(", "));
  const [saved, setSaved] = useState(false);

  const save = async () => {
    await onSave({
      receiptPrefix: prefix,
      nextReceiptNumber: Math.max(1, Number(next) || 1),
      feeDueDay: Math.min(28, Math.max(1, Number(dueDay) || 1)),
      paymentModes: modes
        .split(",")
        .map((mode) => mode.trim())
        .filter(Boolean),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <Section
      title={t("tuStgFeesReceipts")}
      description={t("tuStgFeesBlurb")}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("tuStgReceiptPrefix")}>
          <input
            type="text"
            value={prefix}
            onChange={(event) => setPrefix(event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field
          label={t("tuStgNextReceiptNumber")}
          hint={fill(t("tuFsNextReceipt"), {
            number: formatReceiptNumber(prefix, Number(next) || 1),
          })}
        >
          <input
            type="number"
            min={1}
            value={next}
            onChange={(event) => setNext(event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label={t("tuStgFeesDueDay")} hint={t("tuStgFeesDueDayHint")}>
          <input
            type="number"
            min={1}
            max={28}
            value={dueDay}
            onChange={(event) => setDueDay(event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label={t("tuStgPaymentModes")} hint={t("tuStgCommaSeparated")}>
          <input
            type="text"
            value={modes}
            onChange={(event) => setModes(event.target.value)}
            className={inputClass}
          />
        </Field>
      </div>
      <label className="mt-4 flex items-center gap-2 text-sm text-muted">
        <input
          type="checkbox"
          checked={settings.autoGenerateDues}
          onChange={(event) => void onSave({ autoGenerateDues: event.target.checked })}
          className="h-4 w-4 rounded border-muted-line/40 text-indigo focus:ring-indigo"
        />
        {t("tuStgAutoGenerate")}
      </label>
      <p className="mt-2 text-xs text-muted">
        Amounts are in {currency}. A due is snapshotted when it is raised, so changing a batch fee
        later never rewrites an old month.
      </p>
      <div className="mt-4 flex items-center gap-3">
        <button type="button" onClick={() => void save()} className={primaryBtnClass}>
          {t("save")}
        </button>
        <SavedFlash show={saved} />
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------

const TEMPLATE_LABELS: { key: keyof MessageTemplates; label: TKey }[] = [
  { key: "feeReminder", label: "tuStgTplFeeReminder" },
  { key: "absent", label: "tuStgTplAbsent" },
  { key: "receipt", label: "tuStgTplReceipt" },
  { key: "marks", label: "tuStgTplMarks" },
  { key: "diary", label: "tuStgTplDiary" },
  { key: "birthday", label: "tuStgTplBirthday" },
  { key: "attendanceReport", label: "tuRpAttendanceReport" },
];

function TemplatesSection({
  settings,
  onSave,
}: {
  settings: TuitionSettings;
  onSave: (updates: Partial<TuitionSettings>) => Promise<void>;
}) {
  const { t, lang } = useI18n();
  const [templates, setTemplates] = useState<MessageTemplates>(settings.templates);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    await onSave({ templates });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <Section
      title={t("tuStgTemplatesTitle")}
      description={t("tuStgTemplatesBlurb")}
    >
      <div className="space-y-4">
        {TEMPLATE_LABELS.map(({ key, label }) => (
          <Field key={key} label={label}>
            <textarea
              value={templates[key]}
              onChange={(event) =>
                setTemplates((prev) => ({ ...prev, [key]: event.target.value }))
              }
              rows={3}
              className={inputClass}
            />
          </Field>
        ))}
      </div>

      <details className="mt-3 rounded-xl bg-cream-paper p-3">
        <summary className="cursor-pointer text-sm font-semibold text-ink">
          {t("tuStgPlaceholders")}
        </summary>
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          {messagePlaceholders(lang).map((item) => (
            <li key={item.token} className="text-xs text-muted">
              <code className="font-semibold text-indigo">{item.token}</code> — {item.meaning}
            </li>
          ))}
        </ul>
      </details>

      <div className="mt-4 space-y-2">
        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={settings.showClassAverage}
            onChange={(event) => void onSave({ showClassAverage: event.target.checked })}
            className="h-4 w-4 rounded border-muted-line/40 text-indigo focus:ring-indigo"
          />
          {t("tuStgShowAverage")}
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={settings.showRank}
            onChange={(event) => void onSave({ showRank: event.target.checked })}
            className="h-4 w-4 rounded border-muted-line/40 text-indigo focus:ring-indigo"
          />
          {t("tuStgShowRank")}
        </label>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button type="button" onClick={() => void save()} className={primaryBtnClass}>
          {t("tuStgSaveTemplates")}
        </button>
        <button
          type="button"
          onClick={() => setTemplates(defaultTemplates(lang))}
          className={secondaryBtnClass}
        >
          {t("tuStgResetDefault")}
        </button>
        <SavedFlash show={saved} />
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------

function HolidaysSection({
  holidays,
  onAdd,
  onRemove,
}: {
  holidays: ReturnType<typeof useTuition>["holidays"];
  onAdd: (date: string, name: string) => Promise<void>;
  onRemove: (date: string) => Promise<void>;
}) {
  const { t, lang } = useI18n();
  const [date, setDate] = useState(todayIso());
  const [name, setName] = useState("");

  return (
    <Section
      title={t("tuAtHoliday")}
      description={t("tuStgHolidaysBlurb")}
    >
      <div className="flex flex-wrap items-end gap-3">
        <Field label={t("date")}>
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label={t("dgReason")}>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("tuStgHolidayPh")}
            className={inputClass}
          />
        </Field>
        <button
          type="button"
          onClick={() => {
            if (date) void onAdd(date, name.trim() || t("tuAtHoliday"));
            setName("");
          }}
          className={`${primaryBtnClass} h-[38px]`}
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </div>

      {holidays.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2">
          {holidays.map((holiday) => (
            <li
              key={holiday.id}
              className="flex items-center gap-2 rounded-full bg-cream-paper px-3 py-1.5 text-xs text-ink"
            >
              <span className="font-semibold">{formatDate(holiday.date, lang)}</span>
              <span className="text-muted">{holiday.name}</span>
              <button
                type="button"
                onClick={() => void onRemove(holiday.id)}
                className="text-muted transition hover:text-red-600"
                aria-label={fill(t("appRemoveNamed"), { name: holiday.name })}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------------------

function SheetSyncSection({
  settings,
  sheetSync,
  onConnect,
  onDisconnect,
  onSyncNow,
  onResync,
}: {
  settings: TuitionSettings;
  sheetSync: ReturnType<typeof useTuition>["sheetSync"];
  onConnect: (url: string) => Promise<void>;
  onDisconnect: () => Promise<void>;
  onSyncNow: () => Promise<void>;
  onResync: () => Promise<void>;
}) {
  const { t, lang } = useI18n();
  const [url, setUrl] = useState(settings.sheetSyncUrl);
  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [copied, setCopied] = useState(false);
  const connected = Boolean(settings.sheetSyncUrl);

  const connect = async () => {
    setError("");
    setConnecting(true);
    try {
      await onConnect(url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("appSheetCouldNotConnect"));
    } finally {
      setConnecting(false);
    }
  };

  const copyScript = async () => {
    try {
      await navigator.clipboard.writeText(APPS_SCRIPT_TEMPLATE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — the script is shown below to copy by hand.
    }
  };

  return (
    <Section
      title={t("tuStgSheetSync")}
      description={t("tuStgSheetBlurb")}
    >
      <ol className="space-y-2 text-sm text-muted">
        <li>
          1. Create a Google Sheet, then open <b>Extensions → Apps Script</b>.
        </li>
        <li>2. Replace everything there with the script below and save.</li>
        <li>
          3. <b>Deploy → New deployment → Web app</b>. Execute as <b>Me</b>, access{" "}
          <b>Anyone</b>.
        </li>
        <li>4. Copy the web app URL and paste it here.</li>
      </ol>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => void copyScript()} className={secondaryBtnClass}>
          <Copy className="h-4 w-4" />
          {copied ? t("tuStgScriptCopied") : t("clStCopyScript")}
        </button>
        <a
          href="https://sheets.new"
          target="_blank"
          rel="noopener noreferrer"
          className={secondaryBtnClass}
        >
          <ExternalLink className="h-4 w-4" />
          {t("tuStgNewSheet")}
        </a>
      </div>

      <div className="mt-4">
        <Field label={t("tuStgWebAppUrl")}>
          <input
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://script.google.com/macros/s/…/exec"
            className={inputClass}
          />
        </Field>
      </div>

      {error && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void connect()}
          disabled={connecting || !url.trim()}
          className={primaryBtnClass}
        >
          <Sheet className="h-4 w-4" />
          {connecting
            ? t("clStConnecting")
            : connected
              ? t("tuStgReconnect")
              : t("clStConnect")}
        </button>
        {connected && (
          <>
            <button
              type="button"
              onClick={() => void onSyncNow()}
              disabled={sheetSync.syncing}
              className={secondaryBtnClass}
            >
              <RefreshCw className={`h-4 w-4 ${sheetSync.syncing ? "animate-spin" : ""}`} />
              {t("tuStgSyncNow")}
            </button>
            <button type="button" onClick={() => void onResync()} className={secondaryBtnClass}>
              {t("tuStgResendAll")}
            </button>
            <button type="button" onClick={() => void onDisconnect()} className={secondaryBtnClass}>
              {t("clStDisconnect")}
            </button>
          </>
        )}
      </div>

      {connected && (
        <p className="mt-3 text-xs text-muted">
          {sheetSync.lastError
            ? `Last sync failed: ${sheetSync.lastError}`
            : sheetSync.lastSyncAt
              ? fill(t("tuStgLastSynced"), {
                  when: new Date(sheetSync.lastSyncAt).toLocaleString(intlLocaleFor(lang)),
                })
              : t("clStNotSyncedYet")}
          {sheetSync.dirtyCount > 0
            ? fill(t("tuStgChangesWaiting"), { count: sheetSync.dirtyCount })
            : ""}
        </p>
      )}

      <details className="mt-4 rounded-xl bg-cream-paper p-3">
        <summary className="cursor-pointer text-sm font-semibold text-ink">
          {t("tuStgShowScript")}
        </summary>
        <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-white p-3 text-[11px] leading-relaxed text-muted">
          {APPS_SCRIPT_TEMPLATE}
        </pre>
      </details>
    </Section>
  );
}

// ---------------------------------------------------------------------------

function BackupSection({
  settings,
  onExport,
  onRestore,
  counts,
}: {
  settings: TuitionSettings;
  onExport: () => Promise<void>;
  onRestore: (backup: TuitionBackup) => Promise<void>;
  counts: { students: number; batches: number };
}) {
  const { t, lang } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<TuitionBackup | null>(null);

  const readFile = async (file: File) => {
    setError("");
    const result = parseBackupFile(await file.text());
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setPending(result.backup);
  };

  return (
    <Section
      title={t("tuStgBackupRestore")}
      description={t("tuStgBackupBlurb")}
    >
      <p className="text-sm text-muted">
        {counts.students} student{counts.students === 1 ? "" : "s"} · {counts.batches} batch
        {counts.batches === 1 ? "" : "es"}
        {settings.lastBackupAt
          ? ` · last backup ${new Date(settings.lastBackupAt).toLocaleDateString()}`
          : " · never backed up"}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => void onExport()} className={primaryBtnClass}>
          <Download className="h-4 w-4" />
          {t("tuStgDownloadBackup")}
        </button>
        <button type="button" onClick={() => fileRef.current?.click()} className={secondaryBtnClass}>
          <Upload className="h-4 w-4" />
          {t("tuStgRestoreFromFile")}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void readFile(file);
            event.target.value = "";
          }}
        />
      </div>
      {error && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <ConfirmDialog
        open={Boolean(pending)}
        title={t("tuStgRestoreQ")}
        message={t("tuStgRestoreBody")}
        confirmLabel={t("clWelRestore")}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (pending) void onRestore(pending);
          setPending(null);
        }}
      />
    </Section>
  );
}

// ---------------------------------------------------------------------------

function PinSection({
  settings,
  onSave,
  onLockNow,
}: {
  settings: TuitionSettings;
  onSave: (updates: Partial<TuitionSettings>) => Promise<void>;
  onLockNow?: () => void;
}) {
  const { t, lang } = useI18n();
  const hasPin = Boolean(settings.pinHash);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const flash = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const savePin = async () => {
    setError("");
    if (hasPin) {
      const ok = await verifyPin(currentPin, settings.pinSalt ?? "", settings.pinHash ?? "");
      if (!ok) {
        setError(t("tuStgPinWrong"));
        return;
      }
    }
    if (!isValidPinFormat(pin)) {
      setError(fill(t("appPinLengthError"), { min: PIN_MIN_LENGTH, max: PIN_MAX_LENGTH }));
      return;
    }
    if (pin !== confirmPin) {
      setError(t("tuStgPinMismatch"));
      return;
    }
    const salt = generateSalt();
    await onSave({ pinHash: await hashPin(pin, salt), pinSalt: salt });
    setPin("");
    setConfirmPin("");
    setCurrentPin("");
    flash();
  };

  const removePin = async () => {
    setError("");
    const ok = await verifyPin(currentPin, settings.pinSalt ?? "", settings.pinHash ?? "");
    if (!ok) {
      setError(t("tuStgPinNeeded"));
      return;
    }
    await onSave({ pinHash: "", pinSalt: "", autoLockMinutes: 0 });
    setCurrentPin("");
    flash();
  };

  return (
    <Section
      title={t("appLockTitle")}
      description={t("tuStgLockBlurb")}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
            hasPin ? "bg-emerald-100 text-emerald-700" : "bg-cream text-muted"
          }`}
        >
          {hasPin ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
          {t(hasPin ? "tuStgPinIsSet" : "tuStgNoPinSet")}
        </span>
        {hasPin && onLockNow && (
          <button type="button" onClick={onLockNow} className={secondaryBtnClass}>
            {t("clStLockNow")}
          </button>
        )}
        <SavedFlash show={saved} />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {hasPin && (
          <Field label={t("clStCurrentPin")}>
            <input
              type="password"
              inputMode="numeric"
              maxLength={PIN_MAX_LENGTH}
              value={currentPin}
              onChange={(event) => setCurrentPin(event.target.value.replace(/\D/g, ""))}
              className={inputClass}
            />
          </Field>
        )}
        <Field
          label={t(hasPin ? "clStNewPin" : "tuStgPin")}
          hint={fill(t("tuStgPinDigits"), { min: PIN_MIN_LENGTH, max: PIN_MAX_LENGTH })}
        >
          <input
            type="password"
            inputMode="numeric"
            maxLength={PIN_MAX_LENGTH}
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))}
            className={inputClass}
          />
        </Field>
        <Field label={t("clStConfirmPin")}>
          <input
            type="password"
            inputMode="numeric"
            maxLength={PIN_MAX_LENGTH}
            value={confirmPin}
            onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, ""))}
            className={inputClass}
          />
        </Field>
      </div>

      {hasPin && (
        <div className="mt-4">
          <Field label={t("clStAutoLockAfter")} hint={t("tuStgNeverLocks")}>
            <select
              value={settings.autoLockMinutes ?? 0}
              onChange={(event) => void onSave({ autoLockMinutes: Number(event.target.value) })}
              className={`${inputClass} w-auto`}
            >
              <option value={0}>Never</option>
              <option value={2}>2 minutes</option>
              <option value={5}>5 minutes</option>
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
            </select>
          </Field>
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => void savePin()} className={primaryBtnClass}>
          {t(hasPin ? "tuStgChangePin" : "appSetPin")}
        </button>
        {hasPin && (
          <button type="button" onClick={() => void removePin()} className={dangerBtnClass}>
            {t("tuStgRemovePin")}
          </button>
        )}
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------

function DangerSection({ onReset }: { onReset: () => Promise<void> }) {
  const { t, lang } = useI18n();
  const [confirm, setConfirm] = useState(false);
  return (
    <Section
      title={t("resetLabel")}
      description={t("tuStgResetBlurb")}
    >
      <button type="button" onClick={() => setConfirm(true)} className={dangerBtnClass}>
        <Trash2 className="h-4 w-4" />
        {t("tuStgDeleteAll")}
      </button>
      <ConfirmDialog
        open={confirm}
        title={t("tuStgDeleteAllQ")}
        message={t("tuStgDeleteAllBody")}
        confirmLabel={t("appDeleteEverything")}
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          void onReset();
          setConfirm(false);
        }}
      />
    </Section>
  );
}
