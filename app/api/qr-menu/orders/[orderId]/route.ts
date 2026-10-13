import { NextRequest } from "next/server";
import { cashfreeConfig, getOrder, isOrderId } from "@/lib/cashfree";
import { emailLicenseKey, licenseForOrder, licenseSecret } from "@/lib/qrMenuOrders";

// What the return page polls after Cashfree sends the buyer back. Asks
// Cashfree directly rather than trusting the redirect, and returns the key once
// the order is PAID. Keys are derived from the order id, so asking twice gives
// the same key, not a second one.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "private, no-store" };

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;
  const config = cashfreeConfig();
  const secret = licenseSecret();
  if (!config || !secret) {
    return Response.json({ error: "Payments are not set up." }, { status: 503, headers: NO_STORE });
  }
  if (!isOrderId(orderId)) {
    return Response.json({ status: "not_found" }, { status: 404, headers: NO_STORE });
  }

  let order;
  try {
    order = await getOrder(config, orderId);
  } catch (error) {
    console.error("QR Menu order lookup failed:", error);
    return Response.json(
      { error: "Could not check the payment. Please refresh in a minute." },
      { status: 502, headers: NO_STORE }
    );
  }
  if (!order) return Response.json({ status: "not_found" }, { status: 404, headers: NO_STORE });

  const license = licenseForOrder(order, secret);
  if (license) {
    // The webhook sends this too; whichever arrives second is de-duplicated.
    const email = order.customer_details?.customer_email;
    if (email) await emailLicenseKey(email, license, order.order_id);
    return Response.json({ status: "paid", ...license }, { headers: NO_STORE });
  }
  if (order.order_status === "PAID") {
    // Paid, but not a QR Menu order.
    return Response.json({ status: "not_found" }, { status: 404, headers: NO_STORE });
  }
  const status = order.order_status === "ACTIVE" ? "pending" : "failed";
  return Response.json({ status }, { headers: NO_STORE });
}
