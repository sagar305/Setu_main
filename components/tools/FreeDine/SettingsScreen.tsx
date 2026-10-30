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
import { useI18n } from "@/lib/i18n";
import { fill, type TKey } from "@/lib/i18n/translate";
import { intlLocaleFor } from "@/lib/i18n/pages";
import { useDine } from "@/lib/dine/store";
import { formatPlain, parseAmount } from "@/lib/dine/money";
import { daysSinceBackup } from "@/lib/dine/backup";
import { isValidPinFormat } from "@/lib/dine/pin";
import {
  CURRENCIES,
  ORDER_TYPE_ORDER,
  orderTypeLabel,
  paymentMethodLabel,
  type OrderType,
  type PaperSize,
} from "@/lib/dine/types";
import { APPS_SCRIPT_TEMPLATE } from "@/lib/dine/sheetSync";
import { getReceiptTemplates } from "@/lib/toolkit/workspace";
import type { ReceiptTemplate } from "@/lib/toolkit/types";
import { RestoreBackupButton } from "./RestoreBackupButton";
import { QrMenuCard } from "./QrMenuCard";
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

const PAPER_SIZES: { id: PaperSize; labelKey: TKey }[] = [
  { id: "80mm", labelKey: "dnStPaper80" },
  { id: "58mm", labelKey: "dnStPaper58" },
  { id: "a4", labelKey: "dnStPaperA4" },
];

