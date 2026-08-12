"use client";

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
import { MESSAGE_PLACEHOLDERS } from "@/lib/tuition/messages";
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
  DEFAULT_TEMPLATES,
  describeDays,
  formatDate,
  formatReceiptNumber,
  todayIso,
  WEEKDAYS,
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
  if (!show) return null;
  return <span className="text-sm font-semibold text-emerald-600">Saved ✓</span>;
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
      title="Your details"
      description="Shown on fee receipts and in the messages you send parents. Shared with your other Setu tools on this device."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name / institute name">
          <input
            type="text"
            value={form.name}
            onChange={(event) => setForm((p) => ({ ...p, name: event.target.value }))}
            className={inputClass}
          />
        </Field>
        <Field label="Phone">
          <input
            type="tel"
            value={form.phone}
            onChange={(event) => setForm((p) => ({ ...p, phone: event.target.value }))}
            className={inputClass}
          />
        </Field>
        <Field label="Email">
          <input
            type="email"
            value={form.email}
            onChange={(event) => setForm((p) => ({ ...p, email: event.target.value }))}
            className={inputClass}
          />
        </Field>
        <Field label="UPI ID" hint="Puts a Pay now button on receipts and reminders">
          <input
            type="text"
            value={form.upiId}
            onChange={(event) => setForm((p) => ({ ...p, upiId: event.target.value }))}
            placeholder="yourname@okhdfcbank"
            className={inputClass}
          />
        </Field>
        <Field label="Currency">
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
        <Field label="Address">
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
          Save details
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
      setError(describeConflict(blocking[0]));
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
      setError(caught instanceof Error ? caught.message : "Could not save this batch.");
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
      title="Batches"
      description="A batch is a class you take, with its own timing and its own fee. A student enrolled in two batches pays both fees. Two batches cannot run at the same time — you can only be in one place."
    >
      {batches.length === 0 ? (
        <p className="rounded-xl bg-cream-paper p-4 text-sm text-muted">
          No batches yet. Add one to start marking attendance and charging fees.
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
                        Inactive
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {[
                      batch.subject,
                      describeDays(batch.days),
                      `${batch.startTime}–${batch.endTime}`,
                      `${count} student${count === 1 ? "" : "s"}`,
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
                    aria-label={`Delete ${batch.name}`}
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
        Add batch
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit batch" : "Add batch"}>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Batch name" required>
            <input
              type="text"
              value={form.name}
              onChange={(event) => setForm((p) => ({ ...p, name: event.target.value }))}
              placeholder="e.g. Class 10 Maths — Evening"
              className={inputClass}
              autoFocus
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Subject">
              <input
                type="text"
                value={form.subject}
                onChange={(event) => setForm((p) => ({ ...p, subject: event.target.value }))}
                className={inputClass}
              />
            </Field>
            <Field label="Class / grade">
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
              Days
            </span>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map((label, day) => (
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
            <Field label="Starts">
              <input
                type="time"
                value={form.startTime}
                onChange={(event) => setForm((p) => ({ ...p, startTime: event.target.value }))}
                className={inputClass}
              />
            </Field>
            <Field label="Ends">
              <input
                type="time"
                value={form.endTime}
                onChange={(event) => setForm((p) => ({ ...p, endTime: event.target.value }))}
                className={inputClass}
              />
            </Field>
            <Field label="Fee per month" required>
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
          <Field label="Venue (optional)">
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
            Batch is running
          </label>

          {blocking.length > 0 && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {describeConflict(blocking[0])}
            </p>
          )}

          {blocking.length === 0 && warning && (
            <div className="rounded-lg border border-saffron/40 bg-saffron/10 px-4 py-3">
              <p className="text-sm text-ink">{describeConflict(warning)}</p>
              <label className="mt-2 flex items-center gap-2 text-sm text-muted">
                <input
                  type="checkbox"
                  checked={acceptedWarning}
                  onChange={(event) => setAcceptedWarning(event.target.checked)}
                  className="h-4 w-4 rounded border-muted-line/40 text-indigo focus:ring-indigo"
                />
                This is a separate group at a different time
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
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || blocking.length > 0 || (Boolean(warning) && !acceptedWarning)}
              className={primaryBtnClass}
            >
              {saving ? "Saving…" : editing ? "Save changes" : "Add batch"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title={`Delete ${confirmDelete?.name ?? "this batch"}?`}
        message="Students in this batch stay, but they will no longer be enrolled in it and their fee will change. Past attendance and fees are kept."
        confirmLabel="Delete batch"
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
      title="Fees & receipts"
      description="Monthly dues are raised automatically for every active student from their joining month onwards."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Receipt prefix">
          <input
            type="text"
            value={prefix}
            onChange={(event) => setPrefix(event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Next receipt number" hint={`Next: ${formatReceiptNumber(prefix, Number(next) || 1)}`}>
          <input
            type="number"
            min={1}
            value={next}
            onChange={(event) => setNext(event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Fees due on day" hint="Day of the month the monthly fee falls due">
          <input
            type="number"
            min={1}
            max={28}
            value={dueDay}
            onChange={(event) => setDueDay(event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Payment modes" hint="Comma separated">
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
        Raise each month&apos;s dues automatically when I open the app
      </label>
      <p className="mt-2 text-xs text-muted">
        Amounts are in {currency}. A due is snapshotted when it is raised, so changing a batch fee
        later never rewrites an old month.
      </p>
      <div className="mt-4 flex items-center gap-3">
        <button type="button" onClick={() => void save()} className={primaryBtnClass}>
          Save
        </button>
        <SavedFlash show={saved} />
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------

const TEMPLATE_LABELS: { key: keyof MessageTemplates; label: string }[] = [
  { key: "feeReminder", label: "Fee reminder" },
  { key: "absent", label: "Absent notice" },
  { key: "receipt", label: "Payment receipt" },
  { key: "marks", label: "Test result" },
  { key: "diary", label: "Diary note" },
  { key: "birthday", label: "Birthday wish" },
  { key: "attendanceReport", label: "Attendance report" },
];

function TemplatesSection({
  settings,
  onSave,
}: {
  settings: TuitionSettings;
  onSave: (updates: Partial<TuitionSettings>) => Promise<void>;
}) {
  const [templates, setTemplates] = useState<MessageTemplates>(settings.templates);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    await onSave({ templates });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <Section
      title="Message templates"
      description="What gets typed into WhatsApp. Edit the wording — write them in Hindi or your local language if that is what parents read."
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
          Placeholders you can use
        </summary>
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          {MESSAGE_PLACEHOLDERS.map((item) => (
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
          Show the class average on shared test results
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={settings.showRank}
            onChange={(event) => void onSave({ showRank: event.target.checked })}
            className="h-4 w-4 rounded border-muted-line/40 text-indigo focus:ring-indigo"
          />
          Show the student&apos;s rank on shared test results
        </label>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button type="button" onClick={() => void save()} className={primaryBtnClass}>
          Save templates
        </button>
        <button
          type="button"
          onClick={() => setTemplates({ ...DEFAULT_TEMPLATES })}
          className={secondaryBtnClass}
        >
          Reset to default
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
  const [date, setDate] = useState(todayIso());
  const [name, setName] = useState("");

  return (
    <Section
      title="Holidays"
      description="Days you are not taking class. The attendance screen warns you instead of leaving a false absence."
    >
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Date">
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Reason">
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Diwali"
            className={inputClass}
          />
        </Field>
        <button
          type="button"
          onClick={() => {
            if (date) void onAdd(date, name.trim() || "Holiday");
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
              <span className="font-semibold">{formatDate(holiday.date)}</span>
              <span className="text-muted">{holiday.name}</span>
              <button
                type="button"
                onClick={() => void onRemove(holiday.id)}
                className="text-muted transition hover:text-red-600"
                aria-label={`Remove ${holiday.name}`}
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
      setError(caught instanceof Error ? caught.message : "Could not connect.");
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
      title="Google Sheet sync"
      description="Push a copy of your students, attendance, fees and marks into your own Google Sheet. It is your backup and your report — the app keeps working offline either way."
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
          {copied ? "Script copied" : "Copy the script"}
        </button>
        <a
          href="https://sheets.new"
          target="_blank"
          rel="noopener noreferrer"
          className={secondaryBtnClass}
        >
          <ExternalLink className="h-4 w-4" />
          New Google Sheet
        </a>
      </div>

      <div className="mt-4">
        <Field label="Web app URL">
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
          {connecting ? "Connecting…" : connected ? "Reconnect" : "Connect"}
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
              Sync now
            </button>
            <button type="button" onClick={() => void onResync()} className={secondaryBtnClass}>
              Re-send everything
            </button>
            <button type="button" onClick={() => void onDisconnect()} className={secondaryBtnClass}>
              Disconnect
            </button>
          </>
        )}
      </div>

      {connected && (
        <p className="mt-3 text-xs text-muted">
          {sheetSync.lastError
            ? `Last sync failed: ${sheetSync.lastError}`
            : sheetSync.lastSyncAt
              ? `Last synced ${new Date(sheetSync.lastSyncAt).toLocaleString()}`
              : "Not synced yet."}
          {sheetSync.dirtyCount > 0 ? ` · ${sheetSync.dirtyCount} change(s) waiting` : ""}
        </p>
      )}

      <details className="mt-4 rounded-xl bg-cream-paper p-3">
        <summary className="cursor-pointer text-sm font-semibold text-ink">
          Show the script
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
      title="Backup & restore"
      description="Everything lives in this browser. Take a backup before changing devices or clearing browser data."
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
          Download backup
        </button>
        <button type="button" onClick={() => fileRef.current?.click()} className={secondaryBtnClass}>
          <Upload className="h-4 w-4" />
          Restore from file
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
        title="Restore this backup?"
        message="Your current students, attendance, fees and marks will be replaced by the ones in this file. Other Setu tools on this device are not touched."
        confirmLabel="Restore"
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
        setError("Current PIN is incorrect.");
        return;
      }
    }
    if (!isValidPinFormat(pin)) {
      setError(`PIN must be ${PIN_MIN_LENGTH}–${PIN_MAX_LENGTH} digits.`);
      return;
    }
    if (pin !== confirmPin) {
      setError("The two PINs don't match.");
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
      setError("Enter your current PIN to remove it.");
      return;
    }
    await onSave({ pinHash: "", pinSalt: "", autoLockMinutes: 0 });
    setCurrentPin("");
    flash();
  };

  return (
    <Section
      title="Screen lock"
      description="You are storing parents' phone numbers and fee records. A PIN keeps them off a shared or borrowed phone."
    >
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
            hasPin ? "bg-emerald-100 text-emerald-700" : "bg-cream text-muted"
          }`}
        >
          {hasPin ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
          {hasPin ? "PIN is set" : "No PIN set"}
        </span>
        {hasPin && onLockNow && (
          <button type="button" onClick={onLockNow} className={secondaryBtnClass}>
            Lock now
          </button>
        )}
        <SavedFlash show={saved} />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {hasPin && (
          <Field label="Current PIN">
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
        <Field label={hasPin ? "New PIN" : "PIN"} hint={`${PIN_MIN_LENGTH}–${PIN_MAX_LENGTH} digits`}>
          <input
            type="password"
            inputMode="numeric"
            maxLength={PIN_MAX_LENGTH}
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))}
            className={inputClass}
          />
        </Field>
        <Field label="Confirm PIN">
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
          <Field label="Auto-lock after" hint="0 = never">
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
          {hasPin ? "Change PIN" : "Set PIN"}
        </button>
        {hasPin && (
          <button type="button" onClick={() => void removePin()} className={dangerBtnClass}>
            Remove PIN
          </button>
        )}
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------

function DangerSection({ onReset }: { onReset: () => Promise<void> }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <Section
      title="Reset"
      description="Deletes every student, attendance mark, fee record, test and note from this browser. Your other Setu tools are not touched."
    >
      <button type="button" onClick={() => setConfirm(true)} className={dangerBtnClass}>
        <Trash2 className="h-4 w-4" />
        Delete all tuition data
      </button>
      <ConfirmDialog
        open={confirm}
        title="Delete everything?"
        message="This cannot be undone. Download a backup first if you might need this data."
        confirmLabel="Delete everything"
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          void onReset();
          setConfirm(false);
        }}
      />
    </Section>
  );
}
