"use client";

import { useMemo, useState } from "react";
import { Plus, User, X } from "lucide-react";
import { usePharmacy } from "@/lib/pharmacy/store";
import type { Customer } from "@/lib/pharmacy/types";
import { Field, Modal, inputClass, primaryBtnClass, secondaryBtnClass } from "./ui";

/**
 * Attach a customer to a bill.
 *
 * Optional, always — most counter sales are to someone who will never come
 * back, and forcing a name on every bill is the fastest way to have every bill
 * say "cash". A customer is only worth capturing when there is a reason: credit,
 * a refill reminder, or a regular the shop already knows.
 */
export function CustomerPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const { customers, saveCustomer } = usePharmacy();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const selected = customers.find((customer) => customer.id === value) ?? null;

  const matches = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return customers.slice(0, 20);
    return customers
      .filter(
        (customer) =>
          customer.name.toLowerCase().includes(text) || customer.phone.includes(text)
      )
      .slice(0, 20);
  }, [customers, query]);

  const pick = (customer: Customer | null) => {
    onChange(customer?.id ?? null);
    setOpen(false);
    setQuery("");
  };

  const createAndPick = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const created = await saveCustomer({
        name: name.trim(),
        phone: phone.trim(),
        email: "",
        address: "",
        notes: "",
      });
      setName("");
      setPhone("");
      pick(created);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {selected ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-indigo/30 bg-indigo/5 px-3 py-2">
          <span className="truncate text-sm font-semibold text-ink">
            {selected.name}
            {selected.phone && <span className="ml-2 font-normal text-muted">{selected.phone}</span>}
          </span>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="rounded p-1 text-muted hover:text-red-600"
            aria-label="Remove customer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-muted-line/50 px-3 py-2 text-sm font-semibold text-muted transition hover:border-indigo/50 hover:text-indigo"
        >
          <User className="h-4 w-4" aria-hidden="true" />
          Attach a customer (optional)
        </button>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Attach a customer">
        <div className="grid gap-4">
          <Field label="Search">
            <input
              className={inputClass}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name or phone"
              autoFocus
            />
          </Field>

          <div className="max-h-56 overflow-y-auto rounded-lg border border-muted-line/30">
            {matches.length === 0 ? (
              <p className="p-3 text-sm text-muted">No customer matches that.</p>
            ) : (
              matches.map((customer) => (
                <button
                  key={customer.id}
                  type="button"
                  onClick={() => pick(customer)}
                  className="flex w-full items-center justify-between gap-3 border-b border-muted-line/20 px-3 py-2 text-left last:border-0 hover:bg-indigo/5"
                >
                  <span className="text-sm font-semibold text-ink">{customer.name}</span>
                  <span className="text-xs text-muted">{customer.phone}</span>
                </button>
              ))
            )}
          </div>

          <div className="rounded-lg border border-muted-line/30 p-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
              Or add a new one
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                className={inputClass}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Name"
              />
              <input
                className={inputClass}
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Phone"
                inputMode="tel"
              />
            </div>
            <button
              type="button"
              onClick={() => void createAndPick()}
              className={`${primaryBtnClass} mt-3 w-full`}
              disabled={!name.trim() || saving}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {saving ? "Adding…" : "Add and attach"}
            </button>
          </div>

          <button type="button" onClick={() => setOpen(false)} className={secondaryBtnClass}>
            Cancel
          </button>
        </div>
      </Modal>
    </>
  );
}
