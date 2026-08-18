// Table bookings, and the WhatsApp messages that go with them.
//
// Two things here are worth stating up front.
//
// A booking holds a *window*, not an instant. A 7:30 table for two hours means
// nobody else can be promised that table until 9:30, so double-booking is an
// overlap test rather than an equality test — the bug that ships otherwise is
// two families arriving at 7:30 and 8:00 for the same table.
//
// Messages are built here, not in a component, because the phone number
// handling is the part that quietly fails: wa.me needs a country code, and a
// counter types ten digits. A confirmation that opens an empty chat looks like
// it worked right up until the guest never hears from you.

import { formatPaise } from "./money";
import {
  ACTIVE_RESERVATION_STATUSES,
  type DineReservation,
  type ReservationStatus,
} from "./types";

export type ReservationWindow = { start: number; end: number };

/** Start and end of a booking, in epoch milliseconds. */
export function windowOf(
  reservation: Pick<DineReservation, "startsAt" | "durationMinutes">
): ReservationWindow {
  const start = new Date(reservation.startsAt).getTime();
  const minutes = Math.max(reservation.durationMinutes, 0);
  return { start, end: start + minutes * 60_000 };
}

/** Half-open overlap: a booking ending at 9:30 does not clash with 9:30. */
export function windowsOverlap(a: ReservationWindow, b: ReservationWindow): boolean {
  if (Number.isNaN(a.start) || Number.isNaN(b.start)) return false;
  return a.start < b.end && b.start < a.end;
}

export function isActive(status: ReservationStatus): boolean {
  return ACTIVE_RESERVATION_STATUSES.includes(status);
}

/**
 * Bookings that would clash with this one: same table, overlapping window,
 * both still holding it.
 *
 * A booking with no table cannot clash — "any table at 8" is a promise the
 * floor resolves on the night, and refusing it here would stop a restaurant
 * taking bookings it can honour.
 */
export function conflictsFor(
  candidate: Pick<DineReservation, "id" | "tableId" | "startsAt" | "durationMinutes">,
  all: DineReservation[]
): DineReservation[] {
  if (!candidate.tableId) return [];
  const mine = windowOf(candidate);
  return all.filter(
    (other) =>
      other.id !== candidate.id &&
      other.tableId === candidate.tableId &&
      isActive(other.status) &&
      windowsOverlap(mine, windowOf(other))
  );
}

/** Still-to-come bookings inside the next N minutes, soonest first. */
export function upcoming(
  reservations: DineReservation[],
  now: number,
  withinMinutes: number
): DineReservation[] {
  const horizon = now + withinMinutes * 60_000;
  return reservations
    .filter((row) => row.status === "booked")
    .filter((row) => {
      const { start } = windowOf(row);
      return !Number.isNaN(start) && start <= horizon;
    })
    .sort((a, b) => windowOf(a).start - windowOf(b).start);
}

/**
 * Bookings holding a given table right now, or about to.
 *
 * `holdMinutes` is the grace either side: a table starts showing as reserved
 * that long before the booking, and a party that has not arrived is flagged
 * late that long after — so a free table with a 7:30 booking stops taking
 * walk-ins at 7:00 and is released again at 8:00 if nobody comes.
 */
export function holdingTable(
  reservations: DineReservation[],
  tableId: string,
  now: number,
  holdMinutes: number
): DineReservation | null {
  const grace = holdMinutes * 60_000;
  const candidates = reservations
    .filter((row) => row.tableId === tableId && row.status === "booked")
    .filter((row) => {
      const { start, end } = windowOf(row);
      return !Number.isNaN(start) && now >= start - grace && now <= end;
    })
    .sort((a, b) => windowOf(a).start - windowOf(b).start);
  return candidates[0] ?? null;
}

/** A booked party who has not been seated by their grace period. */
export function isLate(
  reservation: Pick<DineReservation, "status" | "startsAt" | "durationMinutes">,
  now: number,
  holdMinutes: number
): boolean {
  if (reservation.status !== "booked") return false;
  const { start } = windowOf(reservation);
  if (Number.isNaN(start)) return false;
  return now > start + holdMinutes * 60_000;
}

/** Advance still to collect on a booking, in paise. */
export function depositDue(
  reservation: Pick<DineReservation, "depositRequired" | "depositPaid">
): number {
  return Math.max(reservation.depositRequired - reservation.depositPaid, 0);
}

/** A booking asks for money up front. The alternative is simply a free one. */
export function isPaidBooking(reservation: Pick<DineReservation, "depositRequired">): boolean {
  return reservation.depositRequired > 0;
}

// ---------------------------------------------------------------------------
// WhatsApp
// ---------------------------------------------------------------------------

