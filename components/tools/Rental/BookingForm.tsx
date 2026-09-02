"use client";

// New booking / edit booking.
//
// The order of the form is the order of the conversation: who is calling, when
// they want it, what they want, and only then what it costs. The availability
// figure sits inside the quantity field rather than on a separate screen,
// because the moment it matters is the moment the number is being typed — and
// it is the only thing here that can stop a save.

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Plus, Search, Trash2, UserPlus } from "lucide-react";
import { useRental } from "@/lib/rental/store";
import { availabilityFor, buildIndex, freeUnits } from "@/lib/rental/availability";
import { bookingTotals, chargeableUnitsFor, round2 } from "@/lib/rental/calc";
import {
  RATE_BASIS_SUFFIX,
  formatDate,
  generateId,
  type Booking,
  type BookingLine,
  type RentalItem,
} from "@/lib/rental/types";
import { formatMoney } from "@/lib/pos/types";
import { Field, Modal, inputClass, primaryBtnClass, secondaryBtnClass } from "./ui";

type Draft = {
  customerId: string;
  fromDate: string;
  toDate: string;
  fromTime: string;
  toTime: string;
  eventName: string;
  venue: string;
  venueContact: string;
  lines: BookingLine[];
  transportCharge: string;
  labourCharge: string;
  discount: string;
  taxRate: string;
  note: string;
  overCommitted: boolean;
};

function lineFromItem(item: RentalItem, quantity: number): BookingLine {
  return {
    id: generateId(),
    itemId: item.id,
    name: item.name,
    quantity,
    unitIds: [],
    rateBasis: item.rateBasis,
    rate: item.rate,
    chargeableUnits: 1,
    amount: 0,
    depositPerUnit: item.depositPerUnit,
    returnedQuantity: 0,
    damagedQuantity: 0,
    lostQuantity: 0,
    damageCharge: 0,
    lossCharge: 0,
    returnNote: "",
  };
}

