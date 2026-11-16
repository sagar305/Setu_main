import { NextRequest } from "next/server";
import { CashfreeError, cashfreeConfig, createOrder, customerIdFor, newOrderId } from "@/lib/cashfree";
import { PayPalError, approveUrl, createPayPalOrder, paypalConfig } from "@/lib/paypal";
import {
  BILLING_DAYS,
  checkoutProvider,
  countryFromHeaders,
  isBilling,
  isCheckoutEmail,
  normaliseCheckoutPhone,
  pricingRegion,
  qrMenuRegion,
  regionFor,
} from "@/lib/qrMenuCheckout";
import { WORKFLOW_PRODUCT_TAG, workflowAmounts, workflowPlanLabel } from "@/lib/workflowCheckout";
import { workflowLicenseSecret } from "@/lib/workflowOrders";
import { usdCheckoutEnabled, workflowPaymentsDisabledResponse } from "@/lib/workflowPaymentsGate";

// Starts an order for a Setu Workflow key: Cashfree for rupees, PayPal for
// dollars, as /api/qr-menu/checkout does. The amount comes from pricing.json
// for the chosen period; nothing the browser sends sets the price.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NOT_SET_UP = "Online payments are not set up yet. Please contact us to buy.";

export async function POST(request: NextRequest) {
  const disabled = workflowPaymentsDisabledResponse();
  if (disabled) return disabled;
  if (!workflowLicenseSecret()) return Response.json({ error: NOT_SET_UP }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { billing, email, phone, timezone } = body;
  if (!isBilling(billing)) return Response.json({ error: "Choose monthly or yearly." }, { status: 400 });
  const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!isCheckoutEmail(cleanEmail)) return Response.json({ error: "Enter a valid email address." }, { status: 400 });

  const buyerRegion = regionFor(countryFromHeaders(request.headers), typeof timezone === "string" ? timezone : null);
  const regionId = pricingRegion(buyerRegion, usdCheckoutEnabled());
  const region = qrMenuRegion(regionId);
  const amount = workflowAmounts(regionId)[billing];
  const origin = request.nextUrl.origin;
  const note = `${workflowPlanLabel(billing)}, ${BILLING_DAYS[billing]} days`;
  const tags = { product: WORKFLOW_PRODUCT_TAG, billing, region: regionId };

  if (checkoutProvider(regionId) === "paypal") {
    const config = paypalConfig();
    if (!config) return Response.json({ error: NOT_SET_UP }, { status: 503 });
    try {
      const order = await createPayPalOrder(config, {
        amount,
        currency: region.currency,
        email: cleanEmail,
        returnUrl: `${origin}/products/workflow/payment?provider=paypal`,
        cancelUrl: `${origin}/products/workflow#buy`,
        description: note,
        tags,
      });
      const url = approveUrl(order);
      if (!url) throw new Error("PayPal returned no approval link");
      return Response.json({ provider: "paypal", orderId: order.id, approveUrl: url });
    } catch (error) {
      console.error("Setu Workflow PayPal checkout failed:", error);
      const reason = error instanceof PayPalError ? ` (${error.paypalMessage})` : "";
      return Response.json({ error: `Could not start the payment${reason}. Please try again in a minute.` }, { status: 502 });
    }
  }

  const config = cashfreeConfig();
  if (!config) return Response.json({ error: NOT_SET_UP }, { status: 503 });
  const cleanPhone = normaliseCheckoutPhone(typeof phone === "string" ? phone : "", buyerRegion);
  if (!cleanPhone) {
    return Response.json(
      { error: buyerRegion === "IN" ? "Enter a 10-digit Indian mobile number." : "Enter your phone number with its country code." },
      { status: 400 },
    );
  }
  try {
    const order = await createOrder(config, {
      orderId: newOrderId("swf"),
      amount,
      currency: region.currency,
      customer: { id: customerIdFor(cleanEmail), email: cleanEmail, phone: cleanPhone },
      returnUrl: `${origin}/products/workflow/payment?order_id={order_id}`,
      notifyUrl: origin.startsWith("https://") ? `${origin}/api/workflow/webhook` : undefined,
      note,
      tags,
    });
    if (!order.payment_session_id) throw new Error("Cashfree returned no payment_session_id");
    return Response.json({ provider: "cashfree", orderId: order.order_id, paymentSessionId: order.payment_session_id, mode: config.mode });
  } catch (error) {
    console.error("Setu Workflow checkout failed:", error);
    const reason = error instanceof CashfreeError ? ` (${error.cashfreeMessage})` : "";
    return Response.json({ error: `Could not start the payment${reason}. Please try again in a minute.` }, { status: 502 });
  }
}
