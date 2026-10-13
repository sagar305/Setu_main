import { NextRequest } from "next/server";
import { cashfreeConfig, createOrder, customerIdFor, newOrderId } from "@/lib/cashfree";
import {
  BILLING_DAYS,
  countryFromHeaders,
  isBilling,
  isCheckoutEmail,
  normaliseCheckoutPhone,
  qrMenuAmounts,
  qrMenuRegion,
  regionFor,
} from "@/lib/qrMenuCheckout";
import { licenseSecret, ORDER_PRODUCT_TAG } from "@/lib/qrMenuOrders";

// Starts a Cashfree order for QR Menu time and hands the page the session id
// it opens checkout with. The amount is set here from pricing.json — nothing
// the browser sends can change what is charged.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const config = cashfreeConfig();
  if (!config || !licenseSecret()) {
    return Response.json(
      { error: "Online payments are not set up yet. Please contact us to buy." },
      { status: 503 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { billing, email, phone, timezone } = body;
  if (!isBilling(billing)) {
    return Response.json({ error: "Choose monthly or yearly." }, { status: 400 });
  }
  const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!isCheckoutEmail(cleanEmail)) {
    return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const regionId = regionFor(
    countryFromHeaders(request.headers),
    typeof timezone === "string" ? timezone : null
  );
  const cleanPhone = normaliseCheckoutPhone(typeof phone === "string" ? phone : "", regionId);
  if (!cleanPhone) {
    return Response.json(
      {
        error:
          regionId === "IN"
            ? "Enter a 10-digit Indian mobile number."
            : "Enter your phone number with its country code.",
      },
      { status: 400 }
    );
  }

  const region = qrMenuRegion(regionId);
  const amount = qrMenuAmounts(regionId)[billing];
  const origin = request.nextUrl.origin;
  const orderId = newOrderId();

  try {
    const order = await createOrder(config, {
      orderId,
      amount,
      currency: region.currency,
      customer: { id: customerIdFor(cleanEmail), email: cleanEmail, phone: cleanPhone },
      returnUrl: `${origin}/products/qr-menu/payment?order_id={order_id}`,
      notifyUrl: origin.startsWith("https://") ? `${origin}/api/qr-menu/webhook` : undefined,
      note: `Setu QR Menu, ${BILLING_DAYS[billing]} days`,
      tags: { product: ORDER_PRODUCT_TAG, billing, region: regionId },
    });
    if (!order.payment_session_id) throw new Error("Cashfree returned no payment_session_id");
    return Response.json({
      orderId: order.order_id,
      paymentSessionId: order.payment_session_id,
      mode: config.mode,
    });
  } catch (error) {
    console.error("QR Menu checkout failed:", error);
    return Response.json(
      { error: "Could not start the payment. Please try again in a minute." },
      { status: 502 }
    );
  }
}
