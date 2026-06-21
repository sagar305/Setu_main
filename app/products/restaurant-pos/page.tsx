import type { Metadata } from "next";
import Link from "next/link";
import { getRestaurantPosContent } from "@/lib/content";
import { PageHero } from "@/components/PageHero";

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

export default function RestaurantPosPage() {
  return (
    <>
      <PageHero
        eyebrow={content.hero.eyebrow}
        headline={content.hero.headline}
        subheadline={content.hero.subheadline}
      />

      <section className="mx-auto max-w-5xl px-6 py-12">
        <div className="grid gap-6 sm:grid-cols-2">
          {content.features.map((feature) => (
            <div key={feature.heading} className="rounded-2xl border border-indigo/15 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-ink">{feature.heading}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

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
