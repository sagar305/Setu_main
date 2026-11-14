import "server-only";

import { retailPaymentsEnabled } from "@/lib/featureFlags";

/** 404 for every /api/retail/* route while RETAIL_PAYMENTS_ENABLED is off, else null. */
export function retailPaymentsDisabledResponse(): Response | null {
  return retailPaymentsEnabled()
    ? null
    : Response.json({ error: "not_found" }, { status: 404, headers: { "cache-control": "no-store" } });
}

export { usdCheckoutEnabled } from "@/lib/qrMenuPaymentsGate";