export function BookingForm({
  open,
  onClose,
  booking,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  /** Null for a new booking. */
  booking: Booking | null;
  onSaved?: (booking: Booking) => void;
}) {
  const {
    bookings,
    business,
    categories,
    customers,
    items,
    maintenanceLogs,
    saveBooking,
    saveCustomer,
    settings,
    today,
    units,
  } = useRental();

  const [draft, setDraft] = useState<Draft>(() => emptyDraft(today, settings.defaultTaxRate));
  const [customerSearch, setCustomerSearch] = useState("");
  const [newCustomer, setNewCustomer] = useState<{ name: string; phone: string } | null>(null);
  const [itemSearch, setItemSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const currency = business?.currency ?? "INR";

  useEffect(() => {
    if (!open) return;
    setError("");
    setNewCustomer(null);
    setCustomerSearch("");
    setItemSearch("");
    setDraft(
      booking
        ? {
            customerId: booking.customerId,
            fromDate: booking.fromDate,
            toDate: booking.toDate,
            fromTime: booking.fromTime,
            toTime: booking.toTime,
            eventName: booking.eventName,
            venue: booking.venue,
            venueContact: booking.venueContact,
            lines: booking.lines.map((line) => ({ ...line })),
            transportCharge: String(booking.transportCharge || ""),
            labourCharge: String(booking.labourCharge || ""),
            discount: String(booking.discount || ""),
            taxRate: String(booking.taxRate || settings.defaultTaxRate),
            note: booking.note,
            overCommitted: booking.overCommitted,
          }
        : emptyDraft(today, settings.defaultTaxRate)
    );
  }, [booking, open, settings.defaultTaxRate, today]);

  /**
   * The index this form checks against excludes the booking being edited —
   * otherwise raising a line from 50 to 60 chairs is measured against a world
   * where 50 are already committed to this same booking, and the owner is told
   * they have no stock for stock they are holding themselves.
   */
  const index = useMemo(
    () =>
      buildIndex(bookings, maintenanceLogs, {
        bufferDays: settings.bufferDays,
        excludeBookingId: booking?.id ?? null,
        today,
      }),
    [booking?.id, bookings, maintenanceLogs, settings.bufferDays, today]
  );

  const freeFor = (item: RentalItem) =>
    availabilityFor(index, item, draft.fromDate, draft.toDate || draft.fromDate);

  const lines = useMemo(
    () =>
      draft.lines.map((line) => {
        const chargeableUnits = chargeableUnitsFor(line.rateBasis, draft, settings);
        return { ...line, chargeableUnits, amount: round2(line.quantity * line.rate * chargeableUnits) };
      }),
    [draft, settings]
  );

  const totals = useMemo(
    () =>
      bookingTotals(
        {
          lines,
          transportCharge: Number(draft.transportCharge) || 0,
          labourCharge: Number(draft.labourCharge) || 0,
          discount: Number(draft.discount) || 0,
          taxRate: Number(draft.taxRate) || 0,
        },
        settings
      ),
    [draft.discount, draft.labourCharge, draft.taxRate, draft.transportCharge, lines, settings]
  );

  /** Lines that ask for more than exists on the tightest day of the window. */
  const shortfalls = useMemo(() => {
    const out: { line: BookingLine; free: number; date: string }[] = [];
    for (const line of lines) {
      const item = items.find((row) => row.id === line.itemId);
      if (!item) continue;
      const availability = freeFor(item);
      if (line.quantity > availability.free) {
        out.push({ line, free: availability.free, date: availability.tightestDate });
      }
    }
    return out;
    // freeFor closes over `index` and the draft window; both are in the deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, items, lines, draft.fromDate, draft.toDate]);

  const visibleItems = useMemo(() => {
    const query = itemSearch.trim().toLowerCase();
    return items
      .filter((item) => item.active)
      .filter((item) => activeCategory === "all" || item.categoryId === activeCategory)
      .filter((item) => !query || item.name.toLowerCase().includes(query))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [activeCategory, itemSearch, items]);

  const matchingCustomers = useMemo(() => {
    const query = customerSearch.trim().toLowerCase();
    if (!query) return customers.slice(0, 6);
    return customers
      .filter(
        (customer) =>
          customer.name.toLowerCase().includes(query) || customer.phone.includes(query)
      )
      .slice(0, 8);
  }, [customerSearch, customers]);

  const patch = (updates: Partial<Draft>) => setDraft((current) => ({ ...current, ...updates }));

  const addItem = (item: RentalItem) => {
    setDraft((current) => {
      const existing = current.lines.find((line) => line.itemId === item.id);
      if (existing) {
        return {
          ...current,
          lines: current.lines.map((line) =>
            line.id === existing.id ? { ...line, quantity: line.quantity + 1 } : line
          ),
        };
      }
      return { ...current, lines: [...current.lines, lineFromItem(item, 1)] };
    });
  };

  const setLine = (id: string, updates: Partial<BookingLine>) =>
    setDraft((current) => ({
      ...current,
      lines: current.lines.map((line) => (line.id === id ? { ...line, ...updates } : line)),
    }));

  const removeLine = (id: string) =>
    setDraft((current) => ({ ...current, lines: current.lines.filter((line) => line.id !== id) }));

  const submit = async (status: Booking["status"]) => {
    setError("");

    let customerId = draft.customerId;
    if (!customerId && newCustomer?.name.trim()) {
      const created = await saveCustomer({
        name: newCustomer.name.trim(),
        phone: newCustomer.phone.trim(),
        altPhone: "",
        address: "",
        idProofKind: "",
        idProofNumber: "",
        idProofPhoto: "",
        isTrade: false,
        notes: "",
      });
      customerId = created.id;
    }

    if (!customerId) {
      setError("Pick a customer, or add a new one.");
      return;
    }
    if (lines.length === 0) {
      setError("Add at least one item.");
      return;
    }
    if (draft.toDate && draft.toDate < draft.fromDate) {
      setError("The return date cannot be before the start date.");
      return;
    }
    // Over-committing is sometimes right — the owner may be sub-hiring, or know
    // stock is coming back early. It is never accidental: it has to be ticked.
    if (shortfalls.length > 0 && !draft.overCommitted) {
      setError(
        `Not enough stock on these dates: ${shortfalls
          .map((row) => `${row.line.name} (${row.free} free)`)
          .join(", ")}. Tick "book anyway" if you are covering it another way.`
      );
      return;
    }

    setSaving(true);
    try {
      const saved = await saveBooking(
        {
          customerId,
          fromDate: draft.fromDate,
          toDate: draft.toDate || draft.fromDate,
          fromTime: draft.fromTime,
          toTime: draft.toTime,
          eventName: draft.eventName,
          venue: draft.venue,
          venueContact: draft.venueContact,
          lines,
          transportCharge: Number(draft.transportCharge) || 0,
          labourCharge: Number(draft.labourCharge) || 0,
          discount: Number(draft.discount) || 0,
          taxRate: Number(draft.taxRate) || 0,
          overCommitted: draft.overCommitted && shortfalls.length > 0,
          note: draft.note,
          status,
        },
        booking?.id
      );
      onSaved?.(saved);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the booking.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={booking ? `Edit ${booking.bookingNo}` : "New booking"}
      wide
    >
      <div className="space-y-5">
        {/* 1 — Customer */}
        <section>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Customer</h4>
          {draft.customerId ? (
            <div className="flex items-center justify-between rounded-lg border border-indigo/30 bg-indigo/5 px-3 py-2">
              <span className="text-sm font-semibold text-ink">
                {customers.find((c) => c.id === draft.customerId)?.name}
                <span className="ml-2 font-normal text-muted">
                  {customers.find((c) => c.id === draft.customerId)?.phone}
                </span>
              </span>
              <button
                type="button"
                onClick={() => patch({ customerId: "" })}
                className="text-xs font-semibold text-indigo"
              >
                Change
              </button>
            </div>
          ) : newCustomer ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                className={inputClass}
                placeholder="Customer name"
                value={newCustomer.name}
                onChange={(event) => setNewCustomer({ ...newCustomer, name: event.target.value })}
                autoFocus
              />
              <input
                className={inputClass}
                placeholder="Phone"
                inputMode="tel"
                value={newCustomer.phone}
                onChange={(event) => setNewCustomer({ ...newCustomer, phone: event.target.value })}
              />
              <button
                type="button"
                onClick={() => setNewCustomer(null)}
                className="text-left text-xs font-semibold text-muted hover:text-indigo"
              >
                Pick an existing customer instead
              </button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted/60" />
                <input
                  className={`${inputClass} pl-9`}
                  placeholder="Search by name or phone"
                  value={customerSearch}
                  onChange={(event) => setCustomerSearch(event.target.value)}
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {matchingCustomers.map((customer) => (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() => patch({ customerId: customer.id })}
                    className="rounded-lg border border-muted-line/40 bg-white px-3 py-1.5 text-sm text-ink hover:border-indigo/50 hover:text-indigo"
                  >
                    {customer.name}
                    <span className="ml-1.5 text-xs text-muted">{customer.phone}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setNewCustomer({ name: customerSearch, phone: "" })}
                  className="inline-flex items-center gap-1 rounded-lg border border-dashed border-indigo/40 px-3 py-1.5 text-sm font-semibold text-indigo"
                >
                  <UserPlus className="h-4 w-4" aria-hidden="true" />
                  New customer
                </button>
              </div>
            </>
          )}
        </section>

        {/* 2 — Event and window */}
        <section className="grid gap-3 sm:grid-cols-2">
          <Field label="Event">
            <input
              className={inputClass}
              value={draft.eventName}
              onChange={(event) => patch({ eventName: event.target.value })}
              placeholder="Sharma wedding"
            />
          </Field>
          <Field label="Venue">
            <input
              className={inputClass}
              value={draft.venue}
              onChange={(event) => patch({ venue: event.target.value })}
              placeholder="Green Lawns, Sector 12"
            />
          </Field>
          <Field label="Venue contact" hint="Who the delivery team calls on arrival.">
            <input
              className={inputClass}
              inputMode="tel"
              value={draft.venueContact}
              onChange={(event) => patch({ venueContact: event.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="From">
              <input
                type="date"
                className={inputClass}
                value={draft.fromDate}
                onChange={(event) => patch({ fromDate: event.target.value })}
              />
            </Field>
            <Field label="To">
              <input
                type="date"
                className={inputClass}
                value={draft.toDate}
                min={draft.fromDate}
                onChange={(event) => patch({ toDate: event.target.value })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Out at" hint="Optional — used for per-hour rates.">
              <input
                type="time"
                className={inputClass}
                value={draft.fromTime}
                onChange={(event) => patch({ fromTime: event.target.value })}
              />
            </Field>
            <Field label="Back at">
              <input
                type="time"
                className={inputClass}
                value={draft.toTime}
                onChange={(event) => patch({ toTime: event.target.value })}
              />
            </Field>
          </div>
        </section>

        {/* 3 — Items */}
        <section>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
            Items — availability shown for {formatDate(draft.fromDate)}
            {draft.toDate && draft.toDate !== draft.fromDate ? ` to ${formatDate(draft.toDate)}` : ""}
          </h4>

          <div className="-mx-1 mb-2 flex gap-1 overflow-x-auto px-1 pb-1">
            <button
              type="button"
              onClick={() => setActiveCategory("all")}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                activeCategory === "all" ? "bg-indigo text-white" : "bg-white text-muted"
              }`}
            >
              All
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setActiveCategory(category.id)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  activeCategory === category.id ? "bg-indigo text-white" : "bg-white text-muted"
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>

          <input
            className={inputClass}
            placeholder="Search items"
            value={itemSearch}
            onChange={(event) => setItemSearch(event.target.value)}
          />

          <div className="mt-2 grid max-h-52 gap-1.5 overflow-y-auto sm:grid-cols-2">
            {visibleItems.map((item) => {
              const availability = freeFor(item);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => addItem(item)}
                  className="flex items-center justify-between gap-2 rounded-lg border border-muted-line/30 bg-white px-3 py-2 text-left transition hover:border-indigo/50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">
                      {item.name}
                    </span>
                    <span className="text-xs text-muted">
                      {formatMoney(item.rate, currency)}
                      {RATE_BASIS_SUFFIX[item.rateBasis]}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 text-xs font-bold ${
                      availability.free <= 0 ? "text-red-600" : "text-muted"
                    }`}
                  >
                    {availability.free} of {availability.total}
                  </span>
                </button>
              );
            })}
          </div>

          {lines.length > 0 ? (
            <div className="mt-3 space-y-2">
              {lines.map((line) => {
                const item = items.find((row) => row.id === line.itemId);
                const availability = item ? freeFor(item) : null;
                const over = availability ? line.quantity > availability.free : false;
                const serialised = item?.tracking === "serialised";
                const unitsFree = item
                  ? freeUnits(index, units, item.id, booking?.id ?? null).length
                  : 0;

                return (
                  <div
                    key={line.id}
                    className="rounded-xl border border-muted-line/30 bg-white p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">{line.name}</p>
                        <p className="text-xs text-muted">
                          {formatMoney(line.rate, currency)}
                          {RATE_BASIS_SUFFIX[line.rateBasis]} × {line.chargeableUnits}
                          {line.depositPerUnit
                            ? ` · deposit ${formatMoney(line.depositPerUnit, currency)}/unit`
                            : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeLine(line.id)}
                        className="text-muted hover:text-red-600"
                        aria-label={`Remove ${line.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <label className="block">
                        <span className="text-[10px] font-semibold uppercase text-muted">Qty</span>
                        <input
                          className={`${inputClass} ${over ? "border-red-400" : ""}`}
                          inputMode="numeric"
                          value={line.quantity}
                          onChange={(event) =>
                            setLine(line.id, { quantity: Math.max(0, Number(event.target.value) || 0) })
                          }
                        />
                      </label>
                      <label className="block">
                        <span className="text-[10px] font-semibold uppercase text-muted">Rate</span>
                        <input
                          className={inputClass}
                          inputMode="decimal"
                          value={line.rate}
                          onChange={(event) =>
                            setLine(line.id, { rate: Number(event.target.value) || 0 })
                          }
                        />
                      </label>
                      <div>
                        <span className="text-[10px] font-semibold uppercase text-muted">
                          Amount
                        </span>
                        <p className="mt-2 text-sm font-bold text-ink">
                          {formatMoney(line.amount, currency)}
                        </p>
                      </div>
                    </div>

                    {availability ? (
                      <p
                        className={`mt-1.5 text-xs ${over ? "font-semibold text-red-600" : "text-muted"}`}
                      >
                        {availability.free} of {availability.total} free on these dates
                        {availability.tightestDate
                          ? ` (tightest on ${formatDate(availability.tightestDate)})`
                          : ""}
                        {serialised ? ` · ${unitsFree} units available` : ""}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </section>

        {/* 4 — Charges */}
        <section className="grid gap-3 sm:grid-cols-4">
          <Field label="Transport">
            <input
              className={inputClass}
              inputMode="decimal"
              value={draft.transportCharge}
              onChange={(event) => patch({ transportCharge: event.target.value })}
            />
          </Field>
          <Field label="Labour">
            <input
              className={inputClass}
              inputMode="decimal"
              value={draft.labourCharge}
              onChange={(event) => patch({ labourCharge: event.target.value })}
            />
          </Field>
          <Field label="Discount">
            <input
              className={inputClass}
              inputMode="decimal"
              value={draft.discount}
              onChange={(event) => patch({ discount: event.target.value })}
            />
          </Field>
          {settings.taxEnabled ? (
            <Field label="Tax %">
              <input
                className={inputClass}
                inputMode="decimal"
                value={draft.taxRate}
                onChange={(event) => patch({ taxRate: event.target.value })}
              />
            </Field>
          ) : null}
        </section>

        <Field label="Note" hint="Anything the crew or the office should know.">
          <textarea
            className={inputClass}
            rows={2}
            value={draft.note}
            onChange={(event) => patch({ note: event.target.value })}
          />
        </Field>

        {/* 5 — Totals */}
        <section className="rounded-xl bg-cream-paper/70 p-4">
          <dl className="space-y-1 text-sm">
            <Row label="Rent" value={formatMoney(totals.subtotal, currency)} />
            {totals.transportCharge ? (
              <Row label="Transport" value={formatMoney(totals.transportCharge, currency)} />
            ) : null}
            {totals.labourCharge ? (
              <Row label="Labour" value={formatMoney(totals.labourCharge, currency)} />
            ) : null}
            {totals.discount ? (
              <Row label="Discount" value={`-${formatMoney(totals.discount, currency)}`} />
            ) : null}
            {totals.taxAmount ? (
              <Row label={`Tax (${draft.taxRate}%)`} value={formatMoney(totals.taxAmount, currency)} />
            ) : null}
            <Row label="Total" value={formatMoney(totals.total, currency)} bold />
            {totals.depositTotal ? (
              <Row
                label="Refundable deposit"
                value={formatMoney(totals.depositTotal, currency)}
              />
            ) : null}
          </dl>
        </section>

        {shortfalls.length > 0 ? (
          <label className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3">
            <input
              type="checkbox"
              checked={draft.overCommitted}
              onChange={(event) => patch({ overCommitted: event.target.checked })}
              className="mt-0.5 h-4 w-4 accent-indigo"
            />
            <span className="text-sm text-ink">
              <span className="flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden="true" />
                Book anyway — I am covering the shortfall
              </span>
              <span className="mt-1 block text-xs text-muted">
                {shortfalls
                  .map(
                    (row) =>
                      `${row.line.name}: ${row.line.quantity} wanted, ${row.free} free${
                        row.date ? ` on ${formatDate(row.date)}` : ""
                      }`
                  )
                  .join(" · ")}
              </span>
            </span>
          </label>
        ) : null}

        {error ? (
          <p className="text-sm font-semibold text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => void submit("confirmed")}
            className={`${primaryBtnClass} flex-1`}
            disabled={saving}
          >
            <Check className="h-4 w-4" aria-hidden="true" />
            {saving ? "Saving…" : "Confirm booking"}
          </button>
          <button
            type="button"
            onClick={() => void submit(booking?.status === "enquiry" || !booking ? "enquiry" : booking.status)}
            className={`${secondaryBtnClass} flex-1`}
            disabled={saving}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {booking ? "Save" : "Save as enquiry"}
          </button>
        </div>
        <p className="text-xs text-muted">
          An enquiry is a quotation — it holds no stock. Confirming is what commits it.
        </p>
      </div>
    </Modal>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "text-base font-bold text-ink" : "text-muted"}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function emptyDraft(today: string, defaultTaxRate: number): Draft {
  return {
    customerId: "",
    fromDate: today,
    toDate: today,
    fromTime: "",
    toTime: "",
    eventName: "",
    venue: "",
    venueContact: "",
    lines: [],
    transportCharge: "",
    labourCharge: "",
    discount: "",
    taxRate: String(defaultTaxRate),
    note: "",
    overCommitted: false,
  };
}
