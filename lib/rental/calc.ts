// The money. Rent, deposits, late fees, damage, loss and what is left at the
// end of it.
//
// Rental settlement is where the margin in this trade is won or lost, and it is
// the part every free tool skips. The rules are stated here once and read
// everywhere — the return screen, the printed settlement note, the reports and
// the shared link all call these functions rather than each doing the sum their
// own way, because three subtly different answers to "what do they owe" is
// worse than one wrong one.

import {
  daysBetween,
  fromDateKey,
  type Booking,
  type BookingLine,
  type RateBasis,
  type RentalItem,
  type RentalSettings,
  todayKey,
} from "./types";

export function round2(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

/**
 * How many days/hours/events a line is charged for.
 *
 * Per-day is the window plus the return day when the owner charges for it —
 * a Saturday-to-Sunday hire is two days in most tent houses and one in some,
 * so it is a setting rather than an opinion. Never less than one: a booking
 * that goes out and comes back the same day is still a day's hire.
 *
 * Per-hour reads the clock fields and rounds up, because nobody bills 4.3
 * hours. Per-event charges once regardless of how long it runs.
 */
export function chargeableUnitsFor(
  basis: RateBasis,
  window: { fromDate: string; toDate: string; fromTime: string; toTime: string },
  settings: Pick<RentalSettings, "countReturnDay">
): number {
  if (basis === "per-event") return 1;

  if (basis === "per-hour") {
    const from = withTime(window.fromDate, window.fromTime || "00:00");
    const to = withTime(window.toDate || window.fromDate, window.toTime || "00:00");
    const hours = (to.getTime() - from.getTime()) / 3_600_000;
    return Math.max(1, Math.ceil(hours));
  }

  const span = daysBetween(window.fromDate, window.toDate || window.fromDate);
  return Math.max(1, span + (settings.countReturnDay ? 1 : 0));
}

function withTime(dateKey: string, time: string): Date {
  const date = fromDateKey(dateKey);
  const [hours, minutes] = (time || "00:00").split(":").map(Number);
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date;
}

export function lineAmount(line: Pick<BookingLine, "quantity" | "rate" | "chargeableUnits">): number {
  return round2(line.quantity * line.rate * line.chargeableUnits);
}

/** Rebuild a line's chargeable units and amount against the booking's window. */
export function recalcLine(
  line: BookingLine,
  window: { fromDate: string; toDate: string; fromTime: string; toTime: string },
  settings: Pick<RentalSettings, "countReturnDay">
): BookingLine {
  const chargeableUnits = chargeableUnitsFor(line.rateBasis, window, settings);
  const next = { ...line, chargeableUnits };
  return { ...next, amount: lineAmount(next) };
}

export type BookingTotals = {
  subtotal: number;
  transportCharge: number;
  labourCharge: number;
  discount: number;
  taxableBase: number;
  taxAmount: number;
  /** Rent + charges + tax. What the hire itself costs. */
  total: number;
  /** Refundable, never taxed, and not part of `total`. */
  depositTotal: number;
};

/**
 * Booking totals.
 *
 * Transport and labour are part of what is being sold, so they are taxed with
 * the rent; the discount comes off before tax; the deposit is not a sale at all
 * and never attracts tax. It is also kept out of `total` deliberately — a
 * booking's value in every report is the hire, not the hire plus money that is
 * going to be handed back.
 */
export function bookingTotals(
  booking: Pick<
    Booking,
    "lines" | "transportCharge" | "labourCharge" | "discount" | "taxRate"
  >,
  settings: Pick<RentalSettings, "taxEnabled">
): BookingTotals {
  const subtotal = round2(booking.lines.reduce((sum, line) => sum + line.amount, 0));
  const depositTotal = round2(
    booking.lines.reduce((sum, line) => sum + line.quantity * line.depositPerUnit, 0)
  );
  const taxableBase = Math.max(
    0,
    round2(subtotal + booking.transportCharge + booking.labourCharge - booking.discount)
  );
  const taxAmount = settings.taxEnabled ? round2((taxableBase * booking.taxRate) / 100) : 0;

  return {
    subtotal,
    transportCharge: booking.transportCharge,
    labourCharge: booking.labourCharge,
    discount: booking.discount,
    taxableBase,
    taxAmount,
    total: round2(taxableBase + taxAmount),
    depositTotal,
  };
}

/**
 * Days late.
 *
 * Against the agreed return date, floored at zero, and counted to today while
 * the stock is still out — that is what makes the Today screen's overdue figure
 * tick up on its own rather than only becoming true once someone finally
 * settles the booking.
 */
export function lateDaysFor(booking: Booking, today = todayKey()): number {
  if (!booking.toDate) return 0;
  if (booking.status === "cancelled" || booking.status === "enquiry") return 0;
  const end = booking.actualReturnedOn ?? (booking.status === "dispatched" ? today : null);
  if (!end) return 0;
  return Math.max(0, daysBetween(booking.toDate, end));
}

/**
 * Late fee.
 *
 * Per item because a day's delay on a marquee is not a day's delay on a chair.
 * The flat basis exists for the owner who charges "₹500 a day, whatever it is"
 * and does not want to maintain a per-item figure.
 */
export function lateFeeFor(
  booking: Booking,
  lateDays: number,
  settings: Pick<RentalSettings, "defaultLateFeeBasis" | "fixedLateFeePerDay">,
  itemById: Map<string, RentalItem>
): number {
  if (lateDays <= 0) return 0;
  if (settings.defaultLateFeeBasis === "fixed") {
    return round2(settings.fixedLateFeePerDay * lateDays);
  }
  const perDay = booking.lines.reduce((sum, line) => {
    const item = itemById.get(line.itemId);
    return sum + line.quantity * (item?.lateFeePerUnitPerDay ?? 0);
  }, 0);
  return round2(perDay * lateDays);
}

/** Loss defaults to what the unit costs to replace. */
export function defaultLossCharge(lostQuantity: number, item: RentalItem | undefined): number {
  return round2(lostQuantity * (item?.replacementValue ?? 0));
}

/** Damage defaults to a share of replacement value, chosen at return. */
export function damageChargeFor(
  damagedQuantity: number,
  percent: number,
  item: RentalItem | undefined
): number {
  return round2((damagedQuantity * (item?.replacementValue ?? 0) * percent) / 100);
}

export type Settlement = {
  /** The hire itself. */
  total: number;
  lateDays: number;
  lateFee: number;
  damageTotal: number;
  lossTotal: number;
  /** Everything the customer owes before any money is counted. */
  charges: number;
  /** Money already received against those charges — advance and part payments. */
  paidTowardsCharges: number;
  /** Charges still outstanding once payments are counted, before the deposit. */
  outstanding: number;
  depositTotal: number;
  /** Deposit left after outstanding charges are taken out of it. */
  depositRefunded: number;
  /**
   * What the customer still has to hand over after the deposit is applied.
   * Zero when the deposit covered everything.
   */
  finalPayable: number;
};

/**
 * The settlement.
 *
 * The order matters and is the one thing the spec left open, so it is fixed
 * here: charges are added up, money already taken is subtracted, and the
 * deposit is applied to whatever is left. What remains of the deposit is
 * refunded; if the charges ate the whole deposit, the balance is payable. A
 * deposit is never refunded while charges are outstanding, and never counted
 * as revenue.
 *
 *   charges     = total + lateFee + damage + loss
 *   outstanding = charges − advance and part payments
 *   refund      = max(0, deposit − outstanding)
 *   payable     = max(0, outstanding − deposit)
 */
export function settleBooking(
  booking: Booking,
  settings: Pick<
    RentalSettings,
    "defaultLateFeeBasis" | "fixedLateFeePerDay" | "taxEnabled"
  >,
  itemById: Map<string, RentalItem>,
  today = todayKey()
): Settlement {
  const totals = bookingTotals(booking, settings);
  const lateDays = lateDaysFor(booking, today);
  const lateFee = lateFeeFor(booking, lateDays, settings, itemById);
  const damageTotal = round2(booking.lines.reduce((sum, line) => sum + line.damageCharge, 0));
  const lossTotal = round2(booking.lines.reduce((sum, line) => sum + line.lossCharge, 0));

  const charges = round2(totals.total + lateFee + damageTotal + lossTotal);
  const paidTowardsCharges = round2(
    booking.payments
      .filter((payment) => payment.kind === "advance" || payment.kind === "settlement")
      .reduce((sum, payment) => sum + payment.amount, 0)
  );
  const outstanding = round2(charges - paidTowardsCharges);
  const depositTotal = totals.depositTotal;

  return {
    total: totals.total,
    lateDays,
    lateFee,
    damageTotal,
    lossTotal,
    charges,
    paidTowardsCharges,
    outstanding,
    depositTotal,
    depositRefunded: round2(Math.max(0, depositTotal - Math.max(0, outstanding))),
    finalPayable: round2(Math.max(0, outstanding - depositTotal)),
  };
}

/** Balance still due on a live booking, before it reaches settlement. */
export function balanceDue(
  booking: Booking,
  settings: Pick<RentalSettings, "taxEnabled">
): number {
  const totals = bookingTotals(booking, settings);
  const paid = booking.payments
    .filter((payment) => payment.kind === "advance" || payment.kind === "settlement")
    .reduce((sum, payment) => sum + payment.amount, 0);
  return round2(totals.total - paid);
}

/**
 * Deposits the business is currently holding — money that is not its own.
 *
 * Held from dispatch until the return is settled, and not a moment longer: once
 * the settlement has run, that money has either gone back to the customer or
 * been eaten by the charges, and either way it is no longer a liability sitting
 * in the till.
 */
export function isDepositHeld(booking: Booking): boolean {
  if (booking.depositTotal <= 0) return false;
  if (booking.status === "dispatched") return true;
  return booking.status === "returned" && !booking.actualReturnedOn;
}

export function depositsHeld(bookings: Booking[]): number {
  return round2(
    bookings.filter(isDepositHeld).reduce((sum, booking) => sum + booking.depositTotal, 0)
  );
}

/** Money actually received on a given day, across every booking. */
export function collectionsOn(bookings: Booking[], date: string): number {
  return round2(
    bookings.reduce(
      (sum, booking) =>
        sum +
        booking.payments
          .filter((payment) => payment.date === date)
          .reduce(
            (inner, payment) =>
              inner + (payment.kind === "refund" ? -payment.amount : payment.amount),
            0
          ),
      0
    )
  );
}

/** Rupees of stock on rent right now, valued at what it would cost to replace. */
export function valueOnRent(bookings: Booking[], itemById: Map<string, RentalItem>): number {
  return round2(
    bookings
      .filter((booking) => booking.status === "dispatched")
      .reduce(
        (sum, booking) =>
          sum +
          booking.lines.reduce((inner, line) => {
            const item = itemById.get(line.itemId);
            return inner + line.quantity * (item?.replacementValue ?? 0);
          }, 0),
        0
      )
  );
}

/** Units physically out on hire right now. */
export function itemsOut(bookings: Booking[]): number {
  return bookings
    .filter((booking) => booking.status === "dispatched")
    .reduce(
      (sum, booking) => sum + booking.lines.reduce((inner, line) => inner + line.quantity, 0),
      0
    );
}
