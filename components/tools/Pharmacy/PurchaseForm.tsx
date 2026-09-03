"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { usePharmacy } from "@/lib/pharmacy/store";
import { effectiveRate, purchaseTotals } from "@/lib/pharmacy/calc";
import { formatMoney } from "@/lib/pos/types";
import {
  TAX_RATES,
  currentMonthKey,
  generateId,
  todayKey,
  type Medicine,
  type PurchaseLine,
} from "@/lib/pharmacy/types";
import { MedicinePicker } from "./MedicinePicker";
import { SupplierPicker } from "./SupplierPicker";
import { Field, Modal, inputClass, primaryBtnClass, secondaryBtnClass } from "./ui";

/**
 * A line as the operator enters it.
 *
 * Quantities are in PACKS here and converted to units on save: a distributor
 * invoice says "10 strips", the shelf holds 10 strips, and nobody at the
 * counter thinks in 150 tablets. Rates stay per unit, which is how the batch
 * stores them and how the bill prices them — so each rate input shows its pack
 * equivalent alongside, and the operator checks that against the paper.
 */
type DraftLine = {
  id: string;
  medicine: Medicine | null;
  batchNo: string;
  expiry: string;
  packs: string;
  freePacks: string;
  purchaseRate: string;
  mrp: string;
  sellingRate: string;
  discountPct: string;
  taxRate: string;
};

function blankLine(): DraftLine {
  return {
    id: generateId(),
    medicine: null,
    batchNo: "",
    expiry: currentMonthKey(),
    packs: "1",
    freePacks: "0",
    purchaseRate: "",
    mrp: "",
    sellingRate: "",
    discountPct: "0",
    taxRate: "12",
  };
}

function toPurchaseLine(draft: DraftLine): PurchaseLine | null {
  if (!draft.medicine) return null;
  const packSize = Math.max(1, draft.medicine.packSize);
  return {
    id: draft.id,
    medicineId: draft.medicine.id,
    batchNo: draft.batchNo.trim(),
    expiry: draft.expiry,
    quantity: Math.max(0, Math.round((Number(draft.packs) || 0) * packSize)),
    freeQuantity: Math.max(0, Math.round((Number(draft.freePacks) || 0) * packSize)),
    purchaseRate: Number(draft.purchaseRate) || 0,
    mrp: Number(draft.mrp) || 0,
    sellingRate: Number(draft.sellingRate) || Number(draft.mrp) || 0,
    discountPct: Math.min(100, Math.max(0, Number(draft.discountPct) || 0)),
    taxRate: Number(draft.taxRate) || 0,
  };
}

