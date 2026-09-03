"use client";

// Settings.
//
// Grouped by when an owner comes looking: the rules that change what
// availability means first, then money, then paperwork, then the things touched
// once (sync, backup, lock, reset). Every field saves as it is changed — there
// is no Save button to forget.

import { useEffect, useRef, useState } from "react";
import {
  Download,
  Link2,
  Lock,
  RefreshCw,
  Sheet,
  Trash2,
  Upload,
} from "lucide-react";
import { getPreferences, setPreferences } from "@/lib/toolkit/preferences";
import { shortLinksConfigured } from "@/lib/toolkit/shortLink";
import { generateSalt, hashPin, isValidPinFormat } from "@/lib/pos/pin";
import { useRental } from "@/lib/rental/store";
import {
  createBackup,
  downloadBackupFile,
  backupSummary,
  parseBackupFile,
} from "@/lib/rental/backup";
import { APPS_SCRIPT_TEMPLATE, isValidSyncUrl, testSheetConnection } from "@/lib/rental/sheetSync";
import { TEMPLATE_LABELS } from "@/lib/rental/messages";
import {
  DEFAULT_MESSAGE_TEMPLATES,
  MESSAGE_PLACEHOLDERS,
  type RentalTemplateKey,
} from "@/lib/rental/types";
import {
  ConfirmDialog,
  Field,
  SectionCard,
  chipBtnClass,
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
    settings,
    syncToSheet,
    updateBusiness,
    updateSettings,
  } = useRental();

  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [pin, setPin] = useState("");
  const [autoShorten, setAutoShorten] = useState(false);
  const [shortLinksOn, setShortLinksOn] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showScript, setShowScript] = useState(false);

  useEffect(() => {
    const preferences = getPreferences();
    setShortLinksOn(preferences.shortLinks);
    setAutoShorten(preferences.shortLinksAuto);
  }, []);

  const say = (text: string) => {
    setMessage(text);
    setError("");
    window.setTimeout(() => setMessage(""), 2500);
  };

  const fail = (caught: unknown, fallback: string) => {
    setError(caught instanceof Error ? caught.message : fallback);
    setMessage("");
  };

  return (
    <div className="grid gap-4">
      {message ? (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <SectionCard title="Business details">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Business name">
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
          <Field label="GSTIN">
            <input
              className={inputClass}
              value={business?.taxNumber ?? ""}
              onChange={(event) => void updateBusiness({ taxNumber: event.target.value })}
            />
          </Field>
          <Field label="UPI ID" hint="Shown as a pay button on links you share.">
            <input
              className={inputClass}
              value={business?.upiId ?? ""}
              onChange={(event) => void updateBusiness({ upiId: event.target.value })}
              placeholder="tenthouse@okhdfcbank"
            />
          </Field>
        </div>
        <p className="mt-2 text-xs text-muted">
          These are shared with every Setu tool on this device — change them here and the invoice
          generator sees the change too.
        </p>
      </SectionCard>

      <SectionCard title="Availability rules">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Buffer days"
            hint="Days after a booking is due back before that stock can go out again."
          >
            <input
              className={inputClass}
              inputMode="numeric"
              value={settings.bufferDays}
              onChange={(event) =>
                void updateSettings({ bufferDays: Math.max(0, Number(event.target.value) || 0) })
              }
            />
          </Field>
          <label className="flex items-start gap-2 pt-6 text-sm text-ink">
            <input
              type="checkbox"
              checked={settings.countReturnDay}
              onChange={(event) => void updateSettings({ countReturnDay: event.target.checked })}
              className="mt-0.5 h-4 w-4 accent-indigo"
            />
            <span>
              Charge for the return day
              <span className="mt-0.5 block text-xs text-muted">
                Saturday out, Sunday back is two days with this on, one with it off.
              </span>
            </span>
          </label>
        </div>
      </SectionCard>

      <SectionCard title="Charges">
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Late fee basis">
            <select
              className={inputClass}
              value={settings.defaultLateFeeBasis}
              onChange={(event) =>
                void updateSettings({
                  defaultLateFeeBasis: event.target.value as "item-rate" | "fixed",
                })
              }
            >
              <option value="item-rate">Per item, per day</option>
              <option value="fixed">Flat, per day</option>
            </select>
          </Field>
          {settings.defaultLateFeeBasis === "fixed" ? (
            <Field label="Flat late fee per day">
              <input
                className={inputClass}
                inputMode="decimal"
                value={settings.fixedLateFeePerDay}
                onChange={(event) =>
                  void updateSettings({ fixedLateFeePerDay: Number(event.target.value) || 0 })
                }
              />
            </Field>
          ) : null}
          <Field
            label="Minimum advance %"
            hint="Of the booking's value, before it can be confirmed. 0 = none."
          >
            <input
              className={inputClass}
              inputMode="decimal"
              value={settings.minAdvancePercent}
              onChange={(event) =>
                void updateSettings({
                  minAdvancePercent: Math.min(100, Math.max(0, Number(event.target.value) || 0)),
                })
              }
            />
          </Field>
          <Field label="Quotation valid for (days)">
            <input
              className={inputClass}
              inputMode="numeric"
              value={settings.quotationValidDays}
              onChange={(event) =>
                void updateSettings({
                  quotationValidDays: Math.max(1, Number(event.target.value) || 1),
                })
              }
            />
          </Field>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Damage presets" hint="Comma-separated. Offered as tags at return.">
            <input
              className={inputClass}
              value={settings.damagePresets.join(", ")}
              onChange={(event) =>
                void updateSettings({
                  damagePresets: event.target.value
                    .split(",")
                    .map((value) => value.trim())
                    .filter(Boolean),
                })
              }
            />
          </Field>
          <Field
            label="Damage percentages"
            hint="Share of replacement value offered as buttons at return."
          >
            <input
              className={inputClass}
              value={settings.damagePercentOptions.join(", ")}
              onChange={(event) =>
                void updateSettings({
                  damagePercentOptions: event.target.value
                    .split(",")
                    .map((value) => Number(value.trim()))
                    .filter((value) => Number.isFinite(value) && value > 0),
                })
              }
            />
          </Field>
        </div>

        <label className="mt-3 flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={settings.taxEnabled}
            onChange={(event) => void updateSettings({ taxEnabled: event.target.checked })}
            className="h-4 w-4 accent-indigo"
          />
          Charge tax on hires
        </label>
        {settings.taxEnabled ? (
          <div className="mt-2 max-w-[200px]">
            <Field label="Default tax rate %">
              <input
                className={inputClass}
                inputMode="decimal"
                value={settings.defaultTaxRate}
                onChange={(event) =>
                  void updateSettings({ defaultTaxRate: Number(event.target.value) || 0 })
                }
              />
            </Field>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard title="Billing">
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Booking prefix">
            <input
              className={inputClass}
              value={settings.bookingPrefix}
              onChange={(event) => void updateSettings({ bookingPrefix: event.target.value })}
            />
          </Field>
          <Field label="Next booking no">
            <input
              className={inputClass}
              inputMode="numeric"
              value={settings.nextBookingNumber}
              onChange={(event) =>
                void updateSettings({
                  nextBookingNumber: Math.max(1, Number(event.target.value) || 1),
                })
              }
            />
          </Field>
          <Field label="Invoice prefix">
            <input
              className={inputClass}
              value={settings.invoicePrefix}
              onChange={(event) => void updateSettings({ invoicePrefix: event.target.value })}
            />
          </Field>
          <Field label="Next invoice no">
            <input
              className={inputClass}
              inputMode="numeric"
              value={settings.nextInvoiceNumber}
              onChange={(event) =>
                void updateSettings({
                  nextInvoiceNumber: Math.max(1, Number(event.target.value) || 1),
                })
              }
            />
          </Field>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Payment modes" hint="Comma-separated.">
            <input
              className={inputClass}
              value={settings.paymentModes.join(", ")}
              onChange={(event) =>
                void updateSettings({
                  paymentModes: event.target.value
                    .split(",")
                    .map((value) => value.trim())
                    .filter(Boolean),
                })
              }
            />
          </Field>
          <Field label="Receipt paper">
            <select
              className={inputClass}
              value={settings.receiptPaperSize}
              onChange={(event) =>
                void updateSettings({
                  receiptPaperSize: event.target.value as "58mm" | "80mm" | "a4",
                })
              }
            >
              <option value="58mm">58mm thermal</option>
              <option value="80mm">80mm thermal</option>
              <option value="a4">A4</option>
            </select>
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Message templates">
        <p className="mb-3 text-xs text-muted">
          Placeholders: {MESSAGE_PLACEHOLDERS.map((row) => row.token).join(" · ")}
        </p>
        <div className="grid gap-3">
          {(Object.keys(TEMPLATE_LABELS) as RentalTemplateKey[]).map((key) => (
            <Field key={key} label={TEMPLATE_LABELS[key]}>
              <textarea
                className={inputClass}
                rows={2}
                value={settings.messageTemplates[key] ?? ""}
                onChange={(event) =>
                  void updateSettings({
                    messageTemplates: {
                      ...settings.messageTemplates,
                      [key]: event.target.value,
                    },
                  })
                }
              />
            </Field>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void updateSettings({ messageTemplates: DEFAULT_MESSAGE_TEMPLATES })}
          className={`${chipBtnClass} mt-3`}
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Reset to defaults
        </button>
      </SectionCard>

      {shortLinksConfigured() ? (
        <SectionCard title="Sharing links">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={shortLinksOn}
              onChange={(event) => {
                setShortLinksOn(event.target.checked);
                setPreferences({ shortLinks: event.target.checked });
              }}
              className="mt-0.5 h-4 w-4 accent-indigo"
            />
            <span className="text-sm text-ink">
              Offer to shorten links
              <span className="mt-1 block text-xs text-muted">
                Adds a Shorten button to the send sheet. Nothing is uploaded until you press it.
              </span>
            </span>
          </label>

          <label className={`mt-3 flex items-start gap-3 ${shortLinksOn ? "" : "opacity-50"}`}>
            <input
              type="checkbox"
              checked={autoShorten && shortLinksOn}
              disabled={!shortLinksOn}
              onChange={(event) => {
                setAutoShorten(event.target.checked);
                setPreferences({ shortLinksAuto: event.target.checked });
              }}
              className="mt-0.5 h-4 w-4 accent-indigo"
            />
            <span className="text-sm text-ink">
              Shorten every link automatically
              <span className="mt-1 block text-xs text-muted">
                Every quote, confirmation and settlement you send gets a short link without a
                second tap. The booking is stored online so the link can stay short, and deleted
                180 days after it was last opened. If you are offline, you get the full
                self-contained link instead.
              </span>
            </span>
          </label>

          <p className="mt-3 flex items-start gap-2 rounded-lg bg-cream-paper/60 p-3 text-xs text-muted">
            <Link2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            This setting is shared with every Setu tool on this device.
          </p>
        </SectionCard>
      ) : null}

      <SectionCard title="Google Sheet sync">
        <Field
          label="Apps Script web app URL"
          hint="One-way: this pushes a snapshot up. Nothing is ever pulled back down."
        >
          <input
            className={inputClass}
            value={settings.sheetSyncUrl}
            onChange={(event) => void updateSettings({ sheetSyncUrl: event.target.value })}
            placeholder="https://script.google.com/macros/s/…/exec"
          />
        </Field>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className={chipBtnClass}
            disabled={!isValidSyncUrl(settings.sheetSyncUrl ?? "")}
            onClick={async () => {
              const result = await testSheetConnection(settings.sheetSyncUrl);
              if (result.ok) say("Connected to the sheet.");
              else fail(new Error(result.error ?? ""), "Could not reach the script.");
            }}
          >
            Test connection
          </button>
          <button
            type="button"
            className={primaryBtnClass}
            disabled={syncing || !isValidSyncUrl(settings.sheetSyncUrl ?? "")}
            onClick={async () => {
              setSyncing(true);
              try {
                await syncToSheet();
                say("Pushed to your sheet.");
              } catch (caught) {
                fail(caught, "Could not push to the sheet.");
              } finally {
                setSyncing(false);
              }
            }}
          >
            <Sheet className="h-4 w-4" aria-hidden="true" />
            {syncing ? "Pushing…" : "Push now"}
          </button>
          <button
            type="button"
            className={chipBtnClass}
            onClick={() => setShowScript((value) => !value)}
          >
            {showScript ? "Hide" : "Show"} the script
          </button>
        </div>

        {settings.lastSyncAt ? (
          <p className="mt-2 text-xs text-muted">
            Last pushed {new Date(settings.lastSyncAt).toLocaleString("en-IN")}.
          </p>
        ) : null}

        {showScript ? (
          <pre className="mt-3 overflow-x-auto rounded-lg bg-ink/95 p-3 text-[11px] leading-relaxed text-white">
            {APPS_SCRIPT_TEMPLATE}
          </pre>
        ) : null}
      </SectionCard>

      <SectionCard title="Backup & restore">
        <p className="mb-3 text-xs text-muted">
          Everything lives in this browser. A backup is the only copy that survives a cleared
          cache or a lost phone — take one weekly.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={primaryBtnClass}
            onClick={async () => {
              try {
                const backup = await createBackup();
                downloadBackupFile(backup);
                await updateSettings({ lastBackupAt: new Date().toISOString() });
                say(
                  `Backed up: ${backupSummary(backup)
                    .filter((row) => row.count > 0)
                    .map((row) => `${row.count} ${row.label.toLowerCase()}`)
                    .join(", ")}.`
                );
              } catch (caught) {
                fail(caught, "Could not create the backup.");
              }
            }}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Download backup
          </button>
          <button type="button" className={secondaryBtnClass} onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" aria-hidden="true" />
            Restore
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              const result = parseBackupFile(await file.text());
              if (!result.ok) {
                fail(new Error(result.error), result.error);
                return;
              }
              try {
                await applyRestoredBackup(result.backup);
                say("Restored.");
              } catch (caught) {
                fail(caught, "Could not restore that backup.");
              }
            }}
          />
        </div>
        {settings.lastBackupAt ? (
          <p className="mt-2 text-xs text-muted">
            Last backup {new Date(settings.lastBackupAt).toLocaleString("en-IN")}.
          </p>
        ) : (
          <p className="mt-2 text-xs text-amber-700">No backup taken yet.</p>
        )}
      </SectionCard>

      <SectionCard title="Screen lock">
        <p className="mb-3 text-xs text-muted">
          A PIN keeps a passer-by out of your rates and customer list. It is not encryption —
          anyone with the device and the know-how can still read the database.
        </p>
        {settings.pinHash ? (
          <button
            type="button"
            className={dangerBtnClass}
            onClick={() => void updateSettings({ pinHash: "", pinSalt: "" })}
          >
            <Lock className="h-4 w-4" aria-hidden="true" />
            Remove PIN
          </button>
        ) : (
          <div className="flex flex-wrap items-end gap-2">
            <div className="max-w-[160px]">
              <Field label="New PIN" hint="4–8 digits.">
                <input
                  className={inputClass}
                  inputMode="numeric"
                  value={pin}
                  onChange={(event) => setPin(event.target.value)}
                />
              </Field>
            </div>
            <button
              type="button"
              className={primaryBtnClass}
              onClick={async () => {
                if (!isValidPinFormat(pin)) {
                  fail(new Error(""), "A PIN is 4 to 8 digits.");
                  return;
                }
                const salt = generateSalt();
                await updateSettings({ pinHash: await hashPin(pin, salt), pinSalt: salt });
                setPin("");
                say("PIN set.");
              }}
            >
              Set PIN
            </button>
          </div>
        )}

        <div className="mt-3 max-w-[220px]">
          <Field label="Auto-lock after (minutes)" hint="0 = never.">
            <input
              className={inputClass}
              inputMode="numeric"
              value={settings.autoLockMinutes ?? 0}
              onChange={(event) =>
                void updateSettings({ autoLockMinutes: Math.max(0, Number(event.target.value) || 0) })
              }
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Danger zone">
        <button type="button" className={dangerBtnClass} onClick={() => setConfirmReset(true)}>
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Erase the hire book
        </button>
        <p className="mt-2 text-xs text-muted">
          Deletes every item, customer and booking in this browser. Your business profile and
          other Setu tools are untouched. Take a backup first.
        </p>
      </SectionCard>

      <ConfirmDialog
        open={confirmReset}
        title="Erase everything?"
        message="Every item, customer, booking and maintenance log is deleted. This cannot be undone."
        confirmLabel="Erase"
        onCancel={() => setConfirmReset(false)}
        onConfirm={async () => {
          setConfirmReset(false);
          try {
            await clearAllData();
          } catch (caught) {
            fail(caught, "Could not erase the data.");
          }
        }}
      />
    </div>
  );
}
