import "server-only";

import { Resend } from "resend";
import { issueLicenseKey } from "@/lib/retailLicense";
import { BILLING_DAYS, isBilling, type Billing } from "@/lib/qrMenuCheckout";
import { PROVIDER_NAMES, type QrMenuOrder } from "@/lib/qrMenuOrders";
import { buildInvoicePdf, formatMoney, invoiceNumber } from "@/lib/qrMenuInvoice";
import { planFromProductTag, planLabel, RETAIL_PLAN_INFO, retailRedeemUrl, type RetailPlan } from "@/lib/retailCheckout";

/** Same order shape as QR Menu: lib/cashfree.ts and lib/paypal.ts map both. */
export type RetailOrder = QrMenuOrder;

/**
 * Shared with setu-retail-be (its RETAIL_LICENSE_SECRET), which reads the keys
 * this site issues. Null when unset, which turns checkout off.
 */
export function retailLicenseSecret(): string | null {
  return process.env.RETAIL_LICENSE_SECRET || null;
}

export type RetailLicense = { key: string; plan: RetailPlan; days: number; billing: Billing; branches: number };

/** The key a paid order earns, or null while it is unpaid or not a Setu Retail order. */
export function licenseForRetailOrder(order: RetailOrder, secret: string): RetailLicense | null {
  if (order.status !== "paid") return null;
  const plan = planFromProductTag(order.product);
  if (!plan || !isBilling(order.billing)) return null;
  // Plan and days follow from the order's own tags, so they can't disagree
  // with what was charged; rtl_ (Cashfree) and PayPal ids never collide with
  // QR Menu ones, and the key's own secret differs, so neither product can
  // mint the other's key.
  const days = BILLING_DAYS[order.billing];
  return { key: issueLicenseKey(order.orderId, plan, days, secret), plan, days, billing: order.billing, branches: RETAIL_PLAN_INFO[plan].branches };
}

const BRAND_INDIGO = "#26306B";
const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

