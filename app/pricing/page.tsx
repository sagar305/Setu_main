import type { Metadata } from "next";
import { getPricingContent } from "@/lib/content";
import {
  pharmacySoftwareEnabled,
  rentalSoftwareEnabled,
  repairSoftwareEnabled,
  tokenSystemEnabled,
} from "@/lib/featureFlags";
import { PageHero } from "@/components/PageHero";
import { PricingTable } from "@/components/PricingTable";
import { Faq } from "@/components/Faq";
import { CtaBanner } from "@/components/CtaBanner";

const rawContent = getPricingContent();

/**
 * An unreleased product has no card here, for the same reason it has none on
 * /products: a plan advertising a page that 404s is worse than either state on
 * its own. The slugs must match the ones in content/en/pricing.json.
 */
const content = {
  ...rawContent,
  plans: rawContent.plans.filter((plan) => {
    if (plan.slug === "free-token") return tokenSystemEnabled();
    if (plan.slug === "free-rental" || plan.slug === "setu-rental") return rentalSoftwareEnabled();
    if (plan.slug === "free-pharmacy" || plan.slug === "setu-pharmacy")
      return pharmacySoftwareEnabled();
    if (plan.slug === "free-repair" || plan.slug === "setu-repair") return repairSoftwareEnabled();
    return true;
  }),
};

export const metadata: Metadata = {
  title: content.seo.title,
  description: content.seo.description,
  keywords: content.seo.keywords,
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: content.seo.title,
    description: content.seo.description,
    url: "/pricing",
    images: [
      {
        url: "/og/setu-og-image-1200x627.png",
        width: 1200,
        height: 627,
        alt: "Setu Technology - Setu for your business",
      },
    ],
  },
};

// The per-product Offer data lives on each product page's SoftwareApplication
// schema. Here we describe the pricing questions themselves, which is what gets
// asked of an AI model ("which Setu products are free", "is it per outlet").
const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: content.faq.items.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: { "@type": "Answer", text: item.answer },
  })),
};

export default function PricingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <PageHero
        eyebrow={content.hero.eyebrow}
        headline={content.hero.headline}
        subheadline={content.hero.subheadline}
      />

      <PricingTable content={content} />

      <Faq headline={content.faq.headline} items={content.faq.items} />

      <CtaBanner
        headline="Not sure which one fits?"
        subtext="Tell us what you run and we'll point you at the right tool — almost everything here is free to open right now."
        cta={{ label: "Talk to us", href: "/contact" }}
      />
    </>
  );
}
