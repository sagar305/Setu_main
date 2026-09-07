"use client";

import { usePharmacy } from "@/lib/pharmacy/store";
import { batchBlockReason, batchesForMedicine } from "@/lib/pharmacy/calc";
import { formatMoney } from "@/lib/pos/types";
import { formatExpiry, type Batch } from "@/lib/pharmacy/types";
import { ExpiryChip, Modal, Pill } from "./ui";

/**
 * Change the batch on a cart line.
 *
 * FEFO already chose one, and it is right nearly every time — but "nearly" is
 * not good enough at a counter where the customer is holding a strip from a
 * different lot, or where the oldest box is at the back of the store and the
 * newer one is in reach. One tap, and the reason each batch is or is not
 * available is on the row rather than hidden behind a disabled state.
 */
export function BatchPicker({
  open,
  medicineId,
  currentBatchId,
  onPick,
  onClose,
}: {
  open: boolean;
  medicineId: string;
  currentBatchId: string;
  onPick: (batch: Batch) => void;
  onClose: () => void;
}) {
  const { batches, business, medicineById, settings, today } = usePharmacy();
  const medicine = medicineById(medicineId);
  const currency = business?.currency ?? "INR";
  const options = batchesForMedicine(batches, medicineId);

  return (
    <Modal open={open} onClose={onClose} title={`Batches — ${medicine?.name ?? "medicine"}`}>
      {options.length === 0 ? (
        <p className="text-sm text-muted">
          No batches on record. Stock arrives through Purchases.
        </p>
      ) : (
        <div className="grid gap-2">
          {options.map((batch) => {
            const blocked = batchBlockReason(batch, settings, today);
            const isCurrent = batch.id === currentBatchId;
            const selectable = blocked === "" || isCurrent;
            return (
              <button
                key={batch.id}
                type="button"
                disabled={!selectable}
                onClick={() => {
                  onPick(batch);
                  onClose();
                }}
                className={`flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition ${
                  isCurrent
                    ? "border-indigo bg-indigo/5"
                    : selectable
                      ? "border-muted-line/30 bg-white hover:border-indigo/50"
                      : "cursor-not-allowed border-muted-line/20 bg-muted-line/5 opacity-70"
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-ink">
                    {batch.batchNo || "No batch no."}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    Exp {formatExpiry(batch.expiry)} · MRP {formatMoney(batch.mrp, currency)} ·{" "}
                    {formatMoney(batch.sellingRate, currency)} each
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <ExpiryChip expiry={batch.expiry} today={today} />
                  {blocked === "empty" ? (
                    <Pill tone="muted">Out of stock</Pill>
                  ) : blocked === "expired" ? (
                    <Pill tone="danger">Cannot be sold</Pill>
                  ) : blocked === "near-expiry" ? (
                    <Pill tone="warn">Blocked by your expiry rule</Pill>
                  ) : (
                    <Pill tone="good">{batch.quantity} in hand</Pill>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
