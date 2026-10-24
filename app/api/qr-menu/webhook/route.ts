import { NextRequest } from "next/server";
import {
  cashfreeConfig,
  getOrder,
  isOrderId,
  qrMenuOrderFromCashfree,
  verifyWebhookSignature,
} from "@/lib/cashfree";
import { emailLicenseKey, licenseForOrder, licenseSecret } from "@/lib/qrMenuOrders";
import { paymentsDisabledResponse } from "@/lib/qrMenuPaymentsGate";

// Cashfree's payment webhook (PayPal's is ../paypal-webhook). Its only job is emailing the license key, so the
// buyer has it even if they closed the tab before the return page loaded.
//
// The payload is used only for the order id: the order is then fetched from
// Cashfree, so a replayed or reordered event can at most resend the same key to
// the same buyer. Cashfree retries on anything but a 2xx, hence the 200s below
// for events that are fine to ignore.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const disabled = paymentsDisabledResponse();
  if (disabled) return disabled;
  const config = cashfreeConfig();
  const secret = licenseSecret();
  if (!config || !secret) return Response.json({ error: "not_configured" }, { status: 503 });

  const rawBody = await request.text();
  const signed = verifyWebhookSignature(
    config.secretKey,
    request.headers.get("x-webhook-timestamp"),
    rawBody,
    request.headers.get("x-webhook-signature")
  );
  if (!signed) {
    // Usually CASHFREE_SECRET_KEY belonging to the other environment (sandbox
    // vs production) from the one that sent the webhook.
    console.warn("QR Menu webhook rejected: signature did not verify");
    return Response.json({ error: "bad_signature" }, { status: 401 });
  }

  let event: { type?: string; data?: { order?: { order_id?: unknown } } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  if (event.type !== "PAYMENT_SUCCESS_WEBHOOK") return Response.json({ ok: true });
  const orderId = event.data?.order?.order_id;
  if (typeof orderId !== "string" || !isOrderId(orderId)) return Response.json({ ok: true });

  const found = await getOrder(config, orderId);
  const order = found ? qrMenuOrderFromCashfree(found) : null;
  const license = order ? licenseForOrder(order, secret) : null;
  if (order && license) await emailLicenseKey(order, license);

  return Response.json({ ok: true });
}
