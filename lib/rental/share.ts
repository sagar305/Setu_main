// Builders for the links this app sends to customers.
//
// A hire is shared three times — as a quote, as a confirmation, and as the
// settled note at the end — and it is the same document each time, so it is one
// shape with a marker saying which moment it is. The whole thing is compressed
// into the fragment of /view, exactly like the invoice and fee receipt: nothing
// is uploaded, and the link keeps working on a phone with no signal.
//
// When the owner has turned auto-shortening on, the share sheet swaps this long
// link for a ten-character one; the payload is identical either way.

import {
  buildShareUrl,
  businessToShare,
  type SharedDoc,
  type SharedRental,
} from "@/lib/toolkit/shareLink";
import type { Business } from "@/lib/pos/types";
import { bookingTotals, settleBooking, type Settlement } from "./calc";
import {
  addDays,
  todayKey,
  type Booking,
  type Customer,
  type RentalItem,
  type RentalSettings,
} from "./types";

export type RentalShareStage = "quote" | "confirmed" | "settled";

/**
 * Which document a booking is at, unless the caller says otherwise.
 *
 * An enquiry is a quote, a settled booking is a settlement, and everything in
 * between is a confirmation — the customer gets the paper that matches where
 * their hire actually is.
 */
export function stageFor(booking: Booking): RentalShareStage {
  if (booking.status === "enquiry") return "quote";
  if (booking.status === "returned" || booking.status === "closed") return "settled";
  return "confirmed";
}

export function rentalDoc(
  business: Business | null,
  booking: Booking,
  customer: Customer | undefined,
  settings: RentalSettings,
  itemById: Map<string, RentalItem>,
  stage: RentalShareStage = stageFor(booking)
): SharedRental {
  const totals = bookingTotals(booking, settings);
  const settlement: Settlement | null =
    stage === "settled" ? settleBooking(booking, settings, itemById) : null;

  return {
    t: "rnt",
    b: businessToShare(business),
    st: stage,
    no: booking.bookingNo,
    dt: booking.createdAt,
    cn: customer?.name || undefined,
    cp: customer?.phone || undefined,
    ev: booking.eventName || undefined,
    vn: booking.venue || undefined,
    fd: booking.fromDate,
    td: booking.toDate,
    ft: booking.fromTime || undefined,
    tt: booking.toTime || undefined,
    // The viewer multiplies quantity by rate, so the rate it is handed is the
    // whole per-unit charge for the hire — five days at ₹20 is ₹100 a chair,
    // not ₹20 with the days hidden somewhere the customer cannot see.
    it: booking.lines.map((line) => ({
      n:
        line.chargeableUnits > 1
          ? `${line.name} · ${line.chargeableUnits} ${unitWord(line.rateBasis, line.chargeableUnits)}`
          : line.name,
      q: line.quantity,
      r: line.rate * line.chargeableUnits,
    })),
    sub: totals.subtotal,
    trn: booking.transportCharge || undefined,
    lab: booking.labourCharge || undefined,
    dis: booking.discount || undefined,
    tax: totals.taxAmount || undefined,
    tot: totals.total,
    dep: totals.depositTotal || undefined,
    adv: booking.paid || undefined,
    ld: settlement?.lateDays || undefined,
    lf: settlement?.lateFee || undefined,
    dmg: settlement?.damageTotal || undefined,
    los: settlement?.lossTotal || undefined,
    ref: settlement?.depositRefunded || undefined,
    due: settlement ? settlement.finalPayable : undefined,
    vu:
      stage === "quote"
        ? addDays(todayKey(), Math.max(1, settings.quotationValidDays))
        : undefined,
    note: booking.note || undefined,
  };
}

function unitWord(basis: RentalItem["rateBasis"], count: number): string {
  if (basis === "per-hour") return count === 1 ? "hour" : "hours";
  if (basis === "per-event") return "event";
  return count === 1 ? "day" : "days";
}

/** Full /view#d=… link. Client-side only — needs window.location.origin. */
export function shareUrlFor(doc: SharedDoc): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return buildShareUrl(doc, origin);
}
