"use client";

import { useState } from "react";
import {
  Building2,
  ChefHat,
  Download,
  ExternalLink,
  Lock,
  Percent,
  Printer,
  Receipt,
  Sheet,
  TriangleAlert,
  Unlock,
} from "lucide-react";
import { useDine } from "@/lib/dine/store";
import { daysSinceBackup } from "@/lib/dine/backup";
import { isValidPinFormat } from "@/lib/dine/pin";
import { CURRENCIES, type OrderType, type PaperSize } from "@/lib/dine/types";
import { RestoreBackupButton } from "./RestoreBackupButton";
import {
  ConfirmDialog,
  Field,
  SectionHeading,
  dangerBtnClass,
  inputClass,
  primaryBtnClass,
  secondaryBtnClass,
  tapTargetClass,
} from "./ui";

const PAPER_SIZES: { id: PaperSize; label: string }[] = [
  { id: "80mm", label: "80mm roll" },
  { id: "58mm", label: "58mm roll" },
  { id: "a4", label: "A4 sheet" },
];

export function SettingsScreen({ onLockNow }: { onLockNow: () => void }) {
  const {
    business,
    settings,
    bills,
    paymentMethods,
    updateBusiness,
    updateSettings,
    addPaymentMethod,
    deletePaymentMethod,
    exportBackup,
    resetAll,
    setPin,
    clearPin,
  } = useDine();

  const [pinValue, setPinValue] = useState("");
  const [pinError, setPinError] = useState("");
  const [newMethod, setNewMethod] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);

  const sinceBackup = daysSinceBackup(settings.lastBackupAt);
  const backupOverdue = bills.length > 0 && (sinceBackup === null || sinceBackup >= 7);

  return (
    <div className="space-y-6">
      <SectionHeading title="Settings" subtitle="Everything here is stored on this device." />

      {backupOverdue && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-saffron/50 bg-saffron/10 p-4">
          <TriangleAlert className="h-5 w-5 shrink-0 text-ink" aria-hidden="true" />
          <p className="flex-1 text-sm text-ink">
            <strong className="font-bold">
              {sinceBackup === null
                ? "You have never taken a backup."
                : `Your last backup was ${sinceBackup} days ago.`}
            </strong>{" "}
            Clearing your browser data would take your sales with it. A backup takes two seconds.
          </p>
          <button
            type="button"
            onClick={async () => {
              setBackupBusy(true);
              await exportBackup();
              setBackupBusy(false);
            }}
            className={primaryBtnClass}
          >
            <Download className="h-4 w-4" />
            {backupBusy ? "Saving…" : "Back up now"}
          </button>
        </div>
      )}

      <Card icon={Building2} title="Restaurant">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <input
              value={business?.name ?? ""}
              onChange={(event) => void updateBusiness({ name: event.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Phone">
            <input
              value={business?.phone ?? ""}
              onChange={(event) => void updateBusiness({ phone: event.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="GSTIN">
            <input
              value={business?.gstin ?? ""}
              onChange={(event) => void updateBusiness({ gstin: event.target.value.toUpperCase() })}
              className={`${inputClass} uppercase`}
            />
          </Field>
          <Field label="UPI ID">
            <input
              value={business?.upiId ?? ""}
              onChange={(event) => void updateBusiness({ upiId: event.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Currency">
            <select
              value={business?.currency ?? "INR"}
              onChange={(event) => void updateBusiness({ currency: event.target.value })}
              className={inputClass}
            >
              {CURRENCIES.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Default order type">
            <select
              value={settings.defaultOrderType}
              onChange={(event) =>
                void updateSettings({ defaultOrderType: event.target.value as OrderType })
              }
              className={inputClass}
            >
              <option value="dine-in">Dine-in</option>
              <option value="takeaway">Takeaway</option>
              <option value="delivery">Delivery</option>
            </select>
          </Field>
        </div>
        <Field label="Address">
          <textarea
            value={business?.address ?? ""}
            onChange={(event) => void updateBusiness({ address: event.target.value })}
            rows={2}
            className={inputClass}
          />
        </Field>
      </Card>

      <Card icon={Percent} title="Tax and service charge">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Charge tax?">
            <div className="flex gap-2">
              {[true, false].map((on) => (
                <button
                  key={String(on)}
                  type="button"
                  onClick={() => void updateSettings({ taxEnabled: on })}
                  aria-pressed={settings.taxEnabled === on}
                  className={`${tapTargetClass} flex-1 rounded-lg border text-sm font-semibold transition ${
                    settings.taxEnabled === on
                      ? "border-indigo bg-indigo text-white"
                      : "border-muted-line/40 bg-white text-ink"
                  }`}
                >
                  {on ? "Yes" : "No"}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Default tax rate %" hint="Used by dishes with no rate of their own.">
            <input
              inputMode="decimal"
              value={String(settings.defaultTaxRate)}
              onChange={(event) =>
                void updateSettings({ defaultTaxRate: Number(event.target.value) || 0 })
              }
              className={inputClass}
            />
          </Field>
          <Field label="Service charge %">
            <input
              inputMode="decimal"
              value={String(settings.serviceChargeRate)}
              onChange={(event) =>
                void updateSettings({ serviceChargeRate: Number(event.target.value) || 0 })
              }
              className={inputClass}
            />
          </Field>
          <Field label="Tax on service charge %" hint="GST applies to service charge as well.">
            <input
              inputMode="decimal"
              value={String(settings.serviceChargeTaxRate)}
              onChange={(event) =>
                void updateSettings({ serviceChargeTaxRate: Number(event.target.value) || 0 })
              }
              className={inputClass}
            />
          </Field>
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-muted-line/40 bg-cream/40 p-3">
          <input
            type="checkbox"
            checked={settings.serviceChargeDefaultOn}
            onChange={(event) =>
              void updateSettings({ serviceChargeDefaultOn: event.target.checked })
            }
            className="mt-0.5 h-4 w-4 accent-[#26306B]"
          />
          <span>
            <span className="block text-sm font-semibold text-ink">
              Add service charge to new tickets by default
            </span>
            <span className="mt-0.5 block text-xs text-muted">
              Off by default. Service charge is voluntary in India — a guest can ask you to remove
              it, and the bill says so.
            </span>
          </span>
        </label>
      </Card>

      <Card icon={Printer} title="Printing and numbering">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="KOT paper">
            <select
              value={settings.kotPaperSize}
              onChange={(event) =>
                void updateSettings({ kotPaperSize: event.target.value as PaperSize })
              }
              className={inputClass}
            >
              {PAPER_SIZES.map((size) => (
                <option key={size.id} value={size.id}>
                  {size.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Bill paper">
            <select
              value={settings.billPaperSize}
              onChange={(event) =>
                void updateSettings({ billPaperSize: event.target.value as PaperSize })
              }
              className={inputClass}
            >
              {PAPER_SIZES.map((size) => (
                <option key={size.id} value={size.id}>
                  {size.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="KOT prefix">
            <input
              value={settings.kotPrefix}
              onChange={(event) => void updateSettings({ kotPrefix: event.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Bill prefix">
            <input
              value={settings.billPrefix}
              onChange={(event) => void updateSettings({ billPrefix: event.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Next bill number">
            <input
              inputMode="numeric"
              value={String(settings.nextBillNumber)}
              onChange={(event) =>
                void updateSettings({ nextBillNumber: Math.max(Number(event.target.value) || 1, 1) })
              }
              className={inputClass}
            />
          </Field>
          <Field
            label="Business day starts at"
            hint="Set to 4 if you close at 2am, so a late order counts towards the night it belongs to."
          >
            <select
              value={String(settings.dayStartHour)}
              onChange={(event) =>
                void updateSettings({ dayStartHour: Number(event.target.value) || 0 })
              }
              className={inputClass}
            >
              {Array.from({ length: 12 }, (_, hour) => (
                <option key={hour} value={hour}>
                  {String(hour).padStart(2, "0")}:00
                  {hour === 0 ? " (midnight)" : ""}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Bill footer">
          <input
            value={settings.receiptFooter}
            onChange={(event) => void updateSettings({ receiptFooter: event.target.value })}
            className={inputClass}
          />
        </Field>
      </Card>

      <Card icon={Receipt} title="Payment methods">
        <div className="flex flex-wrap gap-2">
          {paymentMethods.map((method) => (
            <span
              key={method.id}
              className="inline-flex items-center gap-2 rounded-full border border-muted-line/40 bg-white px-3 py-1.5 text-sm font-semibold text-ink"
            >
              {method.name}
              {paymentMethods.length > 1 && (
                <button
                  type="button"
                  onClick={() => void deletePaymentMethod(method.id)}
                  aria-label={`Remove ${method.name}`}
                  className="text-muted hover:text-red-600"
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newMethod}
            onChange={(event) => setNewMethod(event.target.value)}
            placeholder="Swiggy, Zomato, Sodexo…"
            className={`${inputClass} max-w-xs`}
          />
          <button
            type="button"
            onClick={async () => {
              if (!newMethod.trim()) return;
              await addPaymentMethod(newMethod.trim());
              setNewMethod("");
            }}
            className={secondaryBtnClass}
          >
            Add
          </button>
        </div>
      </Card>

      <Card icon={Lock} title="Counter lock">
        <p className="text-sm text-muted">
          A PIN stops a passing guest or a curious staff member poking at the till. It is not a
          defence against someone holding an unlocked device.
        </p>
        {settings.pinHash ? (
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={onLockNow} className={primaryBtnClass}>
              <Lock className="h-4 w-4" />
              Lock now
            </button>
            <button type="button" onClick={() => void clearPin()} className={secondaryBtnClass}>
              Remove PIN
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <Field label="New PIN" hint="4–8 digits.">
              <input
                inputMode="numeric"
                value={pinValue}
                onChange={(event) => {
                  setPinValue(event.target.value.replace(/\D/g, ""));
                  setPinError("");
                }}
                className={`${inputClass} max-w-[140px]`}
              />
            </Field>
            <button
              type="button"
              onClick={async () => {
                if (!isValidPinFormat(pinValue)) {
                  setPinError("Use 4 to 8 digits.");
                  return;
                }
                await setPin(pinValue);
                setPinValue("");
              }}
              className={primaryBtnClass}
            >
              Set PIN
            </button>
          </div>
        )}
        {pinError && <p className="text-xs text-red-600">{pinError}</p>}

        {settings.pinHash && (
          <Field label="Lock automatically after" hint="0 means never.">
            <select
              value={String(settings.autoLockMinutes)}
              onChange={(event) =>
                void updateSettings({ autoLockMinutes: Number(event.target.value) || 0 })
              }
              className={`${inputClass} max-w-[180px]`}
            >
              {[0, 1, 2, 5, 10, 30].map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes === 0 ? "Never" : `${minutes} minute${minutes === 1 ? "" : "s"}`}
                </option>
              ))}
            </select>
          </Field>
        )}
      </Card>

      <Card icon={ChefHat} title="Kitchen screen">
        <p className="text-sm text-muted">
          Open this in a second tab and leave it on the pass. Rounds appear the moment you send
          them, and marking food ready shows up on your floor.
        </p>

        <div className="flex flex-wrap gap-3">
          <a
            href="/products/free-restaurant-pos/kitchen"
            target="_blank"
            rel="noopener noreferrer"
            className={secondaryBtnClass}
          >
            <ExternalLink className="h-4 w-4" />
            Open kitchen screen
          </a>

          {settings.kitchenLocked ? (
            <button
              type="button"
              onClick={() => void updateSettings({ kitchenLocked: false })}
              className={primaryBtnClass}
            >
              <Unlock className="h-4 w-4" />
              Unlock the kitchen screen
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void updateSettings({ kitchenLocked: true })}
              disabled={!settings.pinHash}
              title={
                settings.pinHash
                  ? "Lock the kitchen screen so staff cannot leave it"
                  : "Set a counter PIN first — it is what unlocks the screen"
              }
              className={primaryBtnClass}
            >
              <Lock className="h-4 w-4" />
              Lock the kitchen screen
            </button>
          )}
        </div>

        {!settings.pinHash && (
          <p className="text-xs text-muted">
            Set a counter PIN above first — it is what unlocks the kitchen screen again.
          </p>
        )}

        {settings.kitchenLocked && (
          <p className="rounded-xl bg-indigo/5 p-3 text-xs leading-relaxed text-ink">
            The kitchen screen is locked. Its way back to the counter is hidden, the back gesture
            is blocked and closing the tab warns first — but a browser tab can never truly trap
            someone, so anyone who reaches the address bar can still leave. On a tablet you want to
            lock down properly, pair this with the device&apos;s own kiosk mode: screen pinning on
            Android, Guided Access on iPad, or launching Chrome with{" "}
            <code className="rounded bg-white px-1 py-0.5">--kiosk</code> on a PC.
          </p>
        )}
      </Card>

      <Card icon={Sheet} title="Backup and safety">
        <p className="text-sm text-muted">
          Free Dine keeps everything in this browser. A backup file is the one thing standing
          between a cleared cache and losing your year.
        </p>
        <div className="flex flex-wrap items-start gap-3">
          <button
            type="button"
            onClick={async () => {
              setBackupBusy(true);
              await exportBackup();
              setBackupBusy(false);
            }}
            className={primaryBtnClass}
          >
            <Download className="h-4 w-4" />
            {backupBusy ? "Saving…" : "Download backup"}
          </button>
          <RestoreBackupButton className={secondaryBtnClass} />
        </div>
        {settings.lastBackupAt && (
          <p className="text-xs text-muted">
            Last backup {new Date(settings.lastBackupAt).toLocaleString()}.
          </p>
        )}
      </Card>

      <Card icon={TriangleAlert} title="Danger zone">
        <p className="text-sm text-muted">
          Erases this restaurant&apos;s menu, tables, tickets and bills from this browser. The
          Browser Based POS is a separate product with separate data and is not touched.
        </p>
        <button type="button" onClick={() => setConfirmReset(true)} className={dangerBtnClass}>
          Reset everything
        </button>
      </Card>

      <ConfirmDialog
        open={confirmReset}
        title="Erase everything?"
        message="Your menu, tables, tickets and every bill are deleted from this browser. This cannot be undone — download a backup first if you might want any of it."
        confirmLabel="Erase it all"
        onCancel={() => setConfirmReset(false)}
        onConfirm={async () => {
          await resetAll();
          setConfirmReset(false);
        }}
      />
    </div>
  );
}

function Card({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-muted-line/30 bg-white p-4 shadow-sm sm:p-5">
      <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
        <Icon className="h-4 w-4 text-indigo" />
        {title}
      </h3>
      {children}
    </section>
  );
}
