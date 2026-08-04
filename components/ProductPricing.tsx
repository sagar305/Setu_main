import Link from "next/link";
import { Check } from "lucide-react";
import { FadeIn, FadeInStagger, FadeInStaggerItem } from "@/components/motion/FadeIn";

export type ProductPricingPlan = {
  /** e.g. "India" or "Rest of the world". */
  region: string;
  monthlyLabel: string;
  yearlyLabel: string;
  saveLabel: string;
};

export type ProductPricingContent = {
  badge: string;
  title: string;
  subtitle: string;
  /** How long the product is free before billing starts, e.g. "for 1 month". */
  freeDuration: string;
  /** What one subscription covers, shown under each plan. */
  scopeNote: string;
  note: string;
  plans: ProductPricingPlan[];
  includes: string[];
  cta: { label: string; href: string };
};

/**
 * Pricing block for a product page, matching the layout used on the QR Menu
 * page. Numbers come from the page's content JSON and are kept in step with
 * content/en/pricing.json, which is what /pricing and the Offer schema read.
 */
export function ProductPricing({ pricing }: { pricing: ProductPricingContent }) {
  return (
    // scroll-mt keeps the heading clear of the sticky nav on a #pricing link
    <section id="pricing" className="mx-auto max-w-5xl scroll-mt-24 px-6 py-16">
      <FadeIn>
        <div className="text-center">
          <span className="inline-block rounded-full bg-saffron/20 px-3 py-1 text-xs font-semibold text-ink">
            {pricing.badge}
          </span>
          <h2 className="mt-4 text-3xl font-bold text-ink">{pricing.title}</h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted">{pricing.subtitle}</p>
        </div>
      </FadeIn>

      <FadeInStagger className="mt-10 grid gap-6 md:grid-cols-2">
        {pricing.plans.map((plan) => (
          <FadeInStaggerItem key={plan.region}>
            <div className="h-full rounded-2xl border border-indigo/15 bg-white p-8 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-warm">
                {plan.region}
              </p>

              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-4xl font-bold text-ink">Free</span>
                <span className="text-sm text-muted">{pricing.freeDuration}</span>
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

              <p className="mt-4 text-sm text-muted">{pricing.scopeNote}</p>
            </div>
          </FadeInStaggerItem>
        ))}
      </FadeInStagger>

      <FadeIn delay={0.1}>
        <div className="mt-8 rounded-2xl border border-muted-line/20 bg-white p-8">
          <h3 className="font-bold text-ink">Included on every plan</h3>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {pricing.includes.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-ink/80">
                <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href={pricing.cta.href}
              className="inline-flex items-center gap-2 rounded-lg border border-indigo bg-indigo px-5 py-3 text-sm font-semibold text-cream-paper transition hover:bg-ink"
            >
              {pricing.cta.label}
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-lg border border-indigo/30 px-5 py-3 text-sm font-semibold text-indigo transition hover:bg-indigo/5"
            >
              Compare all plans
            </Link>
          </div>

          <p className="mt-6 text-xs text-muted">{pricing.note}</p>
        </div>
      </FadeIn>
    </section>
  );
}
