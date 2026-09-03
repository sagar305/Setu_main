"use client";

// Today — what has to happen before the day is over.
//
// Four lists in the order the day runs: what goes out, what comes back, what
// should have come back and has not, and what is still only a quote. The
// overdue list is deliberately first among equals in colour, because it is the
// only one that costs money every day it is ignored.

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarPlus,
  ClipboardList,
  Coins,
  PackageCheck,
  Send,
  Truck,
  Wallet,
} from "lucide-react";
import { formatMoney } from "@/lib/pos/types";
import { useRental } from "@/lib/rental/store";
import {
  collectionsOn,
  depositsHeld,
  itemsOut,
  lateDaysFor,
  lateFeeFor,
  valueOnRent,
} from "@/lib/rental/calc";
import { daysBetween, formatDate, formatDateWindow, type Booking } from "@/lib/rental/types";
import { BookingForm } from "./BookingForm";
import { DispatchModal } from "./DispatchModal";
import { ReturnModal } from "./ReturnModal";
import { ShareBookingModal } from "./ShareBookingModal";
import { EmptyState, Pill, SectionCard, StatCard, chipBtnClass, primaryBtnClass } from "./ui";

export function TodayScreen({ onOpenBooking }: { onOpenBooking?: (id: string) => void }) {
  const { bookings, business, customerById, items, settings, today } = useRental();
  const [formOpen, setFormOpen] = useState(false);
  const [dispatchFor, setDispatchFor] = useState<Booking | null>(null);
  const [returnFor, setReturnFor] = useState<Booking | null>(null);
  const [shareFor, setShareFor] = useState<Booking | null>(null);

  const currency = business?.currency ?? "INR";
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  const dispatching = useMemo(
    () =>
      bookings
        .filter((booking) => booking.status === "confirmed" && booking.fromDate <= today)
        .sort((a, b) => a.fromDate.localeCompare(b.fromDate)),
    [bookings, today]
  );

  const returning = useMemo(
    () =>
      bookings
        .filter((booking) => booking.status === "dispatched" && booking.toDate === today)
        .sort((a, b) => a.toTime.localeCompare(b.toTime)),
    [bookings, today]
  );

  const overdue = useMemo(
    () =>
      bookings
        .filter((booking) => booking.status === "dispatched" && booking.toDate < today)
        .sort((a, b) => a.toDate.localeCompare(b.toDate)),
    [bookings, today]
  );

  const enquiries = useMemo(
    () =>
      bookings
        .filter((booking) => booking.status === "enquiry")
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [bookings]
  );

  const stats = useMemo(
    () => ({
      out: itemsOut(bookings),
      value: valueOnRent(bookings, itemById),
      deposits: depositsHeld(bookings),
      collected: collectionsOn(bookings, today),
    }),
    [bookings, itemById, today]
  );

  const summary = (booking: Booking) => {
    const customer = customerById(booking.customerId);
    const count = booking.lines.reduce((sum, line) => sum + line.quantity, 0);
    return { customer, count };
  };

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Items out" value={String(stats.out)} sub="units on hire right now" />
        <StatCard
          label="Value on rent"
          value={formatMoney(stats.value, currency)}
          sub="replacement value out of the godown"
        />
        <StatCard
          label="Deposits held"
          value={formatMoney(stats.deposits, currency)}
          sub="money that is not yours yet"
        />
        <StatCard
          label="Collected today"
          value={formatMoney(stats.collected, currency)}
          sub="net of refunds"
        />
      </div>

      {overdue.length > 0 ? (
        <SectionCard
          title={`Overdue · ${overdue.length}`}
          action={
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
              Late fees accruing
            </span>
          }
        >
          <div className="grid gap-2">
            {overdue.map((booking) => {
              const { customer, count } = summary(booking);
              const lateDays = lateDaysFor(booking, today);
              const lateFee = lateFeeFor(booking, lateDays, settings, itemById);
              return (
                <div
                  key={booking.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50/60 p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-ink">
                      {booking.bookingNo} · {customer?.name ?? "—"}
                    </p>
                    <p className="text-xs text-muted">
                      Due {formatDate(booking.toDate)} · {count} items · {booking.venue}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Pill tone="danger">
                      {lateDays} day{lateDays === 1 ? "" : "s"} · {formatMoney(lateFee, currency)}
                    </Pill>
                    <button
                      type="button"
                      onClick={() => setShareFor(booking)}
                      className={chipBtnClass}
                    >
                      <Send className="h-4 w-4" aria-hidden="true" />
                      Chase
                    </button>
                    <button
                      type="button"
                      onClick={() => setReturnFor(booking)}
                      className={primaryBtnClass}
                    >
                      <PackageCheck className="h-4 w-4" aria-hidden="true" />
                      Return
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title={`Dispatching today · ${dispatching.length}`}
          action={
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo"
            >
              <CalendarPlus className="h-3.5 w-3.5" aria-hidden="true" />
              New booking
            </button>
          }
        >
          {dispatching.length === 0 ? (
            <EmptyState
              icon={<Truck className="h-6 w-6" />}
              title="Nothing to load"
              message="Confirmed bookings starting today show up here with their picking list."
            />
          ) : (
            <div className="grid gap-2">
              {dispatching.map((booking) => {
                const { customer, count } = summary(booking);
                return (
                  <button
                    key={booking.id}
                    type="button"
                    onClick={() => setDispatchFor(booking)}
                    className="flex items-center justify-between gap-2 rounded-xl border border-muted-line/30 bg-white p-3 text-left transition hover:border-indigo/50"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-ink">
                        {booking.bookingNo} · {customer?.name ?? "—"}
                      </span>
                      <span className="block text-xs text-muted">
                        {count} items · {booking.venue || "no venue given"}
                        {booking.fromTime ? ` · ${booking.fromTime}` : ""}
                      </span>
                    </span>
                    <Truck className="h-4 w-4 shrink-0 text-indigo" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard title={`Returning today · ${returning.length}`}>
          {returning.length === 0 ? (
            <EmptyState
              icon={<PackageCheck className="h-6 w-6" />}
              title="Nothing due back"
              message="Bookings due back today appear here, ready to settle."
            />
          ) : (
            <div className="grid gap-2">
              {returning.map((booking) => {
                const { customer, count } = summary(booking);
                return (
                  <button
                    key={booking.id}
                    type="button"
                    onClick={() => setReturnFor(booking)}
                    className="flex items-center justify-between gap-2 rounded-xl border border-muted-line/30 bg-white p-3 text-left transition hover:border-indigo/50"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-ink">
                        {booking.bookingNo} · {customer?.name ?? "—"}
                      </span>
                      <span className="block text-xs text-muted">
                        {count} items · deposit {formatMoney(booking.depositTotal, currency)}
                      </span>
                    </span>
                    <PackageCheck className="h-4 w-4 shrink-0 text-indigo" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard title={`Enquiries pending · ${enquiries.length}`}>
        {enquiries.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-6 w-6" />}
            title="No open quotes"
            message="Save a booking as an enquiry to quote for it without holding stock."
          />
        ) : (
          <div className="grid gap-2">
            {enquiries.map((booking) => {
              const { customer } = summary(booking);
              const age = daysBetween(booking.createdAt.slice(0, 10), today);
              return (
                <div
                  key={booking.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-muted-line/30 bg-white p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-ink">
                      {booking.bookingNo} · {customer?.name ?? "—"}
                    </p>
                    <p className="text-xs text-muted">
                      {formatDateWindow(booking.fromDate, booking.toDate)} ·{" "}
                      {formatMoney(booking.total, currency)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {age >= settings.quotationValidDays ? (
                      <Pill tone="warn">{age} days old</Pill>
                    ) : (
                      <Pill>{age === 0 ? "today" : `${age}d old`}</Pill>
                    )}
                    <button
                      type="button"
                      onClick={() => setShareFor(booking)}
                      className={chipBtnClass}
                    >
                      <Send className="h-4 w-4" aria-hidden="true" />
                      Follow up
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenBooking?.(booking.id)}
                      className={chipBtnClass}
                    >
                      Open
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {stats.deposits > 0 ? (
        <p className="flex items-center gap-2 text-xs text-muted">
          <Wallet className="h-4 w-4" aria-hidden="true" />
          You are holding {formatMoney(stats.deposits, currency)} of customer deposits across{" "}
          {bookings.filter((b) => b.depositTotal > 0 && (b.status === "dispatched" || b.status === "returned")).length}{" "}
          bookings.
          <Coins className="h-4 w-4" aria-hidden="true" />
        </p>
      ) : null}

      <BookingForm open={formOpen} booking={null} onClose={() => setFormOpen(false)} />
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
    </div>
  );
}
