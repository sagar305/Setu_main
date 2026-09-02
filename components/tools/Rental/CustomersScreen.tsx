"use client";

// The customer register.
//
// Two things a hire business needs from it that a shop does not: an ID proof
// on file, because stock leaves the premises, and a trade flag, because half
// the revenue in this trade comes from a handful of caterers and decorators who
// are back every fortnight.

import { useMemo, useState } from "react";
import { IdCard, Pencil, Phone, Plus, Trash2, Users } from "lucide-react";
import { formatMoney } from "@/lib/pos/types";
import { useRental } from "@/lib/rental/store";
import { bookingTotals } from "@/lib/rental/calc";
import { formatDateWindow, whatsAppNumber, type Customer } from "@/lib/rental/types";
import {
  ConfirmDialog,
  EmptyState,
  Field,
  Modal,
  Pill,
  SearchInput,
  StatusChip,
  chipBtnClass,
  inputClass,
  primaryBtnClass,
  secondaryBtnClass,
} from "./ui";

export function CustomersScreen() {
  const { bookings, business, customers, deleteCustomer, saveCustomer, settings } = useRental();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Customer | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [detailFor, setDetailFor] = useState<Customer | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Customer | null>(null);
  const [error, setError] = useState("");

  const currency = business?.currency ?? "INR";

  const stats = useMemo(() => {
    const map = new Map<string, { count: number; revenue: number }>();
    for (const booking of bookings) {
      if (booking.status === "enquiry" || booking.status === "cancelled") continue;
      const row = map.get(booking.customerId) ?? { count: 0, revenue: 0 };
      row.count += 1;
      row.revenue += bookingTotals(booking, settings).total;
      map.set(booking.customerId, row);
    }
    return map;
  }, [bookings, settings]);

  const visible = useMemo(() => {
    const search = query.trim().toLowerCase();
    return customers
      .filter(
        (customer) =>
          !search ||
          customer.name.toLowerCase().includes(search) ||
          customer.phone.includes(search) ||
          customer.altPhone.includes(search)
      )
      .sort(
        (a, b) =>
          (stats.get(b.id)?.revenue ?? 0) - (stats.get(a.id)?.revenue ?? 0) ||
          a.name.localeCompare(b.name)
      );
  }, [customers, query, stats]);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[200px] flex-1">
          <SearchInput value={query} onChange={setQuery} placeholder="Name or phone" />
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className={primaryBtnClass}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add customer
        </button>
      </div>

      {error ? (
        <p className="text-sm font-semibold text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {visible.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="No customers yet"
          message="Customers are added as you take bookings, or you can add them here first."
        />
      ) : (
        <div className="grid gap-2">
          {visible.map((customer) => {
            const row = stats.get(customer.id);
            return (
              <article
                key={customer.id}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-muted-line/30 bg-white p-3"
              >
                <button
                  type="button"
                  onClick={() => setDetailFor(customer)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-ink">{customer.name}</span>
                    {customer.isTrade ? <Pill tone="good">Trade</Pill> : null}
                    {customer.idProofNumber ? (
                      <span className="inline-flex items-center gap-1 text-xs text-muted">
                        <IdCard className="h-3.5 w-3.5" aria-hidden="true" />
                        {customer.idProofKind || "ID"} on file
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">
                    {[customer.phone, customer.address].filter(Boolean).join(" · ")}
                  </span>
                </button>

                <div className="text-right">
                  <p className="text-sm font-bold text-ink">
                    {formatMoney(row?.revenue ?? 0, currency)}
                  </p>
                  <p className="text-xs text-muted">
                    {row?.count ?? 0} booking{(row?.count ?? 0) === 1 ? "" : "s"}
                  </p>
                </div>

                <div className="flex gap-1">
                  {customer.phone ? (
                    <a
                      href={`tel:${customer.phone}`}
                      className={chipBtnClass}
                      aria-label={`Call ${customer.name}`}
                    >
                      <Phone className="h-4 w-4" aria-hidden="true" />
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(customer);
                      setFormOpen(true);
                    }}
                    className={chipBtnClass}
                    aria-label={`Edit ${customer.name}`}
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(customer)}
                    className={chipBtnClass}
                    aria-label={`Delete ${customer.name}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <CustomerForm
        open={formOpen}
        customer={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSave={saveCustomer}
      />

      {detailFor ? (
        <Modal open onClose={() => setDetailFor(null)} title={detailFor.name} wide>
          <div className="space-y-3">
            <p className="text-sm text-muted">
              {[detailFor.phone, detailFor.altPhone].filter(Boolean).join(" · ")}
            </p>
            {detailFor.address ? <p className="text-sm text-muted">{detailFor.address}</p> : null}
            {detailFor.idProofNumber ? (
              <p className="text-sm text-muted">
                {detailFor.idProofKind}: {detailFor.idProofNumber}
              </p>
            ) : null}
            {detailFor.idProofPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={detailFor.idProofPhoto}
                alt="ID proof"
                className="max-h-48 rounded-lg border border-muted-line/30 object-contain"
              />
            ) : null}
            {detailFor.notes ? (
              <p className="whitespace-pre-wrap text-sm text-ink">{detailFor.notes}</p>
            ) : null}

            <h4 className="pt-2 text-xs font-bold uppercase tracking-wide text-muted">
              Bookings
            </h4>
            <div className="grid gap-1.5">
              {bookings
                .filter((booking) => booking.customerId === detailFor.id)
                .sort((a, b) => b.fromDate.localeCompare(a.fromDate))
                .map((booking) => (
                  <div
                    key={booking.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-muted-line/30 px-3 py-2"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-ink">
                        {booking.bookingNo}
                      </span>
                      <span className="block text-xs text-muted">
                        {formatDateWindow(booking.fromDate, booking.toDate)}
                        {booking.eventName ? ` · ${booking.eventName}` : ""}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <StatusChip status={booking.status} />
                      <span className="text-sm font-semibold text-ink">
                        {formatMoney(booking.total, currency)}
                      </span>
                    </span>
                  </div>
                ))}
            </div>

            {detailFor.phone ? (
              <a
                href={`https://wa.me/${whatsAppNumber(detailFor.phone)}`}
                target="_blank"
                rel="noopener noreferrer"
                className={secondaryBtnClass}
              >
                Message on WhatsApp
              </a>
            ) : null}
          </div>
        </Modal>
      ) : null}

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Delete this customer?"
        message="Only possible while they have no bookings on record."
        onCancel={() => setConfirmDelete(null)}
        onConfirm={async () => {
          const target = confirmDelete;
          setConfirmDelete(null);
          if (!target) return;
          setError("");
          try {
            await deleteCustomer(target.id);
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Could not delete.");
          }
        }}
      />
    </div>
  );
}

function CustomerForm({
  open,
  customer,
  onClose,
  onSave,
}: {
  open: boolean;
  customer: Customer | null;
  onClose: () => void;
  onSave: (
    input: Omit<Customer, "id" | "createdAt" | "updatedAt">,
    id?: string
  ) => Promise<Customer>;
}) {
  const blank = {
    name: "",
    phone: "",
    altPhone: "",
    address: "",
    idProofKind: "Aadhaar",
    idProofNumber: "",
    idProofPhoto: "",
    isTrade: false,
    notes: "",
  };
  const [form, setForm] = useState(blank);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const key = `${open}-${customer?.id ?? "new"}`;
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setForm(
      customer
        ? {
            name: customer.name,
            phone: customer.phone,
            altPhone: customer.altPhone,
            address: customer.address,
            idProofKind: customer.idProofKind || "Aadhaar",
            idProofNumber: customer.idProofNumber,
            idProofPhoto: customer.idProofPhoto,
            isTrade: customer.isTrade,
            notes: customer.notes,
          }
        : blank
    );
    setError("");
  }

  const patch = (updates: Partial<typeof form>) =>
    setForm((current) => ({ ...current, ...updates }));

  return (
    <Modal open={open} onClose={onClose} title={customer ? "Edit customer" : "Add customer"}>
      <div className="space-y-3">
        <Field label="Name" required>
          <input
            className={inputClass}
            value={form.name}
            onChange={(event) => patch({ name: event.target.value })}
            autoFocus
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone">
            <input
              className={inputClass}
              inputMode="tel"
              value={form.phone}
              onChange={(event) => patch({ phone: event.target.value })}
            />
          </Field>
          <Field label="Alternate phone">
            <input
              className={inputClass}
              inputMode="tel"
              value={form.altPhone}
              onChange={(event) => patch({ altPhone: event.target.value })}
            />
          </Field>
        </div>
        <Field label="Address">
          <textarea
            className={inputClass}
            rows={2}
            value={form.address}
            onChange={(event) => patch({ address: event.target.value })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="ID proof">
            <select
              className={inputClass}
              value={form.idProofKind}
              onChange={(event) => patch({ idProofKind: event.target.value })}
            >
              {["Aadhaar", "PAN", "Driving licence", "Voter ID", "Passport", "Other"].map(
                (kind) => (
                  <option key={kind} value={kind}>
                    {kind}
                  </option>
                )
              )}
            </select>
          </Field>
          <Field label="Number">
            <input
              className={inputClass}
              value={form.idProofNumber}
              onChange={(event) => patch({ idProofNumber: event.target.value })}
            />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={form.isTrade}
            onChange={(event) => patch({ isTrade: event.target.checked })}
            className="h-4 w-4 accent-indigo"
          />
          Trade customer — caterer, decorator, production house
        </label>
        <Field label="Notes">
          <textarea
            className={inputClass}
            rows={2}
            value={form.notes}
            onChange={(event) => patch({ notes: event.target.value })}
          />
        </Field>

        {error ? (
          <p className="text-sm font-semibold text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex gap-2">
          <button
            type="button"
            className={`${primaryBtnClass} flex-1`}
            disabled={saving}
            onClick={async () => {
              if (!form.name.trim()) {
                setError("A name is the one thing this needs.");
                return;
              }
              setSaving(true);
              try {
                await onSave({ ...form, name: form.name.trim() }, customer?.id);
                onClose();
              } catch (caught) {
                setError(caught instanceof Error ? caught.message : "Could not save.");
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={onClose} className={secondaryBtnClass}>
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
