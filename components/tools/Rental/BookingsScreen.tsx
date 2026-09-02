"use client";

// The booking pipeline: enquiry → confirmed → dispatched → returned → closed.
//
// One card per booking, and the card's primary button is whatever that booking
// needs next. An owner working through a Saturday morning should never have to
// open a booking to find out what it is waiting for.

import { useMemo, useState } from "react";
import {
  CalendarPlus,
  ClipboardList,
  FileText,
  PackageCheck,
  Pencil,
  Printer,
  Send,
  Trash2,
  Truck,
  XCircle,
} from "lucide-react";
import { formatMoney } from "@/lib/pos/types";
import { useRental } from "@/lib/rental/store";
import { balanceDue, requiredAdvanceFor, round2 } from "@/lib/rental/calc";
import { printQuotation } from "@/lib/rental/print";
import {
  BOOKING_STATUS_LABELS,
  formatDateWindow,
  type Booking,
  type BookingStatus,
} from "@/lib/rental/types";
import { BookingForm } from "./BookingForm";
import { DispatchModal } from "./DispatchModal";
import { ReturnModal } from "./ReturnModal";
import { ShareBookingModal } from "./ShareBookingModal";
import {
  ConfirmDialog,
  EmptyState,
  Field,
  Modal,
  SearchInput,
  StatusChip,
  chipBtnClass,
  inputClass,
  primaryBtnClass,
  secondaryBtnClass,
} from "./ui";

const TABS: (BookingStatus | "all")[] = [
  "all",
  "enquiry",
  "confirmed",
  "dispatched",
  "returned",
  "closed",
];

