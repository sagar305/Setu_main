"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
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

/**
 * Search-or-create, for purchase entry.
 *
 * Half the lines on a distributor's invoice are things the shop has never
 * stocked before, and stopping to fill in a full medicine form for each one
 * would make invoice entry unbearable. So this creates with the seven fields
 * that actually matter for billing and returns the medicine straight into the
 * line; racks, barcodes and HSN codes get filled in later, from the Medicines
 * screen, when there is time.
 */
export function MedicinePicker({
  open,
  onPick,
  onClose,
  initialQuery = "",
}: {
  open: boolean;
  onPick: (medicine: Medicine) => void;
  onClose: () => void;
  initialQuery?: string;
}) {
  const { medicines, saveMedicine } = usePharmacy();
  const [query, setQuery] = useState(initialQuery);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [composition, setComposition] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [form, setForm] = useState<Form>("tablet");
  const [packSize, setPackSize] = useState("10");
  const [taxRate, setTaxRate] = useState("12");
  const [schedule, setSchedule] = useState<ScheduleClass>("");

  const matches = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return medicines.slice(0, 25);
    return medicines
      .filter(
        (medicine) =>
          medicine.name.toLowerCase().includes(text) ||
          medicine.composition.toLowerCase().includes(text) ||
          medicine.manufacturer.toLowerCase().includes(text)
      )
      .slice(0, 25);
  }, [medicines, query]);

  const startCreate = () => {
    setName(query.trim());
    setComposition("");
    setManufacturer("");
    setForm("tablet");
    setPackSize("10");
    setTaxRate("12");
    setSchedule("");
    setCreating(true);
  };

  const create = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const size = Math.max(1, Number(packSize) || 1);
      const created = await saveMedicine({
        name: name.trim(),
        composition: composition.trim(),
        manufacturer: manufacturer.trim(),
        strength: "",
        form,
        packSize: size,
        packLabel: `${FORM_LABELS[form].toLowerCase()} of ${size}`,
        hsnCode: "",
        taxRate: Number(taxRate) || 0,
        schedule,
        rack: "",
        barcode: "",
        lowStockAt: 0,
        active: true,
      });
      setCreating(false);
      onPick(created);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Pick a medicine" wide>
      {creating ? (
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Brand name" required>
              <input
                className={inputClass}
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoFocus
              />
            </Field>
            <Field label="Manufacturer">
              <input
                className={inputClass}
                value={manufacturer}
                onChange={(event) => setManufacturer(event.target.value)}
              />
            </Field>
          </div>
          <Field label="Composition (salt)">
            <input
              className={inputClass}
              value={composition}
              onChange={(event) => setComposition(event.target.value)}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-4">
            <Field label="Form">
              <select
                className={inputClass}
                value={form}
                onChange={(event) => setForm(event.target.value as Form)}
              >
                {MEDICINE_FORMS.map((option) => (
                  <option key={option} value={option}>
                    {FORM_LABELS[option]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Units per pack">
              <input
                className={inputClass}
                value={packSize}
                inputMode="numeric"
                onChange={(event) => setPackSize(event.target.value)}
              />
            </Field>
            <Field label="GST %">
              <select
                className={inputClass}
                value={taxRate}
                onChange={(event) => setTaxRate(event.target.value)}
              >
                {TAX_RATES.map((rate) => (
                  <option key={rate} value={rate}>
                    {rate}%
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Schedule">
              <select
                className={inputClass}
                value={schedule}
                onChange={(event) => setSchedule(event.target.value as ScheduleClass)}
              >
                {SCHEDULE_CLASSES.map((option) => (
                  <option key={option} value={option}>
                    {SCHEDULE_LABELS[option]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => void create()}
              className={`${primaryBtnClass} sm:flex-1`}
              disabled={!name.trim() || saving}
            >
              {saving ? "Adding…" : "Add and use"}
            </button>
            <button type="button" onClick={() => setCreating(false)} className={secondaryBtnClass}>
              Back to search
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          <input
            className={inputClass}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Brand, salt or manufacturer"
            autoFocus
          />
          <div className="max-h-72 overflow-y-auto rounded-lg border border-muted-line/30">
            {matches.length === 0 ? (
              <p className="p-3 text-sm text-muted">Nothing matches that yet.</p>
            ) : (
              matches.map((medicine) => (
                <button
                  key={medicine.id}
                  type="button"
                  onClick={() => {
                    onPick(medicine);
                    onClose();
                  }}
                  className="flex w-full items-center justify-between gap-3 border-b border-muted-line/20 px-3 py-2 text-left last:border-0 hover:bg-indigo/5"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">
                      {medicine.name}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {[medicine.composition, medicine.manufacturer, medicine.packLabel]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
          <button type="button" onClick={startCreate} className={secondaryBtnClass}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Not on the list — add “{query.trim() || "a new medicine"}”
          </button>
        </div>
      )}
    </Modal>
  );
}
