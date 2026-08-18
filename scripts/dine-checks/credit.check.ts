// Credit (udhaar) read out of the shared Customer Ledger.
//
// Free Dine stores no balance of its own — what a diner owes is the sum of
// their entries in the workspace ledger, the same book the Browser Based POS
// and the Customer Ledger tool use. Two things about that boundary are easy to
// get wrong and impossible to see: the ledger speaks rupees while Free Dine
// speaks paise, and the ledger signs a debt with `type` rather than with a
// negative amount. Both are checked here.

import {
  balanceOf,
  balancesByCustomer,
  billLedgerEntry,
  depositLedgerEntry,
  ledgerAmountOf,
  oldestUnpaidDays,
  toPaiseFromLedger,
  totalOutstanding,
} from "../../lib/dine/credit";
import { toPaise } from "../../lib/dine/money";
import type { LedgerEntry } from "../../lib/toolkit/types";

let pass = 0, fail = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : ` — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
};

console.log("\ncustomer credit (shared ledger)\n");

let clock = 0;
const entry = (
  type: "credit" | "payment",
  rupees: number,
  over: Partial<LedgerEntry> = {}
): LedgerEntry => {
  clock += 1;
  return {
    id: `e${clock}`,
    customerId: "c1",
    customerName: "Sharma ji",
    type,
    amount: rupees,
    note: "",
    date: `2026-03-0${clock}`,
    createdByTool: "free-dine",
    createdAt: `2026-03-0${clock}T12:00:00.000Z`,
    ...over,
  };
};

// --- The units boundary ---
eq("paise become the rupees the ledger speaks", ledgerAmountOf(toPaise(1500)), 1500);
eq("a fifty-paise amount survives the trip", ledgerAmountOf(toPaise(12.5)), 12.5);
eq("and comes back as paise", toPaiseFromLedger(12.5), 1250);
eq("round-trips exactly", toPaiseFromLedger(ledgerAmountOf(toPaise(1234.56))), toPaise(1234.56));

// --- The sign convention is the ledger's, not ours ---
const book = [entry("credit", 1200), entry("credit", 800), entry("payment", 500)];
eq("credit adds to what they owe, payment takes away", balanceOf(book, "c1"), toPaise(1500));
eq("another diner's entries are not counted", balanceOf(book, "c2"), 0);
eq("an empty ledger owes nothing", balanceOf([], "c1"), 0);

// --- Totals across the book ---
const shared = [
  entry("credit", 1500, { customerId: "a" }),
  entry("credit", 400, { customerId: "b" }),
  entry("payment", 400, { customerId: "b" }),
  // Someone in credit must not cancel out another diner's debt.
  entry("payment", 300, { customerId: "c" }),
];
eq("balances are per diner", balancesByCustomer(shared).get("a"), toPaise(1500));
eq("a settled diner is at zero", balancesByCustomer(shared).get("b"), 0);
eq("an overpaid diner goes negative", balancesByCustomer(shared).get("c"), -toPaise(300));
eq("only debts count towards what is owed", totalOutstanding(shared), toPaise(1500));
eq("nothing owed is nothing outstanding", totalOutstanding([]), 0);

// --- Ageing: payments settle the oldest charge first ---
clock = 0;
const aged = [
  entry("credit", 1000, { createdAt: "2026-03-01T12:00:00.000Z" }),
  entry("credit", 500, { createdAt: "2026-03-10T12:00:00.000Z" }),
];
const now = new Date("2026-03-20T12:00:00.000Z");
eq("the oldest unpaid charge is the first one", oldestUnpaidDays(aged, "c1", now), 19);

const covered = [...aged, entry("payment", 1000, { createdAt: "2026-03-15T12:00:00.000Z" })];
eq(
  "a payment covering the first charge ages from the second",
  oldestUnpaidDays(covered, "c1", now),
  10
);
const cleared = [...aged, entry("payment", 1500, { createdAt: "2026-03-15T12:00:00.000Z" })];
eq("nothing owed has no age", oldestUnpaidDays(cleared, "c1", now), null);
eq("an empty ledger has no age", oldestUnpaidDays([], "c1", now), null);

const partial = [
  entry("credit", 1000, { createdAt: "2026-03-01T12:00:00.000Z" }),
  entry("payment", 400, { createdAt: "2026-03-05T12:00:00.000Z" }),
];
eq("a part-payment does not reset the clock", oldestUnpaidDays(partial, "c1", now), 19);

// --- What Free Dine writes into the shared book ---
const bill = billLedgerEntry({
  customerId: "c1",
  customerName: "Sharma ji",
  amountPaise: toPaise(432.5),
  billLabel: "BILL-0007",
});
eq("a bill on account is a credit entry", bill.type, "credit");
eq("carried across in rupees", bill.amount, 432.5);
eq("stamped as Free Dine's, so the Ledger can say where it came from", bill.createdByTool, "free-dine");
eq("and traceable back to the meal", bill.note.includes("BILL-0007"), true);
eq("dated for the day sheet", bill.date, bill.createdAt.slice(0, 10));

const deposit = depositLedgerEntry({
  customerId: "c1",
  customerName: "Sharma ji",
  amountPaise: toPaise(500),
  when: "Sat 14 Mar, 7:30 pm",
});
eq("an advance on account is also a credit entry", deposit.type, "credit");
eq("and says which booking it was for", deposit.note.includes("Sat 14 Mar"), true);

// A round trip through the ledger's own arithmetic must land back on the bill.
eq(
  "an entry Free Dine wrote reads back at the same amount",
  balanceOf([bill], "c1"),
  toPaise(432.5)
);

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
