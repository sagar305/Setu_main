import { NextRequest } from "next/server";
import { captureIfApproved, getPayPalOrder, isPayPalOrderId, paypalConfig, qrMenuOrderFromPayPal, verifyPayPalWebhook } from "@/lib/paypal";
import { emailWorkflowKey, licenseForWorkflowOrder, workflowLicenseSecret } from "@/lib/workflowOrders";
import { workflowPaymentsDisabledResponse } from "@/lib/workflowPaymentsGate";
import { WORKFLOW_PRODUCT_TAG } from "@/lib/workflowCheckout";

// PayPal's webhook for Setu Workflow. Register this URL as a second webhook on
// the same PayPal app (CHECKOUT.ORDER.APPROVED and PAYMENT.CAPTURE.COMPLETED)
// and put its id in WORKFLOW_PAYPAL_WEBHOOK_ID. PayPal sends every event to
// every webhook, so orders for other products arriving here are ignored before
// anything is captured.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PayPalEvent = { event_type?: string; resource?: { id?: unknown; supplementary_data?: { related_ids?: { order_id?: unknown } } } };

function orderIdOf(event: PayPalEvent): unknown {
  if (event.event_type === "CHECKOUT.ORDER.APPROVED") return event.resource?.id;
  if (event.event_type === "PAYMENT.CAPTURE.COMPLETED") return event.resource?.supplementary_data?.related_ids?.order_id;
  return null;
}

export async function POST(request: NextRequest) {
  const disabled = workflowPaymentsDisabledResponse();
  if (disabled) return disabled;
  const base = paypalConfig();
  const webhookId = process.env.WORKFLOW_PAYPAL_WEBHOOK_ID || null;
  const secret = workflowLicenseSecret();
  if (!base || !webhookId || !secret) return Response.json({ error: "not_configured" }, { status: 503 });
  const config = { ...base, webhookId };

  const rawBody = await request.text();
  let signed = false;
  try {
    signed = await verifyPayPalWebhook(config, request.headers, rawBody);
  } catch (error) {
    console.error("Setu Workflow PayPal webhook verification errored:", error);
    return Response.json({ error: "verification_unavailable" }, { status: 502 });
  }
  if (!signed) {
    console.warn("Setu Workflow PayPal webhook rejected: signature did not verify");
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
    const order0 = qrMenuOrderFromPayPal(found);
    // Only capture our own orders: other products' orders are their webhook's job.
    if (order0.product !== WORKFLOW_PRODUCT_TAG) return Response.json({ ok: true });
    const { order: settled, declined } = await captureIfApproved(config, found);
    const order = qrMenuOrderFromPayPal(settled, declined);
    const license = licenseForWorkflowOrder(order, secret);
    if (license) await emailWorkflowKey(order, license);
  }
  return Response.json({ ok: true });
}
