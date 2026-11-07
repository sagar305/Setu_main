import type { Metadata } from "next";
import Link from "next/link";
import { Check, Gift, KeyRound, Users } from "lucide-react";
import { getWorkflowContent, getPricingPlan } from "@/lib/content";
import { planOffers } from "@/lib/schema";
import { workflowPaymentsEnabled } from "@/lib/featureFlags";
import { WORKFLOW_INCLUDED_USERS, WORKFLOW_SIGNUP_URL } from "@/lib/workflowCheckout";
import { PageHero } from "@/components/PageHero";
import { FadeIn } from "@/components/motion/FadeIn";
import { WorkflowBuy } from "@/components/WorkflowBuy";
import { WorkflowRolesShowcase } from "@/components/WorkflowRolesShowcase";

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
  offers: planOffers(getPricingPlan("setu-workflow")!),
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
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <a
              href={WORKFLOW_SIGNUP_URL}
              className="inline-flex items-center gap-2 rounded-lg border border-indigo bg-indigo px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              Start your 15-day free trial
            </a>
            <a
              href={workflowPaymentsEnabled() ? "#buy" : "#pricing"}
              className="inline-flex items-center gap-2 rounded-lg border border-indigo/30 px-5 py-3 text-sm font-semibold text-indigo transition hover:bg-indigo/5"
            >
              <KeyRound className="h-4 w-4" />
              {workflowPaymentsEnabled() ? "Buy a key" : "See pricing"}
            </a>
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

      {/* Roles: an auto-playing walkthrough of what each person sees and does */}
      <section id="roles" className="mx-auto max-w-6xl scroll-mt-24 px-6 pb-16">
        <FadeIn>
          <h2 className="text-2xl font-bold tracking-tight text-ink">{content.roles.headline}</h2>
          <p className="mt-3 max-w-2xl text-muted">{content.roles.subheadline}</p>
        </FadeIn>
        <FadeIn className="mt-8">
          <WorkflowRolesShowcase roles={content.roles.items} />
        </FadeIn>
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

      {/* Pricing; scroll-mt keeps the heading clear of the sticky nav on a #pricing link */}
      <section id="pricing" className="mx-auto max-w-5xl scroll-mt-24 px-6 pb-16">
        <FadeIn>
          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-saffron/20 px-3 py-1 text-xs font-bold uppercase tracking-wide text-ink">
              <Gift className="h-3.5 w-3.5" />
              {content.pricing.badge}
            </span>
            <h2 className="mt-4 text-3xl font-bold text-ink">{content.pricing.title}</h2>
            <p className="mx-auto mt-3 max-w-2xl text-muted">{content.pricing.subtitle}</p>
          </div>
        </FadeIn>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {content.pricing.plans.map((plan) => (
            <FadeIn key={plan.region}>
              <div className="h-full rounded-2xl border border-indigo/15 bg-white p-8 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-warm">{plan.region}</p>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-ink">{plan.monthlyLabel}</span>
                  <span className="text-sm text-muted">/ month</span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-lg font-semibold text-ink">{plan.yearlyLabel}</span>
                  <span className="text-sm text-muted">/ year</span>
                  <span className="rounded-full bg-saffron/20 px-2 py-0.5 text-[11px] font-semibold text-ink">
                    {plan.saveLabel}
                  </span>
                </div>
                <p className="mt-4 flex items-center gap-2 text-sm text-muted">
                  <Check className="h-4 w-4 text-indigo" />
                  {WORKFLOW_INCLUDED_USERS} users, every module included.
                </p>
              </div>
            </FadeIn>
          ))}
        </div>
        <FadeIn>
          <div className="mt-8 rounded-2xl border border-muted-line/20 bg-white p-8">
            <h3 className="font-bold text-ink">Included on every plan</h3>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {content.pricing.includes.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-ink/80">
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </FadeIn>
        <FadeIn>
          <p className="mt-6 flex items-start gap-2 rounded-xl border border-muted-line/30 bg-cream/60 p-4 text-sm text-ink/80">
            <Users className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo" />
            <span>
              {content.pricing.extraUsers}{" "}
              <Link href="/contact" className="font-semibold text-indigo hover:underline">
                Contact sales →
              </Link>
            </span>
          </p>
          <p className="mt-4 text-xs text-muted">{content.pricing.note}</p>
        </FadeIn>
        {/* scroll-mt keeps the box clear of the sticky nav on a #buy link */}
        {workflowPaymentsEnabled() && (
          <div id="buy" className="mt-8 scroll-mt-24">
            <WorkflowBuy />
          </div>
        )}
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
