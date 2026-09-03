// Reports.
//
// Utilisation is the one that matters. A hire business's whole question is what
// to buy more of and what to sell off, and the answer is which stock earned its
// keep. Everything else here is a supporting figure.
//
// Utilisation is measured in unit-days, not booking-days: twenty of two hundred
// chairs out for three days is 60 unit-days against a possible 200 × period,
// which is 10% on a week — not "the item was out, so 43%". The per-item figure a
// bulk hire business needs is what share of what it owns was earning, and only
// unit-days answers that.

import {
  COMMITTING_STATUSES,
  dateRange,
  daysBetween,
  type Booking,
  type Customer,
  type MaintenanceLog,
  type RentalItem,
  type RentalSettings,
} from "./types";
import { bookingTotals, isDepositHeld, round2 } from "./calc";
import { commitmentEnd } from "./availability";

export type Period = { from: string; to: string };

/** Days of a booking's hire that fall inside the period. */
function overlapDays(booking: Booking, period: Period, bufferDays: number): string[] {
  const end = commitmentEnd(booking, 0, period.to);
  void bufferDays; // the buffer is a stock rule, not an earning one
  const from = booking.fromDate > period.from ? booking.fromDate : period.from;
  const to = end < period.to ? end : period.to;
  if (!from || !to || to < from) return [];
  return dateRange(from, to);
}

/** Bookings that actually happened — quotes and cancellations earn nothing. */
export function realisedBookings(bookings: Booking[]): Booking[] {
  return bookings.filter(
    (booking) => booking.status !== "enquiry" && booking.status !== "cancelled"
  );
}

export function inPeriod(bookings: Booking[], period: Period): Booking[] {
  return bookings.filter(
    (booking) => booking.fromDate <= period.to && booking.toDate >= period.from
  );
}

export type ItemUtilisation = {
  item: RentalItem;
  /** Unit-days actually out on hire inside the period. */
  unitDaysOut: number;
  /** Unit-days the item could have been out: total owned × days in period. */
  unitDaysAvailable: number;
  utilisation: number; // 0–1
  revenue: number;
  bookings: number;
  purchaseCost: number;
  /** Revenue earned to date ÷ what the stock cost. Null when cost is unknown. */
  returnOnCost: number | null;
  maintenanceSpend: number;
};

/**
 * Per-item utilisation and revenue.
 *
 * Revenue is apportioned from the line, not the booking — a booking with a
 * marquee and two hundred chairs on it has to split its money the way it was
 * earned, or the report says the chairs paid for themselves when the marquee
 * did.
 */
export function utilisationByItem(
  items: RentalItem[],
  bookings: Booking[],
  maintenanceLogs: MaintenanceLog[],
  period: Period,
  settings: RentalSettings
): ItemUtilisation[] {
  const periodDays = Math.max(1, daysBetween(period.from, period.to) + 1);
  const realised = inPeriod(realisedBookings(bookings), period);

  const unitDays = new Map<string, number>();
  const revenue = new Map<string, number>();
  const counts = new Map<string, number>();

  for (const booking of realised) {
    const days = overlapDays(booking, period, settings.bufferDays).length;
    if (days <= 0) continue;
    const chargedDays = Math.max(1, daysBetween(booking.fromDate, booking.toDate) + 1);
    // The share of the hire that falls inside the window being reported on.
    const share = Math.min(1, days / chargedDays);

    for (const line of booking.lines) {
      unitDays.set(line.itemId, (unitDays.get(line.itemId) ?? 0) + line.quantity * days);
      revenue.set(line.itemId, (revenue.get(line.itemId) ?? 0) + line.amount * share);
      counts.set(line.itemId, (counts.get(line.itemId) ?? 0) + 1);
    }
  }

  const maintenanceSpend = new Map<string, number>();
  for (const log of maintenanceLogs) {
    if (log.date < period.from || log.date > period.to) continue;
    maintenanceSpend.set(log.itemId, (maintenanceSpend.get(log.itemId) ?? 0) + log.cost);
  }

  return items
    .map((item) => {
      const available = Math.max(1, item.totalQuantity) * periodDays;
      const out = unitDays.get(item.id) ?? 0;
      const earned = round2(revenue.get(item.id) ?? 0);
      const cost = item.purchaseCost * Math.max(1, item.totalQuantity);
      return {
        item,
        unitDaysOut: out,
        unitDaysAvailable: available,
        utilisation: available > 0 ? out / available : 0,
        revenue: earned,
        bookings: counts.get(item.id) ?? 0,
        purchaseCost: cost,
        returnOnCost: cost > 0 ? earned / cost : null,
        maintenanceSpend: round2(maintenanceSpend.get(item.id) ?? 0),
      };
    })
    .sort((a, b) => b.utilisation - a.utilisation || b.revenue - a.revenue);
}

