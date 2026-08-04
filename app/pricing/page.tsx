import type { Metadata } from "next";
import { getPricingContent } from "@/lib/content";
import { PageHero } from "@/components/PageHero";
import { PricingTable } from "@/components/PricingTable";
import { Faq } from "@/components/Faq";
import { CtaBanner } from "@/components/CtaBanner";

const content = getPricingContent();

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
// asked of an AI model ("what does Setu Dine cost", "is it per outlet").
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
        headline="Not sure which plan fits?"
        subtext="Book a free demo and we'll walk through your setup before you pay for anything."
        cta={{ label: "Book your free demo", href: "/book-demo?product=Setu%20Dine" }}
      />
    </>
  );
}