export function PurchaseForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { business, savePurchase } = usePharmacy();
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [date, setDate] = useState(todayKey());
  const [drafts, setDrafts] = useState<DraftLine[]>([blankLine()]);
  const [discount, setDiscount] = useState("");
  const [paid, setPaid] = useState("");
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const currency = business?.currency ?? "INR";

  const lines = useMemo(
    () => drafts.map(toPurchaseLine).filter((line): line is PurchaseLine => line !== null),
    [drafts]
  );
  const totals = purchaseTotals(lines, Number(discount) || 0);

  const update = (id: string, updates: Partial<DraftLine>) =>
    setDrafts((previous) =>
      previous.map((draft) => (draft.id === id ? { ...draft, ...updates } : draft))
    );

  const reset = () => {
    setSupplierId(null);
    setInvoiceNo("");
    setDate(todayKey());
    setDrafts([blankLine()]);
    setDiscount("");
    setPaid("");
    setError("");
  };

  const submit = async () => {
    if (!supplierId) {
      setError("Pick the supplier this invoice came from.");
      return;
    }
    if (!invoiceNo.trim()) {
      setError("The distributor's invoice number is what ties this back to their paper.");
      return;
    }
    if (lines.length === 0) {
      setError("Add at least one line.");
      return;
    }
    const missingBatch = drafts.find(
      (draft) => draft.medicine && !draft.batchNo.trim()
    );
    if (missingBatch) {
      setError(
        `${missingBatch.medicine?.name} has no batch number. Without one there is nothing to track an expiry against.`
      );
      return;
    }

    setSaving(true);
    setError("");
    try {
      await savePurchase({
        invoiceNo: invoiceNo.trim(),
        supplierId,
        date,
        lines,
        discount: Number(discount) || 0,
        paid: paid === "" ? totals.total : Number(paid) || 0,
      });
      reset();
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save this purchase.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Enter a distributor invoice" wide>
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Supplier" required>
            <SupplierPicker value={supplierId} onChange={setSupplierId} />
          </Field>
          <Field label="Invoice no." required>
            <input
              className={inputClass}
              value={invoiceNo}
              onChange={(event) => setInvoiceNo(event.target.value)}
              placeholder="As printed on their bill"
            />
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

        <div className="grid gap-3">
          {drafts.map((draft, index) => {
            const line = toPurchaseLine(draft);
            const packSize = draft.medicine?.packSize ?? 1;
            const perPack = (value: string) =>
              draft.medicine && Number(value)
                ? `${formatMoney((Number(value) || 0) * packSize, currency)} / pack`
                : "";
            return (
              <div
                key={draft.id}
                className="rounded-xl border border-muted-line/30 bg-white p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setPickerFor(draft.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    {draft.medicine ? (
                      <>
                        <p className="truncate text-sm font-bold text-ink">
                          {draft.medicine.name}
                        </p>
                        <p className="text-xs text-muted">
                          {[draft.medicine.composition, draft.medicine.packLabel]
                            .filter(Boolean)
                            .join(" · ")}{" "}
                          · {packSize} units per pack
                        </p>
                      </>
                    ) : (
                      <span className="text-sm font-semibold text-indigo">
                        Line {index + 1} — pick a medicine
                      </span>
                    )}
                  </button>
                  {drafts.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setDrafts((previous) => previous.filter((row) => row.id !== draft.id))
                      }
                      className="rounded p-1 text-muted hover:text-red-600"
                      aria-label="Remove line"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-4">
                  <Field label="Batch no.">
                    <input
                      className={inputClass}
                      value={draft.batchNo}
                      onChange={(event) => update(draft.id, { batchNo: event.target.value })}
                    />
                  </Field>
                  <Field label="Expiry" hint="Month">
                    <input
                      type="month"
                      className={inputClass}
                      value={draft.expiry}
                      onChange={(event) => update(draft.id, { expiry: event.target.value })}
                    />
                  </Field>
                  <Field label="Packs" hint={`= ${line?.quantity ?? 0} units`}>
                    <input
                      className={inputClass}
                      value={draft.packs}
                      inputMode="decimal"
                      onChange={(event) => update(draft.id, { packs: event.target.value })}
                    />
                  </Field>
                  <Field label="Free packs" hint="Scheme goods">
                    <input
                      className={inputClass}
                      value={draft.freePacks}
                      inputMode="decimal"
                      onChange={(event) => update(draft.id, { freePacks: event.target.value })}
                    />
                  </Field>
                </div>

                <div className="mt-2 grid gap-2 sm:grid-cols-5">
                  <Field label="Rate / unit" hint={perPack(draft.purchaseRate)}>
                    <input
                      className={inputClass}
                      value={draft.purchaseRate}
                      inputMode="decimal"
                      onChange={(event) => update(draft.id, { purchaseRate: event.target.value })}
                    />
                  </Field>
                  <Field label="MRP / unit" hint={perPack(draft.mrp)}>
                    <input
                      className={inputClass}
                      value={draft.mrp}
                      inputMode="decimal"
                      onChange={(event) =>
                        update(draft.id, {
                          mrp: event.target.value,
                          // Most shops sell at MRP; typing it once is enough.
                          sellingRate: draft.sellingRate || event.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field label="Selling / unit">
                    <input
                      className={inputClass}
                      value={draft.sellingRate}
                      inputMode="decimal"
                      onChange={(event) => update(draft.id, { sellingRate: event.target.value })}
                    />
                  </Field>
                  <Field label="Disc %">
                    <input
                      className={inputClass}
                      value={draft.discountPct}
                      inputMode="decimal"
                      onChange={(event) => update(draft.id, { discountPct: event.target.value })}
                    />
                  </Field>
                  <Field label="GST %">
                    <select
                      className={inputClass}
                      value={draft.taxRate}
                      onChange={(event) => update(draft.id, { taxRate: event.target.value })}
                    >
                      {TAX_RATES.map((rate) => (
                        <option key={rate} value={rate}>
                          {rate}%
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                {line && line.freeQuantity > 0 && (
                  <p className="mt-2 text-xs text-muted">
                    {line.quantity} paid + {line.freeQuantity} free ={" "}
                    <strong>{line.quantity + line.freeQuantity} units</strong> on the shelf, at a
                    blended cost of {formatMoney(effectiveRate(line), currency)} each.
                  </p>
                )}
              </div>
            );
          })}

          <button
            type="button"
            onClick={() => setDrafts((previous) => [...previous, blankLine()])}
            className={secondaryBtnClass}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add another line
          </button>
        </div>

        {/*
          The running total exists so the operator can check it against the
          paper invoice before saving. A mismatch here is nearly always a typo
          in a rate, and it is far cheaper to find now than in next month's
          margin report.
        */}
        <div className="grid gap-2 rounded-xl border border-muted-line/30 bg-cream-paper p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Goods value</span>
            <span className="font-semibold">{formatMoney(totals.subtotal, currency)}</span>
          </div>
          <label className="flex items-center justify-between gap-2">
            <span className="text-muted">Invoice discount</span>
            <input
              className="h-8 w-28 rounded-lg border border-muted-line/40 px-2 text-right"
              value={discount}
              inputMode="decimal"
              placeholder="0"
              onChange={(event) => setDiscount(event.target.value)}
            />
          </label>
          <div className="flex justify-between">
            <span className="text-muted">GST</span>
            <span className="font-semibold">{formatMoney(totals.taxTotal, currency)}</span>
          </div>
          <div className="flex justify-between border-t border-muted-line/30 pt-2">
            <span className="font-bold text-ink">Invoice total</span>
            <span className="text-lg font-bold text-ink">
              {formatMoney(totals.total, currency)}
            </span>
          </div>
          <label className="flex items-center justify-between gap-2">
            <span className="text-muted">Paid now</span>
            <input
              className="h-8 w-28 rounded-lg border border-muted-line/40 px-2 text-right"
              value={paid}
              inputMode="decimal"
              placeholder={String(totals.total)}
              onChange={(event) => setPaid(event.target.value)}
            />
          </label>
          <p className="text-xs text-muted">{totals.units} units will be added to stock.</p>
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
            {saving ? "Saving…" : "Save purchase and add stock"}
          </button>
          <button type="button" onClick={onClose} className={secondaryBtnClass}>
            Cancel
          </button>
        </div>
      </div>

      {pickerFor && (
        <MedicinePicker
          open
          onPick={(medicine) => {
            update(pickerFor, {
              medicine,
              taxRate: String(medicine.taxRate),
            });
          }}
          onClose={() => setPickerFor(null)}
        />
      )}
    </Modal>
  );
}
