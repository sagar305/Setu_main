import { NextRequest } from "next/server";
import { checkoutProvider, countryFromHeaders, pricingRegion, regionFor } from "@/lib/qrMenuCheckout";
import { paymentsDisabledResponse, usdCheckoutEnabled } from "@/lib/qrMenuPaymentsGate";

// Which price list the buy box opens on. Checkout works the region out again
// on its own rather than trusting what the page sends.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const disabled = paymentsDisabledResponse();
  if (disabled) return disabled;
  const timezone = request.nextUrl.searchParams.get("tz");
  const buyer = regionFor(countryFromHeaders(request.headers), timezone);
  const region = pricingRegion(buyer, usdCheckoutEnabled());
  return Response.json(
    // `region` is the price list and `provider` the gateway that charges it;
    // `buyerRegion` decides how the phone is asked for.
    { region, buyerRegion: buyer, provider: checkoutProvider(region) },
    { headers: { "cache-control": "private, no-store" } }
  );
}
