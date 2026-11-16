import { NextRequest } from "next/server";
import { checkoutProvider, countryFromHeaders, pricingRegion, regionFor } from "@/lib/qrMenuCheckout";
import { workflowPaymentsDisabledResponse, usdCheckoutEnabled } from "@/lib/workflowPaymentsGate";

// Which price list the Workflow buy box opens on (checkout works it out again itself).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const disabled = workflowPaymentsDisabledResponse();
  if (disabled) return disabled;
  const buyer = regionFor(countryFromHeaders(request.headers), request.nextUrl.searchParams.get("tz"));
  const region = pricingRegion(buyer, usdCheckoutEnabled());
  return Response.json({ region, buyerRegion: buyer, provider: checkoutProvider(region) }, { headers: { "cache-control": "private, no-store" } });
}