export type MonthTotals = {
  month: string; // "YYYY-MM"
  bookings: number;
  revenue: number;
  deposits: number;
  lateFees: number;
  damageAndLoss: number;
};

export function totalsByMonth(bookings: Booking[], settings: RentalSettings): MonthTotals[] {
  const months = new Map<string, MonthTotals>();
  for (const booking of realisedBookings(bookings)) {
    const month = booking.fromDate.slice(0, 7);
    const row = months.get(month) ?? {
      month,
      bookings: 0,
      revenue: 0,
      deposits: 0,
      lateFees: 0,
      damageAndLoss: 0,
    };
    row.bookings += 1;
    row.revenue = round2(row.revenue + bookingTotals(booking, settings).total);
    row.deposits = round2(row.deposits + booking.depositTotal);
    row.lateFees = round2(row.lateFees + booking.lateFee);
    row.damageAndLoss = round2(row.damageAndLoss + booking.damageTotal + booking.lossTotal);
    months.set(month, row);
  }
  return [...months.values()].sort((a, b) => a.month.localeCompare(b.month));
}

export type ConversionStats = {
  enquiries: number;
  converted: number;
  cancelled: number;
  rate: number; // 0–1
};

/**
 * Enquiry to confirmed.
 *
 * An enquiry that became a booking is counted by where it ended up, not by
 * where it started — the app moves a row through statuses rather than creating
 * a second one, so anything past `enquiry` was once an enquiry.
 */
export function conversion(bookings: Booking[]): ConversionStats {
  const enquiries = bookings.filter((booking) => booking.status === "enquiry").length;
  const converted = bookings.filter((booking) =>
    ["confirmed", "dispatched", "returned", "closed"].includes(booking.status)
  ).length;
  const cancelled = bookings.filter((booking) => booking.status === "cancelled").length;
  const total = enquiries + converted + cancelled;
  return { enquiries, converted, cancelled, rate: total > 0 ? converted / total : 0 };
}

export type DamageRecovery = {
  damageCharged: number;
  lossCharged: number;
  /** Replacement value of what was lost, whether or not it was charged for. */
  lossValue: number;
  /** Charged less than the stock was worth — the part written off. */
  writtenOff: number;
};

export function damageAndLoss(
  bookings: Booking[],
  itemById: Map<string, RentalItem>
): DamageRecovery {
  let damageCharged = 0;
  let lossCharged = 0;
  let lossValue = 0;

  for (const booking of realisedBookings(bookings)) {
    for (const line of booking.lines) {
      damageCharged += line.damageCharge;
      lossCharged += line.lossCharge;
      lossValue += line.lostQuantity * (itemById.get(line.itemId)?.replacementValue ?? 0);
    }
  }

  return {
    damageCharged: round2(damageCharged),
    lossCharged: round2(lossCharged),
    lossValue: round2(lossValue),
    writtenOff: round2(Math.max(0, lossValue - lossCharged)),
  };
}

export type LateStats = {
  lateBookings: number;
  totalLateDays: number;
  lateFeesCharged: number;
  /** Share of returned bookings that came back late. */
  lateRate: number;
};