/**
 * A phone number wa.me will accept: digits only, with a country code.
 *
 * Handles what people actually type at a counter — "98765 43210",
 * "+91 98765-43210", "098765 43210". A leading 0 is a domestic trunk prefix
 * and is dropped before the dial code goes on. Anything already long enough to
 * carry a country code is left as it is, because guessing twice is worse than
 * not guessing: prefixing 91 onto a number that starts with 44 sends the
 * message nowhere.
 *
 * Returns "" when there is nothing usable, so callers can hide the button
 * rather than open a broken chat.
 */
export function normalizePhone(raw: string, dialCode: string): string {
  const plus = raw.trim().startsWith("+");
  let digits = raw.replace(/\D/g, "");
  if (!digits) return "";

  const code = dialCode.replace(/\D/g, "");

  // "+91 98765 43210" already carries its country code.
  if (plus) return digits;
  if (code && digits.startsWith(code) && digits.length > code.length + 6) return digits;

  if (digits.startsWith("0")) digits = digits.replace(/^0+/, "");
  if (!digits) return "";
  return code ? `${code}${digits}` : digits;
}

export function whatsappUrl(phone: string, message: string, dialCode: string): string {
  const to = normalizePhone(phone, dialCode);
  const text = encodeURIComponent(message);
  return to ? `https://wa.me/${to}?text=${text}` : `https://wa.me/?text=${text}`;
}

/** How a booking's time reads to a guest: "Sat 14 Mar, 7:30 pm". */
export function formatSlot(startsAt: string): string {
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

type MessageInput = {
  businessName: string;
  reservation: DineReservation;
  currency: string;
  /** Included on a confirmation so a guest can find the place. */
  address?: string;
  phone?: string;
  upiId?: string;
};

/**
 * The message sent when a booking is taken.
 *
 * It has to survive being read on a phone in a hurry, so the slot and the
 * party size come first, and money is only mentioned when there is money —
 * a free booking that talks about deposits reads as a trick.
 */
export function confirmationMessage({
  businessName,
  reservation,
  currency,
  address,
  phone,
  upiId,
}: MessageInput): string {
  const lines = [
    `Namaste ${reservation.guestName || "ji"}, your table at ${businessName} is booked.`,
    "",
    `📅 ${formatSlot(reservation.startsAt)}`,
    `👥 ${reservation.partySize} ${reservation.partySize === 1 ? "guest" : "guests"}`,
  ];
  if (reservation.tableName) {
    lines.push(`🪑 ${reservation.tableName}${reservation.areaName ? ` · ${reservation.areaName}` : ""}`);
  }
  if (reservation.occasion) lines.push(`🎉 ${reservation.occasion}`);

  if (reservation.depositPaid > 0) {
    lines.push(
      "",
      `Advance received: ${formatPaise(reservation.depositPaid, currency)} — it comes off your final bill.`
    );
  }
  const due = depositDue(reservation);
  if (due > 0) {
    lines.push("", `Advance to confirm: ${formatPaise(due, currency)}.`);
    if (upiId) lines.push(`Pay by UPI to ${upiId} and we will hold the table.`);
  }

  if (reservation.note) lines.push("", `Note: ${reservation.note}`);
  if (address) lines.push("", `📍 ${address}`);
  if (phone) lines.push(`📞 ${phone}`);
  lines.push("", "See you soon!");
  return lines.join("\n");
}

/** A nudge on the day. Short on purpose — it is read at a glance. */
export function reminderMessage({ businessName, reservation }: MessageInput): string {
  return [
    `Namaste ${reservation.guestName || "ji"}, just a reminder about your table at ${businessName}.`,
    "",
    `📅 ${formatSlot(reservation.startsAt)}`,
    `👥 ${reservation.partySize} ${reservation.partySize === 1 ? "guest" : "guests"}`,
    "",
    "Please let us know if your plans change. See you soon!",
  ].join("\n");
}

/**
 * Sent when the restaurant cancels, or confirms a guest's cancellation.
 *
 * Says what happens to any advance, because that is the only question the
 * guest actually has.
 */
export function cancellationMessage({
  businessName,
  reservation,
  currency,
}: MessageInput): string {
  const lines = [
    `Namaste ${reservation.guestName || "ji"}, your booking at ${businessName} for ${formatSlot(
      reservation.startsAt
    )} has been cancelled.`,
  ];
  if (reservation.cancelReason) lines.push("", reservation.cancelReason);
  if (reservation.depositPaid > 0) {
    lines.push(
      "",
      reservation.depositOutcome === "refunded"
        ? `Your advance of ${formatPaise(reservation.depositPaid, currency)} is being refunded.`
        : `Your advance of ${formatPaise(reservation.depositPaid, currency)} is held against a future visit.`
    );
  }
  lines.push("", "We hope to see you another time.");
  return lines.join("\n");
}
