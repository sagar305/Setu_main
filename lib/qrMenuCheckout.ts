// ---------------------------------------------------------------------------
// Buying Setu QR Menu time on setutechnology.com.
//
// The buyer picks monthly or yearly; their region is worked out for them. The
// price comes from content/en/pricing.json, the same numbers /pricing and the
// product page show, so there is no second price list to drift.
//
// Client-safe: no secrets here. The Cashfree calls live in lib/cashfree.ts.
// ---------------------------------------------------------------------------

import pricing from "@/content/en/pricing.json";
import type { PricingAmounts, PricingRegion, PricingRegionId } from "@/lib/pricing";

export type Billing = "monthly" | "yearly";

export const BILLINGS: readonly Billing[] = ["monthly", "yearly"];

/** How much premium one purchase adds. */
export const BILLING_DAYS: Record<Billing, number> = { monthly: 30, yearly: 365 };

export function isBilling(value: unknown): value is Billing {
  return value === "monthly" || value === "yearly";
}

const qrMenuPlan = pricing.plans.find((plan) => plan.slug === "qr-menu");

export function qrMenuRegion(id: PricingRegionId): PricingRegion {
  return pricing.regions.find((region) => region.id === id) as PricingRegion;
}

export function qrMenuAmounts(region: PricingRegionId): PricingAmounts {
  const price = qrMenuPlan?.price as Record<PricingRegionId, PricingAmounts> | null | undefined;
  if (!price) throw new Error('content/en/pricing.json has no price for "qr-menu".');
  return price[region];
}

/** Timezones that can only mean India, for when the host sends no country. */
const INDIAN_TIMEZONES = new Set(["Asia/Kolkata", "Asia/Calcutta"]);

/**
 * India pays in rupees, everyone else in dollars. The country comes from the
 * host's geo header when there is one (Vercel, Cloudflare); otherwise the
 * browser's timezone is a good enough signal for a two-way split.
 */
export function regionFor(country?: string | null, timezone?: string | null): PricingRegionId {
  const code = country?.trim().toUpperCase();
  if (code && /^[A-Z]{2}$/.test(code) && code !== "XX") return code === "IN" ? "IN" : "INTL";
  return timezone && INDIAN_TIMEZONES.has(timezone) ? "IN" : "INTL";
}

/**
 * The price list to charge: the buyer's own region, except that outside India
 * falls back to rupees while USD charging is switched off (see
 * qrMenuUsdEnabled in lib/featureFlags.ts — passed in to keep this file
 * client-safe).
 */
export function pricingRegion(buyer: PricingRegionId, usdEnabled: boolean): PricingRegionId {
  return buyer === "INTL" && !usdEnabled ? "IN" : buyer;
}

/** The country header set by whichever host is in front of the site, if any. */
export function countryFromHeaders(headers: Headers): string | null {
  return (
    headers.get("x-vercel-ip-country") ??
    headers.get("cf-ipcountry") ??
    headers.get("cloudfront-viewer-country") ??
    null
  );
}

/**
 * Cashfree wants a bare phone number. An Indian number is its last ten digits
 * (dropping +91 or a leading 0); elsewhere the full international number is
 * kept. Null when it cannot be a phone number at all.
 */
export function normaliseCheckoutPhone(input: string, region: PricingRegionId): string | null {
  const digits = input.replace(/\D/g, "");
  if (region === "IN") {
    const local = digits.replace(/^(91|0)(?=\d{10}$)/, "");
    return /^[6-9]\d{9}$/.test(local) ? local : null;
  }
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isCheckoutEmail(input: string): boolean {
  return input.length <= 254 && EMAIL.test(input);
}
