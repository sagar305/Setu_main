"use client";

import { useRef, useState } from "react";
import { Check, Copy, Download, Trash2, Upload } from "lucide-react";
import { usePharmacy } from "@/lib/pharmacy/store";
import {
  createBackup,
  downloadBackupFile,
  backupSummary,
  parseBackupFile,
} from "@/lib/pharmacy/backup";
import {
  APPS_SCRIPT_TEMPLATE,
  SHEET_TAB_NAMES,
  isValidSyncUrl,
  testSheetConnection,
} from "@/lib/pharmacy/sheetSync";
import { MESSAGE_PLACEHOLDERS } from "@/lib/pharmacy/messages";
import {
  PIN_MAX_LENGTH,
  PIN_MIN_LENGTH,
  generateSalt,
  hashPin,
  isValidPinFormat,
} from "@/lib/pos/pin";
import {
  SCHEDULE_CLASSES,
  SCHEDULE_LABELS,
  formatDate,
  type ReceiptPaperSize,
  type ScheduleClass,
} from "@/lib/pharmacy/types";
import {
  ConfirmDialog,
  Field,
  SectionCard,
  dangerBtnClass,
  inputClass,
  primaryBtnClass,
  secondaryBtnClass,
} from "./ui";

export function SettingsScreen() {
  const {
    applyRestoredBackup,
    business,
    clearAllData,
    deleteSupplier,
    saveSupplier,
    settings,
    suppliers,
    syncToSheet,
    updateBusiness,
    updateSettings,
  } = usePharmacy();

  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const backupInputRef = useRef<HTMLInputElement>(null);

  const say = (message: string) => {
    setNotice(message);
    setError("");
    window.setTimeout(() => setNotice(""), 4000);
  };

  return (
    <div className="grid gap-4">
      {notice && (
        <p className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm font-semibold text-green-800">
          {notice}
        </p>
      )}
      {error && (
        <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-700" role="alert">
          {error}
        </p>
      )}

      {/* ---------------------------------------------------------------- */}
      <SectionCard title="Shop details">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Shop name">
            <input
              className={inputClass}
              value={business?.name ?? ""}
              onChange={(event) => void updateBusiness({ name: event.target.value })}
            />
          </Field>
          <Field label="Phone">
            <input
              className={inputClass}
              value={business?.phone ?? ""}
              onChange={(event) => void updateBusiness({ phone: event.target.value })}
            />
          </Field>
          <Field label="Address">
            <input
              className={inputClass}
              value={business?.address ?? ""}
              onChange={(event) => void updateBusiness({ address: event.target.value })}
            />
          </Field>
          <Field label="Drug licence no." hint="Prints on every bill">
            <input
              className={inputClass}
              value={settings.drugLicenceNo}
              onChange={(event) => void updateSettings({ drugLicenceNo: event.target.value })}
            />
          </Field>
          <Field label="GSTIN">
            <input
              className={inputClass}
              value={settings.gstin}
              onChange={(event) => void updateSettings({ gstin: event.target.value.toUpperCase() })}
            />
          </Field>
        </div>
      </SectionCard>

      {/* ---------------------------------------------------------------- */}
      <SectionCard title="Expiry">
        <div className="grid gap-4">
          <Field
            label="Dashboard windows, in days"
            hint="Comma separated — the expiry screen gets one bucket per window"
          >
            <input
              className={inputClass}
              value={settings.expiryBuckets.join(", ")}
              onChange={(event) =>
                void updateSettings({
                  expiryBuckets: event.target.value
                    .split(",")
                    .map((part) => Math.round(Number(part.trim())))
                    .filter((days) => Number.isFinite(days) && days > 0)
                    .sort((a, b) => a - b),
                })
              }
            />
          </Field>

          <Field
            label="Refuse to bill a batch expiring within"
            hint="0 = warn only. Already-expired stock is never sellable, whatever this says."
          >
            <div className="flex items-center gap-2">
              <input
                className={`${inputClass} w-24`}
                value={settings.blockExpiryWithinDays}
                inputMode="numeric"
                onChange={(event) =>
                  void updateSettings({
                    blockExpiryWithinDays: Math.max(0, Number(event.target.value) || 0),
                  })
                }
              />
              <span className="text-sm text-muted">days</span>
            </div>
          </Field>

          <p className="text-xs text-muted">
            Set this to zero unless you have a reason not to. Selling a strip that expires in
            three weeks to someone on a five-day course is perfectly normal, and an app that
            refuses it gets switched off.
          </p>
        </div>
      </SectionCard>

      {/* ---------------------------------------------------------------- */}
      <SectionCard title="Prescriptions">
        <p className="mb-3 text-sm text-muted">
          A bill containing any of these cannot be completed without a doctor name, registration
          number and patient name.
        </p>
        <div className="flex flex-wrap gap-2">
          {SCHEDULE_CLASSES.filter(Boolean).map((schedule) => {
            const on = settings.prescriptionRequiredFor.includes(schedule as ScheduleClass);
            return (
              <button
                key={schedule}
                type="button"
                onClick={() =>
                  void updateSettings({
                    prescriptionRequiredFor: on
                      ? settings.prescriptionRequiredFor.filter((row) => row !== schedule)
                      : [...settings.prescriptionRequiredFor, schedule as ScheduleClass],
                  })
                }
                aria-pressed={on}
                className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                  on
                    ? "border-indigo bg-indigo text-white"
                    : "border-muted-line/40 bg-white text-muted hover:border-indigo/40"
                }`}
              >
                {on && <Check className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />}
                {SCHEDULE_LABELS[schedule as ScheduleClass]}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted">
          This app records what you enter. It does not verify a prescription, check a
          registration number, or decide whether a sale is lawful — that judgement stays with
          your registered pharmacist.
        </p>
      </SectionCard>

      {/* ---------------------------------------------------------------- */}
      <SectionCard title="Billing">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Invoice prefix">
            <input
              className={inputClass}
              value={settings.invoicePrefix}
              onChange={(event) => void updateSettings({ invoicePrefix: event.target.value })}
            />
          </Field>
          <Field label="Next invoice number">
            <input
              className={inputClass}
              value={settings.nextInvoiceNumber}
              inputMode="numeric"
              onChange={(event) =>
                void updateSettings({
                  nextInvoiceNumber: Math.max(1, Number(event.target.value) || 1),
                })
              }
            />
          </Field>
          <Field label="Return note prefix">
            <input
              className={inputClass}
              value={settings.returnNotePrefix}
              onChange={(event) => void updateSettings({ returnNotePrefix: event.target.value })}
            />
          </Field>
          <Field label="Receipt paper">
            <select
              className={inputClass}
              value={settings.receiptPaperSize}
              onChange={(event) =>
                void updateSettings({
                  receiptPaperSize: event.target.value as ReceiptPaperSize,
                })
              }
            >
              <option value="58mm">58 mm thermal</option>
              <option value="80mm">80 mm thermal</option>
              <option value="a4">A4</option>
            </select>
          </Field>
          <Field label="Payment modes" hint="Comma separated. “Credit” is what leaves a balance.">
            <input
              className={inputClass}
              value={settings.paymentModes.join(", ")}
              onChange={(event) =>
                void updateSettings({
                  paymentModes: event.target.value
                    .split(",")
                    .map((mode) => mode.trim())
                    .filter(Boolean),
                })
              }
            />
          </Field>
        </div>

        <label className="mt-4 flex items-start gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={settings.taxInclusive}
            onChange={(event) => void updateSettings({ taxInclusive: event.target.checked })}
            className="mt-0.5 h-4 w-4 rounded border-muted-line/50"
          />
          <span>
            Prices include tax
            <span className="block text-xs text-muted">
              On for a pharmacy — MRP is a printed tax-inclusive price. Tax is backed out for the
              GST summary rather than added to the bill.
            </span>
          </span>
        </label>
      </SectionCard>

      {/* ---------------------------------------------------------------- */}
      <SectionCard title="Suppliers">
        <SupplierEditor
          suppliers={suppliers}
          onSave={saveSupplier}
          onDelete={deleteSupplier}
        />
      </SectionCard>

      {/* ---------------------------------------------------------------- */}
      <SectionCard title="Message templates">
        <div className="grid gap-4">
          <Field label="Refill due">
            <textarea
              className={`${inputClass} min-h-[80px]`}
              value={settings.messageTemplates.refillDue}
              onChange={(event) =>
                void updateSettings({
                  messageTemplates: {
                    ...settings.messageTemplates,
                    refillDue: event.target.value,
                  },
                })
              }
            />
          </Field>
          <Field label="Balance reminder">
            <textarea
              className={`${inputClass} min-h-[80px]`}
              value={settings.messageTemplates.duesReminder}
              onChange={(event) =>
                void updateSettings({
                  messageTemplates: {
                    ...settings.messageTemplates,
                    duesReminder: event.target.value,
                  },
                })
              }
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            {MESSAGE_PLACEHOLDERS.map((placeholder) => (
              <span
                key={placeholder.token}
                className="rounded-full border border-muted-line/40 px-2 py-0.5 text-xs text-muted"
                title={placeholder.meaning}
              >
                {placeholder.token}
              </span>
            ))}
          </div>
          <p className="text-xs text-muted">
            Nothing is sent automatically. The app prepares each message and hands it to
            WhatsApp — you tap send, one customer at a time.
          </p>
        </div>
      </SectionCard>

      {/* ---------------------------------------------------------------- */}
      <SheetSyncCard
        settings={settings}
        onChange={updateSettings}
        onSync={syncToSheet}
        onNotice={say}
        onError={setError}
      />

      {/* ---------------------------------------------------------------- */}
      <SectionCard title="Backup and restore">
        <p className="mb-3 text-sm text-muted">
          Everything lives in this browser. If the machine is wiped or the browser data is
          cleared, so is your shop — take a backup regularly and keep it somewhere else.
          {settings.lastBackupAt &&
            ` Last backup: ${formatDate(settings.lastBackupAt.slice(0, 10))}.`}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={async () => {
              const backup = await createBackup();
              downloadBackupFile(backup);
              await updateSettings({ lastBackupAt: new Date().toISOString() });
              say(
                `Backup saved — ${backupSummary(backup)
                  .filter((row) => row.count > 0)
                  .map((row) => `${row.count} ${row.label.toLowerCase()}`)
                  .join(", ")}.`
              );
            }}
            className={primaryBtnClass}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Download a backup
          </button>
          <button
            type="button"
            onClick={() => backupInputRef.current?.click()}
            className={secondaryBtnClass}
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            Restore from a backup
          </button>
          <input
            ref={backupInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              const result = parseBackupFile(await file.text());
              if (!result.ok) {
                setError(result.error);
                return;
              }
              await applyRestoredBackup(result.backup);
              say("Backup restored.");
            }}
          />
        </div>
      </SectionCard>

      {/* ---------------------------------------------------------------- */}
      <SectionCard title="Screen lock">
        <PinEditor settings={settings} onChange={updateSettings} onNotice={say} />
      </SectionCard>

      {/* ---------------------------------------------------------------- */}
      <SectionCard title="Reset">
        <p className="mb-3 text-sm text-muted">
          Deletes every medicine, batch, bill, purchase and customer in this browser. Your
          business profile and other Setu tools are untouched.
        </p>
        <button type="button" onClick={() => setConfirmReset(true)} className={dangerBtnClass}>
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Delete everything
        </button>
      </SectionCard>

      <ConfirmDialog
        open={confirmReset}
        title="Delete the whole shop?"
        message="Every medicine, batch, bill and purchase goes. This cannot be undone — download a backup first if you are not certain."
        confirmLabel="Delete everything"
        onConfirm={async () => {
          await clearAllData();
          setConfirmReset(false);
        }}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  );
}

function SupplierEditor({
  suppliers,
  onSave,
  onDelete,
}: {
  suppliers: { id: string; name: string; phone: string; gstin: string; address: string }[];
  onSave: (
    input: { name: string; phone: string; gstin: string; address: string },
    id?: string
  ) => Promise<unknown>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [gstin, setGstin] = useState("");

  return (
    <div className="grid gap-3">
      {suppliers.length === 0 ? (
        <p className="text-sm text-muted">
          No suppliers yet. They are what makes an expiry return list actionable — stock with no
          supplier on it cannot be grouped into a return note.
        </p>
      ) : (
        <div className="grid gap-2">
          {suppliers.map((supplier) => (
            <div
              key={supplier.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-muted-line/30 p-2.5"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-ink">
                  {supplier.name}
                </span>
                <span className="block truncate text-xs text-muted">
                  {[supplier.phone, supplier.gstin].filter(Boolean).join(" · ")}
                </span>
              </span>
              <button
                type="button"
                onClick={() => void onDelete(supplier.id)}
                className="rounded p-1.5 text-muted hover:text-red-600"
                aria-label={`Remove ${supplier.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
        <input
          className={inputClass}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Distributor name"
        />
        <input
          className={inputClass}
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="Phone"
          inputMode="tel"
        />
        <input
          className={inputClass}
          value={gstin}
          onChange={(event) => setGstin(event.target.value.toUpperCase())}
          placeholder="GSTIN"
        />
        <button
          type="button"
          className={primaryBtnClass}
          disabled={!name.trim()}
          onClick={async () => {
            await onSave({ name: name.trim(), phone: phone.trim(), gstin: gstin.trim(), address: "" });
            setName("");
            setPhone("");
            setGstin("");
          }}
        >
          Add
        </button>
      </div>
    </div>
  );
}

function SheetSyncCard({
  settings,
  onChange,
  onSync,
  onNotice,
  onError,
}: {
  settings: { sheetSyncUrl: string; lastSyncAt: string | null };
  onChange: (updates: { sheetSyncUrl?: string }) => Promise<void>;
  onSync: () => Promise<void>;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [url, setUrl] = useState(settings.sheetSyncUrl);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  return (
    <SectionCard title="Google Sheet sync">
      <p className="mb-3 text-sm text-muted">
        One-way, and off until you set it up. Paste the script below into your own Google Sheet,
        deploy it as a web app with access set to &ldquo;Anyone&rdquo;, and put the URL here.
        Nothing leaves this device otherwise.
      </p>

      <Field label="Apps Script web-app URL">
        <input
          className={inputClass}
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://script.google.com/macros/s/…/exec"
        />
      </Field>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className={secondaryBtnClass}
          disabled={busy || !isValidSyncUrl(url)}
          onClick={async () => {
            setBusy(true);
            const result = await testSheetConnection(url);
            setBusy(false);
            if (result.ok) {
              await onChange({ sheetSyncUrl: url.trim() });
              onNotice("Connected. The sheet is ready to receive.");
            } else {
              onError(result.error ?? "Could not reach that script.");
            }
          }}
        >
          Test and save
        </button>
        <button
          type="button"
          className={primaryBtnClass}
          disabled={busy || !settings.sheetSyncUrl}
          onClick={async () => {
            setBusy(true);
            try {
              await onSync();
              onNotice("Pushed to your sheet.");
            } catch (caught) {
              onError(caught instanceof Error ? caught.message : "The push failed.");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Working…" : "Push now"}
        </button>
        <button
          type="button"
          className={secondaryBtnClass}
          onClick={async () => {
            await navigator.clipboard.writeText(APPS_SCRIPT_TEMPLATE);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2500);
          }}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied" : "Copy the script"}
        </button>
      </div>

      <p className="mt-3 text-xs text-muted">
        Tabs written: {SHEET_TAB_NAMES.join(", ")}.{" "}
        <strong>
          The Schedule Register tab carries patient and doctor names — leave sync off if you
          would rather that never leaves the counter.
        </strong>
        {settings.lastSyncAt && ` Last pushed ${formatDate(settings.lastSyncAt.slice(0, 10))}.`}
      </p>
    </SectionCard>
  );
}

function PinEditor({
  settings,
  onChange,
  onNotice,
}: {
  settings: { pinHash?: string; pinSalt?: string; autoLockMinutes?: number };
  onChange: (updates: {
    pinHash?: string;
    pinSalt?: string;
    autoLockMinutes?: number;
  }) => Promise<void>;
  onNotice: (message: string) => void;
}) {
  const [pin, setPin] = useState("");
  const [problem, setProblem] = useState("");
  const hasPin = Boolean(settings.pinHash && settings.pinSalt);

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted">
        A PIN keeps the counter machine from showing your margins and customer balances to
        whoever walks behind it. It protects the screen, not the data — anyone with the device
        can still read the browser&rsquo;s storage.
      </p>

      {hasPin ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-green-300 bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-800">
            PIN is on
          </span>
          <button
            type="button"
            className={secondaryBtnClass}
            onClick={async () => {
              await onChange({ pinHash: "", pinSalt: "" });
              onNotice("PIN removed.");
            }}
          >
            Remove PIN
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <Field label={`Set a PIN (${PIN_MIN_LENGTH}–${PIN_MAX_LENGTH} digits)`}>
            <input
              className={`${inputClass} w-40`}
              value={pin}
              inputMode="numeric"
              type="password"
              onChange={(event) => setPin(event.target.value)}
            />
          </Field>
          <button
            type="button"
            className={primaryBtnClass}
            onClick={async () => {
              if (!isValidPinFormat(pin)) {
                setProblem(`A PIN is ${PIN_MIN_LENGTH} to ${PIN_MAX_LENGTH} digits.`);
                return;
              }
              const salt = generateSalt();
              await onChange({ pinHash: await hashPin(pin, salt), pinSalt: salt });
              setPin("");
              setProblem("");
              onNotice("PIN set.");
            }}
          >
            Set PIN
          </button>
        </div>
      )}

      {problem && <p className="text-sm font-semibold text-red-600">{problem}</p>}

      <Field label="Lock after idle minutes" hint="0 = never">
        <input
          className={`${inputClass} w-32`}
          value={settings.autoLockMinutes ?? 0}
          inputMode="numeric"
          onChange={(event) =>
            void onChange({ autoLockMinutes: Math.max(0, Number(event.target.value) || 0) })
          }
        />
      </Field>
    </div>
  );
}
