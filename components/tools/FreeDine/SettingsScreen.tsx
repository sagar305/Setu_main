"use client";

import { useEffect, useState } from "react";
import {
  Boxes,
  Building2,
  ChefHat,
  Download,
  ExternalLink,
  Lock,
  Percent,
  Printer,
  Receipt,
  RefreshCw,
  Sheet,
  TriangleAlert,
  Unlock,
  Users,
  BookUser,
  CalendarClock,
} from "lucide-react";
import { useDine } from "@/lib/dine/store";
import { formatPlain, parseAmount } from "@/lib/dine/money";
import { daysSinceBackup } from "@/lib/dine/backup";
import { isValidPinFormat } from "@/lib/dine/pin";
import { CURRENCIES, type OrderType, type PaperSize } from "@/lib/dine/types";
import { APPS_SCRIPT_TEMPLATE } from "@/lib/dine/sheetSync";
import { getReceiptTemplates } from "@/lib/toolkit/workspace";
import type { ReceiptTemplate } from "@/lib/toolkit/types";
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
    customers,
    paymentMethods,
    sheetSync,
    connectSheet,
    disconnectSheet,
    syncSheetNow,
    resyncSheetAll,
    restoreFromSheet,
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

        <BillTemplatePicker
          value={settings.billTemplateId}
          onChange={(id) => void updateSettings({ billTemplateId: id })}
        />
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
            Set a counter PIN above first. Locking the pass is only worth doing if this counter is
            itself protected.
          </p>
        )}

        {settings.kitchenLocked && (
          <p className="rounded-xl bg-indigo/5 p-3 text-xs leading-relaxed text-ink">
            <strong className="font-bold">
              This button is the only way to unlock it.
            </strong>{" "}
            The kitchen screen carries no unlock control and no PIN pad of its own — its way back
            to the counter is hidden, the back gesture is blocked, and closing the tab warns first.
            A browser tab still cannot truly trap anyone, so whoever reaches the address bar can
            leave. On a tablet you want properly locked down, pair this with the device&apos;s own
            kiosk mode: screen pinning on Android, Guided Access on iPad, or launching Chrome with{" "}
            <code className="rounded bg-white px-1 py-0.5">--kiosk</code> on a PC.
          </p>
        )}
      </Card>

      <Card icon={Boxes} title="Raw materials and recipes">
        <p className="text-sm text-muted">
          Count what you buy — rice, paneer, ghee — and give each dish a recipe. Sending a round to
          the kitchen then deducts exactly what that dish uses, following the size and add-ons the
          guest chose.
        </p>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-muted-line/40 bg-cream/40 p-3">
          <input
            type="checkbox"
            checked={settings.inventoryEnabled}
            onChange={(event) => void updateSettings({ inventoryEnabled: event.target.checked })}
            className="mt-0.5 h-4 w-4 accent-[#26306B]"
          />
          <span>
            <span className="block text-sm font-semibold text-ink">Track stock and recipes</span>
            <span className="mt-0.5 block text-xs text-muted">
              Adds a Stock screen and a Recipe button on every dish. Off by default, because it is a
              real commitment — the numbers mean nothing until each dish has a recipe, and a
              half-entered one is worse than none.
            </span>
          </span>
        </label>

        {settings.inventoryEnabled && (
          <p className="text-xs text-muted">
            Stock comes out when a round is sent to the kitchen, not when the bill is paid. A dish
            cancelled after that is recorded as wastage rather than returned — it was cooked.
            Running out never blocks a sale; it only warns.
          </p>
        )}
      </Card>

      <Card icon={BookUser} title="Credit (udhaar)">
        <p className="text-sm text-muted">
          Let regulars eat now and pay later. What they owe is not kept here — it goes into the
          shared{" "}
          <a
            href="/tools/customer-ledger"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-indigo underline underline-offset-2"
          >
            Customer Ledger
          </a>
          , the same book the Browser Based POS writes its udhaar sales to. One balance per person
          for the whole business, settled and chased in one place.
        </p>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-muted-line/40 bg-cream/40 p-3">
          <input
            type="checkbox"
            checked={settings.creditEnabled}
            onChange={(event) => void updateSettings({ creditEnabled: event.target.checked })}
            className="mt-0.5 h-4 w-4 accent-[#26306B]"
          />
          <span>
            <span className="block text-sm font-semibold text-ink">Allow bills on account</span>
            <span className="mt-0.5 block text-xs text-muted">
              Adds an &ldquo;On account&rdquo; tender at payment, for saved customers you have
              marked as allowed. Off by default, so nobody can be sent away without paying by
              tapping the wrong button.
            </span>
          </span>
        </label>

        {settings.creditEnabled && (
          <p className="text-xs text-muted">
            Only a saved customer can run a tab — never a walk-in — and you tick who is allowed when
            you attach them to a table. The payment screen shows what they already owe before you
            add to it. Settling, reminders and statements all happen in the Customer Ledger.
          </p>
        )}
      </Card>

      <Card icon={CalendarClock} title="Table bookings">
        <p className="text-sm text-muted">
          Hold a table ahead of time, free or against an advance, and send the guest a confirmation
          on WhatsApp. Anything you take as an advance comes off their bill when they sit down.
        </p>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-muted-line/40 bg-cream/40 p-3">
          <input
            type="checkbox"
            checked={settings.reservationsEnabled}
            onChange={(event) => void updateSettings({ reservationsEnabled: event.target.checked })}
            className="mt-0.5 h-4 w-4 accent-[#26306B]"
          />
          <span>
            <span className="block text-sm font-semibold text-ink">Take bookings</span>
            <span className="mt-0.5 block text-xs text-muted">
              Adds a Bookings screen, marks held tables on the floor, and seats a booking when you
              tap its table.
            </span>
          </span>
        </label>

        {settings.reservationsEnabled && (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Usual length (minutes)" hint="Pre-filled on a new booking.">
                <input
                  inputMode="numeric"
                  value={String(settings.reservationDefaultMinutes)}
                  onChange={(event) =>
                    void updateSettings({
                      reservationDefaultMinutes: Number(event.target.value) || 90,
                    })
                  }
                  className={inputClass}
                />
              </Field>
              <Field
                label="Hold either side (minutes)"
                hint="A table shows as reserved this long before, and a party counts as late this long after."
              >
                <input
                  inputMode="numeric"
                  value={String(settings.reservationHoldMinutes)}
                  onChange={(event) =>
                    void updateSettings({
                      reservationHoldMinutes: Number(event.target.value) || 0,
                    })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Usual advance" hint="Pre-filled on a new booking. Blank for free bookings.">
                <input
                  inputMode="decimal"
                  value={
                    settings.reservationDefaultDeposit > 0
                      ? formatPlain(settings.reservationDefaultDeposit)
                      : ""
                  }
                  onChange={(event) =>
                    void updateSettings({
                      reservationDefaultDeposit: parseAmount(event.target.value),
                    })
                  }
                  placeholder="No advance"
                  className={inputClass}
                />
              </Field>
            </div>

            <Field
              label="WhatsApp country code"
              hint="Put on the front of a local number when opening WhatsApp. 91 for India."
            >
              <input
                inputMode="numeric"
                value={settings.whatsappDialCode}
                onChange={(event) => void updateSettings({ whatsappDialCode: event.target.value })}
                className={inputClass}
              />
            </Field>

            <p className="text-xs text-muted">
              WhatsApp opens with the message written out and waits for you to send it — the
              restaurant&apos;s own number, its own chat history, and no diner&apos;s phone number
              ever leaves this browser.
            </p>
          </>
        )}
      </Card>

      <Card icon={Users} title="Customers and the Customer Ledger">
        <p className="text-sm text-muted">
          One customer book for the whole business. Saving a diner on a ticket copies them into your
          shared workspace, and regulars first saved at the shop till or in the{" "}
          <a
            href="/tools/customer-ledger"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-indigo underline underline-offset-2"
          >
            Customer Ledger
          </a>{" "}
          appear in the picker here — so &ldquo;select a customer&rdquo; finds the same people
          everywhere.
        </p>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-muted-line/40 bg-cream/40 p-3">
          <input
            type="checkbox"
            checked={settings.shareCustomersWithLedger}
            onChange={(event) =>
              void updateSettings({ shareCustomersWithLedger: event.target.checked })
            }
            className="mt-0.5 h-4 w-4 accent-[#26306B]"
          />
          <span>
            <span className="block text-sm font-semibold text-ink">
              Share diners with the Customer Ledger
            </span>
            <span className="mt-0.5 block text-xs text-muted">
              Copies name, phone and address across as you save them, and brings the other tools&apos;
              customers in here. Free Dine keeps its own copy either way, so clearing another tool
              can never take your regulars with it. Switch this off and diners stay in Free Dine
              only — but bills can no longer go on account, because the ledger they would post to is
              the shared one.
            </span>
          </span>
        </label>

        <p className="text-xs text-muted">
          {customers.length} diner{customers.length === 1 ? "" : "s"} saved.
        </p>
      </Card>

      <SheetSyncCard
        url={sheetSync.url}
        dirtyCount={sheetSync.dirtyCount}
        syncing={sheetSync.syncing}
        lastSyncAt={sheetSync.lastSyncAt}
        lastError={sheetSync.lastError}
        callsToday={sheetSync.callsToday}
        onConnect={connectSheet}
        onDisconnect={disconnectSheet}
        onSyncNow={syncSheetNow}
        onResyncAll={resyncSheetAll}
        onRestore={restoreFromSheet}
      />

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

/**
 * Google Sheet sync.
 *
 * A safety net and a reporting feed, not a link between devices — the copy
 * says so, because a restaurant that believed otherwise would put two tablets
 * on one sheet and quietly lose orders to last-write-wins.
 */
function SheetSyncCard({
  url,
  dirtyCount,
  syncing,
  lastSyncAt,
  lastError,
  callsToday,
  onConnect,
  onDisconnect,
  onSyncNow,
  onResyncAll,
  onRestore,
}: {
  url: string;
  dirtyCount: number;
  syncing: boolean;
  lastSyncAt: string | null;
  lastError: string;
  callsToday: number;
  onConnect: (url: string) => Promise<void>;
  onDisconnect: () => Promise<void>;
  onSyncNow: () => Promise<void>;
  onResyncAll: () => Promise<void>;
  onRestore: (url: string) => Promise<void>;
}) {
  const [draftUrl, setDraftUrl] = useState(url);
  const [restoreUrl, setRestoreUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showScript, setShowScript] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);

  const run = async (job: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await job();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That did not work.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card icon={Sheet} title="Google Sheet sync">
      <p className="text-sm text-muted">
        Push your menu, diners and settled bills into a Google Sheet you own. It is the second
        safety net alongside the backup file, and it gives you your sales in a spreadsheet you can
        pivot however you like.
      </p>

      <p className="rounded-xl bg-cream/60 p-3 text-xs leading-relaxed text-ink">
        <strong className="font-bold">This is not multi-device sync.</strong> Each push rewrites
        whole tabs, so two devices pointed at one sheet would overwrite each other and lose orders.
        Use it from one device. Running a second till or a second outlet is what{" "}
        <a
          href="/products/restaurant-pos"
          className="font-semibold text-indigo underline underline-offset-2"
        >
          Setu Dine
        </a>{" "}
        is for.
      </p>

      {url ? (
        <>
          <div className="rounded-xl border border-muted-line/30 bg-white p-3 text-xs">
            <p className="break-all font-mono text-muted">{url}</p>
            <p className="mt-2 text-muted">
              {lastSyncAt
                ? `Last synced ${new Date(lastSyncAt).toLocaleString()}.`
                : "Not synced yet."}{" "}
              {dirtyCount > 0
                ? `${dirtyCount} change${dirtyCount === 1 ? "" : "s"} waiting.`
                : "Everything is up to date."}
            </p>
            <p className="mt-1 text-muted/80">
              {callsToday} sheet call{callsToday === 1 ? "" : "s"} from this browser today.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void run(onSyncNow)}
              disabled={busy || syncing}
              className={primaryBtnClass}
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing…" : "Sync now"}
            </button>
            <button
              type="button"
              onClick={() => void run(onResyncAll)}
              disabled={busy || syncing}
              className={secondaryBtnClass}
            >
              Re-send everything
            </button>
            <button
              type="button"
              onClick={() => void run(onDisconnect)}
              disabled={busy}
              className={secondaryBtnClass}
            >
              Disconnect
            </button>
          </div>
        </>
      ) : (
        <div className="space-y-3">
          <Field
            label="Apps Script web-app URL"
            hint="Deploy the script below in your own sheet, then paste the URL here."
          >
            <input
              value={draftUrl}
              onChange={(event) => setDraftUrl(event.target.value)}
              placeholder="https://script.google.com/macros/s/…/exec"
              className={inputClass}
            />
          </Field>
          <button
            type="button"
            onClick={() => void run(() => onConnect(draftUrl))}
            disabled={busy || !draftUrl.trim()}
            className={primaryBtnClass}
          >
            {busy ? "Connecting…" : "Connect sheet"}
          </button>
        </div>
      )}

      {(error || lastError) && <p className="text-xs text-red-600">{error || lastError}</p>}

      <div>
        <button
          type="button"
          onClick={() => setShowScript((previous) => !previous)}
          className="text-sm font-semibold text-indigo"
        >
          {showScript ? "Hide the setup script" : "Show the setup script"}
        </button>
        {showScript && (
          <div className="mt-3 space-y-2">
            <ol className="list-decimal space-y-1 pl-5 text-xs text-muted">
              <li>Open your Google Sheet, then Extensions → Apps Script.</li>
              <li>Replace everything with the script below and save.</li>
              <li>
                Deploy → New deployment → Web app. Execute as <strong>Me</strong>, access{" "}
                <strong>Anyone</strong>.
              </li>
              <li>Copy the Web app URL and paste it above.</li>
            </ol>
            <p className="text-xs text-muted">
              Treat that URL like the share link of the sheet — anyone holding it can read and
              write it.
            </p>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(APPS_SCRIPT_TEMPLATE);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 2000);
                } catch {
                  setError("Could not copy — select the script and copy it by hand.");
                }
              }}
              className={secondaryBtnClass}
            >
              {copied ? "Copied" : "Copy script"}
            </button>
            <pre className="max-h-56 overflow-auto rounded-xl bg-ink p-3 text-[11px] leading-relaxed text-cream">
              {APPS_SCRIPT_TEMPLATE}
            </pre>
          </div>
        )}
      </div>

      <div className="border-t border-muted-line/20 pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          Restore from a sheet
        </p>
        <p className="mt-1 text-xs text-muted">
          Rebuilds this browser from a sheet you synced earlier — menu, floor, diners and bills.
          Anything open on the pass right now is left alone.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            value={restoreUrl}
            onChange={(event) => setRestoreUrl(event.target.value)}
            placeholder="https://script.google.com/macros/s/…/exec"
            className={`${inputClass} max-w-md`}
          />
          <button
            type="button"
            onClick={() => setConfirmRestore(true)}
            disabled={busy || !restoreUrl.trim()}
            className={secondaryBtnClass}
          >
            Restore
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmRestore}
        title="Restore from this sheet?"
        message="Your menu, floor, diners and bills in this browser are replaced by the sheet's copy. Take a backup first if you are not sure."
        confirmLabel="Restore"
        onCancel={() => setConfirmRestore(false)}
        onConfirm={async () => {
          setConfirmRestore(false);
          await run(() => onRestore(restoreUrl));
        }}
      />
    </Card>
  );
}

