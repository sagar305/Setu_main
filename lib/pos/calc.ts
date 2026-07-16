import type { CartLine } from "./types";

export type CartTotals = {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  itemCount: number;
};

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Cart math: discount applies on the subtotal, tax is calculated on the
 * discounted amount (proportionally per line, using each line's tax rate).
 * total = subtotal - discount + tax
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
  if (taxEnabled && subtotal > 0) {
    const discountRatio = discountAmount / subtotal;
    taxAmount = round2(
      lines.reduce((sum, line) => {
        const lineTotal = line.price * line.quantity;
        const taxableBase = lineTotal * (1 - discountRatio);
        return sum + (taxableBase * (line.taxRate || 0)) / 100;
      }, 0)
    );
  }

  const total = round2(subtotal - discountAmount + taxAmount);
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);

  return { subtotal, discountAmount, taxAmount, total, itemCount };
}
