// Client-safe pricing types and formatting.
//
// Prices are per business account and inclusive of GST — see `billingNote` in
// content/en/pricing.json, which is the single place that wording lives.

export type PricingRegionId = "IN" | "INTL";

export type PricingRegion = {
  id: PricingRegionId;
  label: string;
  currency: "INR" | "USD";
  symbol: string;
};

export type PricingAmounts = { monthly: number; yearly: number };

export type PricingPlan = {
  slug: string;
  name: string;
  href: string;
  status: "free" | "paid" | "in-development";
  summary: string;
  /** Short badge, e.g. "First month free". */
  freeNote: string;
  trial: string | null;
  /** Null for products that are not yet purchasable. */
  price: Record<PricingRegionId, PricingAmounts> | null;
  features: string[];
  cta: { label: string; href: string };
};

export type PricingContent = {
  seo: { title: string; description: string; keywords: string[] };
  hero: { eyebrow: string; headline: string; subheadline: string };
  billingNote: string;
  regions: PricingRegion[];
  plans: PricingPlan[];
  faq: { headline: string; items: { question: string; answer: string }[] };
};

/**
 * Formats an amount for display. Rupee amounts are whole numbers and use the
 * Indian digit grouping (4,999 not 4999); dollar amounts keep their cents.
 */
export function formatPrice(amount: number, region: PricingRegion): string {
  if (amount === 0) return `${region.symbol}0`;
  const formatted =
    region.currency === "INR"
      ? new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(amount)
      : amount.toFixed(2);
  return `${region.symbol}${formatted}`;
}

/** Yearly saving vs paying monthly for twelve months, as a whole percentage. */
export function yearlySavingPercent(amounts: PricingAmounts): number | null {
  const twelveMonths = amounts.monthly * 12;
  if (twelveMonths <= 0 || amounts.yearly <= 0 || amounts.yearly >= twelveMonths) return null;
  return Math.round(((twelveMonths - amounts.yearly) / twelveMonths) * 100);
}
