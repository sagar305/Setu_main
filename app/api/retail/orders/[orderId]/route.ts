import { NextRequest } from "next/server";
import { cashfreeConfig, getOrder, isOrderId, qrMenuOrderFromCashfree } from "@/lib/cashfree";
import { captureIfApproved, getPayPalOrder, isPayPalOrderId, paypalConfig, qrMenuOrderFromPayPal } from "@/lib/paypal";
import { emailRetailKey, licenseForRetailOrder, retailLicenseSecret, type RetailOrder } from "@/lib/retailOrders";
import { retailPaymentsDisabledResponse } from "@/lib/retailPaymentsGate";

// What /products/retail/payment polls after the gateway sends the buyer back.
// Asks the gateway directly and returns the key once the order is paid; the
// key is derived from the order id, so asking twice gives the same key.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "private, no-store" };
const NOT_SET_UP = () => Response.json({ error: "Payments are not set up." }, { status: 503, headers: NO_STORE });
const NOT_FOUND = () => Response.json({ status: "not_found" }, { status: 404, headers: NO_STORE });

export async function GET(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const disabled = retailPaymentsDisabledResponse();
  if (disabled) return disabled;
  const { orderId } = await params;
  const secret = retailLicenseSecret();
  if (!secret) return NOT_SET_UP();

  let order: RetailOrder | null;
  try {
    if (request.nextUrl.searchParams.get("provider") === "paypal") {
      const config = paypalConfig();
      if (!config) return NOT_SET_UP();
      if (!isPayPalOrderId(orderId)) return NOT_FOUND();
      const found = await getPayPalOrder(config, orderId);
      if (found) {
        const { order: settled, declined } = await captureIfApproved(config, found);
        order = qrMenuOrderFromPayPal(settled, declined);
      } else order = null;
    } else {
      const config = cashfreeConfig();
      if (!config) return NOT_SET_UP();
      if (!isOrderId(orderId)) return NOT_FOUND();
      const found = await getOrder(config, orderId);
      order = found ? qrMenuOrderFromCashfree(found) : null;
    }
  } catch (error) {
    console.error("Setu Retail order lookup failed:", error);
    return Response.json({ error: "Could not check the payment. Please refresh in a minute." }, { status: 502, headers: NO_STORE });
  }
  if (!order) return NOT_FOUND();

  const license = licenseForRetailOrder(order, secret);
  if (license) {
    await emailRetailKey(order, license);
    return Response.json({ status: "paid", ...license }, { headers: NO_STORE });
  }
  // Paid, but not a Setu Retail order.
  if (order.status === "paid") return NOT_FOUND();
  return Response.json({ status: order.status }, { headers: NO_STORE });
}
