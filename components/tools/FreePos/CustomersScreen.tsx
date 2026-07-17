"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2, UserRound, Users } from "lucide-react";
import { usePos, type CustomerInput } from "@/lib/pos/store";
import { formatMoney, type Customer } from "@/lib/pos/types";
import type { NavigateFn } from "./nav";
import {
  ConfirmDialog,
  EmptyState,
  Field,
  Modal,
  SearchInput,
  inputClass,
  primaryBtnClass,
  secondaryBtnClass,
} from "./ui";

const emptyForm: CustomerInput = { name: "", phone: "", email: "", address: "", notes: "" };

export function CustomerFormModal({
  open,
  onClose,
  editing,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  editing: Customer | null;
  onSaved?: (customer: Customer) => void;
}) {
  const { createCustomer, updateCustomer } = usePos();
  const [form, setForm] = useState<CustomerInput>(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(
      editing
        ? {
            name: editing.name,
            phone: editing.phone,
            email: editing.email,
            address: editing.address,
            notes: editing.notes,
          }
        : emptyForm
    );
    setError("");
  }, [open, editing]);

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError("Customer name is required.");
      return;
    }
    setSaving(true);
    try {
      const input: CustomerInput = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
        notes: form.notes.trim(),
      };
      if (editing) {
        await updateCustomer(editing.id, input);
        onSaved?.({ ...editing, ...input });
      } else {
        const created = await createCustomer(input);
        onSaved?.(created);
      }
      onClose();
    } catch {
      setError("Could not save the customer. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Edit customer" : "Add customer"}>
      <div className="space-y-4">
        <Field label="Name" required>
          <input
            type="text"
            value={form.name}
            onChange={(event) => setForm((f) => ({ ...f, name: event.target.value }))}
            className={inputClass}
            autoFocus
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone">
            <input
              type="tel"
              value={form.phone}
              onChange={(event) => setForm((f) => ({ ...f, phone: event.target.value }))}
              className={inputClass}
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((f) => ({ ...f, email: event.target.value }))}
              className={inputClass}
            />
          </Field>
        </div>
        <Field label="Address">
          <textarea
            value={form.address}
            onChange={(event) => setForm((f) => ({ ...f, address: event.target.value }))}
            rows={2}
            className={inputClass}
          />
        </Field>
        <Field label="Notes">
          <textarea
            value={form.notes}
            onChange={(event) => setForm((f) => ({ ...f, notes: event.target.value }))}
            rows={2}
            placeholder="Preferences, credit notes, etc."
            className={inputClass}
          />
        </Field>
      </div>

      {error && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-5 flex justify-end gap-3">
        <button type="button" onClick={onClose} className={secondaryBtnClass}>
          Cancel
        </button>
        <button type="button" onClick={() => void handleSave()} disabled={saving} className={primaryBtnClass}>
          {saving ? "Saving…" : editing ? "Save changes" : "Add customer"}
        </button>
      </div>
    </Modal>
  );
}

