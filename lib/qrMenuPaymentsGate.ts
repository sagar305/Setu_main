import "server-only";

import { qrMenuPaymentsEnabled } from "@/lib/featureFlags";

/**
 * The response every /api/qr-menu/* route gives while QR_MENU_PAYMENTS_ENABLED
 * is off, or null when payments are on. A 404 rather than a 503, so a switched
 * off feature looks absent instead of broken.
 */
export function paymentsDisabledResponse(): Response | null {
  return qrMenuPaymentsEnabled()
    ? null
    : Response.json({ error: "not_found" }, { status: 404, headers: { "cache-control": "no-store" } });
}
