"use client";

import { useEffect, useMemo, useState } from "react";
import { usePharmacy } from "@/lib/pharmacy/store";
import { formatMoney } from "@/lib/pos/types";
import {
  PURCHASE_RETURN_REASONS,
  PURCHASE_RETURN_REASON_LABELS,
  formatExpiry,
  isExpired,
  todayKey,
  type PurchaseReturnReason,
} from "@/lib/pharmacy/types";
import { SupplierPicker } from "./SupplierPicker";
import { ExpiryChip, Field, Modal, inputClass, primaryBtnClass, secondaryBtnClass } from "./ui";

/**
 * Build a return note for one distributor.
 *
 * Scoped to a single supplier on purpose: a distributor takes back what they
 * supplied, so a note mixing two of them is a note that gets argued over at the
 * counter. Batches are listed with expired stock first, because that is what
 * this screen is nearly always opened for.
 */
export function PurchaseReturnModal({
  open,
  onClose,
  presetSupplierId,
  presetBatchIds,
}: {
  open: boolean;
  onClose: () => void;
  presetSupplierId?: string | null;
  presetBatchIds?: string[];
}) {
  const { batches, business, medicineById, savePurchaseReturn, today } = usePharmacy();
  const [supplierId, setSupplierId] = useState<string | null>(presetSupplierId ?? null);
  const [reason, setReason] = useState<PurchaseReturnReason>("expiry");
  const [date, setDate] = useState(todayKey());
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const currency = business?.currency ?? "INR";

  useEffect(() => {
    if (!open) return;
    setSupplierId(presetSupplierId ?? null);
    setDate(todayKey());
    setError("");
    setQuantities(
      Object.fromEntries(
        (presetBatchIds ?? []).map((id) => [
          id,
          String(batches.find((batch) => batch.id === id)?.quantity ?? 0),
        ])
      )
    );
  }, [batches, open, presetBatchIds, presetSupplierId]);

  const options = useMemo(() => {
    if (!supplierId) return [];
    return batches
      .filter((batch) => batch.supplierId === supplierId && batch.quantity > 0)
      .sort((a, b) => a.expiry.localeCompare(b.expiry));
  }, [batches, supplierId]);

  const lines = options
    .map((batch) => ({
      batchId: batch.id,
      quantity: Math.min(batch.quantity, Math.max(0, Number(quantities[batch.id]) || 0)),
      rate: batch.effectiveRate,
    }))
    .filter((line) => line.quantity > 0);

  const total = lines.reduce((sum, line) => sum + line.quantity * line.rate, 0);

  const submit = async () => {
    if (!supplierId) {
      setError("Pick the distributor this is going back to.");
      return;
    }
    if (lines.length === 0) {
      setError("Enter a quantity against at least one batch.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await savePurchaseReturn({ supplierId, date, reason, lines });
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save this return.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Return stock to a distributor" wide>
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Supplier" required>
            <SupplierPicker value={supplierId} onChange={setSupplierId} />
          </Field>
          <Field label="Reason">
            <select
              className={inputClass}
              value={reason}
              onChange={(event) => setReason(event.target.value as PurchaseReturnReason)}
            >
              {PURCHASE_RETURN_REASONS.map((option) => (
                <option key={option} value={option}>
                  {PURCHASE_RETURN_REASON_LABELS[option]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date">
            <input
              type="date"
              className={inputClass}
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </Field>
        </div>

        {!supplierId ? (
          <p className="text-sm text-muted">Pick a supplier to see what they supplied.</p>
        ) : options.length === 0 ? (
          <p className="text-sm text-muted">
            Nothing from this supplier is in stock. Batches entered before a supplier was
            recorded on them will not appear here.
          </p>
        ) : (
          <div className="max-h-72 overflow-y-auto rounded-lg border border-muted-line/30">
            {options.map((batch) => {
              const medicine = medicineById(batch.medicineId);
              const expired = isExpired(batch.expiry, today);
              return (
                <div
                  key={batch.id}
                  className={`flex flex-wrap items-center justify-between gap-2 border-b border-muted-line/20 p-3 last:border-0 ${
                    expired ? "bg-red-50/50" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">
                      {medicine?.name ?? "—"}
                    </p>
                    <p className="text-xs text-muted">
                      B/No {batch.batchNo || "—"} · Exp {formatExpiry(batch.expiry)} ·{" "}
                      {batch.quantity} in hand · cost{" "}
                      {formatMoney(batch.effectiveRate, currency)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <ExpiryChip expiry={batch.expiry} today={today} />
                    <input
                      className="h-9 w-20 rounded-lg border border-muted-line/40 px-2 text-right text-sm"
                      value={quantities[batch.id] ?? ""}
                      inputMode="numeric"
                      placeholder="0"
                      onChange={(event) =>
                        setQuantities((previous) => ({
                          ...previous,
                          [batch.id]: event.target.value,
                        }))
                      }
                      aria-label={`Quantity of ${medicine?.name ?? "batch"} to return`}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setQuantities((previous) => ({
                          ...previous,
                          [batch.id]: String(batch.quantity),
                        }))
                      }
                      className="text-xs font-semibold text-indigo hover:underline"
                    >
                      All
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between rounded-xl border border-muted-line/30 bg-cream-paper p-3">
          <span className="text-sm text-muted">
            {lines.length} batch{lines.length === 1 ? "" : "es"} · value at cost
          </span>
          <strong className="text-lg text-ink">{formatMoney(total, currency)}</strong>
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
            {saving ? "Saving…" : "Create return note"}
          </button>
          <button type="button" onClick={onClose} className={secondaryBtnClass}>
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
