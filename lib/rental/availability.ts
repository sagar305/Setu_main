// The availability engine.
//
// This file is the product. Every free rental tool models a hire as an invoice
// with two dates on it, and none of them can answer the only question a tent
// house owner actually has: how many chairs are free on the 14th? Getting this
// wrong does not produce a wrong number on a report — it produces two weddings
// expecting the same 200 chairs.
//
// The rule, stated once so the rest of the app can rely on it:
//
//   An item's committed quantity across a date range is the MAXIMUM overlap on
//   any single day in that range. Not the sum, and not the average. Fifty
//   chairs out on Monday and fifty out on Friday is fifty committed across the
//   week, not a hundred — but fifty on Monday and fifty *also* on Monday is a
//   hundred.
//
// So the index below is per day. Everything else — the table, the calendar
// strip, the live "12 of 200 free" under a quantity box, the conflict list —
// is a read off it.

import {
  COMMITTING_STATUSES,
  addDays,
  dateRange,
  type Booking,
  type ItemUnit,
  type MaintenanceLog,
  type RentalItem,
  todayKey,
} from "./types";

/** Committed and unavailable counts for one item on one day. */
export type DayLoad = {
  date: string;
  committed: number;
  maintenance: number;
};

export type ItemAvailability = {
  itemId: string;
  total: number;
  /** Committed on the tightest day in the range. */
  committed: number;
  /** Out for maintenance on that same tightest day. */
  maintenance: number;
  /** total − committed − maintenance on the tightest day. Can go negative. */
  free: number;
  /** The day the pinch happens on, or "" when the range is entirely clear. */
  tightestDate: string;
};

/**
 * Where a booking's commitment actually ends.
 *
 * Two things push it past `toDate`. The buffer — stock comes back dirty and
 * goes out again cleaned, and the owner sets how many days that takes. And
 * being overdue: a booking that was due back on Tuesday and is still out on
 * Friday is holding that stock on Friday, whatever the paperwork says. Freeing
 * it on Tuesday because Tuesday is what was agreed is how a tool cheerfully
 * promises out chairs that are sitting in someone else's marquee.
 */
export function commitmentEnd(booking: Booking, bufferDays: number, today = todayKey()): string {
  const scheduled = booking.toDate || booking.fromDate;
  const stillOut = booking.status === "dispatched" && !booking.actualReturnedOn;
  const base = stillOut && today > scheduled ? today : scheduled;
  return addDays(base, Math.max(0, bufferDays));
}

/** The window a maintenance log blocks, or null when it blocks nothing. */
function maintenanceWindow(
  log: MaintenanceLog,
  horizonEnd: string
): { from: string; to: string } | null {
  if (!log.outOfServiceFrom) return null;
  // An open-ended repair ("it is at the welder, no idea") blocks to the end of
  // whatever window is being asked about, rather than being ignored.
  return { from: log.outOfServiceFrom, to: log.outOfServiceTo || horizonEnd };
}

/**
 * A per-day commitment index, built once and read many times.
 *
 * Building it costs one pass over the bookings; every question after that is a
 * map lookup. That keeps a 60-day calendar over a few hundred bookings well
 * inside a frame, and it means the table, the strip and the live check in the
 * booking form cannot disagree with each other — they are all reading the same
 * numbers.
 */
export type AvailabilityIndex = {
  /** itemId → date → units committed. */
  committed: Map<string, Map<string, number>>;
  /** itemId → date → units out for maintenance. */
  maintenance: Map<string, Map<string, number>>;
  /** Serialised units currently allocated to a live booking: unitId → bookingId. */
  unitHolders: Map<string, string>;
  bufferDays: number;
  today: string;
};

function bump(index: Map<string, Map<string, number>>, itemId: string, date: string, by: number) {
  let byDate = index.get(itemId);
  if (!byDate) {
    byDate = new Map();
    index.set(itemId, byDate);
  }
  byDate.set(date, (byDate.get(date) ?? 0) + by);
}

