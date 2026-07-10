import type { Metadata } from "next";
import Link from "next/link";
import type { ComponentType } from "react";
import {
  Coffee,
  Store,
  Cloud,
  UtensilsCrossed,
  Receipt,
  ChefHat,
  Bell,
  ShoppingBag,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import { getQueueContent } from "@/lib/content";
import { PageHero } from "@/components/PageHero";
import { QueueShowcase } from "@/components/QueueShowcase";
import { QueueHeroVisual } from "@/components/QueueHeroVisual";
import { Faq } from "@/components/Faq";
import { FadeIn, FadeInStagger, FadeInStaggerItem } from "@/components/motion/FadeIn";

const content = getQueueContent();

export const metadata: Metadata = {
  title: content.seo.title,
  description: content.seo.description,
  keywords: content.seo.keywords,
  alternates: { canonical: "/products/queue" },
  openGraph: {
    title: content.seo.ogTitle,
    description: content.seo.ogDescription,
    url: "/products/queue",
    images: [
      {
        url: "/og/setu-og-image.png",
        width: 1200,
        height: 630,
        alt: "Setu Technology - Setu for your business",
      },
    ],
  },
  twitter: {
    title: content.seo.ogTitle,
    description: content.seo.ogDescription,
  },
};

const softwareApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Setu Queue",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: content.seo.schemaDescription,
  offers: {
    "@type": "Offer",
    availability: "https://schema.org/InStock",
  },
  provider: {
    "@type": "Organization",
    name: "Setu Technology",
    url: "https://setutechnology.com",
    images: [
      {
        url: "/og/setu-og-image.png",
        width: 1200,
        height: 630,
        alt: "Setu Technology - Setu for your business",
      },
    ],
  },
};

const sectionIcons: Record<string, ComponentType<{ className?: string }>> = {
  coffee: Coffee,
  store: Store,
  cloud: Cloud,
  utensils: UtensilsCrossed,
  receipt: Receipt,
  "chef-hat": ChefHat,
  bell: Bell,
  "shopping-bag": ShoppingBag,
  "trending-up": TrendingUp,
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

      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-4 px-6 pb-10">
        <Link
          href={content.hero.primaryCta.href}
          className="rounded-full bg-indigo px-7 py-3 text-sm font-semibold text-cream-paper transition hover:bg-ink"
        >
          {content.hero.primaryCta.label} →
        </Link>
      </div>

      <QueueHeroVisual />

      <section className="pb-16 pt-2">
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center">
            <FadeIn>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-warm">{content.builtFor.headline}</p>
            </FadeIn>
            <FadeInStagger className="mt-5 flex flex-wrap justify-center gap-3">
              {content.builtFor.tags.map((tag) => {
                const Icon = sectionIcons[tag.icon];
                return (
                  <FadeInStaggerItem
                    key={tag.label}
                    className="flex items-center gap-2.5 rounded-full border border-muted-line/40 bg-white py-1.5 pl-2 pr-5 text-sm font-semibold text-ink"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo">
                      <Icon className="h-4 w-4 text-cream-paper" aria-hidden="true" />
                    </span>
                    {tag.label}
                  </FadeInStaggerItem>
                );
              })}
            </FadeInStagger>
          </div>

          <FadeIn className="mt-12">
            <div className="rounded-3xl border border-muted-line/30 bg-white p-8 md:p-10">
              <p className="text-center text-xs font-semibold uppercase tracking-[0.3em] text-muted-warm">
                {content.workflow.headline}
              </p>
              <div className="mt-9 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-5">
                {content.workflow.steps.map((step, index) => {
                  const Icon = sectionIcons[step.icon];
                  return (
                    <div
                      key={step.label}
                      className="relative flex flex-col items-center text-center last:col-span-2 md:last:col-span-1"
                    >
                      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo">
                        <Icon className="h-6 w-6 text-cream-paper" aria-hidden="true" />
                      </span>
                      <span className="mt-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-saffron">
                        Step {index + 1}
                      </span>
                      <p className="mt-1 text-sm font-semibold text-ink">{step.label}</p>
                      {index < content.workflow.steps.length - 1 && (
                        <ArrowRight
                          className="absolute -right-3.5 top-4 hidden h-5 w-5 text-muted-line md:block"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="mx-auto mt-9 max-w-xl border-t border-muted-line/20 pt-6 text-center text-sm leading-relaxed text-muted">
                {content.workflow.note}
              </p>
            </div>
          </FadeIn>
        </div>
      </section>

      <section className="bg-indigo py-16 text-center text-cream-paper">
        <div className="mx-auto max-w-3xl px-6">
          <FadeIn>
            <h2 className="text-3xl font-bold tracking-tight">{content.differentiator.headline}</h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-cream-paper/85">
              {content.differentiator.subtext}
            </p>
            <div className="mx-auto mt-8 flex flex-wrap items-center justify-center gap-x-3 gap-y-4">
              {content.differentiator.chain.map((step, index) => (
                <div key={step} className="flex items-center gap-3">
                  <span className="rounded-full bg-saffron px-4 py-2 text-sm font-semibold text-ink">{step}</span>
                  {index < content.differentiator.chain.length - 1 && (
                    <span className="text-cream-paper/60" aria-hidden="true">→</span>
                  )}
                </div>
              ))}
            </div>
            <p className="mx-auto mt-6 max-w-xl text-sm font-medium text-cream-paper/85">
              {content.differentiator.note}
            </p>
          </FadeIn>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-4 pt-16 text-center">
        <FadeIn>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-warm">{content.showcase.eyebrow}</p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-ink">{content.showcase.headline}</h2>
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

      <section className="bg-cream py-16">
        <div className="mx-auto max-w-3xl px-6">
          <FadeIn>
            <h2 className="text-center text-3xl font-bold tracking-tight text-ink">{content.comparison.headline}</h2>
          </FadeIn>

          <FadeIn>
            <div className="mt-10 overflow-hidden rounded-2xl border border-muted-line/30 bg-white">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-muted-line/30">
                    <th className="px-5 py-4 font-semibold text-muted-warm"></th>
                    {content.comparison.columns.map((col) => (
                      <th key={col.name} className="px-5 py-4 font-bold text-ink">
                        {col.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: "Service style", key: "serviceStyle" as const },
                    { label: "Customer experience", key: "customerExperience" as const },
                    { label: "Best for", key: "bestFor" as const },
                    { label: "Key feature", key: "keyFeature" as const },
                  ].map((row) => (
                    <tr key={row.key} className="border-b border-muted-line/15 last:border-0">
                      <td className="px-5 py-4 font-semibold text-muted-warm">{row.label}</td>
                      {content.comparison.columns.map((col) => (
                        <td key={col.name} className="px-5 py-4 text-muted">
                          {col[row.key]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mx-auto mt-6 max-w-2xl text-center text-sm leading-relaxed text-muted">
              {content.comparison.footnote}
            </p>
          </FadeIn>
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
