import { NextRequest } from "next/server";
import { countryFromHeaders, pricingRegion, regionFor } from "@/lib/qrMenuCheckout";
import { qrMenuUsdEnabled } from "@/lib/featureFlags";
import { paymentsDisabledResponse } from "@/lib/qrMenuPaymentsGate";

// Which price list the buy box opens on. Checkout works the region out again
// on its own rather than trusting what the page sends.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const disabled = paymentsDisabledResponse();
  if (disabled) return disabled;
  const timezone = request.nextUrl.searchParams.get("tz");
  const buyer = regionFor(countryFromHeaders(request.headers), timezone);
  return Response.json(
    // `region` is the price list; `buyerRegion` decides how the phone is asked for.
    { region: pricingRegion(buyer, qrMenuUsdEnabled()), buyerRegion: buyer },
    { headers: { "cache-control": "private, no-store" } }
  );
}
