"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { usePharmacy } from "@/lib/pharmacy/store";
import { Field, Modal, inputClass, primaryBtnClass, secondaryBtnClass } from "./ui";

/** Pick a distributor, or add one without leaving the invoice being entered. */
export function SupplierPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const { suppliers, saveSupplier } = usePharmacy();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [gstin, setGstin] = useState("");
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const created = await saveSupplier({
        name: name.trim(),
        phone: phone.trim(),
        gstin: gstin.trim(),
        address: "",
      });
      onChange(created.id);
      setName("");
      setPhone("");
      setGstin("");
      setAdding(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="flex gap-2">
        <select
          className={inputClass}
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value || null)}
        >
          <option value="">Choose…</option>
          {suppliers.map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="shrink-0 rounded-lg border border-muted-line/40 px-2 text-muted transition hover:border-indigo/40 hover:text-indigo"
          aria-label="Add a supplier"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add a supplier">
        <div className="grid gap-4">
          <Field label="Name" required>
            <input
              className={inputClass}
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone">
              <input
                className={inputClass}
                value={phone}
                inputMode="tel"
                onChange={(event) => setPhone(event.target.value)}
              />
            </Field>
            <Field label="GSTIN">
              <input
                className={inputClass}
                value={gstin}
                onChange={(event) => setGstin(event.target.value.toUpperCase())}
              />
            </Field>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => void create()}
              className={`${primaryBtnClass} sm:flex-1`}
              disabled={!name.trim() || saving}
            >
              {saving ? "Adding…" : "Add supplier"}
            </button>
            <button type="button" onClick={() => setAdding(false)} className={secondaryBtnClass}>
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
