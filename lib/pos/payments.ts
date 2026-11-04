// Payment helpers for the Browser Based POS: split payments (part cash, part
// UPI…) and the UPI QR amount that goes with them. Pure functions only, so
// they are shared by the billing screen, checkout, receipts and reports.

import { generateUPIUrl, supportsUpi } from "@/lib/upi";
import type { Order, OrderPayment, PaymentMethod } from "./types";

/** Order.paymentMethodId used when a sale was paid with more than one method. */
export const SPLIT_PAYMENT_ID = "split";

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** True for the method that should show a UPI QR (named "UPI", "UPI / GPay"…). */
export function isUpiMethod(method: Pick<PaymentMethod, "name"> | null | undefined): boolean {
  return !!method && /\bupi\b/i.test(method.name);
}

/**
 * Format check for a UPI ID (handle@psp). Deliberately looser than
 * lib/upi.isValidUPIId, whose fixed PSP list misses common merchant handles
 * (@paytm, @axl, @okbizaxis…) — a shop's own QR must never be refused.
 */
export function looksLikeUpiId(upiId: string | undefined | null): boolean {
  return !!upiId && /^[a-z0-9._-]{2,256}@[a-z][a-z0-9.-]{1,63}$/i.test(upiId.trim());
}

/** upi://pay link for an exact amount, or "" when UPI can't be offered. */
export function upiPaymentLink(opts: {
  upiId: string | undefined | null;
  amount: number;
  currency: string;
  businessName?: string;
  note?: string;
}): string {
  const { upiId, amount, currency } = opts;
  if (!looksLikeUpiId(upiId) || !supportsUpi(currency) || !(round2(amount) > 0)) return "";
  return generateUPIUrl(upiId!.trim(), round2(amount), opts.note, opts.businessName);
}

export type SplitPart = { methodId: string; amount: number };

export type SplitCheck = {
  /** Sum of the entered parts. */
  paid: number;
  /** total - paid; positive = still due, negative = overpaid. */
  remaining: number;
  /** Ready to charge: every part > 0, known methods, sums exactly to total. */
  ok: boolean;
  error: string;
};

/** Validate split parts against the bill total (2-decimal money). */
export function checkSplit(
  parts: SplitPart[],
  total: number,
  methods: Pick<PaymentMethod, "id">[]
): SplitCheck {
  const paid = round2(parts.reduce((sum, p) => sum + (Number.isFinite(p.amount) ? p.amount : 0), 0));
  const remaining = round2(total - paid);
  const fail = (error: string): SplitCheck => ({ paid, remaining, ok: false, error });

  if (parts.length < 2) return fail("Add at least two payment methods to split.");
  for (const p of parts) {
    if (!methods.some((m) => m.id === p.methodId)) return fail("Pick a payment method for every part.");
    if (!Number.isFinite(p.amount) || round2(p.amount) <= 0) {
      return fail("Every part needs an amount greater than zero.");
    }
  }
  if (remaining > 0) return fail(`${remaining.toFixed(2)} is still due.`);
  if (remaining < 0) return fail(`Parts add up to ${Math.abs(remaining).toFixed(2)} more than the total.`);
  return { paid, remaining: 0, ok: true, error: "" };
}

/**
 * Merge parts that use the same method and attach method names, in entry
 * order — the shape stored on Order.payments.
 */
export function toOrderPayments(parts: SplitPart[], methods: PaymentMethod[]): OrderPayment[] {
  const out: OrderPayment[] = [];
  for (const p of parts) {
    const method = methods.find((m) => m.id === p.methodId);
    if (!method) continue;
    const existing = out.find((o) => o.methodId === method.id);
    if (existing) existing.amount = round2(existing.amount + p.amount);
    else out.push({ methodId: method.id, methodName: method.name, amount: round2(p.amount) });
  }
  return out;
}

/** "Cash + UPI" — the label stored in Order.paymentMethodName for a split. */
export function splitLabel(payments: OrderPayment[]): string {
  return payments.map((p) => p.methodName).join(" + ");
}

/**
 * How an order was paid, one entry per method. Orders saved before split
 * payments existed (no `payments`) count as one payment of the full total.
 */
export function orderPaymentParts(
  order: Pick<Order, "payments" | "paymentMethodId" | "paymentMethodName" | "total">
): OrderPayment[] {
  if (order.payments && order.payments.length > 0) return order.payments;
  return [
    { methodId: order.paymentMethodId, methodName: order.paymentMethodName, amount: order.total },
  ];
}

/**
 * Amount a UPI QR should ask for on this order's receipt: the UPI share of a
 * split, the full total when paid by UPI or on credit (so the customer can
 * pay the udhaar later), and 0 for sales settled in cash/card.
 */
export function upiAmountForOrder(
  order: Pick<Order, "payments" | "paymentMethodId" | "paymentMethodName" | "total" | "status">
): number {
  if (order.status !== "completed") return 0;
  if (order.paymentMethodId === "credit") return round2(order.total);
  return round2(
    orderPaymentParts(order)
      .filter((p) => isUpiMethod({ name: p.methodName }))
      .reduce((sum, p) => sum + p.amount, 0)
  );
}
