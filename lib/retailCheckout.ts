// ---------------------------------------------------------------------------
// Buying Setu Retail keys on setutechnology.com.
//
// The buyer picks a plan (Basic 1 branch, Gold 10, Platinum 100) and monthly
// or yearly; their region is worked out for them, exactly as for QR Menu
// (lib/qrMenuCheckout.ts, whose helpers this reuses). Prices come from
// content/en/pricing.json (slugs setu-retail-basic / -gold / -platinum), the
// same numbers /pricing and /products/retail show.
//
// Client-safe: no secrets here.
// ---------------------------------------------------------------------------

import pricing from "@/content/en/pricing.json";
import type { PricingAmounts, PricingRegionId } from "@/lib/pricing";
import type { Billing } from "@/lib/qrMenuCheckout";

export type RetailPlan = "basic" | "gold" | "platinum";
export const RETAIL_PLANS: readonly RetailPlan[] = ["basic", "gold", "platinum"];
export const RETAIL_PLAN_INFO: Record<RetailPlan, { name: string; branches: number }> = {
  basic: { name: "Basic", branches: 1 },
  gold: { name: "Gold", branches: 10 },
  platinum: { name: "Platinum", branches: 100 },
};

export function isRetailPlan(value: unknown): value is RetailPlan {
  return value === "basic" || value === "gold" || value === "platinum";
}

export function retailAmounts(plan: RetailPlan, region: PricingRegionId): PricingAmounts {
  const entry = pricing.plans.find((p) => p.slug === `setu-retail-${plan}`);
  const price = entry?.price as Record<PricingRegionId, PricingAmounts> | null | undefined;
  if (!price) throw new Error(`content/en/pricing.json has no price for "setu-retail-${plan}".`);
  return price[region];
}

/** What a Retail order is tagged with at the gateway: product and plan in one value. */
export const RETAIL_PRODUCT_PREFIX = "setu-retail.";
export const retailProductTag = (plan: RetailPlan) => `${RETAIL_PRODUCT_PREFIX}${plan}`;

/** The plan in a gateway tag, or null if the order isn't a Setu Retail one. */
export function planFromProductTag(tag: string | undefined | null): RetailPlan | null {
  if (!tag || !tag.startsWith(RETAIL_PRODUCT_PREFIX)) return null;
  const plan = tag.slice(RETAIL_PRODUCT_PREFIX.length);
  return isRetailPlan(plan) ? plan : null;
}

/** The Setu Retail app (production). */
export const RETAIL_APP_URL = (process.env.NEXT_PUBLIC_RETAIL_APP_URL || "https://app.setu-retail.setutechnology.com").replace(/\/+$/, "");
export const RETAIL_SIGNUP_URL = `${RETAIL_APP_URL}/sign-up`;
/** A demo copy of the app to look around in before signing up. */
export const RETAIL_DEMO_URL = (process.env.NEXT_PUBLIC_RETAIL_DEMO_URL || "https://demo.setu-retail.setutechnology.com").replace(/\/+$/, "");

/**
 * Opens Settings → Plan & key with the key filled in. The key goes after #,
 * which browsers never send to a server, so it stays out of logs.
 */
export function retailRedeemUrl(key: string): string {
  return `${RETAIL_APP_URL}/settings/plan#key=${encodeURIComponent(key)}`;
}

export function planLabel(plan: RetailPlan, billing: Billing): string {
  return `Setu Retail ${RETAIL_PLAN_INFO[plan].name}, ${billing === "yearly" ? "yearly" : "monthly"}`;
}