export function buildIndex(
  bookings: Booking[],
  maintenanceLogs: MaintenanceLog[],
  options: {
    bufferDays: number;
    /** Ignore this booking — it is the one being edited. */
    excludeBookingId?: string | null;
    /** How far out open-ended maintenance is treated as blocking. */
    horizonEnd?: string;
    today?: string;
  }
): AvailabilityIndex {
  const today = options.today ?? todayKey();
  const horizonEnd = options.horizonEnd ?? addDays(today, 365);
  const committed = new Map<string, Map<string, number>>();
  const maintenance = new Map<string, Map<string, number>>();
  const unitHolders = new Map<string, string>();

  for (const booking of bookings) {
    if (options.excludeBookingId && booking.id === options.excludeBookingId) continue;
    if (!COMMITTING_STATUSES.includes(booking.status)) continue;

    const end = commitmentEnd(booking, options.bufferDays, today);
    const days = dateRange(booking.fromDate, end);
    for (const line of booking.lines) {
      if (line.quantity <= 0) continue;
      for (const day of days) bump(committed, line.itemId, day, line.quantity);
      for (const unitId of line.unitIds) unitHolders.set(unitId, booking.id);
    }
  }

  for (const log of maintenanceLogs) {
    const window = maintenanceWindow(log, horizonEnd);
    if (!window) continue;
    const quantity = Math.max(1, log.quantity || 1);
    for (const day of dateRange(window.from, window.to)) {
      bump(maintenance, log.itemId, day, quantity);
    }
  }

  return { committed, maintenance, unitHolders, bufferDays: options.bufferDays, today };
}

/** Committed units for one item on one day. */
export function committedOn(index: AvailabilityIndex, itemId: string, date: string): number {
  return index.committed.get(itemId)?.get(date) ?? 0;
}

export function maintenanceOn(index: AvailabilityIndex, itemId: string, date: string): number {
  return index.maintenance.get(itemId)?.get(date) ?? 0;
}

/**
 * What is free across a range — the tightest single day in it.
 *
 * Retired serialised units are removed from the total: a camera body that is
 * written off is not stock, however many rows the item still claims to own.
 */
export function availabilityFor(
  index: AvailabilityIndex,
  item: RentalItem,
  from: string,
  to: string,
  retiredUnits = 0
): ItemAvailability {
  const total = Math.max(0, item.totalQuantity - retiredUnits);
  let worstUsed = -1;
  let committed = 0;
  let maintenance = 0;
  let tightestDate = "";

  for (const day of dateRange(from, to || from)) {
    const dayCommitted = committedOn(index, item.id, day);
    const dayMaintenance = maintenanceOn(index, item.id, day);
    const used = dayCommitted + dayMaintenance;
    if (used > worstUsed) {
      worstUsed = used;
      committed = dayCommitted;
      maintenance = dayMaintenance;
      tightestDate = used > 0 ? day : "";
    }
  }

  return {
    itemId: item.id,
    total,
    committed,
    maintenance,
    free: total - committed - maintenance,
    tightestDate,
  };
}

/** Day-by-day load for one item — what the calendar strip draws. */
export function calendarStrip(
  index: AvailabilityIndex,
  itemId: string,
  from: string,
  days: number
): DayLoad[] {
  const out: DayLoad[] = [];
  for (let i = 0; i < days; i += 1) {
    const date = addDays(from, i);
    out.push({
      date,
      committed: committedOn(index, itemId, date),
      maintenance: maintenanceOn(index, itemId, date),
    });
  }
  return out;
}

export type AvailabilityRow = ItemAvailability & { item: RentalItem };

/**
 * The availability table, tightest first.
 *
 * Sorting by how much is left as a share of what is owned, rather than by the
 * raw figure — two chairs free out of two hundred is the pinch worth seeing,
 * not eight free out of ten. Ties break on the name so the order is stable
 * while the owner scrubs the date picker back and forth.
 */
