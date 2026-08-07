// Shared JSON-LD builders.
//
// Kept in one place so every product page describes pricing the same way, and
// so swapping the quote-based pattern for real published prices is a single
// edit rather than five.

import type { TeamMember } from "@/lib/team";
import type { PricingPlan } from "@/lib/pricing";

const SITE_URL = "https://setutechnology.com";

const REGIONS = [
  { id: "IN", currency: "INR" },
  { id: "INTL", currency: "USD" },
] as const;

export const TEAM_PAGE_PATH = "/team";

/** Canonical profile URL for a team member. */
export function teamMemberUrl(member: Pick<TeamMember, "slug">) {
  return `${SITE_URL}${TEAM_PAGE_PATH}#${member.slug}`;
}

/**
 * Person JSON-LD for a team member. Optional fields are only emitted when the
 * data actually exists, so an unfilled bio or photo never produces an empty
 * property that claims something we don't have.
 */
export function personSchema(member: TeamMember) {
  return {
    "@type": "Person",
    name: member.name,
    url: teamMemberUrl(member),
    jobTitle: member.role,
    ...(member.education.length > 0 ? { honorificSuffix: member.education.join(", ") } : {}),
    ...(member.image ? { image: `${SITE_URL}${member.image}` } : {}),
    ...(member.bio ? { description: member.bio } : {}),
    ...(member.social.length > 0 ? { sameAs: member.social.map((s) => s.href) } : {}),
    worksFor: {
      "@type": "Organization",
      name: "Setu Technology",
      url: SITE_URL,
    },
  };
}

type Availability = "InStock" | "PreOrder";

/** An Offer for a product that is genuinely free, with no paid tier gating it. */
export function freeOffer({ url }: { url: string }) {
  return {
    "@type": "Offer",
    price: "0",
    priceCurrency: "INR",
    availability: "https://schema.org/InStock",
    url: `${SITE_URL}${url}`,
  };
}

/**
 * Offers for a subscription plan: one Offer per currency × billing period.
 *
 * Prices are per business account and GST-inclusive, which is recorded on the
 * UnitPriceSpecification (`valueAddedTaxIncluded`) as well as in the page copy.
 * Returns undefined for products that are not purchasable yet.
 */
export function planOffers(plan: PricingPlan) {
  if (!plan.price) return undefined;

  const periods = [
    { key: "monthly", months: 1 },
    { key: "yearly", months: 12 },
  ] as const;

  const trialNote = plan.trial ? `${plan.trial}. ` : "";

  return REGIONS.flatMap(({ id, currency }) =>
    periods.map(({ key, months }) => {
      const amount = plan.price![id][key];
      return {
        "@type": "Offer",
        price: String(amount),
        priceCurrency: currency,
        availability: "https://schema.org/InStock",
        url: `${SITE_URL}/pricing`,
        description: `${trialNote}Billed per business account, inclusive of GST.`,
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: amount,
          priceCurrency: currency,
          valueAddedTaxIncluded: true,
          billingDuration: months,
          unitCode: "MON",
        },
      };
    }),
  );
}

/**
 * An Offer for a product sold on a quote.
 *
 * schema.org lets an Offer describe its price through `priceSpecification`
 * instead of a flat `price`, which is how we publish a real offer without
 * inventing a number. Google's SoftwareApplication rich result wants a concrete
 * `price`, so this shape may show a "missing field price" warning in the Rich
 * Results Test — a warning, not an error. Swap in `price` + `priceCurrency`
 * here as soon as pricing is public.
 */
export function quoteOffer({
  url,
  description,
  availability = "InStock",
}: {
  url: string;
  description: string;
  availability?: Availability;
}) {
  return {
    "@type": "Offer",
    availability: `https://schema.org/${availability}`,
    url: `${SITE_URL}${url}`,
    priceSpecification: {
      "@type": "PriceSpecification",
      priceCurrency: "INR",
      description,
    },
  };
}

/**
 * WebApplication JSON-LD for a free browser-based calculator or tool.
 *
 * These pages previously carried only FAQPage schema, so nothing described the
 * tool itself, who built it, or that it costs nothing. `author` is a
 * CreativeWork property and WebApplication is a CreativeWork, so crediting a
 * named person here is valid and gives AI systems an accountable source.
 */
export function toolApplicationSchema({
  name,
  description,
  path,
  author,
}: {
  name: string;
  description: string;
  path: string;
  author: TeamMember | undefined;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name,
    description,
    url: `${SITE_URL}${path}`,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    browserRequirements: "Requires JavaScript. Runs in any modern browser.",
    offers: freeOffer({ url: path }),
    ...(author ? { author: personSchema(author) } : {}),
    publisher: {
      "@type": "Organization",
      name: "Setu Technology",
      url: SITE_URL,
    },
  };
}

/**
 * Deliberately absent: `aggregateRating` and `review`.
 *
 * Both must reflect real, verifiable customer reviews. Add them here once there
 * is genuine review data (G2, Capterra, or collected first-party feedback) —
 * never synthesise a rating to fill the field.
 */
