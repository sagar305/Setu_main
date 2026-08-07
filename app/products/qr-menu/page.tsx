import type { Metadata } from "next";
import Link from "next/link";
import type { ComponentType } from "react";
import {
  QrCode,
  IndianRupee,
  Ban,
  Layers,
  Image as ImageIcon,
  Infinity as InfinityIcon,
  BarChart3,
  Files,
  Palette,
  ArrowRight,
  Check,
  PlayCircle,
  Gift,
  ShieldCheck,
  FileCheck,
  Megaphone,
  Clock,
  Images,
  BookOpen,
  Plus,
  ListChecks,
  Tags,
  Leaf,
  FileSpreadsheet,
  LayoutTemplate,
  SwatchBook,
  PanelTop,
  Store,
  Search,
  Calculator,
  Sparkles,
  Heart,
  MapPin,
  Star,
  Share2,
  Rows3,
  ChevronsDownUp,
  ListFilter,
  Copy,
  Eye,
  Sparkle,
  TriangleAlert,
  BadgeCheck,
  CalendarClock,
  KeyRound,
} from "lucide-react";
import { getQrMenuContent, getPricingPlan } from "@/lib/content";
import { planOffers } from "@/lib/schema";
import {
  QR_MENU_APP_ENABLED,
  QR_MENU_DEMO_URL,
  QR_MENU_SIGNUP_IS_EXTERNAL,
  QR_MENU_SIGNUP_LABEL,
  QR_MENU_SIGNUP_URL,
} from "@/lib/premiumLinks";
import { PageHero } from "@/components/PageHero";
import { QrMenuHeroVisual } from "@/components/QrMenuHeroVisual";
import { Faq } from "@/components/Faq";
import { FadeIn, FadeInStagger, FadeInStaggerItem } from "@/components/motion/FadeIn";

const content = getQrMenuContent();

export const metadata: Metadata = {
  title: content.seo.title,
  description: content.seo.description,
  keywords: content.seo.keywords,
  alternates: { canonical: "/products/qr-menu" },
  openGraph: {
    title: content.seo.ogTitle,
    description: content.seo.ogDescription,
    url: "/products/qr-menu",
    images: [
      {
        url: "/og/setu-og-image-1200x627.png",
        width: 1200,
        height: 627,
        alt: "Setu QR Menu - a QR code that never changes",
      },
      {
        url: "/og/setu-og-image-800x418.png",
        width: 800,
        height: 418,
        alt: "Setu QR Menu - a QR code that never changes",
      },
    ],
  },
  twitter: {
    title: content.seo.ogTitle,
    description: content.seo.ogDescription,
  },
};

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  QrCode,
  IndianRupee,
  Ban,
  Layers,
  ImageIcon,
  Infinity: InfinityIcon,
  BarChart3,
  Files,
  Palette,
  ShieldCheck,
  FileCheck,
  Megaphone,
  Clock,
  Images,
  BookOpen,
  Plus,
  ListChecks,
  Tags,
  Leaf,
  FileSpreadsheet,
  LayoutTemplate,
  SwatchBook,
  PanelTop,
  Store,
  Search,
  Calculator,
  Sparkles,
  Heart,
  MapPin,
  Star,
  Share2,
  Rows3,
  ChevronsDownUp,
  ListFilter,
  Copy,
  Eye,
  Sparkle,
  TriangleAlert,
  BadgeCheck,
  CalendarClock,
  KeyRound,
};

type FeatureItem = { icon: string; title: string; description: string };

type Section = {
  eyebrow: string;
  title: string;
  subtitle: string;
  items: readonly FeatureItem[];
};

