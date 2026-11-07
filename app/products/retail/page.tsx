import type { Metadata } from "next";
import Link from "next/link";
import type { ComponentType } from "react";
import {
  ArrowLeftRight,
  Banknote,
  Barcode,
  BookUser,
  Building2,
  CalendarRange,
  Check,
  ClipboardList,
  CloudOff,
  CreditCard,
  DatabaseBackup,
  FileSpreadsheet,
  Globe,
  HandCoins,
  Hash,
  History,
  LayoutDashboard,
  Layers,
  Lock,
  Minus,
  Palette,
  PauseCircle,
  Percent,
  PieChart,
  Printer,
  Receipt,
  RotateCcw,
  ScanBarcode,
  ShieldCheck,
  Tags,
  Timer,
  TrendingUp,
  TriangleAlert,
  Undo2,
  UserPlus,
  Users,
  Wallet,
  WifiOff,
} from "lucide-react";
import { getPricingContent, getPricingPlan, getRetailContent } from "@/lib/content";
import { retailPaymentsEnabled } from "@/lib/featureFlags";
import { formatPrice } from "@/lib/pricing";
import { faqPageSchema, planOffers } from "@/lib/schema";
import { RETAIL_SIGNUP_URL } from "@/lib/retailCheckout";
import { PageHero } from "@/components/PageHero";
import { FadeIn, FadeInStagger, FadeInStaggerItem } from "@/components/motion/FadeIn";
import { RetailBuy } from "@/components/RetailBuy";
import { ContactForm } from "@/components/ContactForm";
import { RelatedProducts } from "@/components/products/RelatedProducts";

const content = getRetailContent();
const regions = getPricingContent().regions;
const PLAN_SLUGS = ["basic", "gold", "platinum"] as const;
type PlanSlug = (typeof PLAN_SLUGS)[number];
const PLANS = PLAN_SLUGS.map((slug) => ({ slug, plan: getPricingPlan(`setu-retail-${slug}`) })).filter(
  (p): p is { slug: PlanSlug; plan: NonNullable<typeof p.plan> } => Boolean(p.plan),
);
/** The plan the free trial runs on. Only this card offers "Start free trial". */
const TRIAL_PLAN: PlanSlug = "basic";

type Icon = ComponentType<{ className?: string }>;

/** Icons are named in content/en/retail.json; unknown names fall back to a check. */
const ICONS: Record<string, Icon> = {
  ArrowLeftRight,
  Banknote,
  Barcode,
  BookUser,
  Building2,
  CalendarRange,
  ClipboardList,
  CloudOff,
  CreditCard,
  DatabaseBackup,
  FileSpreadsheet,
  Globe,
  HandCoins,
  Hash,
  History,
  LayoutDashboard,
  Layers,
  Lock,
  Palette,
  PauseCircle,
  Percent,
  PieChart,
  Printer,
  Receipt,
  RotateCcw,
  ScanBarcode,
  ShieldCheck,
  Tags,
  Timer,
  TrendingUp,
  TriangleAlert,
  Undo2,
  UserPlus,
  Users,
  Wallet,
  WifiOff,
};
const iconFor = (name: string): Icon => ICONS[name] ?? Check;

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
  featureList: content.sections.flatMap((section) => section.items.map((item) => item.title)),
  offers: PLANS.flatMap(({ plan }) => planOffers(plan) ?? []),
  provider: { "@type": "Organization", name: "Setu Technology", url: "https://setutechnology.com" },
};

type Section = (typeof content.sections)[number];

function SectionIntro({ eyebrow, title, subtitle, onDark = false }: { eyebrow: string; title: string; subtitle: string; onDark?: boolean }) {
  return (
    <FadeIn>
      <div className="mx-auto max-w-2xl text-center">
        <p className={`text-xs font-semibold uppercase tracking-[0.3em] ${onDark ? "text-saffron" : "text-muted-warm"}`}>{eyebrow}</p>
        <h2 className={`mt-4 text-3xl font-bold tracking-tight ${onDark ? "text-cream-paper" : "text-ink"}`}>{title}</h2>
        <p className={`mt-4 leading-relaxed ${onDark ? "text-cream-paper/80" : "text-muted"}`}>{subtitle}</p>
      </div>
    </FadeIn>
  );
}

