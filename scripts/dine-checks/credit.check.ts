// Customer credit — the khata.
//
// The invariant worth guarding at build time is that a diner's stored balance
// is always the sum of their ledger. Everything else here follows from it: a
// limit that warns rather than blocks, payments applied oldest-first, and a
// running total that survives part-payments and over-payments.

import {
  creditReminderMessage,
  entriesFor,
  headroom,
  ledgerBalance,
  oldestUnpaidDays,
  overLimitBy,
  totalOutstanding,
  withOutstanding,
} from "../../lib/dine/credit";
import { toPaise } from "../../lib/dine/money";
import type { DineCreditEntry, DineCustomer } from "../../lib/dine/types";

let pass = 0, fail = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : ` — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
};

console.log("\ncustomer credit\n");

const diner = (over: Partial<DineCustomer> = {}): DineCustomer => ({
  id: "c1",
  name: "Sharma ji",
  phone: "9876543210",
  email: "",
  address: "",
  notes: "",
  createdAt: "2026-01-01T00:00:00.000Z",
  creditAllowed: true,
  creditLimit: 0,
  creditBalance: 0,
  ...over,
});

let clock = 0;
const entry = (change: number, over: Partial<DineCreditEntry> = {}): DineCreditEntry => {
  clock += 1;
  return {
    id: `e${clock}`,
    customerId: "c1",
    customerName: "Sharma ji",
    reason: change > 0 ? "bill" : "settlement",
    change,
    billId: null,
    billLabel: "",
    methodId: "",
    methodName: "",
    note: "",
    businessDate: "2026-03-01",
    createdAt: `2026-03-0${clock}T12:00:00.000Z`,
    ...over,
  };
};

// --- The balance is the ledger ---
const ledger = [entry(toPaise(1200)), entry(toPaise(800)), entry(-toPaise(500))];
eq("balance is the sum of the entries", ledgerBalance(ledger, "c1"), toPaise(1500));
eq("another diner's entries are not counted", ledgerBalance(ledger, "c2"), 0);

// --- Limits warn, they do not block ---
eq("no limit means no ceiling", headroom(diner({ creditBalance: toPaise(9000) })), null);
eq("no limit is never over", overLimitBy(diner({ creditBalance: toPaise(9000) }), toPaise(5000)), 0);

const capped = diner({ creditLimit: toPaise(2000), creditBalance: toPaise(1500) });
eq("headroom is what is left of the limit", headroom(capped), toPaise(500));
eq("a charge that fits is not over", overLimitBy(capped, toPaise(500)), 0);
eq("a charge that does not fit reports the excess", overLimitBy(capped, toPaise(800)), toPaise(300));
eq(
  "already past the limit still reports only the excess of this charge",
  overLimitBy(diner({ creditLimit: toPaise(1000), creditBalance: toPaise(1500) }), toPaise(200)),
  toPaise(700)
);

// --- Totals ---
const book = [
  diner({ id: "a", creditBalance: toPaise(1500) }),
  diner({ id: "b", creditBalance: 0 }),
  // A diner in credit (they overpaid) must not cancel out someone else's debt.
  diner({ id: "c", creditBalance: -toPaise(300) }),
];
eq("only debts count towards what is owed", totalOutstanding(book), toPaise(1500));
eq("the outstanding list skips the settled", withOutstanding(book).map((row) => row.id), ["a"]);

// --- Ageing: payments settle the oldest charge first ---
clock = 0;
const aged = [
  entry(toPaise(1000), { createdAt: "2026-03-01T12:00:00.000Z" }),
  entry(toPaise(500), { createdAt: "2026-03-10T12:00:00.000Z" }),
];
const now = new Date("2026-03-20T12:00:00.000Z");
eq("oldest unpaid charge is the first one", oldestUnpaidDays(aged, "c1", now), 19);

const partlyPaid = [...aged, entry(-toPaise(1000), { createdAt: "2026-03-15T12:00:00.000Z" })];
eq(
  "a payment covering the first charge ages from the second",
  oldestUnpaidDays(partlyPaid, "c1", now),
  10
);

const settled = [...aged, entry(-toPaise(1500), { createdAt: "2026-03-15T12:00:00.000Z" })];
eq("nothing owed has no age", oldestUnpaidDays(settled, "c1", now), null);
eq("an empty ledger has no age", oldestUnpaidDays([], "c1", now), null);

// A part-payment that does not clear the oldest charge leaves it the oldest.
const partial = [
  entry(toPaise(1000), { createdAt: "2026-03-01T12:00:00.000Z" }),
  entry(-toPaise(400), { createdAt: "2026-03-05T12:00:00.000Z" }),
];
eq("a part-payment does not reset the clock", oldestUnpaidDays(partial, "c1", now), 19);

// --- History reads newest first ---
eq(
  "history is newest first",
  entriesFor(aged, "c1").map((row) => row.createdAt),
  ["2026-03-10T12:00:00.000Z", "2026-03-01T12:00:00.000Z"]
);

// --- The reminder says what is owed, and never threatens ---
const message = creditReminderMessage({
  businessName: "Anand Bhavan",
  guestName: "Sharma ji",
  balance: "₹1,500.00",
  days: 19,
  upiId: "anand@upi",
});
eq("the reminder names the diner", message.includes("Sharma ji"), true);
eq("the reminder carries the amount", message.includes("₹1,500.00"), true);
eq("the reminder offers a way to pay", message.includes("anand@upi"), true);
eq(
  "with no UPI it still gives them an out",
  creditReminderMessage({
    businessName: "Anand Bhavan",
    guestName: "Sharma ji",
    balance: "₹1,500.00",
    days: null,
  }).includes("next visit"),
  true
);

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
