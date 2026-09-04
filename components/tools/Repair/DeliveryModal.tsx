"use client";

// Handing the device back — §3.4.
//
// Four things happen in one place because they happen in one moment at the
// counter: the bill is settled, the customer signs, the warranty clock starts,
// and the invoice prints with the expiry date on it. Splitting them across
// screens would mean a device handed over with the signature step still open in
// a tab somebody closed.
//
// The bill can be skipped. A warranty claim, or a fault that turned out to be a
// loose connector, is handed back with nothing to charge — and a zero invoice in
// the register is a row that means nothing and a number burnt for no reason.

import { useMemo, useState } from "react";
import { PackageCheck, Printer } from "lucide-react";
import { useRepair } from "@/lib/repair/store";
import { billTotals, isWarrantyClaim, round2 } from "@/lib/repair/calc";
import { addDays, formatDate, todayKey, type Job } from "@/lib/repair/types";
import { formatMoney } from "@/lib/pos/types";
import { SignaturePad } from "@/components/tools/Clinic/SignaturePad";
import { Field, Modal, ToggleChip, inputClass, primaryBtnClass, secondaryBtnClass } from "./ui";

export function DeliveryModal({
  job,
  open,
  onClose,
  onDelivered,
}: {
  job: Job;
  open: boolean;
  onClose: () => void;
  /** Called with the delivered job so the caller can print and message. */
  onDelivered: (job: Job) => void;
}) {
  const { settings, business, deliverJob } = useRepair();
  const currency = business?.currency ?? "INR";
  const claim = isWarrantyClaim(job);

  const [charge, setCharge] = useState(!claim);
  const [discount, setDiscount] = useState("0");
  const [taxRate, setTaxRate] = useState(String(settings.defaultTaxRate));
  const [paid, setPaid] = useState("");
  const [paymentMode, setPaymentMode] = useState(settings.paymentModes[0] ?? "Cash");
  const [warrantyDays, setWarrantyDays] = useState(String(job.warrantyDays));
  const [deliveredOn, setDeliveredOn] = useState(todayKey());
  const [signature, setSignature] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const totals = useMemo(
    () =>
      billTotals(
        {
          partsUsed: job.partsUsed,
          labourCharge: job.labourCharge,
          discount: Number(discount) || 0,
          taxRate: Number(taxRate) || 0,
        },
        settings
      ),
    [job.partsUsed, job.labourCharge, discount, taxRate, settings]
  );

  const paidValue = paid.trim() === "" ? totals.total : Number(paid) || 0;
  const balance = round2(Math.max(0, totals.total - paidValue));
  const days = Number(warrantyDays) || 0;
  const warrantyEnd = days > 0 ? addDays(deliveredOn, days) : "";

  const submit = async () => {
    setError("");
    setSaving(true);
    try {
      const delivered = await deliverJob(job.id, {
        deliveredOn,
        warrantyDays: days,
        deliverySignatureDataUrl: signature,
        bill: charge
          ? {
              discount: Number(discount) || 0,
              taxRate: Number(taxRate) || 0,
              paid: paidValue,
              paymentMode,
            }
          : null,
      });
      onDelivered(delivered);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not complete the delivery.");
      setSaving(false);
    }
  };

  const money = (value: number) => formatMoney(value, currency);

  return (
    <Modal open={open} onClose={onClose} title={`Deliver ${job.jobNo}`} wide>
      <div className="grid gap-4">
        {claim && (
          <p className="rounded-lg border border-indigo/40 bg-indigo/5 p-3 text-sm text-ink">
            This is a warranty claim, so it is free by default. Switch charging on if parts had to
            be billed.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <ToggleChip active={charge} onClick={() => setCharge(true)}>
            Bill this repair
          </ToggleChip>
          <ToggleChip active={!charge} onClick={() => setCharge(false)}>
            No charge
          </ToggleChip>
        </div>

        {charge ? (
          <div className="rounded-xl border border-muted-line/30 bg-cream-paper p-4">
            <table className="w-full text-sm">
              <tbody>
                {job.partsUsed.map((part) => (
                  <tr key={part.id}>
                    <td className="py-1 text-ink">
                      {part.name}
                      {part.quantity > 1 && <span className="text-muted"> × {part.quantity}</span>}
                    </td>
                    <td className="py-1 text-right text-ink">
                      {money(part.sellingPrice * part.quantity)}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td className="py-1 text-ink">Labour</td>
                  <td className="py-1 text-right text-ink">{money(totals.labourCharge)}</td>
                </tr>
                {totals.discount > 0 && (
                  <tr>
                    <td className="py-1 text-muted">Discount</td>
                    <td className="py-1 text-right text-muted">− {money(totals.discount)}</td>
                  </tr>
                )}
                {totals.taxAmount > 0 && (
                  <tr>
                    <td className="py-1 text-muted">Tax ({totals.taxRate}%)</td>
                    <td className="py-1 text-right text-muted">{money(totals.taxAmount)}</td>
                  </tr>
                )}
                <tr className="border-t border-muted-line/40">
                  <td className="pt-2 font-bold text-ink">Total</td>
                  <td className="pt-2 text-right font-bold text-ink">{money(totals.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-muted-line/40 p-4 text-sm text-muted">
            No invoice will be raised and no invoice number used. The job is still recorded as
            delivered, with its warranty.
          </p>
        )}

        {charge && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Discount" hint="A flat amount off the bill.">
              <input
                className={inputClass}
                value={discount}
                onChange={(event) => setDiscount(event.target.value)}
                inputMode="decimal"
              />
            </Field>
            {settings.taxEnabled && (
              <Field label="Tax rate %">
                <input
                  className={inputClass}
                  value={taxRate}
                  onChange={(event) => setTaxRate(event.target.value)}
                  inputMode="decimal"
                />
              </Field>
            )}
            <Field label="Amount received" hint={`Leave blank for the full ${money(totals.total)}.`}>
              <input
                className={inputClass}
                value={paid}
                onChange={(event) => setPaid(event.target.value)}
                inputMode="decimal"
                placeholder={String(totals.total)}
              />
            </Field>
            <Field label="Paid by">
              <select
                className={inputClass}
                value={paymentMode}
                onChange={(event) => setPaymentMode(event.target.value)}
              >
                {settings.paymentModes.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}

        {charge && balance > 0 && (
          <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            {money(balance)} will be left outstanding on this bill.
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Delivered on">
            <input
              type="date"
              className={inputClass}
              value={deliveredOn}
              onChange={(event) => setDeliveredOn(event.target.value)}
            />
          </Field>
          <Field
            label="Warranty (days)"
            hint={warrantyEnd ? `Covered until ${formatDate(warrantyEnd)}.` : "0 means no warranty."}
          >
            <input
              className={inputClass}
              value={warrantyDays}
              onChange={(event) => setWarrantyDays(event.target.value)}
              inputMode="numeric"
            />
          </Field>
        </div>

        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
            Customer&apos;s signature on collection
          </p>
          <p className="mb-2 text-xs text-muted">
            Optional — the printed invoice carries a signature line either way.
          </p>
          <SignaturePad value={signature} onChange={setSignature} />
        </div>

        {error && (
          <p className="text-sm font-semibold text-red-600" role="alert">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => void submit()}
            className={`${primaryBtnClass} sm:flex-1`}
            disabled={saving}
          >
            {charge ? <Printer className="h-4 w-4" /> : <PackageCheck className="h-4 w-4" />}
            {saving ? "Saving…" : charge ? "Deliver, bill and print" : "Deliver with no charge"}
          </button>
          <button type="button" onClick={onClose} className={secondaryBtnClass} disabled={saving}>
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