function FeatureSection({ section, tinted }: { section: Section; tinted: boolean }) {
  const onDark = "onDark" in section && section.onDark === true;
  const bg = onDark ? "bg-indigo" : tinted ? "border-t border-muted-line/20 bg-cream-paper" : "border-t border-muted-line/20 bg-white";
  return (
    <section className={`${bg} py-16`}>
      <div className="mx-auto max-w-6xl px-6">
        <SectionIntro eyebrow={section.eyebrow} title={section.title} subtitle={section.subtitle} onDark={onDark} />
        <FadeInStagger className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {section.items.map((item) => {
            const ItemIcon = iconFor(item.icon);
            return (
              <FadeInStaggerItem key={item.title}>
                <div
                  className={`group h-full rounded-xl border p-6 transition duration-300 ${
                    onDark
                      ? "border-cream-paper/15 bg-white/5 hover:border-saffron/40 hover:bg-white/10"
                      : "border-muted-line/20 bg-white shadow-sm hover:-translate-y-1 hover:border-indigo/30 hover:shadow-md"
                  }`}
                >
                  <div
                    className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg transition duration-300 ${
                      onDark ? "bg-saffron/20 group-hover:bg-saffron/30" : "bg-indigo/10 group-hover:bg-indigo"
                    }`}
                  >
                    <ItemIcon className={`h-5 w-5 ${onDark ? "text-saffron" : "text-indigo group-hover:text-white"}`} />
                  </div>
                  <h3 className={`mb-2 font-bold ${onDark ? "text-cream-paper" : "text-ink"}`}>{item.title}</h3>
                  <p className={`text-sm leading-relaxed ${onDark ? "text-cream-paper/75" : "text-muted"}`}>{item.text}</p>
                </div>
              </FadeInStaggerItem>
            );
          })}
        </FadeInStagger>
      </div>
    </section>
  );
}

/** A role-matrix cell: "yes"/"no" become marks, anything else is shown as a short note. */
function RoleCell({ value }: { value: string }) {
  if (value === "yes") {
    return (
      <span className="inline-flex items-center justify-center">
        <Check className="h-4 w-4 text-indigo" aria-hidden="true" />
        <span className="sr-only">Yes</span>
      </span>
    );
  }
  if (value === "no") {
    return (
      <span className="inline-flex items-center justify-center">
        <Minus className="h-4 w-4 text-muted-line" aria-hidden="true" />
        <span className="sr-only">No</span>
      </span>
    );
  }
  return <span className="text-xs font-semibold text-ink">{value}</span>;
}

export default function RetailPage() {
  const buying = retailPaymentsEnabled();
  const inr = regions.find((r) => r.id === "IN")!;
  const usd = regions.find((r) => r.id === "INTL")!;
  const limitsFor = (slug: PlanSlug) => content.planLimits.rows.filter((row) => row.label !== "Free trial").map((row) => ({ label: row.label, value: row[slug] }));

  // Split the feature sections so the role matrix sits after the counter,
  // receipts and stock sections, and before branches and safety.
  const firstSections = content.sections.slice(0, 5);
  const laterSections = content.sections.slice(5);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageSchema(content.faq, { hreflang: "en", path: "/products/retail" })) }} />

      <PageHero eyebrow={content.hero.eyebrow} headline={content.hero.headline} subheadline={content.hero.subheadline} />

      <section className="mx-auto -mt-4 max-w-5xl px-6 pb-10">
        <div className="flex flex-wrap justify-center gap-3">
          <a href={RETAIL_SIGNUP_URL} className="rounded-full bg-saffron px-7 py-3 text-sm font-semibold text-ink transition hover:brightness-95">
            Start free trial →
          </a>
          <a href="#plans" className="rounded-full border border-indigo/30 px-7 py-3 text-sm font-semibold text-indigo transition hover:bg-indigo/5">
            See plans
          </a>
        </div>
        <p className="mt-3 text-center text-xs text-muted">3 months of Basic free after you verify your email. No card needed.</p>

        <FadeInStagger className="mx-auto mt-8 flex max-w-4xl flex-wrap justify-center gap-2.5">
          {content.highlights.map((highlight) => {
            const HighlightIcon = iconFor(highlight.icon);
            return (
              <FadeInStaggerItem key={highlight.label}>
                <span className="inline-flex items-center gap-2 rounded-full border border-muted-line/30 bg-white px-3.5 py-1.5 text-sm font-semibold text-ink shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-indigo/40 hover:text-indigo">
                  <HighlightIcon className="h-4 w-4 text-indigo" />
                  {highlight.label}
                </span>
              </FadeInStaggerItem>
            );
          })}
        </FadeInStagger>
      </section>

      <section aria-labelledby="features" className="mx-auto max-w-6xl px-6 pb-16">
        <h2 id="features" className="mb-8 text-center text-3xl font-bold tracking-tight text-ink">
          Everything a retail business runs on
        </h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {content.features.map((f) => (
            <FadeIn key={f.title}>
              <article className="h-full rounded-2xl border border-muted-line/30 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold text-ink">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{f.text}</p>
              </article>
            </FadeIn>
          ))}
        </div>
      </section>

      {firstSections.map((section, i) => (
        <FeatureSection key={section.title} section={section} tinted={i % 2 === 0} />
      ))}

      {/* Multi-role: who can do what */}
      <section aria-labelledby="roles-h" className="border-t border-muted-line/20 bg-white py-16">
        <div className="mx-auto max-w-5xl px-6">
          <FadeIn>
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-warm">{content.roles.eyebrow}</p>
              <h2 id="roles-h" className="mt-4 text-3xl font-bold tracking-tight text-ink">
                {content.roles.title}
              </h2>
              <p className="mt-4 leading-relaxed text-muted">{content.roles.subtitle}</p>
            </div>
          </FadeIn>
          <FadeIn className="mt-10">
            <div className="relative overflow-x-auto rounded-2xl border border-muted-line/30 bg-white shadow-sm">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="bg-cream-paper">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold text-ink">
                      What they can do
                    </th>
                    {content.roles.columns.map((column) => (
                      <th key={column} scope="col" className="px-4 py-3 text-center font-semibold text-ink">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-muted-line/20">
                  {content.roles.rows.map(([capability, ...values]) => (
                    <tr key={capability}>
                      <th scope="row" className="px-4 py-3 font-medium text-muted">
                        {capability}
                      </th>
                      {values.map((value, i) => (
                        <td key={content.roles.columns[i]} className="px-4 py-3 text-center">
                          <RoleCell value={value} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </FadeIn>
        </div>
      </section>

      {laterSections.map((section, i) => (
        <FeatureSection key={section.title} section={section} tinted={i % 2 === 1} />
      ))}

      {/* Plans */}
      <section id="plans" aria-labelledby="plans-h" className="scroll-mt-24 border-t border-muted-line/20 bg-cream-paper py-16">
        <div className="mx-auto max-w-7xl px-6">
          <h2 id="plans-h" className="text-center text-3xl font-bold tracking-tight text-ink">
            {content.plansHeadline}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-muted">{content.plansNote}</p>
          <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {PLANS.map(({ slug, plan }) => {
              const isTrialPlan = slug === TRIAL_PLAN;
              return (
                <article
                  key={plan.slug}
                  className={`flex flex-col rounded-2xl border bg-white p-6 ${slug === "gold" ? "border-indigo shadow-md" : "border-muted-line/30"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-lg font-bold text-ink">{plan.name.replace("Setu Retail ", "")}</h3>
                    <span className="whitespace-nowrap rounded-full bg-saffron/20 px-3 py-1 text-xs font-semibold text-ink">{plan.freeNote}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted">{plan.summary}</p>
                  <p className="mt-4 text-3xl font-bold tracking-tight text-ink">
                    {formatPrice(plan.price!.IN.monthly, inr)}
                    <span className="ml-1 text-sm font-semibold text-muted">/month</span>
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    or {formatPrice(plan.price!.IN.yearly, inr)}/year · {formatPrice(plan.price!.INTL.monthly, usd)}/month outside India
                  </p>

                  <dl className="mt-5 grid grid-cols-2 gap-x-3 gap-y-2 rounded-xl bg-cream-paper/70 p-4 text-sm">
                    {limitsFor(slug).map((limit) => (
                      <div key={limit.label} className="contents">
                        <dt className="text-muted">{limit.label}</dt>
                        <dd className="text-right font-semibold text-ink">{limit.value}</dd>
                      </div>
                    ))}
                  </dl>

                  <ul className="mt-5 flex-1 space-y-2.5">
                    {plan.features.slice(3).map((feature) => (
                      <li key={feature} className="flex gap-2.5 text-sm text-muted">
                        <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo" aria-hidden="true" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {isTrialPlan ? (
                    <>
                      <a href={RETAIL_SIGNUP_URL} className="mt-6 rounded-full bg-saffron px-5 py-2.5 text-center text-sm font-semibold text-ink transition hover:brightness-95">
                        Start free trial
                      </a>
                      <p className="mt-2 text-center text-xs text-muted">
                        3 months free.{" "}
                        {buying ? (
                          <a href={`/products/retail?plan=${slug}#buy`} className="font-semibold text-indigo hover:underline">
                            Or buy Basic now
                          </a>
                        ) : (
                          "Buy a key when you're ready."
                        )}
                      </p>
                    </>
                  ) : buying ? (
                    <a
                      href={`/products/retail?plan=${slug}#buy`}
                      className="mt-6 rounded-full bg-indigo px-5 py-2.5 text-center text-sm font-semibold text-cream-paper transition hover:bg-ink"
                    >
                      {plan.cta.label}
                    </a>
                  ) : (
                    <>
                      <span
                        aria-disabled="true"
                        className="mt-6 cursor-not-allowed rounded-full border border-indigo/20 px-5 py-2.5 text-center text-sm font-semibold text-indigo/60"
                      >
                        Online purchase opens soon
                      </span>
                      <p className="mt-2 text-center text-xs text-muted">Start on the Basic trial and upgrade any time; your data stays.</p>
                    </>
                  )}
                </article>
              );
            })}

            {/* More than 100 branches */}
            <article className="flex flex-col rounded-2xl border border-dashed border-indigo/40 bg-white p-6">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-bold text-ink">{content.enterprise.eyebrow}</h3>
                <span className="whitespace-nowrap rounded-full bg-indigo/10 px-3 py-1 text-xs font-semibold text-indigo">100+ branches</span>
              </div>
              <p className="mt-1 text-sm text-muted">{content.enterprise.summary}</p>
              <p className="mt-4 text-3xl font-bold tracking-tight text-ink">Custom</p>
              <p className="mt-1 text-xs text-muted">Priced for your chain, GST included</p>
              <ul className="mt-5 flex-1 space-y-2.5">
                {content.enterprise.points.map((point) => (
                  <li key={point} className="flex gap-2.5 text-sm text-muted">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo" aria-hidden="true" />
                    {point}
                  </li>
                ))}
              </ul>
              <a href="#contact-sales" className="mt-6 rounded-full bg-indigo px-5 py-2.5 text-center text-sm font-semibold text-cream-paper transition hover:bg-ink">
                {content.enterprise.cardCta}
              </a>
            </article>
          </div>

          {/* Plan limits side by side */}
          <div className="mx-auto mt-14 max-w-4xl">
            <h3 className="text-center text-2xl font-bold tracking-tight text-ink">{content.planLimits.headline}</h3>
            <div className="relative mt-6 overflow-x-auto rounded-2xl border border-muted-line/30 bg-white shadow-sm">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="bg-cream-paper">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold text-ink">
                      Limit
                    </th>
                    {PLANS.map(({ slug, plan }) => (
                      <th key={slug} scope="col" className="px-4 py-3 text-center font-semibold text-ink">
                        {plan.name.replace("Setu Retail ", "")}
                      </th>
                    ))}
                    <th scope="col" className="px-4 py-3 text-center font-semibold text-ink">
                      {content.enterprise.eyebrow}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-muted-line/20">
                  {content.planLimits.rows.map((row) => (
                    <tr key={row.label}>
                      <th scope="row" className="px-4 py-3 font-medium text-muted">
                        {row.label}
                      </th>
                      {PLANS.map(({ slug }) => (
                        <td key={slug} className="px-4 py-3 text-center font-semibold text-ink">
                          {row[slug]}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-center font-semibold text-ink">{row.label === "Free trial" ? "—" : "Custom"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-center text-xs text-muted">{content.planLimits.note}</p>
          </div>
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
                <h3 className="text-xl font-bold text-ink">Start with 3 months of Basic free</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  Online purchase of Gold and Platinum keys opens soon. Start your free trial now; your data stays when you move to a bigger plan.
                </p>
                <a href={RETAIL_SIGNUP_URL} className="mt-6 inline-block rounded-lg bg-indigo px-5 py-3 text-sm font-semibold text-white transition hover:bg-ink">
                  Start free trial
                </a>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Contact sales: more than 100 branches */}
      <section id="contact-sales" aria-labelledby="contact-sales-h" className="scroll-mt-24 bg-indigo py-16">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 lg:grid-cols-2 lg:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-saffron">{content.enterprise.eyebrow}</p>
            <h2 id="contact-sales-h" className="mt-4 text-3xl font-bold tracking-tight text-cream-paper">
              {content.enterprise.headline}
            </h2>
            <p className="mt-4 leading-relaxed text-cream-paper/80">{content.enterprise.text}</p>
            <ul className="mt-6 space-y-3">
              {content.enterprise.points.map((point) => (
                <li key={point} className="flex gap-3 text-cream-paper/90">
                  <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-saffron" aria-hidden="true" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
          <ContactForm form={content.enterprise.form} topic="retail-enterprise" markRequired />
        </div>
      </section>

      <section aria-labelledby="faq-h" className="mx-auto max-w-3xl px-6 py-16">
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

      <RelatedProducts group="shop" current="retail" />

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
