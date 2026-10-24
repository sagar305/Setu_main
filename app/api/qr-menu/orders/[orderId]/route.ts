import { NextRequest } from "next/server";
import { cashfreeConfig, getOrder, isOrderId, qrMenuOrderFromCashfree } from "@/lib/cashfree";
import {
  captureIfApproved,
  getPayPalOrder,
  isPayPalOrderId,
  paypalConfig,
  qrMenuOrderFromPayPal,
} from "@/lib/paypal";
import {
  emailLicenseKey,
  licenseForOrder,
  licenseSecret,
  type QrMenuOrder,
} from "@/lib/qrMenuOrders";
import { paymentsDisabledResponse } from "@/lib/qrMenuPaymentsGate";

// What the return page polls after the gateway sends the buyer back. Asks the
// gateway directly rather than trusting the redirect, and returns the key once
// the order is paid. Keys are derived from the order id, so asking twice gives
// the same key, not a second one.
//
// ?provider=paypal looks the id up at PayPal, and captures the order if the
// buyer has approved it but nobody has taken the money yet; anything else is
// a Cashfree order.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "private, no-store" };

const NOT_SET_UP = () =>
  Response.json({ error: "Payments are not set up." }, { status: 503, headers: NO_STORE });
const NOT_FOUND = () => Response.json({ status: "not_found" }, { status: 404, headers: NO_STORE });

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const disabled = paymentsDisabledResponse();
  if (disabled) return disabled;
  const { orderId } = await params;
  const secret = licenseSecret();
  if (!secret) return NOT_SET_UP();

  let order: QrMenuOrder | null;
  try {
    if (request.nextUrl.searchParams.get("provider") === "paypal") {
      const config = paypalConfig();
      if (!config) return NOT_SET_UP();
      if (!isPayPalOrderId(orderId)) return NOT_FOUND();
      const found = await getPayPalOrder(config, orderId);
      if (found) {
        const { order: settled, declined } = await captureIfApproved(config, found);
        order = qrMenuOrderFromPayPal(settled, declined);
      } else {
        order = null;
      }
    } else {
      const config = cashfreeConfig();
      if (!config) return NOT_SET_UP();
      if (!isOrderId(orderId)) return NOT_FOUND();
      const found = await getOrder(config, orderId);
      order = found ? qrMenuOrderFromCashfree(found) : null;
    }
  } catch (error) {
    console.error("QR Menu order lookup failed:", error);
    return Response.json(
      { error: "Could not check the payment. Please refresh in a minute." },
      { status: 502, headers: NO_STORE }
    );
  }
  if (!order) return NOT_FOUND();

  const license = licenseForOrder(order, secret);
  if (license) {
    // The webhook sends this too; whichever arrives second is de-duplicated.
    await emailLicenseKey(order, license);
    return Response.json({ status: "paid", ...license }, { headers: NO_STORE });
  }
  // Paid, but not a QR Menu order.
  if (order.status === "paid") return NOT_FOUND();
  return Response.json({ status: order.status }, { headers: NO_STORE });
}
