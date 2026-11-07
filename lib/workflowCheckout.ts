// ---------------------------------------------------------------------------
// Buying Setu Workflow on setutechnology.com.
//
// One plan for 3 users, monthly or yearly; the region is worked out for the
// buyer exactly as for QR Menu (lib/qrMenuCheckout.ts, whose helpers this
// reuses). Prices come from content/en/pricing.json (slug setu-workflow), the
// same numbers /pricing and /products/workflow show. Firms that need more
// users buy through sales, who issue a key for the agreed number from the
// Setu Workflow owner console.
//
// Client-safe: no secrets here.
// ---------------------------------------------------------------------------

import pricing from "@/content/en/pricing.json";
import type { PricingAmounts, PricingRegionId } from "@/lib/pricing";
import type { Billing } from "@/lib/qrMenuCheckout";

/** Users every self-serve plan covers. */
export const WORKFLOW_INCLUDED_USERS = 3;
/** Each extra user, per month, arranged through sales. */
export const WORKFLOW_EXTRA_USER_USD = 4.99;

export function workflowAmounts(region: PricingRegionId): PricingAmounts {
  const entry = pricing.plans.find((p) => p.slug === "setu-workflow");
  const price = entry?.price as Record<PricingRegionId, PricingAmounts> | null | undefined;
  if (!price) throw new Error('content/en/pricing.json has no price for "setu-workflow".');
  return price[region];
}

/** What a Workflow order is tagged with at the gateway. */
export const WORKFLOW_PRODUCT_TAG = "setu-workflow";

/** The Setu Workflow app. */
export const WORKFLOW_APP_URL = (
  process.env.NEXT_PUBLIC_WORKFLOW_APP_URL || "https://workflow.setutechnology.com"
).replace(/\/+$/, "");
export const WORKFLOW_SIGNUP_URL = `${WORKFLOW_APP_URL}/signup`;

/**
 * Opens Admin → Subscription with the key filled in. The key goes after #,
 * which browsers never send to a server, so it stays out of logs.
 */
export function workflowRedeemUrl(key: string): string {
  return `${WORKFLOW_APP_URL}/admin/subscription#key=${encodeURIComponent(key)}`;
}

export function workflowPlanLabel(billing: Billing): string {
  return `Setu Workflow, ${billing === "yearly" ? "yearly" : "monthly"} (${WORKFLOW_INCLUDED_USERS} users)`;
}
