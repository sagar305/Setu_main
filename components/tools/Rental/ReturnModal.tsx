"use client";

// Return and settlement — where the margin in this trade is won or lost.
//
// The screen is a reconciliation, not a form: for every line, how many came
// back, how many came back broken, how many did not come back at all. The
// charges follow from those three numbers and the item's own replacement value,
// and the deposit is applied at the bottom. Everything is shown while it is
// being entered, because the customer is standing there and the argument is
// about the figures.

import { useEffect, useMemo, useState } from "react";
import { PackageCheck, Printer, Receipt } from "lucide-react";
import { SignaturePad } from "@/components/tools/Clinic/SignaturePad";
import { formatMoney } from "@/lib/pos/types";
import { useRental } from "@/lib/rental/store";
import { damageChargeFor, defaultLossCharge, settleBooking } from "@/lib/rental/calc";
import { printInvoice, printSettlement } from "@/lib/rental/print";
import { formatDate, type Booking } from "@/lib/rental/types";
import type { ReturnLineInput } from "@/lib/rental/store";
import { Field, Modal, inputClass, primaryBtnClass, secondaryBtnClass } from "./ui";

type DraftLine = ReturnLineInput & { damagePercent: number };

export function ReturnModal({
  open,
  onClose,
  booking,
}: {
  open: boolean;
  onClose: () => void;
  booking: Booking | null;
}) {
  const { business, customerById, items, returnBooking, settings, today } = useRental();
  const [returnedOn, setReturnedOn] = useState(today);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [collect, setCollect] = useState("");
  const [refund, setRefund] = useState("");
  const [mode, setMode] = useState(settings.paymentModes[0] ?? "Cash");
  const [raiseInvoice, setRaiseInvoice] = useState(false);
  const [signature, setSignature] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const currency = business?.currency ?? "INR";
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const customer = booking ? customerById(booking.customerId) : undefined;

  useEffect(() => {
    if (!open || !booking) return;
    setReturnedOn(booking.actualReturnedOn ?? today);
    setLines(
      booking.lines.map((line) => ({
        lineId: line.id,
        // Everything came back until someone says otherwise — that is the case
        // nine times in ten, and it makes the exceptions the only typing.
        returnedQuantity: line.returnedQuantity || line.quantity,
        damagedQuantity: line.damagedQuantity,
        lostQuantity: line.lostQuantity,
        damageCharge: line.damageCharge,
        lossCharge: line.lossCharge,
        returnNote: line.returnNote,
        damagePercent: settings.damagePercentOptions[1] ?? 50,
      }))
    );
    setCollect("");
    setRefund("");
    setSignature(booking.returnSignature);
    setRaiseInvoice(Boolean(booking.invoiceNo));
    setError("");
  }, [booking, open, settings.damagePercentOptions, today]);

  /** The live settlement, against the numbers currently on screen. */
  const preview = useMemo(() => {
    if (!booking) return null;
    const byId = new Map(lines.map((line) => [line.lineId, line]));
    const merged: Booking = {
      ...booking,
      actualReturnedOn: returnedOn,
      lines: booking.lines.map((line) => {
        const draft = byId.get(line.id);
        return draft
          ? {
              ...line,
              returnedQuantity: draft.returnedQuantity,
              damagedQuantity: draft.damagedQuantity,
              lostQuantity: draft.lostQuantity,
              damageCharge: draft.damageCharge,
              lossCharge: draft.lossCharge,
              returnNote: draft.returnNote,
            }
          : line;
      }),
    };
    return { booking: merged, settlement: settleBooking(merged, settings, itemById, today) };
  }, [booking, itemById, lines, returnedOn, settings, today]);

  useEffect(() => {
    if (!preview) return;
    // Pre-fill what is actually changing hands, both ways.
    setCollect(preview.settlement.finalPayable > 0 ? String(preview.settlement.finalPayable) : "");
    setRefund(preview.settlement.depositRefunded > 0 ? String(preview.settlement.depositRefunded) : "");
  }, [preview?.settlement.finalPayable, preview?.settlement.depositRefunded]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!booking || !preview) return null;

  const setLine = (lineId: string, updates: Partial<DraftLine>) =>
    setLines((current) =>
      current.map((line) => (line.lineId === lineId ? { ...line, ...updates } : line))
    );

  const printContext = {
    business,
    booking: { ...preview.booking, returnSignature: signature },
    customer,
    itemById,
    settings,
  };

  const submit = async () => {
    setError("");
    for (const line of lines) {
      const source = booking.lines.find((row) => row.id === line.lineId);
      if (!source) continue;
      const accounted = line.returnedQuantity + line.lostQuantity;
      if (accounted > source.quantity) {
        setError(`${source.name}: more returned and lost than went out.`);
        return;
      }
      if (line.damagedQuantity > line.returnedQuantity) {
        setError(`${source.name}: cannot have more damaged than came back.`);
        return;
      }
    }

    setSaving(true);
    try {
      await returnBooking(booking.id, {
        actualReturnedOn: returnedOn,
        lines: lines.map(({ damagePercent: _percent, ...line }) => line),
        returnSignature: signature,
        payment:
          Number(collect) > 0
            ? { amount: Number(collect), mode, kind: "settlement", date: returnedOn }
            : null,
        refund:
          Number(refund) > 0
            ? { amount: Number(refund), mode, kind: "refund", date: returnedOn }
            : null,
        raiseInvoice,
      });
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not settle this booking.");
    } finally {
      setSaving(false);
    }
  };

  const { settlement } = preview;

  return (
    <Modal open={open} onClose={onClose} title={`Return · ${booking.bookingNo}`} wide>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Returned on">
            <input
              type="date"
              className={inputClass}
              value={returnedOn}
              onChange={(event) => setReturnedOn(event.target.value)}
            />
          </Field>
          <div className="rounded-xl bg-cream-paper/70 p-3 text-sm">
            <p className="text-muted">Due back {formatDate(booking.toDate)}</p>
            <p className={settlement.lateDays > 0 ? "font-bold text-red-600" : "font-semibold text-green-700"}>
              {settlement.lateDays > 0
                ? `${settlement.lateDays} day${settlement.lateDays === 1 ? "" : "s"} late · late fee ${formatMoney(settlement.lateFee, currency)}`
                : "On time"}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {booking.lines.map((line) => {
            const draft = lines.find((row) => row.lineId === line.id);
            if (!draft) return null;
            const item = itemById.get(line.itemId);

            return (
              <div key={line.id} className="rounded-xl border border-muted-line/30 bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-ink">{line.name}</p>
                  <p className="text-xs text-muted">{line.quantity} out</p>
                </div>

                <div className="mt-2 grid grid-cols-3 gap-2">
                  <label className="block">
                    <span className="text-[10px] font-semibold uppercase text-muted">Back</span>
                    <input
                      className={inputClass}
                      inputMode="numeric"
                      value={draft.returnedQuantity}
                      onChange={(event) =>
                        setLine(line.id, {
                          returnedQuantity: Math.max(0, Number(event.target.value) || 0),
                        })
                      }
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-semibold uppercase text-muted">Damaged</span>
                    <input
                      className={inputClass}
                      inputMode="numeric"
                      value={draft.damagedQuantity}
                      onChange={(event) => {
                        const damagedQuantity = Math.max(0, Number(event.target.value) || 0);
                        setLine(line.id, {
                          damagedQuantity,
                          damageCharge: damageChargeFor(damagedQuantity, draft.damagePercent, item),
                        });
                      }}
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-semibold uppercase text-muted">Lost</span>
                    <input
                      className={inputClass}
                      inputMode="numeric"
                      value={draft.lostQuantity}
                      onChange={(event) => {
                        const lostQuantity = Math.max(0, Number(event.target.value) || 0);
                        setLine(line.id, {
                          lostQuantity,
                          lossCharge: defaultLossCharge(lostQuantity, item),
                        });
                      }}
                    />
                  </label>
                </div>

                {draft.damagedQuantity > 0 ? (
                  <div className="mt-2 rounded-lg bg-cream-paper/60 p-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-semibold uppercase text-muted">
                        Damage
                      </span>
                      {settings.damagePercentOptions.map((percent) => (
                        <button
                          key={percent}
                          type="button"
                          onClick={() =>
                            setLine(line.id, {
                              damagePercent: percent,
                              damageCharge: damageChargeFor(draft.damagedQuantity, percent, item),
                            })
                          }
                          className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${
                            draft.damagePercent === percent
                              ? "border-indigo bg-indigo text-white"
                              : "border-muted-line/40 bg-white text-muted"
                          }`}
                        >
                          {percent}%
                        </button>
                      ))}
                      <input
                        className={`${inputClass} ml-auto w-28`}
                        inputMode="decimal"
                        value={draft.damageCharge}
                        onChange={(event) =>
                          setLine(line.id, { damageCharge: Number(event.target.value) || 0 })
                        }
                      />
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {settings.damagePresets.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() =>
                            setLine(line.id, {
                              returnNote: draft.returnNote
                                ? `${draft.returnNote}, ${preset}`
                                : preset,
                            })
                          }
                          className="rounded-md border border-muted-line/40 bg-white px-2 py-0.5 text-xs text-muted hover:border-indigo/50 hover:text-indigo"
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {draft.lostQuantity > 0 ? (
                  <label className="mt-2 flex items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase text-muted">
                      Loss charge
                    </span>
                    <input
                      className={`${inputClass} w-32`}
                      inputMode="decimal"
                      value={draft.lossCharge}
                      onChange={(event) =>
                        setLine(line.id, { lossCharge: Number(event.target.value) || 0 })
                      }
                    />
                    <span className="text-xs text-muted">
                      replacement {formatMoney(item?.replacementValue ?? 0, currency)}/unit
                    </span>
                  </label>
                ) : null}

                {draft.damagedQuantity > 0 || draft.lostQuantity > 0 ? (
                  <input
                    className={`${inputClass} mt-2`}
                    placeholder="Note"
                    value={draft.returnNote}
                    onChange={(event) => setLine(line.id, { returnNote: event.target.value })}
                  />
                ) : null}
              </div>
            );
          })}
        </div>

        {/* Settlement */}
        <section className="rounded-xl bg-cream-paper/70 p-4">
          <dl className="space-y-1 text-sm">
            <Row label="Hire total" value={formatMoney(settlement.total, currency)} />
            {settlement.lateFee ? (
              <Row
                label={`Late fee (${settlement.lateDays} days)`}
                value={formatMoney(settlement.lateFee, currency)}
              />
            ) : null}
            {settlement.damageTotal ? (
              <Row label="Damage" value={formatMoney(settlement.damageTotal, currency)} />
            ) : null}
            {settlement.lossTotal ? (
              <Row label="Loss" value={formatMoney(settlement.lossTotal, currency)} />
            ) : null}
            <Row label="Total charges" value={formatMoney(settlement.charges, currency)} bold />
            {settlement.paidTowardsCharges ? (
              <Row
                label="Already paid"
                value={`-${formatMoney(settlement.paidTowardsCharges, currency)}`}
              />
            ) : null}
            {settlement.depositTotal ? (
              <Row
                label="Deposit held"
                value={`-${formatMoney(settlement.depositTotal, currency)}`}
              />
            ) : null}
            <Row
              label={settlement.finalPayable > 0 ? "Customer pays" : "Refund to customer"}
              value={formatMoney(
                settlement.finalPayable > 0 ? settlement.finalPayable : settlement.depositRefunded,
                currency
              )}
              bold
            />
          </dl>
        </section>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Collect now">
            <input
              className={inputClass}
              inputMode="decimal"
              value={collect}
              onChange={(event) => setCollect(event.target.value)}
            />
          </Field>
          <Field label="Refund now">
            <input
              className={inputClass}
              inputMode="decimal"
              value={refund}
              onChange={(event) => setRefund(event.target.value)}
            />
          </Field>
          <Field label="Mode">
            <select
              className={inputClass}
              value={mode}
              onChange={(event) => setMode(event.target.value)}
            >
              {settings.paymentModes.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={raiseInvoice}
            onChange={(event) => setRaiseInvoice(event.target.checked)}
            className="h-4 w-4 accent-indigo"
          />
          Raise a tax invoice for this hire
          {booking.invoiceNo ? (
            <span className="text-xs text-muted">({booking.invoiceNo})</span>
          ) : null}
        </label>

        <div>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
            Customer signature
          </span>
          <SignaturePad value={signature} onChange={setSignature} />
        </div>

        {error ? (
          <p className="text-sm font-semibold text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void submit()}
            className={`${primaryBtnClass} flex-1`}
            disabled={saving}
          >
            <PackageCheck className="h-4 w-4" aria-hidden="true" />
            {saving ? "Settling…" : "Record return"}
          </button>
          <button
            type="button"
            onClick={() => printSettlement(printContext, settlement)}
            className={secondaryBtnClass}
          >
            <Printer className="h-4 w-4" aria-hidden="true" />
            Settlement note
          </button>
          <button
            type="button"
            onClick={() => printInvoice(printContext, settlement)}
            className={secondaryBtnClass}
          >
            <Receipt className="h-4 w-4" aria-hidden="true" />
            Invoice
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "text-base font-bold text-ink" : "text-muted"}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
