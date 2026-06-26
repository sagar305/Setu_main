import type { Metadata } from "next";
import Link from "next/link";
import { getQueueContent } from "@/lib/content";
import { PageHero } from "@/components/PageHero";
import { QueueShowcase } from "@/components/QueueShowcase";
import { Faq } from "@/components/Faq";
import { FadeIn, FadeInStagger, FadeInStaggerItem } from "@/components/motion/FadeIn";

const content = getQueueContent();

export const metadata: Metadata = {
  title: content.seo.title,
  description: content.seo.description,
  keywords: content.seo.keywords,
  alternates: { canonical: "/products/queue" },
  openGraph: {
    title: content.seo.title,
    description: content.seo.description,
    url: "/products/queue",
  },
  twitter: {
    title: content.seo.title,
    description: content.seo.description,
  },
};

const softwareApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Setu Queue",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: content.seo.description,
  offers: {
    "@type": "Offer",
    availability: "https://schema.org/InStock",
  },
  provider: {
    "@type": "Organization",
    name: "Setu Technology",
    url: "https://setutechnology.com",
  },
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

export default function QueuePage() {
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

      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-4 px-6 pb-12">
        <Link
          href={content.hero.primaryCta.href}
          className="rounded-full bg-indigo px-7 py-3 text-sm font-semibold text-cream-paper transition hover:bg-ink"
        >
          {content.hero.primaryCta.label} →
        </Link>
        <Link
          href={content.hero.secondaryCta.href}
          className="rounded-full border border-muted-line/40 px-7 py-3 text-sm font-semibold text-ink transition hover:border-indigo hover:text-indigo"
        >
          {content.hero.secondaryCta.label} ↓
        </Link>
      </div>

      <section className="mx-auto max-w-3xl px-6 pb-4 pt-8 text-center">
        <FadeIn>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-warm">{content.showcase.eyebrow}</p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-ink">{content.showcase.headline}</h2>
          <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-muted">{content.showcase.subtext}</p>
        </FadeIn>
      </section>

      <QueueShowcase features={content.features} />

      <section id="how-it-works" className="bg-cream py-16">
        <div className="mx-auto max-w-4xl px-6">
          <FadeIn>
            <h2 className="text-center text-3xl font-bold tracking-tight text-ink">{content.howItWorks.headline}</h2>
          </FadeIn>

          <FadeInStagger className="mt-10 grid gap-6 md:grid-cols-3">
            {content.howItWorks.steps.map((step, index) => (
              <FadeInStaggerItem
                key={step.title}
                className="rounded-2xl border border-muted-line/30 bg-white p-6"
              >
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-saffron">
                  Step {index + 1}
                </span>
                <h3 className="mt-3 text-lg font-bold text-ink">{step.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted">{step.body}</p>
              </FadeInStaggerItem>
            ))}
          </FadeInStagger>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <FadeIn>
            <h2 className="text-3xl font-bold tracking-tight text-ink">{content.builtFor.headline}</h2>
          </FadeIn>
          <FadeInStagger className="mt-8 flex flex-wrap justify-center gap-3">
            {content.builtFor.tags.map((tag) => (
              <FadeInStaggerItem
                key={tag}
                className="rounded-full bg-cream px-4 py-2 text-sm font-medium text-ink"
              >
                {tag}
              </FadeInStaggerItem>
            ))}
          </FadeInStagger>
        </div>
      </section>

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
