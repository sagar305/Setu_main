import type { CartLine } from "./types";

export type CartTotals = {
  subtotal: number;
  discountAmount: number;
  taxAmount: number; // tax added on top (exclusive lines)
  includedTaxAmount: number; // tax already inside prices (inclusive lines)
  total: number;
  itemCount: number;
};

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Cart math: discount applies on the subtotal, tax is calculated on the
 * discounted amount (proportionally per line, using each line's tax rate).
 *
 * Exclusive lines add tax on top: total = subtotal - discount + tax.
 * Inclusive lines already contain tax in their price — the tax portion is
 * extracted (base * r / (100 + r)) for reporting but does not change the total.
 */
export function calculateCartTotals(
  lines: CartLine[],
  discountType: "flat" | "percent",
  discountValue: number,
  taxEnabled: boolean
): CartTotals {
  const subtotal = round2(
    lines.reduce((sum, line) => sum + line.price * line.quantity, 0)
  );

  const rawDiscount =
    discountType === "percent"
      ? (subtotal * Math.min(Math.max(discountValue, 0), 100)) / 100
      : Math.min(Math.max(discountValue, 0), subtotal);
  const discountAmount = round2(rawDiscount);

  let taxAmount = 0;
  let includedTaxAmount = 0;
  if (taxEnabled && subtotal > 0) {
    const discountRatio = discountAmount / subtotal;
    let added = 0;
    let included = 0;
    for (const line of lines) {
      const rate = line.taxRate || 0;
      if (rate <= 0) continue;
      const lineTotal = line.price * line.quantity;
      const taxableBase = lineTotal * (1 - discountRatio);
      if (line.taxInclusive) {
        included += (taxableBase * rate) / (100 + rate);
      } else {
        added += (taxableBase * rate) / 100;
      }
    }
    taxAmount = round2(added);
    includedTaxAmount = round2(included);
  }

  const total = round2(subtotal - discountAmount + taxAmount);
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);

  return { subtotal, discountAmount, taxAmount, includedTaxAmount, total, itemCount };
}
