import type { Metadata } from "next";
import Link from "next/link";
import { getRestaurantPosContent } from "@/lib/content";
import { PageHero } from "@/components/PageHero";
import { RestaurantPosShowcase } from "@/components/RestaurantPosShowcase";
import { Faq } from "@/components/Faq";
import { FadeIn } from "@/components/motion/FadeIn";

const content = getRestaurantPosContent();

export const metadata: Metadata = {
  title: content.seo.title,
  description: content.seo.description,
  keywords: content.seo.keywords,
  alternates: { canonical: "/products/restaurant-pos" },
  openGraph: {
    title: content.seo.title,
    description: content.seo.description,
    url: "/products/restaurant-pos",
  },
};

const softwareApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Setu POS",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web, Android, iOS",
  description: content.seo.description,
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: content.faq.items.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: { "@type": "Answer", text: item.answer },
  })),
};

export default function RestaurantPosPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationSchema) }}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      <PageHero
        eyebrow={content.hero.eyebrow}
        headline={content.hero.headline}
        subheadline={content.hero.subheadline}
      />

      <section className="mx-auto max-w-3xl px-6 pb-4 pt-8 text-center">
        <FadeIn>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-warm">{content.showcase.eyebrow}</p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-ink">{content.showcase.headline}</h2>
          <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-muted">{content.showcase.subtext}</p>
        </FadeIn>
      </section>

      <RestaurantPosShowcase features={content.features} />

      <Faq headline={content.faq.headline} items={content.faq.items} />

      <section className="bg-indigo py-16 text-center text-cream-paper">
        <div className="mx-auto max-w-2xl px-6">
          <h2 className="text-3xl font-bold tracking-tight">{content.cta.headline}</h2>
          <p className="mt-4 text-lg text-cream-paper/85">{content.cta.subtext}</p>
          <Link
            href={content.cta.cta.href}
            className="mt-8 inline-block rounded-full bg-saffron px-7 py-3 text-sm font-semibold text-ink transition hover:brightness-95"
          >
            {content.cta.cta.label} →
          </Link>
        </div>
      </section>
    </>
  );
}