function CustomerHistoryModal({
  customer,
  onClose,
  onNavigate,
}: {
  customer: Customer | null;
  onClose: () => void;
  onNavigate: NavigateFn;
}) {
  const { business, orders } = usePos();
  const currency = business?.currency ?? "INR";

  if (!customer) return null;
  const customerOrders = orders.filter((order) => order.customerId === customer.id);
  const totalSpent = customerOrders
    .filter((o) => o.status === "completed")
    .reduce((sum, o) => sum + o.total, 0);

  return (
    <Modal open onClose={onClose} title={customer.name}>
      <div className="space-y-1 text-sm text-muted">
        {customer.phone && <p>Phone: {customer.phone}</p>}
        {customer.email && <p>Email: {customer.email}</p>}
        {customer.address && <p>Address: {customer.address}</p>}
        {customer.notes && <p>Notes: {customer.notes}</p>}
      </div>

      <div className="mt-4 rounded-xl bg-cream-paper px-4 py-3 text-sm">
        <span className="font-semibold text-ink">{customerOrders.length}</span> orders ·{" "}
        <span className="font-semibold text-ink">{formatMoney(totalSpent, currency)}</span>{" "}
        lifetime value
      </div>

      <h4 className="mt-5 text-xs font-bold uppercase tracking-wide text-muted">
        Purchase history
      </h4>
      {customerOrders.length === 0 ? (
        <p className="mt-2 text-sm text-muted">No purchases yet.</p>
      ) : (
        <ul className="mt-2 divide-y divide-muted-line/15 rounded-xl border border-muted-line/30">
          {customerOrders.map((order) => (
            <li key={order.id}>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigate("orders", order.invoiceNumber);
                }}
                className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-cream-paper"
              >
                <span>
                  <span className="block text-sm font-semibold text-ink">
                    {order.invoiceNumber}
                  </span>
                  <span className="block text-xs text-muted">
                    {new Date(order.date).toLocaleString()}
                  </span>
                </span>
                <span
                  className={`text-sm font-bold ${
                    order.status === "cancelled" ? "text-red-400 line-through" : "text-ink"
                  }`}
                >
                  {formatMoney(order.total, currency)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

export function CustomersScreen({
  externalQuery,
  onNavigate,
}: {
  externalQuery: { value: string; nonce: number } | null;
  onNavigate: NavigateFn;
}) {
  const { business, customers, orders, deleteCustomer } = usePos();
  const currency = business?.currency ?? "INR";

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [historyTarget, setHistoryTarget] = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);

  useEffect(() => {
    if (externalQuery) setSearch(externalQuery.value);
  }, [externalQuery]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers
      .filter(
        (c) =>
          !q ||
          c.name.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q)
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [customers, search]);

  const customerStats = (id: string) => {
    const list = orders.filter((o) => o.customerId === id && o.status === "completed");
    return {
      count: list.length,
      total: list.reduce((sum, o) => sum + o.total, 0),
    };
  };

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <SearchInput value={search} onChange={setSearch} placeholder="Search name or phone…" />
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className={primaryBtnClass}
        >
          <Plus className="h-4 w-4" />
          Add customer
        </button>
      </div>

      {customers.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title="No customers yet"
            message="Add customers to attach them to sales and track their purchase history."
            action={
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
                className={primaryBtnClass}
              >
                <Plus className="h-4 w-4" />
                Add your first customer
              </button>
            }
          />
        </div>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((customer) => {
            const stats = customerStats(customer.id);
            return (
              <div
                key={customer.id}
                className="rounded-2xl border border-muted-line/30 bg-white p-4 shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => setHistoryTarget(customer)}
                  className="flex w-full items-start gap-3 text-left"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cream text-indigo">
                    <UserRound className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-ink">
                      {customer.name}
                    </span>
                    <span className="block text-xs text-muted">
                      {customer.phone || customer.email || "No contact info"}
                    </span>
                    <span className="mt-1 block text-xs text-muted">
                      {stats.count} orders · {formatMoney(stats.total, currency)}
                    </span>
                  </span>
                </button>
                <div className="mt-3 flex justify-end gap-1 border-t border-muted-line/15 pt-2">
                  <button
                    type="button"
                    aria-label={`Edit ${customer.name}`}
                    onClick={() => {
                      setEditing(customer);
                      setFormOpen(true);
                    }}
                    className="rounded-lg p-2 text-muted transition hover:bg-cream hover:text-indigo"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${customer.name}`}
                    onClick={() => setDeleteTarget(customer)}
                    className="rounded-lg p-2 text-muted transition hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p className="col-span-full rounded-xl border border-dashed border-muted-line/40 px-4 py-8 text-center text-sm text-muted">
              No customers match your search.
            </p>
          )}
        </div>
      )}

      <CustomerFormModal open={formOpen} onClose={() => setFormOpen(false)} editing={editing} />
      <CustomerHistoryModal
        customer={historyTarget}
        onClose={() => setHistoryTarget(null)}
        onNavigate={onNavigate}
      />
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete customer?"
        message={`"${deleteTarget?.name}" will be removed. Their past orders are kept.`}
        onConfirm={() => {
          if (deleteTarget) void deleteCustomer(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