export function BookingsScreen({ initialBookingId }: { initialBookingId?: string | null }) {
  const {
    bookings,
    business,
    cancelBooking,
    closeBooking,
    confirmBooking,
    customerById,
    deleteBooking,
    items,
    settings,
  } = useRental();

  const [tab, setTab] = useState<BookingStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [formFor, setFormFor] = useState<Booking | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [dispatchFor, setDispatchFor] = useState<Booking | null>(null);
  const [returnFor, setReturnFor] = useState<Booking | null>(null);
  const [shareFor, setShareFor] = useState<Booking | null>(null);
  const [advanceFor, setAdvanceFor] = useState<Booking | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<Booking | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Booking | null>(null);
  const [error, setError] = useState("");

  const currency = business?.currency ?? "INR";
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  const visible = useMemo(() => {
    const search = query.trim().toLowerCase();
    return bookings
      .filter((booking) => (tab === "all" ? booking.status !== "cancelled" : booking.status === tab))
      .filter((booking) => {
        if (!search) return true;
        const customer = customerById(booking.customerId);
        return (
          booking.bookingNo.toLowerCase().includes(search) ||
          booking.eventName.toLowerCase().includes(search) ||
          booking.venue.toLowerCase().includes(search) ||
          (customer?.name ?? "").toLowerCase().includes(search) ||
          (customer?.phone ?? "").includes(search)
        );
      })
      .sort((a, b) => b.fromDate.localeCompare(a.fromDate) || b.createdAt.localeCompare(a.createdAt));
  }, [bookings, customerById, query, tab]);

  // A booking opened from another screen (Today, Availability) shows first.
  const ordered = useMemo(() => {
    if (!initialBookingId) return visible;
    const target = visible.find((booking) => booking.id === initialBookingId);
    if (!target) return visible;
    return [target, ...visible.filter((booking) => booking.id !== initialBookingId)];
  }, [initialBookingId, visible]);

  const counts = useMemo(() => {
    const map = new Map<BookingStatus | "all", number>();
    map.set("all", bookings.filter((booking) => booking.status !== "cancelled").length);
    for (const status of TABS) {
      if (status === "all") continue;
      map.set(status, bookings.filter((booking) => booking.status === status).length);
    }
    return map;
  }, [bookings]);

  const run = async (action: () => Promise<void>) => {
    setError("");
    try {
      await action();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That did not work.");
    }
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[200px] flex-1">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Booking no, customer, event or venue"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            setFormFor(null);
            setFormOpen(true);
          }}
          className={primaryBtnClass}
        >
          <CalendarPlus className="h-4 w-4" aria-hidden="true" />
          New booking
        </button>
      </div>

      <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1" aria-label="Booking status">
        {TABS.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setTab(status)}
            aria-current={tab === status ? "page" : undefined}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              tab === status ? "bg-indigo text-white" : "bg-white text-muted hover:text-indigo"
            }`}
          >
            {status === "all" ? "All" : BOOKING_STATUS_LABELS[status]}
            <span className="ml-1.5 text-xs opacity-70">{counts.get(status) ?? 0}</span>
          </button>
        ))}
      </nav>

      {error ? (
        <p className="text-sm font-semibold text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {ordered.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-6 w-6" />}
          title="No bookings here"
          message="Enquiries and confirmed hires will appear in this list."
          action={
            <button
              type="button"
              onClick={() => {
                setFormFor(null);
                setFormOpen(true);
              }}
              className={primaryBtnClass}
            >
              New booking
            </button>
          }
        />
      ) : (
        <div className="grid gap-3">
          {ordered.map((booking) => {
            const customer = customerById(booking.customerId);
            const balance = balanceDue(booking, settings);
            const itemCount = booking.lines.reduce((sum, line) => sum + line.quantity, 0);

            return (
              <article
                key={booking.id}
                className="rounded-2xl border border-muted-line/30 bg-white p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold text-ink">{booking.bookingNo}</h3>
                      <StatusChip status={booking.status} />
                      {booking.overCommitted ? (
                        <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
                          Over-committed
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-ink">
                      {customer?.name ?? "—"}
                      {customer?.phone ? (
                        <span className="ml-2 text-xs text-muted">{customer.phone}</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted">
                      {[booking.eventName, booking.venue].filter(Boolean).join(" · ")}
                    </p>
                    <p className="text-xs text-muted">
                      {formatDateWindow(booking.fromDate, booking.toDate)} · {itemCount} item
                      {itemCount === 1 ? "" : "s"}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-base font-bold text-ink">
                      {formatMoney(booking.total, currency)}
                    </p>
                    {balance > 0 ? (
                      <p className="text-xs font-semibold text-red-600">
                        {formatMoney(balance, currency)} due
                      </p>
                    ) : (
                      <p className="text-xs text-green-700">Paid</p>
                    )}
                    {booking.depositTotal ? (
                      <p className="text-xs text-muted">
                        Deposit {formatMoney(booking.depositTotal, currency)}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {booking.status === "enquiry" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          // Confirming is what commits the stock, so it is also
                          // where the advance is due. Nothing to collect means
                          // nothing to ask about.
                          const outstanding = round2(
                            requiredAdvanceFor(booking, settings, itemById) - booking.advancePaid
                          );
                          if (outstanding > 0) setAdvanceFor(booking);
                          else void run(() => confirmBooking(booking.id));
                        }}
                        className={primaryBtnClass}
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          printQuotation({
                            business,
                            booking,
                            customer,
                            itemById,
                            settings,
                          })
                        }
                        className={chipBtnClass}
                      >
                        <Printer className="h-4 w-4" aria-hidden="true" />
                        Quotation
                      </button>
                    </>
                  ) : null}

                  {booking.status === "confirmed" ? (
                    <button
                      type="button"
                      onClick={() => setDispatchFor(booking)}
                      className={primaryBtnClass}
                    >
                      <Truck className="h-4 w-4" aria-hidden="true" />
                      Dispatch
                    </button>
                  ) : null}

                  {booking.status === "dispatched" ? (
                    <button
                      type="button"
                      onClick={() => setReturnFor(booking)}
                      className={primaryBtnClass}
                    >
                      <PackageCheck className="h-4 w-4" aria-hidden="true" />
                      Record return
                    </button>
                  ) : null}

                  {booking.status === "returned" ? (
                    <button
                      type="button"
                      onClick={() => void run(() => closeBooking(booking.id))}
                      className={primaryBtnClass}
                    >
                      Close booking
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => setShareFor(booking)}
                    className={chipBtnClass}
                  >
                    <Send className="h-4 w-4" aria-hidden="true" />
                    Send
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormFor(booking);
                      setFormOpen(true);
                    }}
                    className={chipBtnClass}
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                    Edit
                  </button>

                  {booking.status === "dispatched" || booking.status === "returned" ? (
                    <button
                      type="button"
                      onClick={() => setDispatchFor(booking)}
                      className={chipBtnClass}
                    >
                      <FileText className="h-4 w-4" aria-hidden="true" />
                      Challan
                    </button>
                  ) : null}

                  {booking.status !== "closed" && booking.status !== "cancelled" ? (
                    <button
                      type="button"
                      onClick={() => setConfirmCancel(booking)}
                      className={chipBtnClass}
                    >
                      <XCircle className="h-4 w-4" aria-hidden="true" />
                      Cancel
                    </button>
                  ) : null}

                  {booking.status === "enquiry" || booking.status === "cancelled" ? (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(booking)}
                      className={chipBtnClass}
                      aria-label={`Delete ${booking.bookingNo}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  ) : null}
                </div>

                {booking.note ? (
                  <p className="mt-2 whitespace-pre-wrap text-xs text-muted">{booking.note}</p>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      <BookingForm
        open={formOpen}
        booking={formFor}
        onClose={() => {
          setFormOpen(false);
          setFormFor(null);
        }}
      />
      <DispatchModal
        open={dispatchFor !== null}
        booking={dispatchFor}
        onClose={() => setDispatchFor(null)}
      />
      <ReturnModal
        open={returnFor !== null}
        booking={returnFor}
        onClose={() => setReturnFor(null)}
      />
      <ShareBookingModal
        open={shareFor !== null}
        booking={shareFor}
        onClose={() => setShareFor(null)}
      />

      <AdvanceDialog
        booking={advanceFor}
        onClose={() => setAdvanceFor(null)}
        onConfirm={async (amount, mode) => {
          const target = advanceFor;
          setAdvanceFor(null);
          if (!target) return;
          await run(() =>
            confirmBooking(target.id, amount > 0 ? { amount, mode, kind: "advance" } : null)
          );
        }}
      />

      <ConfirmDialog
        open={confirmCancel !== null}
        title="Cancel this booking?"
        message="The stock it was holding is freed immediately. The booking stays in the list, marked cancelled."
        confirmLabel="Cancel booking"
        onCancel={() => setConfirmCancel(null)}
        onConfirm={() => {
          const target = confirmCancel;
          setConfirmCancel(null);
          if (target) void run(() => cancelBooking(target.id));
        }}
      />
      <ConfirmDialog
        open={confirmDelete !== null}
        title="Delete this booking?"
        message="It is removed for good. Cancelled bookings are usually worth keeping for the record."
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          const target = confirmDelete;
          setConfirmDelete(null);
          if (target) void run(() => deleteBooking(target.id));
        }}
      />
    </div>
  );
}

