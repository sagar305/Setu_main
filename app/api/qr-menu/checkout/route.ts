import { NextRequest } from "next/server";
import {
  CashfreeError,
  cashfreeConfig,
  createOrder,
  customerIdFor,
  newOrderId,
} from "@/lib/cashfree";
import { PayPalError, approveUrl, createPayPalOrder, paypalConfig } from "@/lib/paypal";
import {
  BILLING_DAYS,
  checkoutProvider,
  countryFromHeaders,
  isBilling,
  isCheckoutEmail,
  normaliseCheckoutPhone,
  qrMenuAmounts,
  pricingRegion,
  qrMenuRegion,
  regionFor,
} from "@/lib/qrMenuCheckout";
import { licenseSecret, ORDER_PRODUCT_TAG } from "@/lib/qrMenuOrders";
import { paymentsDisabledResponse, usdCheckoutEnabled } from "@/lib/qrMenuPaymentsGate";

// Starts an order for QR Menu time: a Cashfree order for rupees, whose session
// id the page opens checkout with, or a PayPal order for dollars, whose
// approval page the browser is sent to. The amount is set here from
// pricing.json — nothing the browser sends can change what is charged.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NOT_SET_UP = "Online payments are not set up yet. Please contact us to buy.";

export async function POST(request: NextRequest) {
  const disabled = paymentsDisabledResponse();
  if (disabled) return disabled;
  if (!licenseSecret()) return Response.json({ error: NOT_SET_UP }, { status: 503 });

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

  // Where the buyer is decides how their phone number is read; what they are
  // charged in, and so which gateway, can differ while PayPal is off.
  const buyerRegion = regionFor(
    countryFromHeaders(request.headers),
    typeof timezone === "string" ? timezone : null
  );
  const regionId = pricingRegion(buyerRegion, usdCheckoutEnabled());
  const region = qrMenuRegion(regionId);
  const amount = qrMenuAmounts(regionId)[billing];
  const origin = request.nextUrl.origin;
  const note = `Setu QR Menu, ${BILLING_DAYS[billing]} days`;
  const tags = { product: ORDER_PRODUCT_TAG, billing, region: regionId };

  if (checkoutProvider(regionId) === "paypal") {
    const config = paypalConfig();
    if (!config) return Response.json({ error: NOT_SET_UP }, { status: 503 });
    try {
      const order = await createPayPalOrder(config, {
        amount,
        currency: region.currency,
        email: cleanEmail,
        // PayPal adds &token=<order id>&PayerID=... to both.
        returnUrl: `${origin}/products/qr-menu/payment?provider=paypal`,
        cancelUrl: `${origin}/products/qr-menu#buy`,
        description: note,
        tags,
      });
      const url = approveUrl(order);
      if (!url) throw new Error("PayPal returned no approval link");
      return Response.json({ provider: "paypal", orderId: order.id, approveUrl: url });
    } catch (error) {
      console.error("QR Menu PayPal checkout failed:", error);
      const reason = error instanceof PayPalError ? ` (${error.paypalMessage})` : "";
      return Response.json(
        { error: `Could not start the payment${reason}. Please try again in a minute.` },
        { status: 502 }
      );
    }
  }

  const config = cashfreeConfig();
  if (!config) return Response.json({ error: NOT_SET_UP }, { status: 503 });
  const cleanPhone = normaliseCheckoutPhone(typeof phone === "string" ? phone : "", buyerRegion);
  if (!cleanPhone) {
    return Response.json(
      {
        error:
          buyerRegion === "IN"
            ? "Enter a 10-digit Indian mobile number."
            : "Enter your phone number with its country code.",
      },
      { status: 400 }
    );
  }

  try {
    const order = await createOrder(config, {
      orderId: newOrderId(),
      amount,
      currency: region.currency,
      customer: { id: customerIdFor(cleanEmail), email: cleanEmail, phone: cleanPhone },
      returnUrl: `${origin}/products/qr-menu/payment?order_id={order_id}`,
      notifyUrl: origin.startsWith("https://") ? `${origin}/api/qr-menu/webhook` : undefined,
      note,
      tags,
    });
    if (!order.payment_session_id) throw new Error("Cashfree returned no payment_session_id");
    return Response.json({
      provider: "cashfree",
      orderId: order.order_id,
      paymentSessionId: order.payment_session_id,
      mode: config.mode,
    });
  } catch (error) {
    console.error("QR Menu checkout failed:", error);
    // Cashfree's own reason ("order_currency : ...", "customer_phone : ...") is
    // what tells a buyer or us what to fix; anything else stays generic.
    const reason = error instanceof CashfreeError ? ` (${error.cashfreeMessage})` : "";
    return Response.json(
      { error: `Could not start the payment${reason}. Please try again in a minute.` },
      { status: 502 }
    );
  }
}
