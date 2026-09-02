"use client";

// Availability — the screen the product exists for.
//
// Everything on it answers one question: what can I promise, and when. The date
// range at the top drives the table; the strip under each row shows where the
// pinch points are for the next two months, so the owner can see the weekend
// they are about to run out on before a customer asks about it.

import { useMemo, useState } from "react";
import { AlertTriangle, CalendarRange, Search } from "lucide-react";
import { useRental } from "@/lib/rental/store";
import {
  availabilityTable,
  buildIndex,
  calendarStrip,
  findConflicts,
} from "@/lib/rental/availability";
import {
  CALENDAR_DAYS,
  addDays,
  formatDate,
  formatDateShort,
  type Booking,
} from "@/lib/rental/types";
import { AvailabilityPill, CalendarStrip, EmptyState, chipBtnClass, inputClass } from "./ui";

export function AvailabilityScreen({ onOpenBooking }: { onOpenBooking?: (id: string) => void }) {
  const { bookings, categories, items, maintenanceLogs, settings, today, units } = useRental();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");

  const index = useMemo(
    () =>
      buildIndex(bookings, maintenanceLogs, {
        bufferDays: settings.bufferDays,
        horizonEnd: addDays(today, CALENDAR_DAYS + 30),
        today,
      }),
    [bookings, maintenanceLogs, settings.bufferDays, today]
  );

  const rows = useMemo(() => {
    const search = query.trim().toLowerCase();
    return availabilityTable(index, items, units, from, to || from)
      .filter((row) => category === "all" || row.item.categoryId === category)
      .filter((row) => !search || row.item.name.toLowerCase().includes(search));
  }, [category, from, index, items, query, to, units]);

  const conflicts = useMemo(
    () => findConflicts(bookings, items, maintenanceLogs, settings.bufferDays, today),
    [bookings, items, maintenanceLogs, settings.bufferDays, today]
  );

  const bookingById = useMemo(
    () => new Map(bookings.map((booking) => [booking.id, booking])),
    [bookings]
  );

  const quickRange = (days: number) => {
    setFrom(today);
    setTo(addDays(today, days));
  };

  return (
    <div className="grid gap-4">
      {/* Date range — everything below reflects it */}
      <section className="rounded-2xl border border-muted-line/30 bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr,1fr,auto] sm:items-end">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
              From
            </span>
            <input
              type="date"
              className={inputClass}
              value={from}
              onChange={(event) => {
                setFrom(event.target.value);
                if (to < event.target.value) setTo(event.target.value);
              }}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
              To
            </span>
            <input
              type="date"
              className={inputClass}
              value={to}
              min={from}
              onChange={(event) => setTo(event.target.value)}
            />
          </label>
          <div className="flex gap-1.5">
            <button type="button" onClick={() => quickRange(0)} className={chipBtnClass}>
              Today
            </button>
            <button type="button" onClick={() => quickRange(6)} className={chipBtnClass}>
              7 days
            </button>
            <button type="button" onClick={() => quickRange(29)} className={chipBtnClass}>
              30 days
            </button>
          </div>
        </div>

        <p className="mt-2 text-xs text-muted">
          Free is counted on the tightest single day in the range — not the average. A booking
          holds its stock for {settings.bufferDays} buffer day
          {settings.bufferDays === 1 ? "" : "s"} after it is due back.
        </p>
      </section>

      {conflicts.length > 0 ? (
        <section className="rounded-2xl border border-red-200 bg-red-50/60 p-4">
          <h3 className="flex items-center gap-1.5 text-sm font-bold text-red-700">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            {conflicts.length} booking{conflicts.length === 1 ? " promises" : "s promise"} more
            than you own
          </h3>
          <div className="mt-2 grid gap-1.5">
            {conflicts.slice(0, 8).map((conflict) => {
              const booking = bookingById.get(conflict.bookingId) as Booking | undefined;
              return (
                <div
                  key={`${conflict.bookingId}-${conflict.itemId}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white p-2.5"
                >
                  <span className="text-sm text-ink">
                    <strong>{booking?.bookingNo ?? "—"}</strong> · {conflict.itemName} —{" "}
                    {conflict.committed} committed of {conflict.total} on{" "}
                    {formatDate(conflict.date)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpenBooking?.(conflict.bookingId)}
                    className={chipBtnClass}
                  >
                    Open booking
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted/60" />
          <input
            className={`${inputClass} pl-9`}
            placeholder="Search items"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1">
          <button
            type="button"
            onClick={() => setCategory("all")}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold ${
              category === "all" ? "bg-indigo text-white" : "bg-white text-muted"
            }`}
          >
            All
          </button>
          {categories.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => setCategory(row.id)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                category === row.id ? "bg-indigo text-white" : "bg-white text-muted"
              }`}
            >
              {row.name}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<CalendarRange className="h-6 w-6" />}
          title="No items to show"
          message="Add stock in Items, and it will appear here with its availability."
        />
      ) : (
        <div className="grid min-w-0 gap-2">
          {rows.map((row) => (
            <article
              key={row.item.id}
              className="min-w-0 rounded-2xl border border-muted-line/30 bg-white p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-bold text-ink">{row.item.name}</h3>
                  <p className="text-xs text-muted">
                    {row.total} owned · {row.committed} committed
                    {row.maintenance > 0 ? ` · ${row.maintenance} in maintenance` : ""}
                    {row.tightestDate ? ` · tightest on ${formatDate(row.tightestDate)}` : ""}
                  </p>
                </div>
                <AvailabilityPill free={row.free} total={row.total} />
              </div>

              <div className="mt-3">
                <CalendarStrip
                  days={calendarStrip(index, row.item.id, today, CALENDAR_DAYS)}
                  total={row.total}
                  onPickDate={(date) => {
                    setFrom(date);
                    setTo(date);
                  }}
                />
                <div className="mt-1 flex justify-between text-[10px] text-muted">
                  <span>{formatDateShort(today)}</span>
                  <span>{formatDateShort(addDays(today, CALENDAR_DAYS - 1))}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