/**
 * The advance asked for at the moment a booking is confirmed.
 *
 * It refuses below the minimum rather than warning, because the minimum is a
 * commercial rule the owner set for themselves — a tool that lets you click
 * past your own rule is not enforcing anything. Anyone who wants to hold stock
 * without money sets the figure to zero in Settings.
 */
function AdvanceDialog({
  booking,
  onClose,
  onConfirm,
}: {
  booking: Booking | null;
  onClose: () => void;
  onConfirm: (amount: number, mode: string) => void | Promise<void>;
}) {
  const { business, items, settings } = useRental();
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const currency = business?.currency ?? "INR";

  const required = booking
    ? round2(requiredAdvanceFor(booking, settings, itemById) - booking.advancePaid)
    : 0;

  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState(settings.paymentModes[0] ?? "Cash");
  const [error, setError] = useState("");

  const key = booking?.id ?? "";
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setAmount(required > 0 ? String(required) : "");
    setMode(settings.paymentModes[0] ?? "Cash");
    setError("");
  }

  if (!booking) return null;

  return (
    <Modal open onClose={onClose} title={`Advance · ${booking.bookingNo}`}>
      <div className="space-y-3">
        <p className="text-sm text-muted">
          Confirming holds the stock for these dates. This booking needs at least{" "}
          <strong className="text-ink">{formatMoney(required, currency)}</strong> before it can be
          confirmed.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Advance received">
            <input
              className={inputClass}
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              autoFocus
            />
          </Field>
          <Field label="Mode">
            <select
              className={inputClass}
              value={mode}
              onChange={(event) => setMode(event.target.value)}
            >
              {settings.paymentModes.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {error ? (
          <p className="text-sm font-semibold text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex gap-2">
          <button
            type="button"
            className={`${primaryBtnClass} flex-1`}
            onClick={() => {
              const value = Number(amount) || 0;
              if (value + 0.001 < required) {
                setError(
                  `That is ${formatMoney(round2(required - value), currency)} short of the minimum advance.`
                );
                return;
              }
              void onConfirm(value, mode);
            }}
          >
            Take advance & confirm
          </button>
          <button type="button" onClick={onClose} className={secondaryBtnClass}>
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