export function availabilityTable(
  index: AvailabilityIndex,
  items: RentalItem[],
  units: ItemUnit[],
  from: string,
  to: string
): AvailabilityRow[] {
  const retiredByItem = new Map<string, number>();
  for (const unit of units) {
    if (unit.condition !== "retired") continue;
    retiredByItem.set(unit.itemId, (retiredByItem.get(unit.itemId) ?? 0) + 1);
  }

  return items
    .filter((item) => item.active)
    .map((item) => ({
      item,
      ...availabilityFor(index, item, from, to, retiredByItem.get(item.id) ?? 0),
    }))
    .sort((a, b) => {
      const aShare = a.total > 0 ? a.free / a.total : 1;
      const bShare = b.total > 0 ? b.free / b.total : 1;
      if (aShare !== bShare) return aShare - bShare;
      return a.item.name.localeCompare(b.item.name);
    });
}

export type Conflict = {
  bookingId: string;
  itemId: string;
  itemName: string;
  date: string;
  committed: number;
  total: number;
  /** How far past the stock the commitment goes on that day. */
  shortfall: number;
};

/**
 * Bookings that currently promise more than exists.
 *
 * A conflict is worth surfacing even when nobody meant it — stock gets sold, a
 * repair runs long, two bookings each fine on their own overlap after one is
 * extended. What is not worth surfacing is a shortfall the owner has already
 * looked at and accepted, which is what the `overCommitted` flag records.
 *
 * Accepting one is not just about hiding that row. A booking the owner has
 * knowingly over-committed (they are sub-hiring the difference) pushes the
 * day's total past stock, and every *other* booking sharing that day then looks
 * broken — so the tent house that deliberately took a second order is told its
 * first, entirely sound order is the problem, and the flag lands on the one
 * booking nobody should touch. So the acknowledged bookings are left out of the
 * count as well as out of the list: what remains is the shortfall the owner has
 * not already dealt with.
 */
export function findConflicts(
  bookings: Booking[],
  items: RentalItem[],
  maintenanceLogs: MaintenanceLog[],
  bufferDays: number,
  today = todayKey()
): Conflict[] {
  const unacknowledged = bookings.filter((booking) => !booking.overCommitted);
  const index = buildIndex(unacknowledged, maintenanceLogs, { bufferDays, today });
  const itemById = new Map(items.map((item) => [item.id, item]));
  const conflicts: Conflict[] = [];
  const seen = new Set<string>();

  for (const booking of bookings) {
    if (!COMMITTING_STATUSES.includes(booking.status)) continue;
    if (booking.overCommitted) continue;

    const days = dateRange(booking.fromDate, commitmentEnd(booking, bufferDays, today));
    for (const line of booking.lines) {
      const item = itemById.get(line.itemId);
      if (!item) continue;

      let worst: Conflict | null = null;
      for (const day of days) {
        const committed = committedOn(index, item.id, day);
        const used = committed + maintenanceOn(index, item.id, day);
        const shortfall = used - item.totalQuantity;
        if (shortfall <= 0) continue;
        if (!worst || shortfall > worst.shortfall) {
          worst = {
            bookingId: booking.id,
            itemId: item.id,
            itemName: item.name,
            date: day,
            committed,
            total: item.totalQuantity,
            shortfall,
          };
        }
      }

      const key = `${booking.id}:${line.itemId}`;
      if (worst && !seen.has(key)) {
        seen.add(key);
        conflicts.push(worst);
      }
    }
  }

  return conflicts.sort((a, b) => b.shortfall - a.shortfall || a.date.localeCompare(b.date));
}

/**
 * Serialised units that can be allocated for a window.
 *
 * A unit can be on only one live booking at a time, so anything held by another
 * confirmed or dispatched booking is out, as is anything not in good condition.
 * The index's `unitHolders` is deliberately not date-aware: a specific camera
 * body allocated to a booking is that booking's until it comes back, and
 * handing it to a second one because the dates look clear is precisely the
 * mistake serialised tracking exists to prevent.
 */
export function freeUnits(
  index: AvailabilityIndex,
  units: ItemUnit[],
  itemId: string,
  excludeBookingId?: string | null
): ItemUnit[] {
  return units.filter((unit) => {
    if (unit.itemId !== itemId) return false;
    if (unit.condition !== "good") return false;
    const holder = index.unitHolders.get(unit.id);
    return !holder || holder === excludeBookingId;
  });
}