export function lateReturns(bookings: Booking[]): LateStats {
  const returned = bookings.filter((booking) => booking.actualReturnedOn);
  const late = returned.filter((booking) => booking.lateDays > 0);
  return {
    lateBookings: late.length,
    totalLateDays: late.reduce((sum, booking) => sum + booking.lateDays, 0),
    lateFeesCharged: round2(late.reduce((sum, booking) => sum + booking.lateFee, 0)),
    lateRate: returned.length > 0 ? late.length / returned.length : 0,
  };
}

export type CustomerRank = {
  customer: Customer;
  bookings: number;
  revenue: number;
  outstanding: number;
};

export function customerRanking(
  customers: Customer[],
  bookings: Booking[],
  settings: RentalSettings
): CustomerRank[] {
  const byCustomer = new Map<string, { bookings: number; revenue: number; outstanding: number }>();
  for (const booking of realisedBookings(bookings)) {
    const row = byCustomer.get(booking.customerId) ?? {
      bookings: 0,
      revenue: 0,
      outstanding: 0,
    };
    row.bookings += 1;
    row.revenue = round2(row.revenue + bookingTotals(booking, settings).total);
    row.outstanding = round2(row.outstanding + Math.max(0, booking.finalPayable));
    byCustomer.set(booking.customerId, row);
  }

  return customers
    .map((customer) => ({
      customer,
      ...(byCustomer.get(customer.id) ?? { bookings: 0, revenue: 0, outstanding: 0 }),
    }))
    .filter((row) => row.bookings > 0)
    .sort((a, b) => b.revenue - a.revenue);
}

export type TradeSplit = { trade: number; retail: number; tradeRevenue: number; retailRevenue: number };

export function tradeVsRetail(
  customers: Customer[],
  bookings: Booking[],
  settings: RentalSettings
): TradeSplit {
  const tradeIds = new Set(customers.filter((c) => c.isTrade).map((c) => c.id));
  const split: TradeSplit = { trade: 0, retail: 0, tradeRevenue: 0, retailRevenue: 0 };

  for (const booking of realisedBookings(bookings)) {
    const revenue = bookingTotals(booking, settings).total;
    if (tradeIds.has(booking.customerId)) {
      split.trade += 1;
      split.tradeRevenue = round2(split.tradeRevenue + revenue);
    } else {
      split.retail += 1;
      split.retailRevenue = round2(split.retailRevenue + revenue);
    }
  }
  return split;
}

export type MaintenanceSpend = { item: RentalItem | undefined; entries: number; cost: number };

export function maintenanceByItem(
  logs: MaintenanceLog[],
  itemById: Map<string, RentalItem>,
  period: Period
): MaintenanceSpend[] {
  const byItem = new Map<string, { entries: number; cost: number }>();
  for (const log of logs) {
    if (log.date < period.from || log.date > period.to) continue;
    const row = byItem.get(log.itemId) ?? { entries: 0, cost: 0 };
    row.entries += 1;
    row.cost = round2(row.cost + log.cost);
    byItem.set(log.itemId, row);
  }
  return [...byItem.entries()]
    .map(([itemId, row]) => ({ item: itemById.get(itemId), ...row }))
    .sort((a, b) => b.cost - a.cost);
}

/** Deposits sitting with the business right now, per booking. */
export function depositRegister(bookings: Booking[]): Booking[] {
  return bookings.filter(isDepositHeld).sort((a, b) => a.toDate.localeCompare(b.toDate));
}

/** Bookings holding stock on a given day — what the Today screen counts. */
export function committingOn(bookings: Booking[], date: string, bufferDays: number): Booking[] {
  return bookings.filter(
    (booking) =>
      COMMITTING_STATUSES.includes(booking.status) &&
      booking.fromDate <= date &&
      commitmentEnd(booking, bufferDays, date) >= date
  );
}