export function SettingsScreen({ onLockNow }: { onLockNow: () => void }) {
  const { t, lang } = useI18n();
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
      <SectionHeading title={t("dnStSettings")} subtitle={t("dnStStoredHere")} />

      {backupOverdue && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-saffron/50 bg-saffron/10 p-4">
          <TriangleAlert className="h-5 w-5 shrink-0 text-ink" aria-hidden="true" />
          <p className="flex-1 text-sm text-ink">
            <strong className="font-bold">
              {sinceBackup === null
                ? t("dnStNeverBackedUp")
                : fill(t("dnStLastBackupDays"), { n: sinceBackup })}
            </strong>{" "}
            {t("dnStBackupWarning")}
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
            {backupBusy ? t("clPfSaving") : t("dnStBackUpNow")}
          </button>
        </div>
      )}

      <Card icon={Building2} title={t("dnRestaurantFallback")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("name")}>
            <input
              value={business?.name ?? ""}
              onChange={(event) => void updateBusiness({ name: event.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label={t("phone")}>
            <input
              value={business?.phone ?? ""}
              onChange={(event) => void updateBusiness({ phone: event.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label={t("gstin")}>
            <input
              value={business?.gstin ?? ""}
              onChange={(event) => void updateBusiness({ gstin: event.target.value.toUpperCase() })}
              className={`${inputClass} uppercase`}
            />
          </Field>
          <Field label={t("upiId")}>
            <input
              value={business?.upiId ?? ""}
              onChange={(event) => void updateBusiness({ upiId: event.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label={t("currency")}>
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
          <Field label={t("dnStDefaultOrderType")}>
            <select
              value={settings.defaultOrderType}
              onChange={(event) =>
                void updateSettings({ defaultOrderType: event.target.value as OrderType })
              }
              className={inputClass}
            >
              {ORDER_TYPE_ORDER.map((type) => (
                <option key={type} value={type}>
                  {orderTypeLabel(type, lang)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label={t("address")}>
          <textarea
            value={business?.address ?? ""}
            onChange={(event) => void updateBusiness({ address: event.target.value })}
            rows={2}
            className={inputClass}
          />
        </Field>
      </Card>

      <Card icon={Percent} title={t("dnStTaxAndService")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("dnStChargeTax")}>
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
                  {on ? t("dnStYes") : t("dnStNo")}
                </button>
              ))}
            </div>
          </Field>
          <Field label={t("dnStDefaultTaxRate")} hint={t("dnStDefaultTaxHint")}>
            <input
              inputMode="decimal"
              value={String(settings.defaultTaxRate)}
              onChange={(event) =>
                void updateSettings({ defaultTaxRate: Number(event.target.value) || 0 })
              }
              className={inputClass}
            />
          </Field>
          <Field label={t("dnStServiceChargePct")}>
            <input
              inputMode="decimal"
              value={String(settings.serviceChargeRate)}
              onChange={(event) =>
                void updateSettings({ serviceChargeRate: Number(event.target.value) || 0 })
              }
              className={inputClass}
            />
          </Field>
          <Field label={t("dnStTaxOnService")} hint={t("dnStTaxOnServiceHint")}>
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
              {t("dnStServiceVoluntary")}
            </span>
          </span>
        </label>
      </Card>

      <Card icon={Printer} title={t("dnStPrintingNumbering")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("dnStKotPaper")}>
            <select
              value={settings.kotPaperSize}
              onChange={(event) =>
                void updateSettings({ kotPaperSize: event.target.value as PaperSize })
              }
              className={inputClass}
            >
              {PAPER_SIZES.map((size) => (
                <option key={size.id} value={size.id}>
                  {t(size.labelKey)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("dnStBillPaper")}>
            <select
              value={settings.billPaperSize}
              onChange={(event) =>
                void updateSettings({ billPaperSize: event.target.value as PaperSize })
              }
              className={inputClass}
            >
              {PAPER_SIZES.map((size) => (
                <option key={size.id} value={size.id}>
                  {t(size.labelKey)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("dnStKotPrefix")}>
            <input
              value={settings.kotPrefix}
              onChange={(event) => void updateSettings({ kotPrefix: event.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label={t("dnStBillPrefix")}>
            <input
              value={settings.billPrefix}
              onChange={(event) => void updateSettings({ billPrefix: event.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label={t("dnStNextBillNumber")}>
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
            label={t("dnStDayStartsAt")}
            hint={t("dnStDayStartsHint")}
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
                  {hour === 0 ? ` (${t("dnStMidnight")})` : ""}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label={t("dnStBillFooter")}>
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

      <Card icon={Receipt} title={t("dnStPaymentMethods")}>
        <div className="flex flex-wrap gap-2">
          {paymentMethods.map((method) => (
            <span
              key={method.id}
              className="inline-flex items-center gap-2 rounded-full border border-muted-line/40 bg-white px-3 py-1.5 text-sm font-semibold text-ink"
            >
              {paymentMethodLabel(method.name, lang)}
              {paymentMethods.length > 1 && (
                <button
                  type="button"
                  onClick={() => void deletePaymentMethod(method.id)}
                  aria-label={fill(t("dnTkRemoveNamed"), { name: paymentMethodLabel(method.name, lang) })}
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
            placeholder={t("dnStNewMethodPh")}
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
            {t("add")}
          </button>
        </div>
      </Card>

      <Card icon={Lock} title={t("dnStCounterLock")}>
        <p className="text-sm text-muted">{t("dnStPinBody")}</p>
        {settings.pinHash ? (
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={onLockNow} className={primaryBtnClass}>
              <Lock className="h-4 w-4" />
              {t("clStLockNow")}
            </button>
            <button type="button" onClick={() => void clearPin()} className={secondaryBtnClass}>
              {t("tuStgRemovePin")}
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <Field label={t("clStNewPin")} hint={t("dnStPinLength")}>
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
                  setPinError(t("dnStUse4To8"));
                  return;
                }
                await setPin(pinValue);
                setPinValue("");
              }}
              className={primaryBtnClass}
            >
              {t("clStSetPin")}
            </button>
          </div>
        )}
        {pinError && <p className="text-xs text-red-600">{pinError}</p>}

        {settings.pinHash && (
          <Field label={t("dnStLockAfter")} hint={t("dnStZeroNever")}>
            <select
              value={String(settings.autoLockMinutes)}
              onChange={(event) =>
                void updateSettings({ autoLockMinutes: Number(event.target.value) || 0 })
              }
              className={`${inputClass} max-w-[180px]`}
            >
              {[0, 1, 2, 5, 10, 30].map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes === 0
                    ? t("dnStNever")
                    : fill(t(minutes === 1 ? "dnStMinute1" : "dnStMinuteN"), { n: minutes })}
                </option>
              ))}
            </select>
          </Field>
        )}
      </Card>

      <Card icon={ChefHat} title={t("dnAppKitchenScreen")}>
        <p className="text-sm text-muted">{t("dnStKitchenBody")}</p>

        <div className="flex flex-wrap gap-3">
          <a
            href="/products/free-restaurant-pos/kitchen"
            target="_blank"
            rel="noopener noreferrer"
            className={secondaryBtnClass}
          >
            <ExternalLink className="h-4 w-4" />
            {t("dnAppOpenKitchen")}
          </a>

          {settings.kitchenLocked ? (
            <button
              type="button"
              onClick={() => void updateSettings({ kitchenLocked: false })}
              className={primaryBtnClass}
            >
              <Unlock className="h-4 w-4" />
              {t("dnStUnlockKitchen")}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void updateSettings({ kitchenLocked: true })}
              disabled={!settings.pinHash}
              title={
                settings.pinHash
                  ? t("dnStLockKitchenTitle")
                  : t("dnStSetPinFirst")
              }
              className={primaryBtnClass}
            >
              <Lock className="h-4 w-4" />
              {t("dnStLockKitchen")}
            </button>
          )}
        </div>

        {!settings.pinHash && (
          <p className="text-xs text-muted">{t("dnStSetPinAbove")}</p>
        )}

        {settings.kitchenLocked && (
          <p className="rounded-xl bg-indigo/5 p-3 text-xs leading-relaxed text-ink">
            <strong className="font-bold">{t("dnStOnlyUnlock")}</strong>{" "}
            {/* The inline flag sits on a placeholder, so each language puts it
                where its own grammar wants it. */}
            {(() => {
              const [before, after] = fill(t("dnStKioskNote"), { kiosk: "\u0000" }).split("\u0000");
              return (
                <>
                  {before}
                  <code className="rounded bg-white px-1 py-0.5">--kiosk</code>
                  {after}
                </>
              );
            })()}
          </p>
        )}
      </Card>

      <Card icon={Boxes} title={t("dnStRawMaterials")}>
        <p className="text-sm text-muted">{t("dnStStockBody")}</p>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-muted-line/40 bg-cream/40 p-3">
          <input
            type="checkbox"
            checked={settings.inventoryEnabled}
            onChange={(event) => void updateSettings({ inventoryEnabled: event.target.checked })}
            className="mt-0.5 h-4 w-4 accent-[#26306B]"
          />
          <span>
            <span className="block text-sm font-semibold text-ink">{t("dnStTrackStock")}</span>
            <span className="mt-0.5 block text-xs text-muted">{t("dnStTrackStockHint")}</span>
          </span>
        </label>

        {settings.inventoryEnabled && (
          <p className="text-xs text-muted">{t("dnStStockNote")}</p>
        )}
      </Card>

      <Card icon={BookUser} title={t("dnStCredit")}>
        <p className="text-sm text-muted">
          {t("dnStCreditBody")}{" "}
          <a
            href="/tools/customer-ledger"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-indigo underline underline-offset-2"
          >
            {t("dnStCustomerLedger")}
          </a>
          {t("dnStCreditTail")}
        </p>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-muted-line/40 bg-cream/40 p-3">
          <input
            type="checkbox"
            checked={settings.creditEnabled}
            onChange={(event) => void updateSettings({ creditEnabled: event.target.checked })}
            className="mt-0.5 h-4 w-4 accent-[#26306B]"
          />
          <span>
            <span className="block text-sm font-semibold text-ink">{t("dnStAllowOnAccount")}</span>
            <span className="mt-0.5 block text-xs text-muted">{t("dnStAllowOnAccountHint")}</span>
          </span>
        </label>

        {settings.creditEnabled && (
          <p className="text-xs text-muted">{t("dnStCreditNote")}</p>
        )}
      </Card>

      <Card icon={CalendarClock} title={t("dnStTableBookings")}>
        <p className="text-sm text-muted">{t("dnStBookingsBody")}</p>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-muted-line/40 bg-cream/40 p-3">
          <input
            type="checkbox"
            checked={settings.reservationsEnabled}
            onChange={(event) => void updateSettings({ reservationsEnabled: event.target.checked })}
            className="mt-0.5 h-4 w-4 accent-[#26306B]"
          />
          <span>
            <span className="block text-sm font-semibold text-ink">{t("dnStTakeBookings")}</span>
            <span className="mt-0.5 block text-xs text-muted">{t("dnStTakeBookingsHint")}</span>
          </span>
        </label>

        {settings.reservationsEnabled && (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={t("dnStUsualLength")} hint={t("dnStPrefilledHint")}>
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
                label={t("dnStHoldEitherSide")}
                hint={t("dnStHoldHint")}
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
              <Field label={t("dnStUsualAdvance")} hint={t("dnStUsualAdvanceHint")}>
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
                  placeholder={t("dnRsNoAdvance")}
                  className={inputClass}
                />
              </Field>
            </div>

            <Field
              label={t("dnStWhatsAppCode")}
              hint={t("dnStWhatsAppCodeHint")}
            >
              <input
                inputMode="numeric"
                value={settings.whatsappDialCode}
                onChange={(event) => void updateSettings({ whatsappDialCode: event.target.value })}
                className={inputClass}
              />
            </Field>

            <p className="text-xs text-muted">{t("dnStWhatsAppNote")}</p>
          </>
        )}
      </Card>

      <Card icon={Users} title={t("dnStCustomersAndLedger")}>
        <p className="text-sm text-muted">
          {/* The ledger link sits on a placeholder, so each language puts it
              where its own sentence wants it. */}
          {(() => {
            const [before, after] = fill(t("dnStCustomersBody"), { link: "\u0000" }).split("\u0000");
            return (
              <>
                {before}
                <a
                  href="/tools/customer-ledger"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-indigo underline underline-offset-2"
                >
                  {t("dnStCustomerLedger")}
                </a>
                {after}
              </>
            );
          })()}
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
            <span className="block text-sm font-semibold text-ink">{t("dnStShareDiners")}</span>
            <span className="mt-0.5 block text-xs text-muted">{t("dnStShareDinersHint")}</span>
          </span>
        </label>

        <p className="text-xs text-muted">
          {fill(t(customers.length === 1 ? "dnStDiner1" : "dnStDinerN"), { n: customers.length })}
        </p>
      </Card>

      <QrMenuCard />

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

      <Card icon={Sheet} title={t("dnStBackupSafety")}>
        <p className="text-sm text-muted">{t("dnStBackupBody")}</p>
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
            {backupBusy ? t("clPfSaving") : t("dnStDownloadBackup")}
          </button>
          <RestoreBackupButton className={secondaryBtnClass} />
        </div>
        {settings.lastBackupAt && (
          <p className="text-xs text-muted">
            {fill(t("appLastBackupAt"), {
              when: new Date(settings.lastBackupAt).toLocaleString(intlLocaleFor(lang)),
            })}
          </p>
        )}
      </Card>

      <Card icon={TriangleAlert} title={t("dnStDangerZone")}>
        <p className="text-sm text-muted">{t("dnStDangerBody")}</p>
        <button type="button" onClick={() => setConfirmReset(true)} className={dangerBtnClass}>
          {t("dnStResetEverything")}
        </button>
      </Card>

      <ConfirmDialog
        open={confirmReset}
        title={t("dnStEraseTitle")}
        message={t("dnStEraseBody")}
        confirmLabel={t("dnStEraseItAll")}
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
  const { t, lang } = useI18n();

  const run = async (job: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await job();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("dnStShFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card icon={Sheet} title={t("clStSheetTitle")}>
      <p className="text-sm text-muted">{t("dnStShBlurb")}</p>

      <p className="rounded-xl bg-cream/60 p-3 text-xs leading-relaxed text-ink">
        <strong className="font-bold">{t("dnStShNotMultiLabel")}</strong>{" "}
        {/* The product link sits on a placeholder, so each language puts it
            where its own sentence wants it. */}
        {(() => {
          const [before, after] = fill(t("dnStShNotMultiBody"), { link: "\u0000" }).split("\u0000");
          return (
            <>
              {before}
              <a
                href="/products/restaurant-pos"
                className="font-semibold text-indigo underline underline-offset-2"
              >
                Setu Dine
              </a>
              {after}
            </>
          );
        })()}
      </p>

      {url ? (
        <>
          <div className="rounded-xl border border-muted-line/30 bg-white p-3 text-xs">
            <p className="break-all font-mono text-muted">{url}</p>
            <p className="mt-2 text-muted">
              {lastSyncAt
                ? fill(t("clStLastSynced"), {
                    when: new Date(lastSyncAt).toLocaleString(intlLocaleFor(lang)),
                  })
                : t("clStNotSyncedYet")}{" "}
              {dirtyCount > 0
                ? fill(t(dirtyCount === 1 ? "dnStShChangeWaiting1" : "dnStShChangeWaitingN"), {
                    n: dirtyCount,
                  })
                : t("dnStShUpToDate")}
            </p>
            <p className="mt-1 text-muted/80">
              {fill(t(callsToday === 1 ? "dnStShCalls1" : "dnStShCallsN"), { n: callsToday })}
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
              {syncing ? t("clStSyncing") : t("tuStgSyncNow")}
            </button>
            <button
              type="button"
              onClick={() => void run(onResyncAll)}
              disabled={busy || syncing}
              className={secondaryBtnClass}
            >
              {t("tuStgResendAll")}
            </button>
            <button
              type="button"
              onClick={() => void run(onDisconnect)}
              disabled={busy}
              className={secondaryBtnClass}
            >
              {t("clStDisconnect")}
            </button>
          </div>
        </>
      ) : (
        <div className="space-y-3">
          <Field
            label={t("clStScriptUrl")}
            hint={t("dnStShScriptHint")}
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
            {busy ? t("clStConnecting") : t("dnStShConnectSheet")}
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
          {showScript ? t("dnStShHideScript") : t("dnStShShowScript")}
        </button>
        {showScript && (
          <div className="mt-3 space-y-2">
            <ol className="list-decimal space-y-1 pl-5 text-xs text-muted">
              <li>{fill(t("dnStShStep1"), { menu: "Extensions \u2192 Apps Script" })}</li>
              <li>{t("dnStShStep2")}</li>
              <li>
                {/* Google's own menu words stay English; the emphasis rides on
                    placeholders so each language orders the clause itself. */}
                {fill(t("dnStShStep3"), {
                  path: "Deploy \u2192 New deployment \u2192 Web app",
                  me: "\u0000Me\u0000",
                  anyone: "\u0000Anyone\u0000",
                })
                  .split("\u0000")
                  .map((part, index) =>
                    index % 2 === 1 ? <strong key={index}>{part}</strong> : part,
                  )}
              </li>
              <li>{t("dnStShStep4")}</li>
            </ol>
            <p className="text-xs text-muted">{t("dnStShTreatUrl")}</p>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(APPS_SCRIPT_TEMPLATE);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 2000);
                } catch {
                  setError(t("dnStShCopyFailed"));
                }
              }}
              className={secondaryBtnClass}
            >
              {copied ? t("spCopiedShort") : t("dnStShCopyScript")}
            </button>
            <pre className="max-h-56 overflow-auto rounded-xl bg-ink p-3 text-[11px] leading-relaxed text-cream">
              {APPS_SCRIPT_TEMPLATE}
            </pre>
          </div>
        )}
      </div>

      <div className="border-t border-muted-line/20 pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          {t("dnStShRestoreTitle")}
        </p>
        <p className="mt-1 text-xs text-muted">{t("dnStShRestoreBlurb")}</p>
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
            {t("dnStShRestore")}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmRestore}
        title={t("dnStShRestoreQ")}
        message={t("dnStShRestoreBody")}
        confirmLabel={t("dnStShRestore")}
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
  const { t } = useI18n();

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
      label={t("dnStBillDesign")}
      hint={t("dnStBillDesignHint")}
    >
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`${inputClass} max-w-xs`}
        >
          <option value="">{t("dnStBuiltInLayout")}</option>
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
          {templates.length > 0 ? t("dnStDesignAnother") : t("dnStDesignOne")}
        </a>
      </div>
      {loaded && templates.length === 0 && (
        <p className="mt-1 text-xs text-muted">{t("dnStNoDesigns")}</p>
      )}
      {value !== "" && (
        <p className="mt-1 text-xs text-muted">{t("dnStDesignDecides")}</p>
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
