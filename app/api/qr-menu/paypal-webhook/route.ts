import { NextRequest } from "next/server";
import {
  captureIfApproved,
  getPayPalOrder,
  isPayPalOrderId,
  paypalConfig,
  qrMenuOrderFromPayPal,
  verifyPayPalWebhook,
} from "@/lib/paypal";
import { emailLicenseKey, licenseForOrder, licenseSecret } from "@/lib/qrMenuOrders";
import { paymentsDisabledResponse } from "@/lib/qrMenuPaymentsGate";

// PayPal's webhook, for buyers who approve the payment and close the tab
// before the return page loads. Subscribe it to CHECKOUT.ORDER.APPROVED (so the
// order is captured without the buyer) and PAYMENT.CAPTURE.COMPLETED (so a
// capture PayPal held for review still emails the key when it clears).
//
// As with Cashfree's webhook, the payload is used only for the order id: the
// order is then fetched from PayPal, so a replayed event can at most capture an
// order its buyer already approved, or resend the same key to the same buyer.
// PayPal retries on anything but a 2xx, hence the 200s for ignorable events.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PayPalEvent = {
  event_type?: string;
  resource?: {
    id?: unknown;
    supplementary_data?: { related_ids?: { order_id?: unknown } };
  };
};

function orderIdOf(event: PayPalEvent): unknown {
  if (event.event_type === "CHECKOUT.ORDER.APPROVED") return event.resource?.id;
  if (event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
    return event.resource?.supplementary_data?.related_ids?.order_id;
  }
  return null;
}

export async function POST(request: NextRequest) {
  const disabled = paymentsDisabledResponse();
  if (disabled) return disabled;
  const config = paypalConfig();
  const secret = licenseSecret();
  if (!config?.webhookId || !secret) {
    return Response.json({ error: "not_configured" }, { status: 503 });
  }

  const rawBody = await request.text();
  let signed = false;
  try {
    signed = await verifyPayPalWebhook(config, request.headers, rawBody);
  } catch (error) {
    // PayPal itself was unreachable; a 5xx makes it retry later.
    console.error("QR Menu PayPal webhook verification errored:", error);
    return Response.json({ error: "verification_unavailable" }, { status: 502 });
  }
  if (!signed) {
    // Usually PAYPAL_WEBHOOK_ID belonging to the other app (sandbox vs live).
    console.warn("QR Menu PayPal webhook rejected: signature did not verify");
    return Response.json({ error: "bad_signature" }, { status: 401 });
  }

  let event: PayPalEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const orderId = orderIdOf(event);
  if (typeof orderId !== "string" || !isPayPalOrderId(orderId)) return Response.json({ ok: true });

  const found = await getPayPalOrder(config, orderId);
  if (found) {
    const { order: settled, declined } = await captureIfApproved(config, found);
    const order = qrMenuOrderFromPayPal(settled, declined);
    const license = licenseForOrder(order, secret);
    if (license) await emailLicenseKey(order, license);
  }

  return Response.json({ ok: true });
}
