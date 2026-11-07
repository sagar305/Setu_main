import { NextRequest } from "next/server";
import { checkoutProvider, countryFromHeaders, pricingRegion, regionFor } from "@/lib/qrMenuCheckout";
import { retailPaymentsDisabledResponse, usdCheckoutEnabled } from "@/lib/retailPaymentsGate";

// Which price list the Retail buy box opens on (checkout works it out again itself).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const disabled = retailPaymentsDisabledResponse();
  if (disabled) return disabled;
  const buyer = regionFor(countryFromHeaders(request.headers), request.nextUrl.searchParams.get("tz"));
  const region = pricingRegion(buyer, usdCheckoutEnabled());
  return Response.json({ region, buyerRegion: buyer, provider: checkoutProvider(region) }, { headers: { "cache-control": "private, no-store" } });
}