/**
 * Choose a bill layout designed in the Receipt Designer.
 *
 * Templates live in the shared workspace, so a restaurant designs its look
 * once and every Setu tool that prints uses it. Picking one takes over the
 * paper size, colour, header, footer and separators — the fields below stay as
 * the fallback for when no template is chosen.
 */
function BillTemplatePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const [templates, setTemplates] = useState<ReceiptTemplate[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getReceiptTemplates()
      .then((all) => {
        if (cancelled) return;
        setTemplates(all);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Field
      label="Bill design"
      hint="Designed in the Receipt Designer and shared across your Setu tools."
    >
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`${inputClass} max-w-xs`}
        >
          <option value="">Built-in layout</option>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name} ({template.paperSize})
            </option>
          ))}
        </select>
        <a
          href="/tools/receipt-designer"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo"
        >
          <ExternalLink className="h-4 w-4" />
          {templates.length > 0 ? "Design another" : "Design one"}
        </a>
      </div>
      {loaded && templates.length === 0 && (
        <p className="mt-1 text-xs text-muted">
          No designs saved yet. The Receipt Designer sets the colour, header, footer, logo and
          separators; save one there and it appears here.
        </p>
      )}
      {value !== "" && (
        <p className="mt-1 text-xs text-muted">
          The design decides the paper size, colour, header, footer and separators. The settings
          above apply when no design is chosen.
        </p>
      )}
    </Field>
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
