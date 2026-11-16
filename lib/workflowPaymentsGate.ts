import "server-only";

import { workflowPaymentsEnabled } from "@/lib/featureFlags";

/** 404 for every /api/workflow/* route while WORKFLOW_PAYMENTS_ENABLED is off, else null. */
export function workflowPaymentsDisabledResponse(): Response | null {
  return workflowPaymentsEnabled()
    ? null
    : Response.json({ error: "not_found" }, { status: 404, headers: { "cache-control": "no-store" } });
}

export { usdCheckoutEnabled } from "@/lib/qrMenuPaymentsGate";
