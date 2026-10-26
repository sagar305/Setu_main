"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
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
import { usePos } from "@/lib/pos/store";
import { parseBackupFile, type PosBackup } from "@/lib/pos/backup";
import { APPS_SCRIPT_TEMPLATE } from "@/lib/pos/sheetSync";
import {
  CURRENCIES,
  formatInvoiceNumber,
  type PosSettings,
  type ReceiptPaperSize,
} from "@/lib/pos/types";
import { POS_TOOLS, POS_TOOL_CATEGORIES } from "@/lib/pos/posTools";
import {
  PIN_MAX_LENGTH,
  PIN_MIN_LENGTH,
  generateSalt,
  hashPin,
  isValidPinFormat,
  verifyPin,
} from "@/lib/pos/pin";
import { getReceiptTemplates } from "@/lib/toolkit/workspace";
import type { ReceiptTemplate } from "@/lib/toolkit/types";
import {
  ConfirmDialog,
  Field,
  dangerBtnClass,
  inputClass,
  primaryBtnClass,
  secondaryBtnClass,
} from "./ui";

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
    payments,
    orders,
    updateBusiness,
    updateSettings,
    addPaymentMethod,
    deletePaymentMethod,
    exportBackup,
    applyRestoredBackup,
    resetAll,
    sheetSync,
    connectSheet,
    disconnectSheet,
    syncSheetNow,
    resyncSheetAll,
  } = usePos();

  // Business profile
  const [profile, setProfile] = useState({
    name: "",
    phone: "",
    address: "",
    currency: "INR",
    email: "",
    taxNumber: "",
  });
  const [profileError, setProfileError] = useState("");
  const [profileSaved, setProfileSaved] = useState(false);

  useEffect(() => {
    if (business) {
      setProfile({
        name: business.name,
        phone: business.phone,
        address: business.address,
        currency: business.currency,
        email: business.email,
        taxNumber: business.taxNumber,
      });
    }
  }, [business]);

  const saveProfile = async () => {
    if (!profile.name.trim()) {
      setProfileError("Business name is required.");
      return;
    }
    setProfileError("");
    await updateBusiness({
      name: profile.name.trim(),
      phone: profile.phone.trim(),
      address: profile.address.trim(),
      currency: profile.currency,
      email: profile.email.trim(),
      taxNumber: profile.taxNumber.trim(),
    });
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2000);
  };

  // Invoice / tax / receipt settings
  const [prefix, setPrefix] = useState(settings.invoicePrefix);
  const [nextNumberText, setNextNumberText] = useState(String(settings.nextInvoiceNumber));
  const [taxEnabled, setTaxEnabled] = useState(settings.taxEnabled);
  const [taxRateText, setTaxRateText] = useState(String(settings.defaultTaxRate));
  const [footer, setFooter] = useState(settings.receiptFooter);
  const [showBusinessInfo, setShowBusinessInfo] = useState(settings.showBusinessInfoOnReceipt);
  const [paperSize, setPaperSize] = useState<ReceiptPaperSize>(settings.receiptPaperSize);
  const [templateId, setTemplateId] = useState(settings.receiptTemplateId ?? "");
  const [templates, setTemplates] = useState<ReceiptTemplate[]>([]);
  const [posError, setPosError] = useState("");
  const [posSaved, setPosSaved] = useState(false);

  useEffect(() => {
    setPrefix(settings.invoicePrefix);
    setNextNumberText(String(settings.nextInvoiceNumber));
    setTaxEnabled(settings.taxEnabled);
    setTaxRateText(String(settings.defaultTaxRate));
    setFooter(settings.receiptFooter);
    setShowBusinessInfo(settings.showBusinessInfoOnReceipt);
    setPaperSize(settings.receiptPaperSize ?? "80mm");
    setTemplateId(settings.receiptTemplateId ?? "");
  }, [settings]);

  // Templates designed in the Receipt Designer live in the shared workspace.
  useEffect(() => {
    getReceiptTemplates().then(setTemplates).catch(() => {});
  }, []);

  const savePosSettings = async () => {
    const nextNumber = parseInt(nextNumberText, 10);
    if (!Number.isInteger(nextNumber) || nextNumber < 1) {
      setPosError("Starting number must be a whole number of 1 or more.");
      return;
    }
    const taxRate = parseFloat(taxRateText || "0");
    if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
      setPosError("Tax percentage must be between 0 and 100.");
      return;
    }
    setPosError("");
    await updateSettings({
      invoicePrefix: prefix.trim(),
      nextInvoiceNumber: nextNumber,
      taxEnabled,
      defaultTaxRate: taxRate,
      receiptFooter: footer,
      showBusinessInfoOnReceipt: showBusinessInfo,
      receiptPaperSize: paperSize,
      receiptTemplateId: templateId,
    });
    setPosSaved(true);
    setTimeout(() => setPosSaved(false), 2000);
  };

  // Payment methods
  const [newMethod, setNewMethod] = useState("");
  const [paymentError, setPaymentError] = useState("");

  // Google Sheet sync
  const [sheetUrlInput, setSheetUrlInput] = useState("");
  const [sheetBusy, setSheetBusy] = useState(false);
  const [sheetError, setSheetError] = useState("");
  const [scriptCopied, setScriptCopied] = useState(false);

  const handleConnectSheet = async () => {
    setSheetError("");
    setSheetBusy(true);
    try {
      await connectSheet(sheetUrlInput);
      setSheetUrlInput("");
    } catch (error) {
      setSheetError(error instanceof Error ? error.message : "Could not connect.");
    } finally {
      setSheetBusy(false);
    }
  };

  const handleCopyScript = async () => {
    try {
      await navigator.clipboard.writeText(APPS_SCRIPT_TEMPLATE);
      setScriptCopied(true);
      setTimeout(() => setScriptCopied(false), 2500);
    } catch {
      // Clipboard blocked — the manual textarea below still works.
    }
  };

  // Backup / restore
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingRestore, setPendingRestore] = useState<PosBackup | null>(null);
  const [backupError, setBackupError] = useState("");
  const [resetOpen, setResetOpen] = useState(false);

  const handleRestoreFile = async (file: File) => {
    setBackupError("");
    try {
      const text = await file.text();
      const result = parseBackupFile(text);
      if (!result.ok) {
        setBackupError(result.error);
        return;
      }
      setPendingRestore(result.backup);
    } catch {
      setBackupError("Could not read this file.");
    }
  };

  return (
    <div className="space-y-6">
      <Section title="Business profile" description="Shown on your receipts.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Business name" required>
            <input
              type="text"
              value={profile.name}
              onChange={(event) => setProfile((p) => ({ ...p, name: event.target.value }))}
              className={inputClass}
            />
          </Field>
          <Field label="Phone">
            <input
              type="tel"
              value={profile.phone}
              onChange={(event) => setProfile((p) => ({ ...p, phone: event.target.value }))}
              className={inputClass}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Address">
              <textarea
                value={profile.address}
                onChange={(event) => setProfile((p) => ({ ...p, address: event.target.value }))}
                rows={2}
                className={inputClass}
              />
            </Field>
          </div>
          <Field label="Currency">
            <select
              value={profile.currency}
              onChange={(event) => setProfile((p) => ({ ...p, currency: event.target.value }))}
              className={inputClass}
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={profile.email}
              onChange={(event) => setProfile((p) => ({ ...p, email: event.target.value }))}
              className={inputClass}
            />
          </Field>
          <Field label="Tax number" hint="e.g. GSTIN — printed on receipts">
            <input
              type="text"
              value={profile.taxNumber}
              onChange={(event) => setProfile((p) => ({ ...p, taxNumber: event.target.value }))}
              className={inputClass}
            />
          </Field>
        </div>
        {profileError && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {profileError}
          </p>
        )}
        <div className="mt-4 flex items-center gap-3">
          <button type="button" onClick={() => void saveProfile()} className={primaryBtnClass}>
            Save profile
          </button>
          <SavedFlash show={profileSaved} />
        </div>
      </Section>

      <Section
        title="Invoice, tax & receipt"
        description="Controls how invoice numbers are generated and what appears on receipts."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Invoice prefix"
            hint={`Next invoice: ${formatInvoiceNumber(prefix, parseInt(nextNumberText, 10) || 1)}`}
          >
            <input
              type="text"
              value={prefix}
              onChange={(event) => setPrefix(event.target.value)}
              placeholder="INV-"
              className={inputClass}
            />
          </Field>
          <Field label="Next invoice number">
            <input
              type="number"
              min={1}
              step="1"
              value={nextNumberText}
              onChange={(event) => setNextNumberText(event.target.value)}
              className={inputClass}
            />
          </Field>
          <div>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
              Tax
            </span>
            <label className="flex items-center gap-2 rounded-lg border border-muted-line/40 bg-white px-3 py-2">
              <input
                type="checkbox"
                checked={taxEnabled}
                onChange={(event) => setTaxEnabled(event.target.checked)}
                className="h-4 w-4 accent-indigo"
              />
              <span className="text-sm text-ink">Enable tax</span>
              {taxEnabled && (
                <span className="ml-auto flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={taxRateText}
                    onChange={(event) => setTaxRateText(event.target.value)}
                    aria-label="Default tax percentage"
                    className="w-20 rounded-md border border-muted-line/40 px-2 py-1 text-right text-sm focus:border-indigo focus:outline-none"
                  />
                  <span className="text-sm text-muted">%</span>
                </span>
              )}
            </label>
          </div>
          <Field label="Receipt footer message">
            <input
              type="text"
              value={footer}
              onChange={(event) => setFooter(event.target.value)}
              placeholder="Thank you for your business!"
              className={inputClass}
            />
          </Field>
          <Field
            label="Receipt paper size"
            hint="Pick your printer's roll width — used when printing receipts"
          >
            <select
              value={paperSize}
              onChange={(event) => setPaperSize(event.target.value as ReceiptPaperSize)}
              className={inputClass}
            >
              <option value="80mm">Thermal 80mm (Epson TM &amp; most receipt printers)</option>
              <option value="58mm">Thermal 58mm (compact printers)</option>
              <option value="a4">A4 / regular printer</option>
            </select>
          </Field>
          <Field
            label="Receipt design"
            hint="Templates from the Receipt Generator — design once, the POS prints with it"
          >
            <select
              value={templateId}
              onChange={(event) => setTemplateId(event.target.value)}
              className={inputClass}
            >
              <option value="">POS default receipt</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.paperSize})
                </option>
              ))}
            </select>
            <a
              href="/tools/receipt-designer"
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-xs font-semibold text-indigo hover:underline"
            >
              {templates.length === 0
                ? "Design your first receipt template →"
                : "Open the Receipt Generator →"}
            </a>
          </Field>
          <label className="flex items-center gap-2 sm:col-span-2">
            <input
              type="checkbox"
              checked={showBusinessInfo}
              onChange={(event) => setShowBusinessInfo(event.target.checked)}
              className="h-4 w-4 accent-indigo"
            />
            <span className="text-sm text-ink">
              Show business address, phone and tax number on receipts
            </span>
          </label>
        </div>
        {posError && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {posError}
          </p>
        )}
        <div className="mt-4 flex items-center gap-3">
          <button type="button" onClick={() => void savePosSettings()} className={primaryBtnClass}>
            Save settings
          </button>
          <SavedFlash show={posSaved} />
        </div>
      </Section>

      <Section
        title="Payment methods"
        description="Cash, UPI and Card are set up by default. Add anything else you accept."
      >
        <div className="flex flex-wrap gap-2">
          {payments.map((method) => (
            <span
              key={method.id}
              className="inline-flex items-center gap-2 rounded-full border border-muted-line/40 bg-cream-paper px-3 py-1.5 text-sm font-semibold text-ink"
            >
              {method.name}
              <button
                type="button"
                aria-label={`Remove ${method.name}`}
                onClick={() => {
                  setPaymentError("");
                  deletePaymentMethod(method.id).catch((error: unknown) => {
                    setPaymentError(
                      error instanceof Error ? error.message : "Could not remove this method."
                    );
                  });
                }}
                className="text-muted transition hover:text-red-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!newMethod.trim()) return;
            setPaymentError("");
            void addPaymentMethod(newMethod).then(() => setNewMethod(""));
          }}
          className="mt-3 flex max-w-md gap-2"
        >
          <input
            type="text"
            value={newMethod}
            onChange={(event) => setNewMethod(event.target.value)}
            placeholder="e.g. Bank Transfer, Wallet"
            className={inputClass}
          />
          <button type="submit" className={secondaryBtnClass}>
            <Plus className="h-4 w-4" />
            Add
          </button>
        </form>
        {paymentError && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {paymentError}
          </p>
        )}
      </Section>

      <Section
        title="Google Sheet sync"
        description="Keep a Google Sheet automatically updated with your orders, products and customers — and restore from it if this browser's data is ever lost."
      >
        {sheetSync.url ? (
          <div>
            <p className="break-all text-sm text-muted">
              Connected to: <span className="font-mono text-xs text-ink">{sheetSync.url}</span>
            </p>
            <p className="mt-2 text-sm text-muted">
              {sheetSync.syncing ? (
                <span className="font-semibold text-indigo">Syncing…</span>
              ) : sheetSync.dirtyCount > 0 ? (
                <span className="font-semibold text-saffron">
                  {sheetSync.dirtyCount} change group{sheetSync.dirtyCount === 1 ? "" : "s"} waiting to
                  sync
                </span>
              ) : (
                <span className="font-semibold text-emerald-600">Everything synced</span>
              )}
              {sheetSync.lastSyncAt && (
                <span>
                  {" "}
                  · last synced {new Date(sheetSync.lastSyncAt).toLocaleString()}
                </span>
              )}
            </p>
            {sheetSync.lastError && (
              <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
                {sheetSync.lastError}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void syncSheetNow()}
                disabled={sheetSync.syncing}
                className={primaryBtnClass}
              >
                <RefreshCw className="h-4 w-4" />
                Sync now
              </button>
              <button
                type="button"
                onClick={() => void resyncSheetAll()}
                disabled={sheetSync.syncing}
                className={secondaryBtnClass}
              >
                Resync everything
              </button>
              <button
                type="button"
                onClick={() => void disconnectSheet()}
                className={dangerBtnClass}
              >
                Disconnect
              </button>
            </div>
          </div>
        ) : (
          <div>
            <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted">
              <li>Create (or open) a Google Sheet for your business data.</li>
              <li>
                In the sheet, open <strong>Extensions → Apps Script</strong>, delete any code
                there and paste our script.
              </li>
              <li>
                Click <strong>Deploy → New deployment → Web app</strong>, set{" "}
                <em>Execute as: Me</em> and <em>Who has access: Anyone</em>, then deploy.
              </li>
              <li>Copy the web app URL and paste it below.</li>
            </ol>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => void handleCopyScript()} className={secondaryBtnClass}>
                <Copy className="h-4 w-4" />
                {scriptCopied ? "Copied ✓" : "Copy the script"}
              </button>
              <details className="text-sm text-muted">
                <summary className="cursor-pointer font-semibold text-indigo">
                  or view the script
                </summary>
                <textarea
                  readOnly
                  value={APPS_SCRIPT_TEMPLATE}
                  rows={10}
                  className="mt-2 w-full rounded-lg border border-muted-line/40 bg-cream-paper p-3 font-mono text-xs"
                  onFocus={(event) => event.target.select()}
                />
              </details>
            </div>
            <div className="mt-4 flex max-w-xl flex-col gap-2 sm:flex-row">
              <input
                type="url"
                value={sheetUrlInput}
                onChange={(event) => setSheetUrlInput(event.target.value)}
                placeholder="https://script.google.com/macros/s/…/exec"
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => void handleConnectSheet()}
                disabled={sheetBusy || !sheetUrlInput.trim()}
                className={`${primaryBtnClass} shrink-0`}
              >
                <Sheet className="h-4 w-4" />
                {sheetBusy ? "Connecting…" : "Test & connect"}
              </button>
            </div>
            {sheetError && (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
                {sheetError}
              </p>
            )}
            <p className="mt-3 text-xs text-muted">
              Treat the script URL like the sheet&apos;s share link — anyone who has it can read
              and write the synced data. Sync is one-way (POS → Sheet); edits made in the sheet
              don&apos;t change the POS.
            </p>
          </div>
        )}
      </Section>

      <Section
        title="Connected tools"
        description="Every tool here shares this POS's data — switch one on and it already knows your business, customers, products and sales when you open it. Some also unlock features inside the POS."
      >
        <ConnectedToolsPanel
          enabled={settings.connectedTools ?? []}
          onToggle={(slug, on) => {
            const current = settings.connectedTools ?? [];
            const next = on ? [...current, slug] : current.filter((s) => s !== slug);
            void updateSettings({ connectedTools: next });
          }}
        />
      </Section>

      <Section
        title="Counter lock"
        description="Set a PIN to protect the till. The POS asks for it when it opens and whenever the screen is locked — nothing on screen responds until the right PIN is entered."
      >
        <CounterLockPanel
          settings={settings}
          onSave={(updates) => updateSettings(updates)}
          onLockNow={onLockNow}
        />
      </Section>

      <Section
        title="Backup & restore"
        description="Your data lives only in this browser. Export a backup regularly and keep it somewhere safe."
      >
        <p className="text-sm text-muted">
          Last backup:{" "}
          <strong className="text-ink">
            {settings.lastBackupAt
              ? new Date(settings.lastBackupAt).toLocaleString()
              : "never"}
          </strong>
          {orders.length > 0 && !settings.lastBackupAt && (
            <span className="ml-2 font-semibold text-saffron">
              You have sales that are not backed up.
            </span>
          )}
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <button type="button" onClick={() => void exportBackup()} className={primaryBtnClass}>
            <Download className="h-4 w-4" />
            Export backup (JSON)
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={secondaryBtnClass}
          >
            <Upload className="h-4 w-4" />
            Restore from backup
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleRestoreFile(file);
              event.target.value = "";
            }}
          />
        </div>
        {backupError && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {backupError}
          </p>
        )}
      </Section>

      <Section
        title="Danger zone"
        description="Deletes every product, order, customer and setting from this browser."
      >
        <button type="button" onClick={() => setResetOpen(true)} className={dangerBtnClass}>
          <Trash2 className="h-4 w-4" />
          Delete all data
        </button>
      </Section>

      <ConfirmDialog
        open={pendingRestore !== null}
        title="Restore this backup?"
        message="Restoring replaces everything currently in this POS with the backup's contents. This cannot be undone. Consider exporting a backup of the current data first."
        confirmLabel="Replace & restore"
        onConfirm={() => {
          if (pendingRestore) {
            void applyRestoredBackup(pendingRestore).catch(() =>
              setBackupError("Could not restore this backup.")
            );
          }
          setPendingRestore(null);
        }}
        onCancel={() => setPendingRestore(null)}
      />

      <ConfirmDialog
        open={resetOpen}
        title="Delete all data?"
        message="This permanently wipes this POS — business profile, products, customers, orders, everything. Export a backup first if you might need it."
        confirmLabel="Delete everything"
        onConfirm={() => {
          setResetOpen(false);
          void resetAll();
        }}
        onCancel={() => setResetOpen(false)}
      />
    </div>
  );
}

