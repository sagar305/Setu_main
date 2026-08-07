// Bill maths for Free Dine. All amounts are paise (see lib/dine/money.ts).
//
// The order of operations is fixed by FR-6.1 and must not be rearranged:
//
//   subtotal → discount → service charge → tax → total
//
// It matters because it changes the number. Charging service on the
// pre-discount subtotal, or taxing before discounting, both produce a bill that
// disagrees with what the guest was told — which on a GST invoice is a
// compliance problem, not a rounding preference.
//
// Service charge is treated as part of the taxable value of the supply, so GST
// applies to it. It is voluntary in India (FR-6.3), which is why it defaults to
// off — but when a restaurant does levy it, it is taxed.

import { apportion, halveTax, percentOf, taxWithin } from "./money";
import {
  effectiveTaxRate,
  isBillable,
  lineTotal,
  lineUnitPrice,
  type DineSettings,
  type DineTaxLine,
  type DineTicketItem,
} from "./types";

/** A ticket line reduced to just what the maths needs. */
export type CalcLine = {
  id: string;
  gross: number;
  taxRate: number;
  taxInclusive: boolean;
  quantity: number;
};

export type CalcLineResult = CalcLine & {
  discount: number;
  net: number;
  /** Tax on this line — added on top, or extracted from within. */
  tax: number;
  /** Value the tax applies to, net of discount and of any tax inside the price. */
  taxable: number;
};

export type DineTotals = {
  subtotal: number;
  discountAmount: number;
  serviceCharge: number;
  serviceChargeTax: number;
  taxBreakup: DineTaxLine[];
  /** Tax added on top of prices (exclusive lines + service charge). */
  addedTax: number;
  /** Tax already inside inclusive prices — shown on the bill, not added to it. */
  includedTax: number;
  total: number;
  itemCount: number;
  lines: CalcLineResult[];
};

export type TotalsInput = {
  discountType: "flat" | "percent";
  discountValue: number;
  serviceChargeOn: boolean;
  settings: DineSettings;
};

/** Turn billable ticket items into calc lines, resolving inherited tax rates. */
export function toCalcLines(items: DineTicketItem[], settings: DineSettings): CalcLine[] {
  return items.filter(isBillable).map((item) => ({
    id: item.id,
    gross: lineTotal(item),
    taxRate: settings.taxEnabled ? effectiveTaxRate(item.taxRate, settings) : 0,
    taxInclusive: item.taxInclusive,
    quantity: item.quantity,
  }));
}

export function computeTotals(lines: CalcLine[], input: TotalsInput): DineTotals {
  const { discountType, discountValue, serviceChargeOn, settings } = input;

  const subtotal = lines.reduce((sum, line) => sum + line.gross, 0);

  // 1. Discount, clamped so it can never exceed the bill or go negative.
  const discountAmount =
    subtotal <= 0
      ? 0
      : discountType === "percent"
        ? percentOf(subtotal, Math.min(Math.max(discountValue, 0), 100))
        : Math.min(Math.max(Math.round(discountValue), 0), subtotal);

  // Spread the discount across lines so each line's tax is calculated on the
  // amount actually charged for it. Largest-remainder keeps the parts summing
  // to the discount exactly.
  const lineDiscounts = apportion(
    discountAmount,
    lines.map((line) => line.gross)
  );

  // 2. Service charge, on the discounted subtotal.
  const netSubtotal = subtotal - discountAmount;
  const serviceChargeRate = serviceChargeOn ? settings.serviceChargeRate : 0;
  const serviceCharge = serviceChargeOn ? percentOf(netSubtotal, serviceChargeRate) : 0;

  // 3. Tax, per line, at each line's own rate.
  const results: CalcLineResult[] = lines.map((line, index) => {
    const discount = lineDiscounts[index] ?? 0;
    const net = line.gross - discount;
    if (line.taxRate <= 0) {
      return { ...line, discount, net, tax: 0, taxable: net };
    }
    if (line.taxInclusive) {
      const tax = taxWithin(net, line.taxRate);
      return { ...line, discount, net, tax, taxable: net - tax };
    }
    return { ...line, discount, net, tax: percentOf(net, line.taxRate), taxable: net };
  });

  const serviceChargeTax =
    settings.taxEnabled && serviceCharge > 0
      ? percentOf(serviceCharge, settings.serviceChargeTaxRate)
      : 0;

  const addedTax =
    results.reduce((sum, line) => sum + (line.taxInclusive ? 0 : line.tax), 0) + serviceChargeTax;
  const includedTax = results.reduce((sum, line) => sum + (line.taxInclusive ? line.tax : 0), 0);

  // 4. Group into GST slabs so the bill can print CGST/SGST per rate.
  const slabs = new Map<number, { taxable: number; tax: number }>();
  for (const line of results) {
    if (line.taxRate <= 0 || line.tax === 0) continue;
    const slab = slabs.get(line.taxRate) ?? { taxable: 0, tax: 0 };
    slab.taxable += line.taxable;
    slab.tax += line.tax;
    slabs.set(line.taxRate, slab);
  }
  if (serviceChargeTax > 0) {
    const rate = settings.serviceChargeTaxRate;
    const slab = slabs.get(rate) ?? { taxable: 0, tax: 0 };
    slab.taxable += serviceCharge;
    slab.tax += serviceChargeTax;
    slabs.set(rate, slab);
  }

  const taxBreakup: DineTaxLine[] = Array.from(slabs.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([rate, slab]) => {
      const { cgst, sgst } = halveTax(slab.tax);
      return { rate, taxable: slab.taxable, cgst, sgst };
    });

  const total = subtotal - discountAmount + serviceCharge + addedTax;
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);

  return {
    subtotal,
    discountAmount,
    serviceCharge,
    serviceChargeTax,
    taxBreakup,
    addedTax,
    includedTax,
    total,
    itemCount,
    lines: results,
  };
}

