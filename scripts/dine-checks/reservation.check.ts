// Table bookings.
//
// Two things get checked here because both fail silently in ways a demo never
// shows: overlap (a booking holds a window, not an instant, so 7:30 and 8:00
// on a two-hour table is a double booking) and phone normalisation (a wa.me
// link with no country code opens an empty chat, which looks like it worked).

import {
  conflictsFor,
  confirmationMessage,
  depositDue,
  holdingTable,
  isLate,
  isPaidBooking,
  normalizePhone,
  upcoming,
  whatsappUrl,
  windowOf,
  windowsOverlap,
} from "../../lib/dine/reservation";
import { toPaise } from "../../lib/dine/money";
import type { DineReservation } from "../../lib/dine/types";

let pass = 0, fail = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : ` — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
};

console.log("\ntable bookings\n");

let seq = 0;
const booking = (over: Partial<DineReservation> = {}): DineReservation => {
  seq += 1;
  return {
    id: `r${seq}`,
    customerId: null,
    guestName: "Mehta",
    phone: "9876543210",
    partySize: 4,
    tableId: "t1",
    tableName: "T1",
    areaName: "Ground",
    startsAt: "2026-03-14T19:30:00.000Z",
    durationMinutes: 120,
    status: "booked",
    depositRequired: 0,
    depositPaid: 0,
    depositMethodId: "",
    depositMethodName: "",
    depositPaidAt: null,
    depositOutcome: "",
    ticketId: null,
    occasion: "",
    note: "",
    cancelReason: "",
    businessDate: "2026-03-14",
    createdAt: "2026-03-10T09:00:00.000Z",
    updatedAt: "2026-03-10T09:00:00.000Z",
    ...over,
  };
};

const at = (iso: string) => new Date(iso).getTime();

// --- A booking holds a window ---
const seven30 = windowOf(booking());
eq("a two-hour booking ends two hours later", seven30.end - seven30.start, 120 * 60_000);
eq(
  "overlapping windows clash",
  windowsOverlap(seven30, windowOf(booking({ startsAt: "2026-03-14T20:00:00.000Z" }))),
  true
);
eq(
  "a booking starting exactly as one ends does not clash",
  windowsOverlap(seven30, windowOf(booking({ startsAt: "2026-03-14T21:30:00.000Z" }))),
  false
);

// --- Conflicts ---
const existing = [booking({ id: "r-a" })];
eq(
  "the same table at an overlapping time is a conflict",
  conflictsFor(
    { id: "new", tableId: "t1", startsAt: "2026-03-14T20:00:00.000Z", durationMinutes: 90 },
    existing
  ).map((row) => row.id),
  ["r-a"]
);
eq(
  "a different table is never a conflict",
  conflictsFor(
    { id: "new", tableId: "t2", startsAt: "2026-03-14T20:00:00.000Z", durationMinutes: 90 },
    existing
  ),
  []
);
eq(
  "'any table' cannot clash, because the floor decides on the night",
  conflictsFor(
    { id: "new", tableId: null, startsAt: "2026-03-14T20:00:00.000Z", durationMinutes: 90 },
    existing
  ),
  []
);
eq(
  "a cancelled booking releases the table",
  conflictsFor(
    { id: "new", tableId: "t1", startsAt: "2026-03-14T20:00:00.000Z", durationMinutes: 90 },
    [booking({ id: "r-a", status: "cancelled" })]
  ),
  []
);
eq(
  "editing a booking does not clash with itself",
  conflictsFor(
    { id: "r-a", tableId: "t1", startsAt: "2026-03-14T19:30:00.000Z", durationMinutes: 120 },
    existing
  ),
  []
);

// --- Holding a table, and lateness. One number, used both ways. ---
const hold = 30;
const rows = [booking({ id: "r-h" })];
eq(
  "the table is not held two hours before",
  holdingTable(rows, "t1", at("2026-03-14T17:30:00.000Z"), hold),
  null
);
eq(
  "it is held from the grace period before",
  holdingTable(rows, "t1", at("2026-03-14T19:05:00.000Z"), hold)?.id,
  "r-h"
);
eq(
  "it is released once the window has passed",
  holdingTable(rows, "t1", at("2026-03-14T21:31:00.000Z"), hold),
  null
);
eq("a party is not late during the grace", isLate(booking(), at("2026-03-14T19:50:00.000Z"), hold), false);
eq("a party is late after it", isLate(booking(), at("2026-03-14T20:05:00.000Z"), hold), true);
eq(
  "a seated party is never late",
  isLate(booking({ status: "seated" }), at("2026-03-14T22:00:00.000Z"), hold),
  false
);

// --- What is arriving soon ---
eq(
  "upcoming looks forward from now",
  upcoming(rows, at("2026-03-14T18:30:00.000Z"), 120).map((row) => row.id),
  ["r-h"]
);
eq(
  "and does not reach past the horizon",
  upcoming(rows, at("2026-03-14T16:00:00.000Z"), 60),
  []
);

// --- Deposits: free and paid bookings ---
eq("a booking with no advance is free", isPaidBooking(booking()), false);
eq("one with an advance is not", isPaidBooking(booking({ depositRequired: toPaise(500) })), true);
eq(
  "what is still to collect",
  depositDue(booking({ depositRequired: toPaise(500), depositPaid: toPaise(200) })),
  toPaise(300)
);
eq(
  "over-collecting is never negative",
  depositDue(booking({ depositRequired: toPaise(500), depositPaid: toPaise(800) })),
  0
);

// --- Phone numbers reach WhatsApp ---
eq("a ten-digit number gets the dial code", normalizePhone("9876543210", "91"), "919876543210");
eq("spacing and dashes are ignored", normalizePhone("98765-43210", "91"), "919876543210");
eq("a trunk zero is dropped", normalizePhone("09876543210", "91"), "919876543210");
eq("a number already carrying it is left alone", normalizePhone("919876543210", "91"), "919876543210");
eq("an explicit + is trusted", normalizePhone("+44 7700 900123", "91"), "447700900123");
eq("nothing usable gives nothing", normalizePhone("call the office", "91"), "");
eq(
  "no number opens the chooser rather than a broken chat",
  whatsappUrl("", "hi", "91").startsWith("https://wa.me/?text="),
  true
);
eq(
  "a number goes straight to that chat",
  whatsappUrl("9876543210", "hi", "91"),
  "https://wa.me/919876543210?text=hi"
);

// --- The confirmation says what the guest needs, and only what is true ---
const free = confirmationMessage({
  businessName: "Anand Bhavan",
  reservation: booking(),
  currency: "INR",
});
eq("a free booking never mentions an advance", /advance/i.test(free), false);
eq("it carries the party size", free.includes("4 guests"), true);

const paid = confirmationMessage({
  businessName: "Anand Bhavan",
  reservation: booking({ depositRequired: toPaise(500), depositPaid: toPaise(500) }),
  currency: "INR",
});
eq("a paid booking says the advance comes off the bill", paid.includes("final bill"), true);

const partly = confirmationMessage({
  businessName: "Anand Bhavan",
  reservation: booking({ depositRequired: toPaise(500) }),
  currency: "INR",
  upiId: "anand@upi",
});
eq("an unpaid advance asks for it", partly.includes("Advance to confirm"), true);
eq("and says how to pay", partly.includes("anand@upi"), true);

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
