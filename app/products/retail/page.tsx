import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { getPricingContent, getPricingPlan, getRetailContent } from "@/lib/content";
import { retailPaymentsEnabled } from "@/lib/featureFlags";
import { formatPrice } from "@/lib/pricing";
import { faqPageSchema, planOffers } from "@/lib/schema";
import { RETAIL_SIGNUP_URL } from "@/lib/retailCheckout";
import { PageHero } from "@/components/PageHero";
import { FadeIn } from "@/components/motion/FadeIn";
import { RetailBuy } from "@/components/RetailBuy";

const content = getRetailContent();
const regions = getPricingContent().regions;
const PLANS = (["basic", "gold", "platinum"] as const).map((slug) => getPricingPlan(`setu-retail-${slug}`)!).filter(Boolean);

export const metadata: Metadata = {
  title: content.seo.title,
  description: content.seo.description,
  keywords: content.seo.keywords,
  alternates: { canonical: "/products/retail" },
  openGraph: {
    title: content.seo.title,
    description: content.seo.description,
    url: "/products/retail",
    images: [
      { url: "/og/setu-og-image-1200x627.png", width: 1200, height: 627, alt: "Setu Retail - cloud POS for shops" },
      { url: "/og/setu-og-image-800x418.png", width: 800, height: 418, alt: "Setu Retail - cloud POS for shops" },
    ],
  },
};

const softwareApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Setu Retail",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web, Android, iOS, Windows",
  description: content.seo.description,
  offers: PLANS.flatMap((plan) => planOffers(plan) ?? []),
  provider: { "@type": "Organization", name: "Setu Technology", url: "https://setutechnology.com" },
};

export default function RetailPage() {
  const buying = retailPaymentsEnabled();
  const inr = regions.find((r) => r.id === "IN")!;
  const usd = regions.find((r) => r.id === "INTL")!;
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageSchema(content.faq, { hreflang: "en", path: "/products/retail" })) }} />

      <PageHero eyebrow={content.hero.eyebrow} headline={content.hero.headline} subheadline={content.hero.subheadline} />

      <section className="mx-auto -mt-4 flex max-w-5xl flex-wrap justify-center gap-3 px-6 pb-10">
        <a href={RETAIL_SIGNUP_URL} className="rounded-full bg-saffron px-7 py-3 text-sm font-semibold text-ink transition hover:brightness-95">
          Start free trial →
        </a>
        <a href="#plans" className="rounded-full border border-indigo/30 px-7 py-3 text-sm font-semibold text-indigo transition hover:bg-indigo/5">
          See plans
        </a>
      </section>

      <section aria-labelledby="features" className="mx-auto max-w-6xl px-6 pb-16">
        <h2 id="features" className="sr-only">
          Features
        </h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {content.features.map((f) => (
            <FadeIn key={f.title}>
              <article className="h-full rounded-2xl border border-muted-line/30 bg-white p-6">
                <h3 className="text-lg font-bold text-ink">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{f.text}</p>
              </article>
            </FadeIn>
          ))}
        </div>
      </section>

      <section id="plans" aria-labelledby="plans-h" className="scroll-mt-24 bg-cream/60 py-16">
        <div className="mx-auto max-w-6xl px-6">
          <h2 id="plans-h" className="text-center text-3xl font-bold tracking-tight text-ink">
            {content.plansHeadline}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-muted">{content.plansNote}</p>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {PLANS.map((plan) => (
              <article key={plan.slug} className="flex flex-col rounded-2xl border border-muted-line/30 bg-white p-6">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-lg font-bold text-ink">{plan.name.replace("Setu Retail ", "")}</h3>
                  <span className="whitespace-nowrap rounded-full bg-saffron/20 px-3 py-1 text-xs font-semibold text-ink">{plan.freeNote}</span>
                </div>
                <p className="mt-4 text-3xl font-bold tracking-tight text-ink">
                  {formatPrice(plan.price!.IN.monthly, inr)}
                  <span className="ml-1 text-sm font-semibold text-muted">/month</span>
                </p>
                <p className="mt-1 text-xs text-muted">
                  or {formatPrice(plan.price!.IN.yearly, inr)}/year · {formatPrice(plan.price!.INTL.monthly, usd)}/month outside India
                </p>
                <ul className="mt-5 flex-1 space-y-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2.5 text-sm text-muted">
                      <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo" aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <a
                  href={buying && plan.slug !== "setu-retail-basic" ? `/products/retail?plan=${plan.slug.replace("setu-retail-", "")}#buy` : RETAIL_SIGNUP_URL}
                  className="mt-6 rounded-full bg-indigo px-5 py-2.5 text-center text-sm font-semibold text-cream-paper transition hover:bg-ink"
                >
                  {buying ? plan.cta.label : "Start free trial"}
                </a>
              </article>
            ))}
          </div>
          <p className="mt-6 text-center text-sm text-muted">
            {content.contactSales.text}{" "}
            <Link href={content.contactSales.cta.href} className="font-semibold text-indigo hover:underline">
              {content.contactSales.cta.label} →
            </Link>
          </p>
        </div>
      </section>

      <section aria-labelledby="how-h" className="mx-auto max-w-5xl px-6 py-16">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <h2 id="how-h" className="text-2xl font-bold tracking-tight text-ink">
              {content.howKeys.headline}
            </h2>
            <ol className="mt-5 list-decimal space-y-3 pl-5 text-muted">
              {content.howKeys.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </div>
          <div id="buy" className="scroll-mt-24">
            {buying ? (
              <RetailBuy />
            ) : (
              <div className="rounded-2xl border border-indigo/15 bg-white p-6 shadow-sm sm:p-8">
                <h3 className="text-xl font-bold text-ink">Start with 3 months free</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">Online purchase of keys opens soon. Start your free trial now; your data stays when you buy a plan.</p>
                <a href={RETAIL_SIGNUP_URL} className="mt-6 inline-block rounded-lg bg-indigo px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700">
                  Start free trial
                </a>
              </div>
            )}
          </div>
        </div>
      </section>

      <section aria-labelledby="faq-h" className="mx-auto max-w-3xl px-6 pb-16">
        <h2 id="faq-h" className="text-2xl font-bold tracking-tight text-ink">
          Questions
        </h2>
        <dl className="mt-6 divide-y divide-muted-line/30 rounded-2xl border border-muted-line/30 bg-white">
          {content.faq.map((item) => (
            <div key={item.question} className="p-5">
              <dt className="font-semibold text-ink">{item.question}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted">{item.answer}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-8 text-sm text-muted">
          {content.crossSell.text}{" "}
          <Link href={content.crossSell.cta.href} className="font-semibold text-indigo hover:underline">
            {content.crossSell.cta.label} →
          </Link>
        </p>
      </section>

      <section className="bg-indigo py-16 text-center text-cream-paper">
        <div className="mx-auto max-w-2xl px-6">
          <h2 className="text-3xl font-bold tracking-tight">{content.cta.headline}</h2>
          <p className="mt-4 text-lg text-cream-paper/85">{content.cta.subtext}</p>
          <a href={content.cta.cta.href} className="mt-8 inline-block rounded-full bg-saffron px-7 py-3 text-sm font-semibold text-ink transition hover:brightness-95">
            {content.cta.cta.label} →
          </a>
        </div>
      </section>
    </>
  );
}
