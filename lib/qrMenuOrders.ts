import "server-only";

import { Resend } from "resend";
import type { CashfreeOrder } from "@/lib/cashfree";
import { issueLicenseKey } from "@/lib/qrMenuLicense";
import { BILLING_DAYS, isBilling, type Billing } from "@/lib/qrMenuCheckout";
import { QR_MENU_APP_URL } from "@/lib/premiumLinks";

/** Marks an order as ours, so a stray Cashfree order on the same account never yields a key. */
export const ORDER_PRODUCT_TAG = "setu-qr-menu";

/**
 * Shared with the QR Menu backend, which needs the same value to read the keys
 * this site issues. Null when unset, which turns checkout off.
 */
export function licenseSecret(): string | null {
  return process.env.QR_MENU_LICENSE_SECRET || null;
}

export type PaidLicense = { key: string; days: number; billing: Billing };

/** The license key a paid order earns, or null while it is unpaid or not one of ours. */
export function licenseForOrder(order: CashfreeOrder, secret: string): PaidLicense | null {
  if (order.order_status !== "PAID") return null;
  const tags = order.order_tags ?? {};
  if (tags.product !== ORDER_PRODUCT_TAG || !isBilling(tags.billing)) return null;
  // Days follow from the billing period rather than a separate tag, so the two
  // can never disagree.
  const days = BILLING_DAYS[tags.billing];
  return { key: issueLicenseKey(order.order_id, days, secret), days, billing: tags.billing };
}

/**
 * Emails the key so it survives the buyer closing the tab. Failures are logged
 * and swallowed: the return page shows the key as well, and the webhook that
 * calls this must still answer Cashfree with a 200.
 */
export async function emailLicenseKey(to: string, license: PaidLicense, orderId: string) {
  if (!process.env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY is not set; QR Menu license email not sent for", orderId);
    return;
  }
  const settingsUrl = `${QR_MENU_APP_URL.replace(/\/+$/, "")}/app/settings`;
  const period = license.billing === "yearly" ? "1 year" : "1 month";

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: "Setu Technology <noreply@setutechnology.com>",
    to,
    subject: `Your Setu QR Menu license key (${period})`,
    text: [
      "Thank you for buying Setu QR Menu.",
      "",
      `Your license key adds ${license.days} days of premium:`,
      "",
      license.key,
      "",
      `To use it, sign in and open Settings: ${settingsUrl}`,
      "Paste the key under Account and press Redeem.",
      "",
      "If your premium is still running, the days are added after it ends.",
      "If it has already ended, they start from the day you redeem the key.",
      "",
      "The key works once. Keep this email until you have redeemed it.",
      "",
      `Order: ${orderId}`,
    ].join("\n"),
  });
  if (error) console.error("Resend error (QR Menu license):", error);
}
