"use client";

// Dispatch — the moment the stock physically leaves.
//
// Two audiences, one screen. The loading crew needs counts and, for serialised
// stock, the exact units they are putting on the lorry; the customer needs a
// challan to sign. So the picking list is ticked here and printed for the yard,
// and the challan prints with the signature on it.

import { useEffect, useMemo, useState } from "react";
import { ClipboardList, FileText, Truck } from "lucide-react";
import { SignaturePad } from "@/components/tools/Clinic/SignaturePad";
import { useRental } from "@/lib/rental/store";
import { freeUnits } from "@/lib/rental/availability";
import { printChallan, printPickingList } from "@/lib/rental/print";
import { formatDate, type Booking } from "@/lib/rental/types";
import { Field, Modal, inputClass, primaryBtnClass, secondaryBtnClass } from "./ui";

export function DispatchModal({
  open,
  onClose,
  booking,
}: {
  open: boolean;
  onClose: () => void;
  booking: Booking | null;
}) {
  const { business, customerById, dispatchBooking, index, items, settings, today, units } =
    useRental();
  const [allocations, setAllocations] = useState<Record<string, string[]>>({});
  const [dispatchedOn, setDispatchedOn] = useState(today);
  const [signature, setSignature] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const customer = booking ? customerById(booking.customerId) : undefined;

  useEffect(() => {
    if (!open || !booking) return;
    setAllocations(
      Object.fromEntries(booking.lines.map((line) => [line.id, [...line.unitIds]]))
    );
    setDispatchedOn(booking.dispatchedOn ?? today);
    setSignature(booking.dispatchSignature);
    setError("");
  }, [booking, open, today]);

  if (!booking) return null;

  const printContext = {
    business,
    booking: { ...booking, dispatchSignature: signature },
    customer,
    itemById,
    settings,
  };

  const toggleUnit = (lineId: string, unitId: string) =>
    setAllocations((current) => {
      const picked = current[lineId] ?? [];
      return {
        ...current,
        [lineId]: picked.includes(unitId)
          ? picked.filter((id) => id !== unitId)
          : [...picked, unitId],
      };
    });

  const submit = async () => {
    setError("");
    // Serialised lines must name the units. Dispatching "3 cameras" without
    // saying which three is how the same body ends up on two bookings.
    for (const line of booking.lines) {
      const item = itemById.get(line.itemId);
      if (item?.tracking !== "serialised") continue;
      const picked = allocations[line.id] ?? [];
      if (picked.length !== line.quantity) {
        setError(
          `Pick ${line.quantity} unit${line.quantity === 1 ? "" : "s"} of ${line.name} — ${picked.length} ticked.`
        );
        return;
      }
    }

    setSaving(true);
    try {
      await dispatchBooking(booking.id, allocations, signature, dispatchedOn);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not dispatch this booking.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Dispatch · ${booking.bookingNo}`} wide>
      <div className="space-y-4">
        <div className="rounded-xl bg-cream-paper/70 p-3 text-sm">
          <p className="font-semibold text-ink">{customer?.name}</p>
          <p className="text-muted">
            {booking.eventName ? `${booking.eventName} · ` : ""}
            {booking.venue}
            {booking.venueContact ? ` · ${booking.venueContact}` : ""}
          </p>
          <p className="text-muted">
            Out {formatDate(booking.fromDate)} · back {formatDate(booking.toDate)}
          </p>
        </div>

        <div className="space-y-2">
          {booking.lines.map((line) => {
            const item = itemById.get(line.itemId);
            const serialised = item?.tracking === "serialised";
            const picked = allocations[line.id] ?? [];
            const available = item ? freeUnits(index, units, item.id, booking.id) : [];

            return (
              <div key={line.id} className="rounded-xl border border-muted-line/30 bg-white p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-ink">{line.name}</p>
                  <p className="text-sm font-bold text-ink">
                    {line.quantity}
                    {serialised ? (
                      <span
                        className={`ml-2 text-xs font-semibold ${
                          picked.length === line.quantity ? "text-green-700" : "text-amber-600"
                        }`}
                      >
                        {picked.length} ticked
                      </span>
                    ) : null}
                  </p>
                </div>

                {serialised ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {available.length === 0 ? (
                      <p className="text-xs text-muted">
                        No units free — add units to this item, or free one from another booking.
                      </p>
                    ) : null}
                    {available.map((unit) => (
                      <button
                        key={unit.id}
                        type="button"
                        onClick={() => toggleUnit(line.id, unit.id)}
                        className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                          picked.includes(unit.id)
                            ? "border-indigo bg-indigo text-white"
                            : "border-muted-line/40 bg-white text-ink hover:border-indigo/50"
                        }`}
                      >
                        {unit.serialNo || unit.id.slice(0, 6)}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <Field label="Dispatched on">
          <input
            type="date"
            className={inputClass}
            value={dispatchedOn}
            onChange={(event) => setDispatchedOn(event.target.value)}
          />
        </Field>

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
            <Truck className="h-4 w-4" aria-hidden="true" />
            {saving ? "Dispatching…" : "Mark dispatched"}
          </button>
          <button
            type="button"
            onClick={() => printPickingList(printContext)}
            className={secondaryBtnClass}
          >
            <ClipboardList className="h-4 w-4" aria-hidden="true" />
            Picking list
          </button>
          <button
            type="button"
            onClick={() => printChallan(printContext)}
            className={secondaryBtnClass}
          >
            <FileText className="h-4 w-4" aria-hidden="true" />
            Challan
          </button>
        </div>
      </div>
    </Modal>
  );
}