/** Convenience: totals straight from ticket items. */
export function computeTicketTotals(
  items: DineTicketItem[],
  input: TotalsInput
): DineTotals {
  return computeTotals(toCalcLines(items, input.settings), input);
}

/**
 * Divide a computed bill into parts that each pay `amounts[i]`.
 *
 * Used by split-by-amount and split-equally (FR-6.5), where the parts are
 * shares of a table's bill rather than baskets of items. Every component is
 * apportioned by the share weights, then the tax is derived as the remainder so
 * each printed part's own arithmetic — subtotal − discount + service + tax —
 * lands exactly on the amount that part is being asked to pay. Without that
 * derivation, independent rounding of four components leaves a part whose lines
 * do not add up to its total, which a guest will notice.
 *
 * `amounts` must sum to `totals.total`; the caller is responsible for that.
 */
export function splitTotalsByAmounts(totals: DineTotals, amounts: number[]): DineTotals[] {
  const weights = amounts.map((amount) => Math.max(amount, 0));

  const subtotals = apportion(totals.subtotal, weights);
  const discounts = apportion(totals.discountAmount, weights);
  const serviceCharges = apportion(totals.serviceCharge, weights);
  const includedTaxes = apportion(totals.includedTax, weights);
  const serviceChargeTaxes = apportion(totals.serviceChargeTax, weights);

  // Per-slab apportioning, so each part still prints a GST breakup.
  const slabParts = totals.taxBreakup.map((slab) => ({
    rate: slab.rate,
    taxable: apportion(slab.taxable, weights),
    tax: apportion(slab.cgst + slab.sgst, weights),
  }));

  return amounts.map((amount, index) => {
    const subtotal = subtotals[index] ?? 0;
    const discountAmount = discounts[index] ?? 0;
    const serviceCharge = serviceCharges[index] ?? 0;
    // Derive rather than apportion, so the part's own sum is exact.
    const addedTax = amount - subtotal + discountAmount - serviceCharge;

    const rawSlabs = slabParts
      .map((slab) => ({
        rate: slab.rate,
        taxable: slab.taxable[index] ?? 0,
        tax: slab.tax[index] ?? 0,
      }))
      .filter((slab) => slab.tax > 0 || slab.taxable > 0);

    // Nudge the largest slab so the printed CGST+SGST matches `addedTax`.
    const slabTaxTotal = rawSlabs.reduce((sum, slab) => sum + slab.tax, 0);
    const includedTax = includedTaxes[index] ?? 0;
    const drift = addedTax + includedTax - slabTaxTotal;
    if (drift !== 0 && rawSlabs.length > 0) {
      const largest = rawSlabs.reduce((a, b) => (b.tax > a.tax ? b : a));
      largest.tax += drift;
    }

    const taxBreakup: DineTaxLine[] = rawSlabs.map((slab) => {
      const { cgst, sgst } = halveTax(slab.tax);
      return { rate: slab.rate, taxable: slab.taxable, cgst, sgst };
    });

    return {
      subtotal,
      discountAmount,
      serviceCharge,
      serviceChargeTax: serviceChargeTaxes[index] ?? 0,
      taxBreakup,
      addedTax,
      includedTax,
      total: amount,
      itemCount: 0,
      lines: [],
    };
  });
}

/** Equal shares of a total that add back up exactly (FR-6.5, "equal share"). */
export function equalShares(total: number, parts: number): number[] {
  const safeParts = Math.max(Math.floor(parts), 1);
  return apportion(total, new Array(safeParts).fill(1));
}

/** What a bill still owes after its recorded tenders (FR-6.7, part payments). */
export function amountDue(total: number, payments: { amount: number }[]): number {
  const paid = payments.reduce((sum, payment) => sum + payment.amount, 0);
  return total - paid;
}

/** Unit price including modifiers — re-exported so screens have one import. */
export { lineUnitPrice, lineTotal };
