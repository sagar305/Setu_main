import type { Metadata } from "next";
import Link from "next/link";
import { getWorkflowContent } from "@/lib/content";
import { quoteOffer } from "@/lib/schema";
import { PageHero } from "@/components/PageHero";
import { FadeIn } from "@/components/motion/FadeIn";

const content = getWorkflowContent();

export const metadata: Metadata = {
  title: content.seo.title,
  description: content.seo.description,
  keywords: content.seo.keywords,
  alternates: { canonical: "/products/workflow" },
  openGraph: {
    title: content.seo.title,
    description: content.seo.description,
    url: "/products/workflow",
    images: [
      {
        url: "/og/setu-og-image-1200x627.png",
        width: 1200,
        height: 627,
        alt: "Setu Technology - Setu for your business",
      },
      {
        url: "/og/setu-og-image-800x418.png",
        width: 800,
        height: 418,
        alt: "Setu Technology - Setu for your business",
      },
      {
        url: "/og/setu-og-image-500x261.png",
        width: 500,
        height: 261,
        alt: "Setu Technology - Setu for your business",
      },
    ],
  },
};

const softwareApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Setu Workflow",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: content.seo.description,
  offers: quoteOffer({
    url: "/contact",
    description: "Setu Workflow is a paid product that has not launched yet. Pricing will be announced at launch.",
    availability: "PreOrder",
  }),
  provider: {
    "@type": "Organization",
    name: "Setu Technology",
    url: "https://setutechnology.com",
  },
};

export default function WorkflowPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationSchema) }}
      />

      <PageHero
        eyebrow={content.hero.eyebrow}
        headline={content.hero.headline}
        subheadline={content.hero.subheadline}
      />

      <section className="mx-auto max-w-3xl px-6 pb-12">
        <FadeIn>
          <div className="rounded-xl border border-muted-line/30 bg-cream/60 p-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-warm">
              {content.status.label}
            </p>
            <p className="mt-1 text-sm text-ink/80">{content.status.text}</p>
          </div>
        </FadeIn>

        <FadeIn className="mt-10">
          <h2 className="text-2xl font-bold tracking-tight text-ink">{content.body.headline}</h2>
          {content.body.paragraphs.map((paragraph) => (
            <p key={paragraph} className="mt-4 text-lg leading-relaxed text-muted">
              {paragraph}
            </p>
          ))}
        </FadeIn>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-16">
        <FadeIn>
          <h2 className="text-2xl font-bold tracking-tight text-ink">{content.modules.headline}</h2>
          <p className="mt-3 max-w-2xl text-muted">{content.modules.subheadline}</p>
        </FadeIn>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {content.modules.items.map((item) => (
            <FadeIn key={item.title}>
              <div className="h-full rounded-2xl border border-indigo/15 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-ink">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{item.description}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-16">
        <FadeIn>
          <h2 className="text-2xl font-bold tracking-tight text-ink">{content.team.headline}</h2>
        </FadeIn>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {content.team.items.map((item) => (
            <FadeIn key={item.title}>
              <div className="h-full rounded-2xl border border-muted-line/30 bg-white/60 p-6">
                <h3 className="text-base font-semibold text-indigo">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{item.description}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-16">
        <FadeIn>
          <h2 className="text-2xl font-bold tracking-tight text-ink">{content.trust.headline}</h2>
          <ul className="mt-6 grid gap-2 sm:grid-cols-2">
            {content.trust.items.map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-ink/80">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-saffron" />
                {item}
              </li>
            ))}
          </ul>
        </FadeIn>

        <FadeIn className="mt-10">
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