export function retailEmailHtml(input: { license: RetailLicense; invoiceNo: string; amount: string; orderId: string }): string {
  const { license, invoiceNo, amount, orderId } = input;
  const name = RETAIL_PLAN_INFO[license.plan].name;
  const redeem = retailRedeemUrl(license.key);
  const row = (label: string, value: string) => `
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#777;">${label}</td>
            <td style="padding:6px 0;font-size:13px;color:#1a1a1a;text-align:right;">${escapeHtml(value)}</td>
          </tr>`;
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#F7F5F0;padding:32px 16px;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e6e3dc;">
      <div style="background:${BRAND_INDIGO};padding:24px;text-align:center;">
        <h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:600;">Setu Retail</h1>
      </div>
      <div style="padding:32px 28px;">
        <h2 style="margin:0 0 12px;font-size:20px;color:#1a1a1a;">Payment successful</h2>
        <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#555;">
          Thank you for buying Setu Retail <strong>${name}</strong>. Here is your license key for
          <strong>${license.days} days</strong>, for up to ${license.branches} branch${license.branches === 1 ? "" : "es"}.
        </p>
        <div style="text-align:center;margin:0 0 24px;">
          <span style="display:inline-block;font-family:Menlo,Consolas,monospace;font-size:15px;line-height:1.6;letter-spacing:1px;font-weight:700;color:${BRAND_INDIGO};background:#f2f1fa;padding:16px 20px;border-radius:12px;word-break:normal;">${escapeHtml(license.key)}</span>
        </div>
        <div style="text-align:center;margin:0 0 28px;">
          <a href="${escapeHtml(redeem)}" style="display:inline-block;background:${BRAND_INDIGO};color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:10px;">Redeem in Setu Retail</a>
        </div>
        <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#1a1a1a;">How to use it</p>
        <ol style="margin:0 0 24px;padding-left:20px;font-size:13px;line-height:1.7;color:#555;">
          <li>Press the button above (sign in as the shop owner), or open Settings &rarr; Plan &amp; key and paste the key.</li>
          <li>Press Redeem. If your current plan is still running, the days are added after it ends.</li>
          <li>If it's a different plan from the one you're on, you choose to switch now or start it later.</li>
        </ol>
        <table style="width:100%;border-collapse:collapse;border-top:1px solid #eee;margin:0 0 16px;">
          ${row("Plan", `${name} · ${license.billing === "yearly" ? "Yearly" : "Monthly"} (${license.days} days)`)}
          ${row("Amount paid", amount)}
          ${row("Invoice", invoiceNo)}
          ${row("Order ID", orderId)}
        </table>
        <p style="margin:0;font-size:13px;line-height:1.6;color:#777;">
          Your invoice is attached as a PDF. The key works once, on one account &mdash; keep this email until you have redeemed it.
        </p>
      </div>
      <div style="border-top:1px solid #eee;padding:16px;text-align:center;">
        <p style="margin:0;font-size:12px;color:#999;">Setu Technology &middot; Setu Retail</p>
      </div>
    </div>
  </div>`;
}

/**
 * Emails the key with the invoice. Called from the webhooks and the return
 * page's status check; Resend's idempotency key collapses the repeats into one
 * email (see emailLicenseKey in lib/qrMenuOrders.ts for why both call it).
 */
export async function emailRetailKey(order: RetailOrder, license: RetailLicense) {
  const to = order.email;
  if (!to) return;
  const { orderId } = order;
  if (!process.env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY is not set; Setu Retail license email not sent for", orderId);
    return;
  }
  const issuedAt = order.createdAt ? new Date(order.createdAt) : new Date();
  const invoiceNo = invoiceNumber(orderId, issuedAt, "SRT");
  const amount = formatMoney(order.amount, order.currency);
  const label = planLabel(license.plan, license.billing);

  let invoice: Buffer | null = null;
  try {
    invoice = buildInvoicePdf({
      orderId,
      issuedAt,
      billing: license.billing,
      days: license.days,
      amount: order.amount,
      currency: order.currency,
      customerEmail: to,
      customerPhone: order.phone,
      paidVia: PROVIDER_NAMES[order.provider],
      product: { name: "Setu Retail", line: `${label} (${license.days} days, up to ${license.branches} branch${license.branches === 1 ? "" : "es"})`, invoicePrefix: "SRT" },
    });
  } catch (error) {
    console.error("Setu Retail invoice PDF failed:", orderId, error);
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send(
    {
      from: "Setu Technology <noreply@setutechnology.com>",
      to,
      subject: `Payment successful - your Setu Retail ${RETAIL_PLAN_INFO[license.plan].name} key (${license.billing === "yearly" ? "1 year" : "1 month"})`,
      html: retailEmailHtml({ license, invoiceNo, amount, orderId }),
      text: [
        `Payment successful. Thank you for buying Setu Retail ${RETAIL_PLAN_INFO[license.plan].name}.`,
        "",
        `Your license key, for ${license.days} days and up to ${license.branches} branch${license.branches === 1 ? "" : "es"}:`,
        "",
        license.key,
        "",
        `Redeem it (sign in as the shop owner): ${retailRedeemUrl(license.key)}`,
        "Or open Settings → Plan & key in Setu Retail and paste it.",
        "",
        "If your current plan is still running, the days are added after it ends.",
        "",
        `Amount paid: ${amount}`,
        `Invoice: ${invoiceNo}${invoice ? " (attached)" : ""}`,
        `Order: ${orderId}`,
        "",
        "The key works once. Keep this email until you have redeemed it.",
      ].join("\n"),
      ...(invoice ? { attachments: [{ filename: `Setu-Retail-Invoice-${invoiceNo}.pdf`, content: invoice }] } : {}),
    },
    { idempotencyKey: `setu-retail-license/${orderId}` },
  );
  if (error) console.error("Resend error (Setu Retail license):", orderId, error);
}
