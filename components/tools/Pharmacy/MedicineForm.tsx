"use client";

import { useEffect, useState } from "react";
import { usePharmacy } from "@/lib/pharmacy/store";
import {
  FORM_LABELS,
  MEDICINE_FORMS,
  SCHEDULE_CLASSES,
  SCHEDULE_LABELS,
  TAX_RATES,
  type Medicine,
  type MedicineForm as Form,
  type ScheduleClass,
} from "@/lib/pharmacy/types";
import { Field, Modal, inputClass, primaryBtnClass, secondaryBtnClass } from "./ui";

const BLANK = {
  name: "",
  composition: "",
  manufacturer: "",
  strength: "",
  form: "tablet" as Form,
  packSize: "10",
  packLabel: "",
  hsnCode: "",
  taxRate: "12",
  schedule: "" as ScheduleClass,
  rack: "",
  barcode: "",
  lowStockAt: "0",
  active: true,
};

/**
 * Add or edit a medicine.
 *
 * Only the brand name is mandatory. A shop entering a medicine mid-sale should
 * not be held up for an HSN code, and everything here is editable later — but
 * composition and schedule are called out, because substitute search is useless
 * without the first and the prescription rule is unenforceable without the
 * second.
 */
export function MedicineFormModal({
  open,
  medicine,
  onClose,
  onSaved,
}: {
  open: boolean;
  medicine: Medicine | null;
  onClose: () => void;
  onSaved?: (saved: Medicine) => void;
}) {
  const { saveMedicine } = usePharmacy();
  const [values, setValues] = useState(BLANK);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError("");
    setValues(
      medicine
        ? {
            name: medicine.name,
            composition: medicine.composition,
            manufacturer: medicine.manufacturer,
            strength: medicine.strength,
            form: medicine.form,
            packSize: String(medicine.packSize),
            packLabel: medicine.packLabel,
            hsnCode: medicine.hsnCode,
            taxRate: String(medicine.taxRate),
            schedule: medicine.schedule,
            rack: medicine.rack,
            barcode: medicine.barcode,
            lowStockAt: String(medicine.lowStockAt),
            active: medicine.active,
          }
        : BLANK
    );
  }, [medicine, open]);

  const set = <K extends keyof typeof BLANK>(key: K, value: (typeof BLANK)[K]) =>
    setValues((previous) => ({ ...previous, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!values.name.trim()) {
      setError("A brand name is needed — it is what the counter searches for.");
      return;
    }
    setSaving(true);
    try {
      const packSize = Math.max(1, Number(values.packSize) || 1);
      const saved = await saveMedicine(
        {
          name: values.name.trim(),
          composition: values.composition.trim(),
          manufacturer: values.manufacturer.trim(),
          strength: values.strength.trim(),
          form: values.form,
          packSize,
          packLabel:
            values.packLabel.trim() ||
            `${FORM_LABELS[values.form].toLowerCase()} of ${packSize}`,
          hsnCode: values.hsnCode.trim(),
          taxRate: Number(values.taxRate) || 0,
          schedule: values.schedule,
          rack: values.rack.trim(),
          barcode: values.barcode.trim(),
          lowStockAt: Math.max(0, Number(values.lowStockAt) || 0),
          active: values.active,
        },
        medicine?.id
      );
      onSaved?.(saved);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save this medicine.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={medicine ? "Edit medicine" : "Add a medicine"} wide>
      <form onSubmit={submit} className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Brand name" required>
            <input
              className={inputClass}
              value={values.name}
              onChange={(event) => set("name", event.target.value)}
              autoFocus
            />
          </Field>
          <Field label="Manufacturer">
            <input
              className={inputClass}
              value={values.manufacturer}
              onChange={(event) => set("manufacturer", event.target.value)}
            />
          </Field>
        </div>

        <Field
          label="Composition (salt)"
          hint="What substitute search matches on — “Paracetamol 500mg”"
        >
          <input
            className={inputClass}
            value={values.composition}
            onChange={(event) => set("composition", event.target.value)}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Strength">
            <input
              className={inputClass}
              value={values.strength}
              onChange={(event) => set("strength", event.target.value)}
              placeholder="500 mg"
            />
          </Field>
          <Field label="Form">
            <select
              className={inputClass}
              value={values.form}
              onChange={(event) => set("form", event.target.value as Form)}
            >
              {MEDICINE_FORMS.map((option) => (
                <option key={option} value={option}>
                  {FORM_LABELS[option]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Units per pack" hint="Stock is counted in units">
            <input
              className={inputClass}
              value={values.packSize}
              inputMode="numeric"
              onChange={(event) => set("packSize", event.target.value)}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Pack label" hint="Left blank, one is written for you">
            <input
              className={inputClass}
              value={values.packLabel}
              onChange={(event) => set("packLabel", event.target.value)}
              placeholder="strip of 10"
            />
          </Field>
          <Field label="Schedule" hint="Decides whether a prescription is required">
            <select
              className={inputClass}
              value={values.schedule}
              onChange={(event) => set("schedule", event.target.value as ScheduleClass)}
            >
              {SCHEDULE_CLASSES.map((option) => (
                <option key={option} value={option}>
                  {SCHEDULE_LABELS[option]}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="HSN code">
            <input
              className={inputClass}
              value={values.hsnCode}
              onChange={(event) => set("hsnCode", event.target.value)}
            />
          </Field>
          <Field label="GST %">
            <select
              className={inputClass}
              value={values.taxRate}
              onChange={(event) => set("taxRate", event.target.value)}
            >
              {TAX_RATES.map((rate) => (
                <option key={rate} value={rate}>
                  {rate}%
                </option>
              ))}
            </select>
          </Field>
          <Field label="Rack" hint="Where it physically sits">
            <input
              className={inputClass}
              value={values.rack}
              onChange={(event) => set("rack", event.target.value)}
              placeholder="A3"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Barcode">
            <input
              className={inputClass}
              value={values.barcode}
              onChange={(event) => set("barcode", event.target.value)}
            />
          </Field>
          <Field label="Low stock at" hint="Units, across every batch">
            <input
              className={inputClass}
              value={values.lowStockAt}
              inputMode="numeric"
              onChange={(event) => set("lowStockAt", event.target.value)}
            />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={values.active}
            onChange={(event) => set("active", event.target.checked)}
            className="h-4 w-4 rounded border-muted-line/50"
          />
          Stocked — uncheck to hide it from counter search without deleting it
        </label>

        {error && (
          <p className="text-sm font-semibold text-red-600" role="alert">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="submit" className={`${primaryBtnClass} sm:flex-1`} disabled={saving}>
            {saving ? "Saving…" : medicine ? "Save changes" : "Add medicine"}
          </button>
          <button type="button" onClick={onClose} className={secondaryBtnClass}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
