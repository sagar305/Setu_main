"use client";

// Settings — §3.8.
//
// Grouped by when an owner comes looking: the checklists that make intake fast
// first, then the rules that colour the board, then money, then paperwork, then
// the things touched once (sync, backup, lock, reset). Every field saves as it
// is changed — there is no Save button to forget.

import { useRef, useState } from "react";
import {
  Download,
  Lock,
  Plus,
  RefreshCw,
  Sheet,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { generateSalt, hashPin, isValidPinFormat } from "@/lib/pos/pin";
import { shortLinksConfigured } from "@/lib/toolkit/shortLink";
import { useRepair } from "@/lib/repair/store";
import {
  backupSummary,
  createBackup,
  downloadBackupFile,
  parseBackupFile,
} from "@/lib/repair/backup";
import { APPS_SCRIPT_TEMPLATE, isValidSyncUrl, testSheetConnection } from "@/lib/repair/sheetSync";
import { TEMPLATE_LABELS } from "@/lib/repair/messages";
import { dataUrlBytes, formatBytes } from "@/lib/repair/photos";
import {
  DEFAULT_MESSAGE_TEMPLATES,
  DEVICE_KIND_LABELS,
  MESSAGE_PLACEHOLDERS,
  nowIso,
  type DeviceKind,
  type RepairTemplateKey,
} from "@/lib/repair/types";
import {
  ConfirmDialog,
  Field,
  SectionCard,
  SensitiveNote,
  ToggleChip,
  chipBtnClass,
  dangerBtnClass,
  inputClass,
  primaryBtnClass,
  secondaryBtnClass,
} from "./ui";

const ALL_KINDS: DeviceKind[] = [
  "mobile",
  "laptop",
  "desktop",
  "tablet",
  "tv",
  "appliance",
  "two-wheeler",
  "watch",
  "other",
];

type PresetField = "problemPresets" | "conditionPresets" | "accessoryPresets";

const PRESET_LABELS: Record<PresetField, { title: string; hint: string }> = {
  problemPresets: {
    title: "Problems",
    hint: "What customers come in complaining about.",
  },
  conditionPresets: {
    title: "Condition checklist",
    hint: "What the counter checks the device for before taking it in. This is the list that ends disputes.",
  },
  accessoryPresets: {
    title: "Accessories",
    hint: "What might come in with the device.",
  },
};

export function SettingsScreen() {
  const {
    applyRestoredBackup,
    business,
    clearAllData,
    jobs,
    settings,
    technicians,
    syncToSheet,
    saveTechnician,
    deleteTechnician,
    updateBusiness,
    updateSettings,
  } = useRepair();

  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pin, setPin] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [presetKind, setPresetKind] = useState<DeviceKind>(settings.deviceKinds[0] ?? "mobile");
  const [newPreset, setNewPreset] = useState<Record<PresetField, string>>({
    problemPresets: "",
    conditionPresets: "",
    accessoryPresets: "",
  });
  const [newTech, setNewTech] = useState("");
  const [includePhotos, setIncludePhotos] = useState(true);
  const [testing, setTesting] = useState(false);

  const say = (text: string) => {
    setError("");
    setMessage(text);
    window.setTimeout(() => setMessage(""), 2200);
  };
  const fail = (caught: unknown, fallback: string) => {
    setMessage("");
    setError(caught instanceof Error && caught.message ? caught.message : fallback);
  };

  /** Roughly what a backup with photos in it would weigh. */
  const photoBytes = jobs.reduce(
    (sum, job) => sum + job.intakePhotos.reduce((inner, photo) => inner + dataUrlBytes(photo), 0),
    0
  );

  const addPreset = (field: PresetField) => {
    const value = newPreset[field].trim();
    if (!value) return;
    const current = settings[field][presetKind] ?? [];
    if (current.includes(value)) return;
    void updateSettings({
      [field]: { ...settings[field], [presetKind]: [...current, value] },
    } as Record<string, unknown>);
    setNewPreset({ ...newPreset, [field]: "" });
  };

  const removePreset = (field: PresetField, value: string) => {
    const current = settings[field][presetKind] ?? [];
    void updateSettings({
      [field]: {
        ...settings[field],
        [presetKind]: current.filter((item) => item !== value),
      },
    } as Record<string, unknown>);
  };

  return (
    <div className="grid gap-4">
      {(message || error) && (
        <p
          className={`rounded-xl p-3 text-sm font-semibold ${
            error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-800"
          }`}
          role="status"
        >
          {error || message}
        </p>
      )}

      {/* Shop ------------------------------------------------------------ */}
      <SectionCard title="Shop details">
        <div className="grid gap-3 sm:grid-cols-2">
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
              inputMode="tel"
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
              onChange={(event) => void updateBusiness({ taxNumber: event.target.value.toUpperCase() })}
            />
          </Field>
          <Field label="UPI ID" hint="Goes into the “ready for pickup” message.">
            <input
              className={inputClass}
              value={business?.upiId ?? ""}
              onChange={(event) => void updateBusiness({ upiId: event.target.value })}
              placeholder="shop@okhdfcbank"
            />
          </Field>
        </div>
      </SectionCard>

      {/* Device kinds ---------------------------------------------------- */}
      <SectionCard title="Device kinds you take in">
        <p className="mb-3 text-xs text-muted">
          Only these appear at intake. A phone shop should turn the rest off — a shorter list is a
          faster intake.
        </p>
        <div className="flex flex-wrap gap-2">
          {ALL_KINDS.map((kind) => (
            <ToggleChip
              key={kind}
              active={settings.deviceKinds.includes(kind)}
              onClick={() => {
                const on = settings.deviceKinds.includes(kind);
                const next = on
                  ? settings.deviceKinds.filter((value) => value !== kind)
                  : [...settings.deviceKinds, kind];
                if (next.length === 0) {
                  fail(new Error(""), "Keep at least one device kind.");
                  return;
                }
                void updateSettings({ deviceKinds: next });
              }}
            >
              {DEVICE_KIND_LABELS[kind]}
            </ToggleChip>
          ))}
        </div>
      </SectionCard>

      {/* Presets --------------------------------------------------------- */}
      <SectionCard title="Intake checklists">
        <p className="mb-3 text-xs text-muted">
          Mobile and laptop come filled in. Every other kind starts empty, because a checklist for a
          trade nobody here has worked in would be worse than none — write your own.
        </p>
        <div className="mb-4 flex flex-wrap gap-2">
          {settings.deviceKinds.map((kind) => (
            <ToggleChip key={kind} active={presetKind === kind} onClick={() => setPresetKind(kind)}>
              {DEVICE_KIND_LABELS[kind]}
            </ToggleChip>
          ))}
        </div>

        <div className="grid gap-5">
          {(Object.keys(PRESET_LABELS) as PresetField[]).map((field) => {
            const items = settings[field][presetKind] ?? [];
            return (
              <div key={field}>
                <p className="text-sm font-bold text-ink">{PRESET_LABELS[field].title}</p>
                <p className="mb-2 text-xs text-muted">{PRESET_LABELS[field].hint}</p>
                <div className="flex flex-wrap gap-2">
                  {items.map((item) => (
                    <span
                      key={item}
                      className="inline-flex items-center gap-1 rounded-lg border border-muted-line/40 bg-white px-2.5 py-1.5 text-sm text-ink"
                    >
                      {item}
                      <button
                        type="button"
                        onClick={() => removePreset(field, item)}
                        className="text-muted transition hover:text-red-600"
                        aria-label={`Remove ${item}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                  {items.length === 0 && (
                    <span className="text-sm text-muted">Nothing yet for this device kind.</span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <input
                    className={`${inputClass} max-w-xs`}
                    value={newPreset[field]}
                    onChange={(event) =>
                      setNewPreset({ ...newPreset, [field]: event.target.value })
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addPreset(field);
                      }
                    }}
                    placeholder="Add an item"
                  />
                  <button type="button" onClick={() => addPreset(field)} className={chipBtnClass}>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Add
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* Technicians ----------------------------------------------------- */}
      <SectionCard title="Technicians">
        <ul className="grid gap-2">
          {technicians.map((tech) => (
            <li
              key={tech.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-muted-line/30 p-3"
            >
              <input
                className={`${inputClass} max-w-[200px]`}
                value={tech.name}
                onChange={(event) =>
                  void saveTechnician(
                    { ...tech, name: event.target.value },
                    tech.id
                  )
                }
              />
              <input
                className={`${inputClass} max-w-[180px]`}
                value={tech.speciality}
                onChange={(event) =>
                  void saveTechnician({ ...tech, speciality: event.target.value }, tech.id)
                }
                placeholder="Speciality"
              />
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  className="h-5 w-5 rounded border-muted-line/50 text-indigo focus:ring-indigo"
                  checked={tech.active}
                  onChange={(event) =>
                    void saveTechnician({ ...tech, active: event.target.checked }, tech.id)
                  }
                />
                Active
              </label>
              <button
                type="button"
                onClick={() => void deleteTechnician(tech.id)}
                className="rounded-lg p-2 text-muted transition hover:text-red-600"
                aria-label={`Remove ${tech.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
          {technicians.length === 0 && (
            <li className="text-sm text-muted">Nobody added yet.</li>
          )}
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            className={`${inputClass} max-w-xs`}
            value={newTech}
            onChange={(event) => setNewTech(event.target.value)}
            placeholder="Add a technician"
          />
          <button
            type="button"
            onClick={async () => {
              if (!newTech.trim()) return;
              await saveTechnician({
                name: newTech.trim(),
                phone: "",
                speciality: "",
                active: true,
              });
              setNewTech("");
            }}
            className={chipBtnClass}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add
          </button>
        </div>
      </SectionCard>

      {/* Board rules ----------------------------------------------------- */}
      <SectionCard title="Ageing and reminders">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Amber after (days)" hint="A card turns amber past this.">
            <input
              className={inputClass}
              inputMode="numeric"
              value={settings.agingAmberDays}
              onChange={(event) =>
                void updateSettings({ agingAmberDays: Math.max(0, Number(event.target.value) || 0) })
              }
            />
          </Field>
          <Field label="Red after (days)">
            <input
              className={inputClass}
              inputMode="numeric"
              value={settings.agingRedDays}
              onChange={(event) =>
                void updateSettings({ agingRedDays: Math.max(0, Number(event.target.value) || 0) })
              }
            />
          </Field>
          <Field label="Chase uncollected after (days)" hint="And every this many days after.">
            <input
              className={inputClass}
              inputMode="numeric"
              value={settings.uncollectedNagDays}
              onChange={(event) =>
                void updateSettings({
                  uncollectedNagDays: Math.max(1, Number(event.target.value) || 1),
                })
              }
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Warranty and privacy">
        <div className="grid gap-4">
          <div className="max-w-[220px]">
            <Field label="Default warranty (days)" hint="0 means no warranty is offered.">
              <input
                className={inputClass}
                inputMode="numeric"
                value={settings.defaultWarrantyDays}
                onChange={(event) =>
                  void updateSettings({
                    defaultWarrantyDays: Math.max(0, Number(event.target.value) || 0),
                  })
                }
              />
            </Field>
          </div>

          <div>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-0.5 h-5 w-5 shrink-0 rounded border-muted-line/50 text-indigo focus:ring-indigo"
                checked={settings.captureUnlockCode}
                onChange={(event) =>
                  void updateSettings({ captureUnlockCode: event.target.checked })
                }
              />
              <span>
                <span className="block text-sm font-semibold text-ink">
                  Ask for the device unlock code at intake
                </span>
                <span className="block text-xs text-muted">
                  Off by default. Technicians sometimes need it to test a repair.
                </span>
              </span>
            </label>
            {settings.captureUnlockCode && (
              <div className="mt-3">
                <SensitiveNote>
                  Unlock codes are stored in this browser in plain text, alongside the jobs. Anyone
                  who can open this app — or who takes the device it runs on — can read them. The
                  PIN lock below helps a little; it is not encryption. Many shops are better off
                  keeping codes on paper and shredding them at the end of the day.
                </SensitiveNote>
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      {/* Customer tracking ------------------------------------------------ */}
      <SectionCard title="Customer tracking links">
        <p className="mb-3 text-xs text-muted">
          Gives every job a web address the customer can open to see where their device is. The
          address never changes — each status change rewrites what it says — so they can bookmark
          it, and the estimate can be approved or declined from the same page.
        </p>

        {!shortLinksConfigured() ? (
          <p className="rounded-lg border border-muted-line/40 bg-cream-paper p-3 text-sm text-muted">
            Tracking links are not available on this site. They need the link service to be
            configured before the option can be switched on.
          </p>
        ) : (
          <>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-0.5 h-5 w-5 shrink-0 rounded border-muted-line/50 text-indigo focus:ring-indigo"
                checked={settings.trackingEnabled}
                onChange={(event) =>
                  void updateSettings({ trackingEnabled: event.target.checked })
                }
              />
              <span>
                <span className="block text-sm font-semibold text-ink">
                  Give customers a tracking link
                </span>
                <span className="block text-xs text-muted">
                  Off by default. This is the only setting in this app that sends anything off this
                  device.
                </span>
              </span>
            </label>

            {settings.trackingEnabled && (
              <div className="mt-3">
                <SensitiveNote>
                  While this is on, each job&apos;s shop name, job number, device, status, promised
                  date and amount are stored on the link service so the customer&apos;s page can
                  read them. The intake photos, the signature, the unlock code, your diagnosis,
                  your parts and their prices, and the customer&apos;s address are never sent.
                  Anyone holding the link can see that job and answer its estimate, so treat it
                  like the message you sent it in. Links do not last for ever — an old one stops
                  working and the customer is told to ring you.
                </SensitiveNote>
              </div>
            )}
          </>
        )}
      </SectionCard>

      {/* Money ----------------------------------------------------------- */}
      <SectionCard title="Billing">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Job number prefix">
            <input
              className={inputClass}
              value={settings.jobPrefix}
              onChange={(event) => void updateSettings({ jobPrefix: event.target.value })}
            />
          </Field>
          <Field label="Next job number">
            <input
              className={inputClass}
              inputMode="numeric"
              value={settings.nextJobNumber}
              onChange={(event) =>
                void updateSettings({ nextJobNumber: Math.max(1, Number(event.target.value) || 1) })
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
          <Field label="Next invoice number">
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

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              className="h-5 w-5 rounded border-muted-line/50 text-indigo focus:ring-indigo"
              checked={settings.taxEnabled}
              onChange={(event) => void updateSettings({ taxEnabled: event.target.checked })}
            />
            Add tax to invoices
          </label>
          {settings.taxEnabled && (
            <Field label="Default tax rate %" hint="Added on top of parts and labour.">
              <input
                className={inputClass}
                inputMode="decimal"
                value={settings.defaultTaxRate}
                onChange={(event) =>
                  void updateSettings({ defaultTaxRate: Number(event.target.value) || 0 })
                }
              />
            </Field>
          )}
          <Field label="Payment modes" hint="Comma separated.">
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
          <Field label="Invoice paper">
            <select
              className={inputClass}
              value={settings.receiptPaperSize}
              onChange={(event) =>
                void updateSettings({
                  receiptPaperSize: event.target.value as typeof settings.receiptPaperSize,
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

      {/* Templates -------------------------------------------------------- */}
      <SectionCard title="Message templates">
        <p className="mb-3 text-xs text-muted">
          Placeholders in double braces are filled in when the message is prepared:{" "}
          {MESSAGE_PLACEHOLDERS.map((placeholder) => placeholder.token).join(", ")}.
        </p>
        <div className="grid gap-4">
          {(Object.keys(TEMPLATE_LABELS) as RepairTemplateKey[]).map((key) => (
            <Field key={key} label={TEMPLATE_LABELS[key]}>
              <textarea
                className={inputClass}
                rows={2}
                value={settings.messageTemplates[key]}
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
          onClick={() => {
            void updateSettings({ messageTemplates: DEFAULT_MESSAGE_TEMPLATES });
            say("Templates reset.");
          }}
          className={`${secondaryBtnClass} mt-3`}
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Reset to the defaults
        </button>
      </SectionCard>

      {/* Sheet sync ------------------------------------------------------- */}
      <SectionCard title="Google Sheet sync">
        <p className="mb-3 text-xs text-muted">
          One-way. Photos, signatures and unlock codes are never sent — a spreadsheet gets shared,
          and those three should not travel.
        </p>
        <Field label="Apps Script web app URL">
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
            className={secondaryBtnClass}
            disabled={testing || !isValidSyncUrl(settings.sheetSyncUrl)}
            onClick={async () => {
              setTesting(true);
              const result = await testSheetConnection(settings.sheetSyncUrl);
              setTesting(false);
              if (result.ok) say("The script answered.");
              else fail(new Error(result.error ?? ""), "Could not reach the script.");
            }}
          >
            <Sheet className="h-4 w-4" aria-hidden="true" />
            {testing ? "Testing…" : "Test the connection"}
          </button>
          <button
            type="button"
            className={primaryBtnClass}
            disabled={!isValidSyncUrl(settings.sheetSyncUrl)}
            onClick={async () => {
              try {
                await syncToSheet();
                say("Pushed to your sheet.");
              } catch (caught) {
                fail(caught, "Could not push to the sheet.");
              }
            }}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Push now
          </button>
        </div>
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer font-semibold text-muted hover:text-indigo">
            The Apps Script to paste into your sheet
          </summary>
          <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-cream-paper p-3 text-xs">
            {APPS_SCRIPT_TEMPLATE}
          </pre>
        </details>
      </SectionCard>

      {/* Backup ----------------------------------------------------------- */}
      <SectionCard title="Backup and restore">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-0.5 h-5 w-5 shrink-0 rounded border-muted-line/50 text-indigo focus:ring-indigo"
            checked={includePhotos}
            onChange={(event) => setIncludePhotos(event.target.checked)}
          />
          <span>
            <span className="block text-sm font-semibold text-ink">
              Include intake photos ({formatBytes(photoBytes)})
            </span>
            <span className="block text-xs text-muted">
              Leave this on unless the file is too big to keep. Photos are the one thing you cannot
              re-create after a lost device — a backup without them restores every job and none of
              the evidence.
            </span>
          </span>
        </label>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className={primaryBtnClass}
            onClick={async () => {
              try {
                const backup = await createBackup({ includePhotos });
                downloadBackupFile(backup);
                await updateSettings({ lastBackupAt: nowIso() });
                say(
                  `Backed up ${backupSummary(backup)
                    .filter((row) => row.count > 0)
                    .map((row) => `${row.count} ${row.label.toLowerCase()}`)
                    .join(", ")}.`
                );
              } catch (caught) {
                fail(caught, "Could not create a backup.");
              }
            }}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Download a backup
          </button>
          <button
            type="button"
            className={secondaryBtnClass}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            Restore from a file
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
                say(
                  result.backup.includesPhotos
                    ? "Restored."
                    : "Restored — that backup was made without photos, so the intake photos are gone."
                );
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

      {/* Lock ------------------------------------------------------------- */}
      <SectionCard title="Screen lock">
        <p className="mb-3 text-xs text-muted">
          A PIN keeps a passer-by out of your customer list — and, if you capture them, your unlock
          codes. It is not encryption: anyone with the device and the know-how can still read the
          database.
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
                void updateSettings({
                  autoLockMinutes: Math.max(0, Number(event.target.value) || 0),
                })
              }
            />
          </Field>
        </div>
      </SectionCard>

      {/* Danger ----------------------------------------------------------- */}
      <SectionCard title="Danger zone">
        <button type="button" className={dangerBtnClass} onClick={() => setConfirmReset(true)}>
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Erase the job card
        </button>
        <p className="mt-2 text-xs text-muted">
          Deletes every job, photo, signature, customer, part and invoice in this browser. Your
          business profile and other Setu tools are untouched. Take a backup first.
        </p>
      </SectionCard>

      <ConfirmDialog
        open={confirmReset}
        title="Erase everything?"
        message="Every job goes, and so does every intake photo and signature. If a customer disputes an old repair afterwards you will have nothing. This cannot be undone."
        confirmLabel="Erase"
        onCancel={() => setConfirmReset(false)}
        onConfirm={async () => {
          setConfirmReset(false);
          try {
            await clearAllData();
          } catch (caught) {
            fail(caught, "Could not erase the job card.");
          }
        }}
      />
    </div>
  );
}
