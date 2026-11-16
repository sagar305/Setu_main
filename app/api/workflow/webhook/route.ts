import { NextRequest } from "next/server";
import { cashfreeConfig, getOrder, isOrderId, qrMenuOrderFromCashfree, verifyWebhookSignature } from "@/lib/cashfree";
import { emailWorkflowKey, licenseForWorkflowOrder, workflowLicenseSecret } from "@/lib/workflowOrders";
import { workflowPaymentsDisabledResponse } from "@/lib/workflowPaymentsGate";

// Cashfree's payment webhook for Setu Workflow orders (set per order as
// notify_url). As for QR Menu, the payload is used only for the order id; the
// order is then fetched from Cashfree, so a replayed event can at most resend
// the same key to the same buyer.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const disabled = workflowPaymentsDisabledResponse();
  if (disabled) return disabled;
  const config = cashfreeConfig();
  const secret = workflowLicenseSecret();
  if (!config || !secret) return Response.json({ error: "not_configured" }, { status: 503 });

  const rawBody = await request.text();
  if (!verifyWebhookSignature(config.secretKey, request.headers.get("x-webhook-timestamp"), rawBody, request.headers.get("x-webhook-signature"))) {
    console.warn("Setu Workflow webhook rejected: signature did not verify");
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
  const license = order ? licenseForWorkflowOrder(order, secret) : null;
  if (order && license) await emailWorkflowKey(order, license);
  return Response.json({ ok: true });
}
