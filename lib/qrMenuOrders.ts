import "server-only";

import { Resend } from "resend";
import type { CashfreeOrder } from "@/lib/cashfree";
import { issueLicenseKey } from "@/lib/qrMenuLicense";
import { BILLING_DAYS, isBilling, type Billing } from "@/lib/qrMenuCheckout";
import { QR_MENU_APP_URL } from "@/lib/premiumLinks";
import { buildInvoicePdf, formatMoney, invoiceNumber } from "@/lib/qrMenuInvoice";

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

const BRAND_INDIGO = "#26306B";

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

/**
 * Same card as the QR Menu app's OTP emails (menu-qr-generator-be,
 * src/lib/mailer.ts): indigo header, white card on cream, the key in the
 * highlighted box where the OTP code sits.
 */
export function licenseEmailHtml(input: {
  license: PaidLicense;
  settingsUrl: string;
  invoiceNo: string;
  amount: string;
  orderId: string;
}): string {
  const { license, settingsUrl, invoiceNo, amount, orderId } = input;
  const period = license.billing === "yearly" ? "Yearly" : "Monthly";
  const row = (label: string, value: string) => `
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#777;">${label}</td>
            <td style="padding:6px 0;font-size:13px;color:#1a1a1a;text-align:right;">${escapeHtml(value)}</td>
          </tr>`;
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#F7F5F0;padding:32px 16px;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e6e3dc;">
      <div style="background:${BRAND_INDIGO};padding:24px;text-align:center;">
        <h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:600;">Setu Technology</h1>
      </div>
      <div style="padding:32px 28px;">
        <h2 style="margin:0 0 12px;font-size:20px;color:#1a1a1a;">Payment successful</h2>
        <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#555;">
          Thank you for buying Setu QR Menu. Here is your license key for
          <strong>${license.days} days</strong> of premium.
        </p>
        <div style="text-align:center;margin:0 0 24px;">
          <span style="display:inline-block;font-family:Menlo,Consolas,monospace;font-size:15px;line-height:1.6;letter-spacing:1px;font-weight:700;color:${BRAND_INDIGO};background:#f2f1fa;padding:16px 20px;border-radius:12px;word-break:normal;">${escapeHtml(license.key)}</span>
        </div>
        <div style="text-align:center;margin:0 0 28px;">
          <a href="${settingsUrl}" style="display:inline-block;background:${BRAND_INDIGO};color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:10px;">Redeem in Settings</a>
        </div>
        <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#1a1a1a;">How to use it</p>
        <ol style="margin:0 0 24px;padding-left:20px;font-size:13px;line-height:1.7;color:#555;">
          <li>Sign in to Setu QR Menu and open Settings.</li>
          <li>Paste the key under Account and press Redeem.</li>
          <li>If your premium is still running, the days are added after it ends. If it has ended, they start from the day you redeem.</li>
        </ol>
        <table style="width:100%;border-collapse:collapse;border-top:1px solid #eee;margin:0 0 16px;">
          ${row("Plan", `${period} (${license.days} days)`)}
          ${row("Amount paid", amount)}
          ${row("Invoice", invoiceNo)}
          ${row("Order ID", orderId)}
        </table>
        <p style="margin:0;font-size:13px;line-height:1.6;color:#777;">
          Your invoice is attached as a PDF. The key works once, on one account &mdash; keep this email until you have redeemed it.
        </p>
      </div>
      <div style="border-top:1px solid #eee;padding:16px;text-align:center;">
        <p style="margin:0;font-size:12px;color:#999;">Setu Technology &middot; QR Menu Generator</p>
      </div>
    </div>
  </div>`;
}

/**
 * Emails the key, with the invoice attached, so it survives the buyer closing
 * the tab.
 *
 * Called from both the webhook and the return page's status check, because
 * either can be the one that never happens: the webhook is not sent on
 * localhost and is blocked by Vercel Deployment Protection on previews, and
 * the buyer can close the tab before the return page loads. Resend's
 * idempotency key (honoured for 24 hours) collapses the repeats into one email.
 *
 * Failures are logged and swallowed: the return page shows the key as well,
 * and the webhook must still answer Cashfree with a 200.
 */
export async function emailLicenseKey(order: CashfreeOrder, license: PaidLicense) {
  const to = order.customer_details?.customer_email;
  if (!to) return;
  const orderId = order.order_id;
  if (!process.env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY is not set; QR Menu license email not sent for", orderId);
    return;
  }

  const settingsUrl = `${QR_MENU_APP_URL.replace(/\/+$/, "")}/app/settings`;
  const issuedAt = order.created_at ? new Date(order.created_at) : new Date();
  const invoiceNo = invoiceNumber(orderId, issuedAt);
  const amount = formatMoney(order.order_amount, order.order_currency);
  const period = license.billing === "yearly" ? "1 year" : "1 month";

  let invoice: Buffer | null = null;
  try {
    invoice = buildInvoicePdf({
      orderId,
      issuedAt,
      billing: license.billing,
      days: license.days,
      amount: order.order_amount,
      currency: order.order_currency,
      customerEmail: to,
      customerPhone: order.customer_details?.customer_phone,
    });
  } catch (error) {
    // The key matters more than the invoice; send without it.
    console.error("QR Menu invoice PDF failed:", orderId, error);
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send(
    {
      from: "Setu Technology <noreply@setutechnology.com>",
      to,
      subject: `Payment successful - your Setu QR Menu license key (${period})`,
      html: licenseEmailHtml({ license, settingsUrl, invoiceNo, amount, orderId }),
      text: [
        "Payment successful. Thank you for buying Setu QR Menu.",
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
        `Amount paid: ${amount}`,
        `Invoice: ${invoiceNo}${invoice ? " (attached)" : ""}`,
        `Order: ${orderId}`,
        "",
        "The key works once. Keep this email until you have redeemed it.",
      ].join("\n"),
      ...(invoice
        ? { attachments: [{ filename: `Setu-QR-Menu-Invoice-${invoiceNo}.pdf`, content: invoice }] }
        : {}),
    },
    { idempotencyKey: `qr-menu-license/${orderId}` }
  );
  if (error) console.error("Resend error (QR Menu license):", orderId, error);
}
