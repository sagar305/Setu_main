// Bill arithmetic.
//
// These numbers go on a GST invoice, so "close enough" is not a category that
// exists here. The figures below were worked out by hand first; if a change
// makes one of them move, the change is wrong until proven otherwise.

import { computeTotals, splitTotalsByAmounts, equalShares } from "../../lib/dine/calc";
import { DEFAULT_DINE_SETTINGS } from "../../lib/dine/types";
import { amountInWords, apportion } from "../../lib/dine/money";

let pass = 0;
let fail = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : ` — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`
  );
};

const settings = {
  ...DEFAULT_DINE_SETTINGS,
  taxEnabled: true,
  serviceChargeRate: 10,
  serviceChargeTaxRate: 5,
};

// A mixed bill: one tax-exclusive line, one tax-inclusive line, a 10% discount
// and a 10% service charge. Hand-calculated in paise:
//   subtotal 41000, discount 4100, service 3690, service tax 185,
//   added tax 900 + 185, included tax 900, total 41675.
const lines = [
  { id: "a", gross: 20000, taxRate: 5, taxInclusive: false, quantity: 2 },
  { id: "b", gross: 21000, taxRate: 5, taxInclusive: true, quantity: 1 },
];
const totals = computeTotals(lines, {
  discountType: "percent",
  discountValue: 10,
  serviceChargeOn: true,
  settings,
});

eq("subtotal", totals.subtotal, 41000);
eq("discount", totals.discountAmount, 4100);
eq("service charge on the discounted subtotal", totals.serviceCharge, 3690);
eq("service charge is itself taxed", totals.serviceChargeTax, 185);
eq("tax added on top", totals.addedTax, 1085);
eq("tax already inside inclusive prices", totals.includedTax, 900);
eq("total", totals.total, 41675);
eq("GST slab breakup", totals.taxBreakup, [
  { rate: 5, taxable: 39690, cgst: 992, sgst: 993 },
]);
eq(
  "the bill's own arithmetic balances",
  totals.subtotal - totals.discountAmount + totals.serviceCharge + totals.addedTax,
  totals.total
);

// Splitting must not invent or lose a paisa, and each printed part must add up
// on its own — a guest will check.
const shares = equalShares(totals.total, 2);
eq("equal shares sum back to the bill", shares[0] + shares[1], totals.total);
const parts = splitTotalsByAmounts(totals, shares);
for (const [index, part] of parts.entries()) {
  eq(
    `split part ${index + 1} balances`,
    part.subtotal - part.discountAmount + part.serviceCharge + part.addedTax,
    part.total
  );
  eq(
    `split part ${index + 1} tax breakup matches its tax`,
    part.taxBreakup.reduce((sum, slab) => sum + slab.cgst + slab.sgst, 0),
    part.addedTax + part.includedTax
  );
}
eq(
  "split parts sum back to the bill",
  parts.reduce((sum, part) => sum + part.total, 0),
  totals.total
);

eq("three-way split of an odd amount", equalShares(100001, 3), [33334, 33334, 33333]);
eq("apportioning never loses a unit", apportion(100, [1, 1, 1]), [34, 33, 33]);
eq("apportioning by weight", apportion(7, [3, 3, 1]), [3, 3, 1]);

eq("amount in words", amountInWords(41675), "Rupees Four Hundred Sixteen and Seventy Five Paise Only");
eq(
  "amount in words uses lakh and crore",
  amountInWords(1234567890),
  "Rupees One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight and Ninety Paise Only"
);
eq("amount in words handles zero", amountInWords(0), "Rupees Zero Only");

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