function SectionIntro({ section, onDark = false }: { section: Section; onDark?: boolean }) {
  return (
    <FadeIn>
      <div className="mx-auto max-w-2xl text-center">
        <p
          className={`text-xs font-semibold uppercase tracking-[0.3em] ${
            onDark ? "text-saffron" : "text-muted-warm"
          }`}
        >
          {section.eyebrow}
        </p>
        <h2
          className={`mt-4 text-3xl font-bold tracking-tight ${onDark ? "text-cream-paper" : "text-ink"}`}
        >
          {section.title}
        </h2>
        <p className={`mt-4 leading-relaxed ${onDark ? "text-cream-paper/80" : "text-muted"}`}>
          {section.subtitle}
        </p>
      </div>
    </FadeIn>
  );
}

/** The card grid shared by the trust, dish-depth and branding sections. */
function FeatureCards({ items }: { items: readonly FeatureItem[] }) {
  return (
    <FadeInStagger className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => {
        const Icon = ICONS[item.icon] ?? QrCode;
        return (
          <FadeInStaggerItem key={item.title}>
            <div className="h-full rounded-xl border border-muted-line/20 bg-white p-6 shadow-sm transition hover:border-indigo/30 hover:shadow-md">
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-indigo/10">
                <Icon className="h-5 w-5 text-indigo" />
              </div>
              <h3 className="mb-2 font-bold text-ink">{item.title}</h3>
              <p className="text-sm leading-relaxed text-muted">{item.description}</p>
            </div>
          </FadeInStaggerItem>
        );
      })}
    </FadeInStagger>
  );
}

/**
 * The signup target is the app on another subdomain normally, but falls back to
 * an in-site path when the app is switched off — so it needs a plain anchor in
 * one case and a Next <Link> in the other.
 */
function SignupCta({ className }: { className: string }) {
  const label = (
    <>
      {QR_MENU_SIGNUP_LABEL}
      <ArrowRight className="h-4 w-4" />
    </>
  );

  if (QR_MENU_SIGNUP_IS_EXTERNAL) {
    return (
      <a href={QR_MENU_SIGNUP_URL} className={className}>
        {label}
      </a>
    );
  }

  return (
    <Link href={QR_MENU_SIGNUP_URL} className={className}>
      {label}
    </Link>
  );
}

const softwareApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Setu QR Menu",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: content.seo.description,
  offers: planOffers(getPricingPlan("qr-menu")!),
  provider: {
    "@type": "Organization",
    name: "Setu Technology",
    url: "https://setutechnology.com",
  },
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: content.faq.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: { "@type": "Answer", text: item.answer },
  })),
};

