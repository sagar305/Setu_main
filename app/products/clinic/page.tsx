import type { Metadata } from "next";
import Link from "next/link";
import { getClinicContent } from "@/lib/content";
import { PageHero } from "@/components/PageHero";
import { FadeIn } from "@/components/motion/FadeIn";

const content = getClinicContent();

export const metadata: Metadata = {
  title: content.seo.title,
  description: content.seo.description,
  keywords: content.seo.keywords,
  alternates: { canonical: "/products/clinic" },
  openGraph: {
    title: content.seo.title,
    description: content.seo.description,
    url: "/products/clinic",
  },
};

export default function ClinicPage() {
  return (
    <>
      <PageHero
        eyebrow={content.hero.eyebrow}
        headline={content.hero.headline}
        subheadline={content.hero.subheadline}
      />

      <section className="mx-auto max-w-3xl px-6 pb-12">
        <FadeIn>
          <h2 className="text-2xl font-bold tracking-tight text-ink">{content.body.headline}</h2>
          {content.body.paragraphs.map((paragraph) => (
            <p key={paragraph} className="mt-4 text-lg leading-relaxed text-muted">
              {paragraph}
            </p>
          ))}
        </FadeIn>

        <FadeIn className="mt-8">
          <p className="text-sm text-muted">
            {content.crossSell.text}{" "}
            <Link href={content.crossSell.cta.href} className="font-semibold text-indigo hover:underline">
              {content.crossSell.cta.label} →
            </Link>
          </p>
        </FadeIn>
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
