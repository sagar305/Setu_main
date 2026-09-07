"use client";

// The customer register.
//
// Thinner than the POS's, on purpose: a repair shop's relationship with a
// customer is a list of devices, not a ledger. What an owner wants from this
// screen is "has this person been here before, and what did we do for them" —
// so the history is the screen, and the contact fields are behind a form.

import { useMemo, useState } from "react";
import { Pencil, Phone, Plus, Trash2, Users } from "lucide-react";
import { useRepair } from "@/lib/repair/store";
import {
  dateKeyOf,
  deviceLabel,
  formatDate,
  whatsAppNumber,
  type Customer,
} from "@/lib/repair/types";
import {
  ConfirmDialog,
  EmptyState,
  Field,
  Modal,
  SearchInput,
  StatusChip,
  inputClass,
  primaryBtnClass,
  secondaryBtnClass,
} from "./ui";

const BLANK = {
  name: "",
  phone: "",
  altPhone: "",
  address: "",
  companyName: "",
  gstin: "",
};

export function CustomersScreen({ onOpenJob }: { onOpenJob: (id: string) => void }) {
  const { customers, jobs, saveCustomer, deleteCustomer } = useRepair();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Customer | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Customer | null>(null);
  const [error, setError] = useState("");

  const jobsByCustomer = useMemo(() => {
    const map = new Map<string, typeof jobs>();
    for (const job of jobs) {
      map.set(job.customerId, [...(map.get(job.customerId) ?? []), job]);
    }
    for (const list of map.values()) {
      list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    return map;
  }, [jobs]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const list = needle
      ? customers.filter(
          (customer) =>
            customer.name.toLowerCase().includes(needle) ||
            customer.phone.toLowerCase().includes(needle) ||
            customer.companyName.toLowerCase().includes(needle)
        )
      : customers;
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [customers, search]);

  const openEditor = (customer: Customer | null) => {
    setError("");
    setEditing(customer);
    setCreating(customer === null);
    setForm(
      customer
        ? {
            name: customer.name,
            phone: customer.phone,
            altPhone: customer.altPhone,
            address: customer.address,
            companyName: customer.companyName,
            gstin: customer.gstin,
          }
        : BLANK
    );
  };

  const closeEditor = () => {
    setEditing(null);
    setCreating(false);
  };

  const submit = async () => {
    if (!form.name.trim()) {
      setError("A customer needs a name.");
      return;
    }
    try {
      await saveCustomer(form, editing?.id);
      closeEditor();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save.");
    }
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[200px] flex-1">
          <SearchInput value={search} onChange={setSearch} placeholder="Name, phone or company" />
        </div>
        <button type="button" onClick={() => openEditor(null)} className={primaryBtnClass}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          New customer
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title={customers.length === 0 ? "No customers yet" : "Nobody matches"}
          message={
            customers.length === 0
              ? "Customers are added as you take devices in — you rarely need this screen first."
              : "No customer matches that search."
          }
        />
      ) : (
        <ul className="grid gap-2">
          {filtered.map((customer) => {
            const theirs = jobsByCustomer.get(customer.id) ?? [];
            const open = expanded === customer.id;
            return (
              <li
                key={customer.id}
                className="rounded-2xl border border-muted-line/30 bg-white p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setExpanded(open ? null : customer.id)}
                    className="min-w-0 text-left"
                    aria-expanded={open}
                  >
                    <p className="truncate text-sm font-bold text-ink">{customer.name}</p>
                    <p className="text-xs text-muted">
                      {customer.phone || "No number"}
                      {customer.companyName ? ` · ${customer.companyName}` : ""}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-indigo">
                      {theirs.length} {theirs.length === 1 ? "job" : "jobs"}
                      {open ? " — hide" : " — show"}
                    </p>
                  </button>
                  <div className="flex shrink-0 items-center gap-1">
                    {customer.phone && (
                      <>
                        <a
                          href={`tel:${customer.phone}`}
                          className="rounded-lg p-2 text-muted transition hover:text-indigo"
                          aria-label={`Call ${customer.name}`}
                        >
                          <Phone className="h-4 w-4" />
                        </a>
                        <a
                          href={`https://wa.me/${whatsAppNumber(customer.phone)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg p-2 text-muted transition hover:text-indigo"
                          aria-label={`WhatsApp ${customer.name}`}
                        >
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                            <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 20Z" />
                          </svg>
                        </a>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => openEditor(customer)}
                      className="rounded-lg p-2 text-muted transition hover:text-indigo"
                      aria-label={`Edit ${customer.name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirm(customer)}
                      className="rounded-lg p-2 text-muted transition hover:text-red-600"
                      aria-label={`Delete ${customer.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {open && (
                  <ul className="mt-3 grid gap-2 border-t border-muted-line/20 pt-3">
                    {theirs.length === 0 && (
                      <li className="text-sm text-muted">No jobs for this customer yet.</li>
                    )}
                    {theirs.map((job) => (
                      <li key={job.id}>
                        <button
                          type="button"
                          onClick={() => onOpenJob(job.id)}
                          className="flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border border-muted-line/30 p-2 text-left transition hover:border-indigo/50"
                        >
                          <span className="min-w-0">
                            <span className="text-sm font-semibold text-ink">{job.jobNo}</span>
                            <span className="ml-2 text-sm text-muted">{deviceLabel(job)}</span>
                          </span>
                          <span className="flex items-center gap-2">
                            <span className="text-xs text-muted">
                              {formatDate(dateKeyOf(job.createdAt))}
                            </span>
                            <StatusChip status={job.status} />
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        open={editing !== null || creating}
        onClose={closeEditor}
        title={editing ? `Edit ${editing.name}` : "New customer"}
      >
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" required>
              <input
                className={inputClass}
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                autoFocus
              />
            </Field>
            <Field label="Phone">
              <input
                className={inputClass}
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
                inputMode="tel"
              />
            </Field>
            <Field label="Alternate phone">
              <input
                className={inputClass}
                value={form.altPhone}
                onChange={(event) => setForm({ ...form, altPhone: event.target.value })}
                inputMode="tel"
              />
            </Field>
            <Field label="Company" hint="Blank for walk-ins.">
              <input
                className={inputClass}
                value={form.companyName}
                onChange={(event) => setForm({ ...form, companyName: event.target.value })}
              />
            </Field>
            <Field label="GSTIN">
              <input
                className={inputClass}
                value={form.gstin}
                onChange={(event) => setForm({ ...form, gstin: event.target.value.toUpperCase() })}
              />
            </Field>
            <Field label="Address">
              <input
                className={inputClass}
                value={form.address}
                onChange={(event) => setForm({ ...form, address: event.target.value })}
              />
            </Field>
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
            >
              Save
            </button>
            <button type="button" onClick={closeEditor} className={secondaryBtnClass}>
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirm !== null}
        title={`Delete ${confirm?.name ?? ""}?`}
        message="Customers with jobs on the board cannot be deleted — the jobs would have nobody to hand the device back to."
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          if (!confirm) return;
          try {
            await deleteCustomer(confirm.id);
            setConfirm(null);
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Could not delete.");
            setConfirm(null);
          }
        }}
      />
    </div>
  );
}
