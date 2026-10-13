import { NextRequest } from "next/server";
import { countryFromHeaders, regionFor } from "@/lib/qrMenuCheckout";

// Which price list the buy box opens on. Checkout works the region out again
// on its own rather than trusting what the page sends.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const timezone = request.nextUrl.searchParams.get("tz");
  return Response.json(
    { region: regionFor(countryFromHeaders(request.headers), timezone) },
    { headers: { "cache-control": "private, no-store" } }
  );
}
