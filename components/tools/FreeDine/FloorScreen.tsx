"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bike,
  CalendarClock,
  ChefHat,
  Clock,
  LayoutGrid,
  Plus,
  ShoppingBag,
} from "lucide-react";
import { useDine, type FloorTable } from "@/lib/dine/store";
import { formatPaise } from "@/lib/dine/money";
import { ORDER_TYPE_LABELS, type DineReservation, type DineTicket } from "@/lib/dine/types";
import { formatSlot, holdingTable, isLate, upcoming } from "@/lib/dine/reservation";
import type { NavigateFn } from "./nav";
import {
  EmptyState,
  OrderTypeChip,
  SectionHeading,
  TableStateBadge,
  elapsedLabel,
  primaryBtnClass,
  secondaryBtnClass,
  tableCardClass,
  tapTargetClass,
} from "./ui";

/**
 * The floor is the home screen: every table, its state, what it owes and how
 * long it has been sitting. Tapping a free table opens a ticket; tapping a
 * running one picks it back up (FR-3.4).
 */
export function FloorScreen({
  onOpenTicket,
  onNavigate,
}: {
  onOpenTicket: (ticketId: string) => void;
  onNavigate: NavigateFn;
}) {
  const {
    areas,
    floorTables,
    openTickets,
    openTicket,
    reservations,
    seatReservation,
    business,
    settings,
  } = useDine();
  const currency = business?.currency ?? "INR";
  const [areaId, setAreaId] = useState<string>("all");

  // Re-render once a minute so the "sitting for 40m" clocks stay honest.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const visible = useMemo(
    () => (areaId === "all" ? floorTables : floorTables.filter((row) => row.table.areaId === areaId)),
    [areaId, floorTables]
  );

  const counterTickets = useMemo(
    () => openTickets.filter((ticket) => ticket.orderType !== "dine-in"),
    [openTickets]
  );

  // Which free tables are spoken for, worked out here rather than in the store
  // because it depends on the clock this screen already ticks.
  const heldBy = useMemo(() => {
    if (!settings.reservationsEnabled) return new Map<string, DineReservation>();
    const map = new Map<string, DineReservation>();
    for (const row of floorTables) {
      if (row.state !== "free") continue;
      const booking = holdingTable(reservations, row.table.id, now, settings.reservationHoldMinutes);
      if (booking) map.set(row.table.id, booking);
    }
    return map;
  }, [floorTables, now, reservations, settings.reservationHoldMinutes, settings.reservationsEnabled]);

  // The next couple of hours, so the counter can see who is about to walk in.
  const arriving = useMemo(
    () => (settings.reservationsEnabled ? upcoming(reservations, now, 120) : []),
    [now, reservations, settings.reservationsEnabled]
  );

  const running = floorTables.filter((row) => row.state !== "free");
  const runningTotal = running.reduce((sum, row) => sum + row.runningTotal, 0);

  const startCounterTicket = async (type: "takeaway" | "delivery") => {
    const ticket = await openTicket(type, null);
    onOpenTicket(ticket.id);
  };

  const openTable = async (row: FloorTable) => {
    if (row.ticket) {
      onOpenTicket(row.ticket.id);
      return;
    }
    // Tapping a held table seats the booking, so the advance and the guest's
    // name come with them instead of being retyped.
    const booking = heldBy.get(row.table.id);
    if (booking) {
      const seated = await seatReservation(booking.id, row.table.id);
      if (seated) {
        onOpenTicket(seated.id);
        return;
      }
    }
    const ticket = await openTicket("dine-in", row.table.id);
    onOpenTicket(ticket.id);
  };

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Floor"
        subtitle={
          running.length === 0
            ? "Every table is free."
            : `${running.length} table${running.length === 1 ? "" : "s"} running · ${formatPaise(
                runningTotal,
                currency
              )} on the floor`
        }
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void startCounterTicket("takeaway")}
              className={`${secondaryBtnClass} ${tapTargetClass}`}
            >
              <ShoppingBag className="h-4 w-4" />
              Takeaway
            </button>
            <button
              type="button"
              onClick={() => void startCounterTicket("delivery")}
              className={`${secondaryBtnClass} ${tapTargetClass}`}
            >
              <Bike className="h-4 w-4" />
              Delivery
            </button>
          </div>
        }
      />

      {arriving.length > 0 && (
        <div className="rounded-2xl border border-purple-200 bg-purple-50 p-3">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-purple-800">
            <CalendarClock className="h-3.5 w-3.5" />
            Arriving soon
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {arriving.slice(0, 6).map((booking) => (
              <button
                key={booking.id}
                type="button"
                onClick={() => onNavigate("bookings")}
                className={`${tapTargetClass} rounded-xl border border-purple-200 bg-white px-3 py-2 text-left text-xs`}
              >
                <span className="block font-bold text-ink">
                  {booking.guestName || "Guest"} · {booking.partySize} pax
                </span>
                <span className="text-muted">
                  {formatSlot(booking.startsAt).replace(/^.*?, /, "")}
                  {booking.tableName ? ` · ${booking.tableName}` : " · any table"}
                  {isLate(booking, now, settings.reservationHoldMinutes) ? " · late" : ""}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {areas.length > 1 && (
        <div className="-mx-1 flex gap-1 overflow-x-auto pb-1" role="tablist" aria-label="Areas">
          <button
            type="button"
            role="tab"
            aria-selected={areaId === "all"}
            onClick={() => setAreaId("all")}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
              areaId === "all" ? "bg-indigo text-white" : "text-muted hover:bg-white hover:text-indigo"
            }`}
          >
            All areas
          </button>
          {areas
            .slice()
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((area) => (
              <button
                key={area.id}
                type="button"
                role="tab"
                aria-selected={areaId === area.id}
                onClick={() => setAreaId(area.id)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  areaId === area.id
                    ? "bg-indigo text-white"
                    : "text-muted hover:bg-white hover:text-indigo"
                }`}
              >
                {area.name}
              </button>
            ))}
        </div>
      )}

      {visible.length === 0 ? (
        <EmptyState
          icon={<LayoutGrid className="h-6 w-6" />}
          title="No tables yet"
          message="Add an area and some tables and they will show up here."
          action={
            <button
              type="button"
              onClick={() => onNavigate("tables")}
              className={primaryBtnClass}
            >
              <Plus className="h-4 w-4" />
              Set up tables
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visible.map((row) => (
            <button
              key={row.table.id}
              type="button"
              onClick={() => void openTable(row)}
              className={`flex min-h-[112px] flex-col justify-between rounded-2xl border p-3 text-left shadow-sm transition ${tableCardClass(
                heldBy.has(row.table.id) ? "reserved" : row.state
              )}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-base font-bold text-ink">{row.table.name}</span>
                <TableStateBadge state={heldBy.has(row.table.id) ? "reserved" : row.state} />
              </div>

              {row.state === "free" ? (
                heldBy.has(row.table.id) ? (
                  <span className="text-xs font-semibold text-purple-800">
                    {heldBy.get(row.table.id)!.guestName || "Guest"} ·{" "}
                    {formatSlot(heldBy.get(row.table.id)!.startsAt).replace(/^.*?, /, "")} ·{" "}
                    {heldBy.get(row.table.id)!.partySize} pax
                  </span>
                ) : (
                  <span className="text-xs text-muted">
                    {row.table.seats} seat{row.table.seats === 1 ? "" : "s"}
                  </span>
                )
              ) : (
                <div className="space-y-1">
                  <span className="block text-sm font-bold text-ink">
                    {formatPaise(row.runningTotal, currency)}
                  </span>
                  <span className="flex items-center gap-2 text-[11px] text-muted">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      {elapsedLabel(row.openedAt, now)}
                    </span>
                    <span>
                      {row.itemCount} item{row.itemCount === 1 ? "" : "s"}
                    </span>
                  </span>
                  {row.readyCount > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-green-800">
                      <ChefHat className="h-2.5 w-2.5" aria-hidden="true" />
                      Food ready
                    </span>
                  )}
                  {row.unfiredCount > 0 && (
                    <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700">
                      {row.unfiredCount} not sent
                    </span>
                  )}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {counterTickets.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wide text-muted">
            Takeaway &amp; delivery
          </h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {counterTickets.map((ticket) => (
              <CounterTicketCard
                key={ticket.id}
                ticket={ticket}
                currency={currency}
                now={now}
                onOpen={() => onOpenTicket(ticket.id)}
              />
            ))}
          </div>
        </div>
      )}

      {settings.dayStartHour > 0 && (
        <p className="text-xs text-muted/80">
          Business day starts at {String(settings.dayStartHour).padStart(2, "0")}:00 — orders before
          then count towards the previous day&apos;s report.
        </p>
      )}
    </div>
  );
}

function CounterTicketCard({
  ticket,
  currency,
  now,
  onOpen,
}: {
  ticket: DineTicket;
  currency: string;
  now: number;
  onOpen: () => void;
}) {
  const { ticketTotals } = useDine();
  const totals = ticketTotals(ticket.id);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex items-center justify-between gap-3 rounded-2xl border border-muted-line/30 bg-white p-3 text-left shadow-sm transition hover:border-indigo/50"
    >
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          <OrderTypeChip type={ticket.orderType} />
          <span className="truncate text-sm font-bold text-ink">
            #{ticket.ticketNumber}
            {ticket.customerName ? ` · ${ticket.customerName}` : ""}
          </span>
        </span>
        <span className="mt-1 flex items-center gap-2 text-[11px] text-muted">
          <Clock className="h-3 w-3" aria-hidden="true" />
          {elapsedLabel(ticket.openedAt, now)}
          <span>{ORDER_TYPE_LABELS[ticket.orderType]}</span>
        </span>
      </span>
      <span className="shrink-0 text-sm font-bold text-ink">
        {formatPaise(totals.total, currency)}
      </span>
    </button>
  );
}
