// Shared JSON-LD builders.
//
// Kept in one place so every product page describes pricing the same way, and
// so swapping the quote-based pattern for real published prices is a single
// edit rather than five.

const SITE_URL = "https://setutechnology.com";

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
 * Deliberately absent: `aggregateRating` and `review`.
 *
 * Both must reflect real, verifiable customer reviews. Add them here once there
 * is genuine review data (G2, Capterra, or collected first-party feedback) —
 * never synthesise a rating to fill the field.
 */