export default function QrMenuProductPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <PageHero
        eyebrow={content.hero.eyebrow}
        headline={content.hero.headline}
        subheadline={content.hero.subheadline}
      />

      {/* Animated hero: the menu changes, the QR does not */}
      <section className="mx-auto max-w-5xl px-6 pb-4">
        <FadeIn>
          <QrMenuHeroVisual />
        </FadeIn>

        <FadeIn delay={0.15}>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <a
              href={QR_MENU_DEMO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-indigo bg-indigo px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              <PlayCircle className="h-4 w-4" />
              Try the live demo
            </a>
            <SignupCta className="inline-flex items-center gap-2 rounded-lg border border-indigo/30 px-5 py-3 text-sm font-semibold text-indigo transition hover:bg-indigo/5" />
          </div>
          {!QR_MENU_APP_ENABLED && (
            <p className="mt-3 text-center text-xs text-muted">
              Sign-ups open soon. The demo is fully working — have a look around.
            </p>
          )}
        </FadeIn>
      </section>

      {/* The problem this solves */}
      <section className="border-t border-muted-line/20 bg-cream-paper py-16">
        <div className="mx-auto max-w-3xl px-6">
          <FadeIn>
            <h2 className="text-3xl font-bold text-ink">{content.problem.title}</h2>
            <p className="mt-4 leading-relaxed text-muted">{content.problem.body}</p>
            <p className="mt-4 font-medium leading-relaxed text-ink">
              {content.problem.resolution}
            </p>
          </FadeIn>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <FadeIn>
          <h2 className="mb-12 text-center text-3xl font-bold text-ink">
            Everything a restaurant actually needs
          </h2>
        </FadeIn>

        <FadeInStagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {content.features.map((feature) => {
            const Icon = ICONS[feature.icon] ?? QrCode;
            return (
              <FadeInStaggerItem key={feature.title}>
                <div className="h-full rounded-xl border border-muted-line/20 bg-white p-6 shadow-sm transition hover:border-indigo/30 hover:shadow-md">
                  <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-indigo/10">
                    <Icon className="h-5 w-5 text-indigo" />
                  </div>
                  <h3 className="mb-2 font-bold text-ink">{feature.title}</h3>
                  <p className="text-sm leading-relaxed text-muted">{feature.description}</p>
                </div>
              </FadeInStaggerItem>
            );
          })}
        </FadeInStagger>
      </section>

      {/* Trust signals a diner checks before ordering */}
      <section className="border-t border-muted-line/20 bg-cream-paper py-16">
        <div className="mx-auto max-w-6xl px-6">
          <SectionIntro section={content.trust} />
          <FeatureCards items={content.trust.items} />
        </div>
      </section>

      {/* How deep a single dish goes */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <SectionIntro section={content.depth} />
        <FeatureCards items={content.depth.items} />
      </section>

      {/* Templates, colours and business types */}
      <section className="border-t border-muted-line/20 bg-cream-paper py-16">
        <div className="mx-auto max-w-6xl px-6">
          <SectionIntro section={content.brand} />
          <FeatureCards items={content.brand.items} />
        </div>
      </section>

      {/* The diner's side of the scan */}
      <section className="bg-indigo py-16">
        <div className="mx-auto max-w-6xl px-6">
          <SectionIntro section={content.diner} onDark />

          <FadeInStagger className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {content.diner.items.map((item) => {
              const Icon = ICONS[item.icon] ?? QrCode;
              return (
                <FadeInStaggerItem key={item.title}>
                  <div className="h-full rounded-xl border border-cream-paper/15 bg-white/5 p-6">
                    <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-saffron/20">
                      <Icon className="h-5 w-5 text-saffron" />
                    </div>
                    <h3 className="mb-2 font-bold text-cream-paper">{item.title}</h3>
                    <p className="text-sm leading-relaxed text-cream-paper/75">{item.description}</p>
                  </div>
                </FadeInStaggerItem>
              );
            })}
          </FadeInStagger>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-muted-line/20 bg-cream-paper py-16">
        <div className="mx-auto max-w-4xl px-6">
          <FadeIn>
            <h2 className="mb-12 text-center text-3xl font-bold text-ink">How it works</h2>
          </FadeIn>

          <FadeInStagger className="space-y-6">
            {content.howItWorks.map((step, index) => (
              <FadeInStaggerItem key={step.title}>
                <div className="flex gap-4 rounded-xl border border-muted-line/20 bg-white p-6">
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-indigo text-sm font-bold text-white">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="font-bold text-ink">{step.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{step.description}</p>
                  </div>
                </div>
              </FadeInStaggerItem>
            ))}
          </FadeInStagger>
        </div>
      </section>

      {/* Editor quality-of-life, for menus that have got long */}
      <section className="border-t border-muted-line/20 bg-white py-16">
        <div className="mx-auto max-w-5xl px-6">
          <SectionIntro section={content.operator} />

          <FadeInStagger className="mt-10 grid gap-x-10 gap-y-6 sm:grid-cols-2">
            {content.operator.items.map((item) => {
              const Icon = ICONS[item.icon] ?? QrCode;
              return (
                <FadeInStaggerItem key={item.title}>
                  <div className="flex min-w-0 gap-3">
                    <Icon className="mt-0.5 h-5 w-5 flex-shrink-0 text-indigo" />
                    <div className="min-w-0">
                      <h3 className="font-semibold text-ink">{item.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-muted">{item.description}</p>
                    </div>
                  </div>
                </FadeInStaggerItem>
              );
            })}
          </FadeInStagger>
        </div>
      </section>

      {/* Pricing */}
      {/* scroll-mt keeps the heading clear of the sticky nav on a #pricing link */}
      <section id="pricing" className="mx-auto max-w-5xl scroll-mt-24 px-6 py-16">
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

        <FadeInStagger className="mt-10 grid gap-6 md:grid-cols-2">
          {content.pricing.plans.map((plan) => (
            <FadeInStaggerItem key={plan.region}>
              <div className="h-full rounded-2xl border border-indigo/15 bg-white p-8 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-warm">
                  {plan.region}
                </p>

                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-ink">Free</span>
                  <span className="text-sm text-muted">for 12 months</span>
                </div>

                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-warm">
                  Then
                </p>

                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-ink">{plan.monthlyLabel}</span>
                  <span className="text-sm text-muted">/ month</span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-lg font-semibold text-ink">{plan.yearlyLabel}</span>
                  <span className="text-sm text-muted">/ year</span>
                  <span className="rounded-full bg-saffron/20 px-2 py-0.5 text-[11px] font-semibold text-ink">
                    {plan.saveLabel}
                  </span>
                </div>

                <p className="mt-4 text-sm text-muted">
                  One restaurant. Everything below included.
                </p>
              </div>
            </FadeInStaggerItem>
          ))}
        </FadeInStagger>

        <FadeIn delay={0.1}>
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
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <SignupCta className="inline-flex items-center gap-2 rounded-lg border border-indigo bg-indigo px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700" />
              <a
                href={QR_MENU_DEMO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-indigo/30 px-5 py-3 text-sm font-semibold text-indigo transition hover:bg-indigo/5"
              >
                <PlayCircle className="h-4 w-4" />
                Or try the demo first
              </a>
            </div>

            <p className="mt-6 text-xs text-muted">{content.pricing.note}</p>
          </div>
        </FadeIn>
      </section>

      {/* Free vs premium */}
      <section className="border-t border-muted-line/20 bg-cream-paper py-16">
        <div className="mx-auto max-w-3xl px-6">
          <FadeIn>
            <h2 className="text-3xl font-bold text-ink">Already using the free tool?</h2>
            <p className="mt-4 leading-relaxed text-muted">
              Keep using it — it stays free. Move up when reprinting starts to hurt: when prices
              change often, when the menu outgrows the QR, or when you want photos and scan
              numbers. Paste your free menu link into the premium editor and everything comes
              across, including your tagline, phone, address and brand colour.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/tools/qr-menu-generator"
                className="inline-flex items-center gap-2 rounded-lg border border-indigo/30 px-4 py-2.5 text-sm font-semibold text-indigo transition hover:bg-indigo/5"
              >
                Open the free QR menu generator
              </Link>
              <a
                href={QR_MENU_DEMO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-indigo bg-indigo px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
              >
                <PlayCircle className="h-4 w-4" />
                Try the premium demo
              </a>
            </div>
          </FadeIn>
        </div>
      </section>

      <Faq headline="Questions restaurants ask" items={content.faq} />

      {/* Closing CTA */}
      <section className="mx-auto max-w-4xl px-6 py-16">
        <FadeIn>
          <div className="rounded-2xl border border-indigo/15 bg-white p-10 text-center shadow-sm">
            <h2 className="text-2xl font-bold text-ink">Print it once. Really.</h2>
            <p className="mx-auto mt-3 max-w-xl text-muted">
              Free for your first year, then {content.pricing.plans[0].monthlyLabel} a month.
              Either way, your table tents stop being something you reprint every time a price
              moves.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <a
                href={QR_MENU_DEMO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-indigo bg-indigo px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700"
              >
                <PlayCircle className="h-4 w-4" />
                Try the live demo
              </a>
              <SignupCta className="inline-flex items-center gap-2 rounded-lg border border-indigo/30 px-5 py-3 text-sm font-semibold text-indigo transition hover:bg-indigo/5" />
            </div>
          </div>
        </FadeIn>
      </section>
    </>
  );
}