/**
 * The catalog of tools that can attach to POS data. Each row explains what
 * data flows in, and flags the ones that also unlock a POS feature — so an
 * owner can see what's available without leaving Settings.
 */
function ConnectedToolsPanel({
  enabled,
  onToggle,
}: {
  enabled: string[];
  onToggle: (slug: string, on: boolean) => void;
}) {
  return (
    <div className="space-y-6">
      {POS_TOOL_CATEGORIES.map((category) => {
        const tools = POS_TOOLS.filter((t) => t.category === category);
        if (tools.length === 0) return null;
        return (
          <div key={category}>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{category}</h4>
            <div className="space-y-2">
              {tools.map((tool) => {
                const on = enabled.includes(tool.slug);
                return (
                  <div
                    key={tool.slug}
                    className={`rounded-xl border p-3 transition ${
                      on ? "border-indigo/40 bg-indigo/5" : "border-muted-line/30 bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-bold text-ink">{tool.name}</p>
                          {tool.unlocks && (
                            <span className="rounded-full bg-saffron/20 px-2 py-0.5 text-[11px] font-semibold text-ink">
                              Unlocks a POS feature
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-sm text-muted">{tool.description}</p>
                        <p className="mt-1 text-xs text-muted/80">
                          <span className="font-semibold">Uses: </span>
                          {tool.usesPosData}
                        </p>
                        {tool.unlocks && (
                          <p className="mt-1 text-xs font-medium text-indigo">{tool.unlocks}</p>
                        )}
                        {on && (
                          <a
                            href={tool.route}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-indigo hover:underline"
                          >
                            Open {tool.name}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                      <label className="flex shrink-0 cursor-pointer items-center gap-2">
                        <span className="text-xs font-semibold text-muted">{on ? "On" : "Off"}</span>
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={(event) => onToggle(tool.slug, event.target.checked)}
                          className="h-4 w-4 accent-indigo"
                          aria-label={`${on ? "Disable" : "Enable"} ${tool.name}`}
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** PIN setup + auto-lock timing for the counter lock screen. */
function CounterLockPanel({
  settings,
  onSave,
  onLockNow,
}: {
  settings: PosSettings;
  onSave: (updates: Partial<Omit<PosSettings, "id">>) => Promise<void>;
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
    window.setTimeout(() => setSaved(false), 2000);
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
    setPin("");
    setConfirmPin("");
    flash();
  };

  return (
    <div className="space-y-4">
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
            <Lock className="h-4 w-4" />
            Lock screen now
          </button>
        )}
        <SavedFlash show={saved} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {hasPin && (
          <Field label="Current PIN">
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={currentPin}
              onChange={(event) => setCurrentPin(event.target.value.replace(/\D/g, ""))}
              className={inputClass}
              placeholder="••••"
            />
          </Field>
        )}
        <Field label={hasPin ? "New PIN" : "PIN"} hint={`${PIN_MIN_LENGTH}–${PIN_MAX_LENGTH} digits`}>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))}
            className={inputClass}
            placeholder="••••"
          />
        </Field>
        <Field label="Confirm PIN">
          <input
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            value={confirmPin}
            onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, ""))}
            className={inputClass}
            placeholder="••••"
          />
        </Field>
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => void savePin()} className={primaryBtnClass}>
          {hasPin ? "Change PIN" : "Set PIN"}
        </button>
        {hasPin && (
          <button type="button" onClick={() => void removePin()} className={dangerBtnClass}>
            Remove PIN
          </button>
        )}
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="max-w-xs border-t border-muted-line/20 pt-4">
        <Field
          label="Auto-lock when idle"
          hint={hasPin ? undefined : "Set a PIN first to use auto-lock."}
        >
          <select
            value={settings.autoLockMinutes ?? 0}
            disabled={!hasPin}
            onChange={(event) => {
              void onSave({ autoLockMinutes: Number(event.target.value) });
              flash();
            }}
            className={inputClass}
          >
            <option value={0}>Never</option>
            <option value={1}>After 1 minute</option>
            <option value={5}>After 5 minutes</option>
            <option value={15}>After 15 minutes</option>
            <option value={30}>After 30 minutes</option>
          </select>
        </Field>
      </div>

      <p className="text-xs text-muted">
        The PIN is stored hashed in this browser and never leaves your device. It protects the
        counter from casual access — it is not encryption, so keep taking backups.
      </p>
    </div>
  );
}
