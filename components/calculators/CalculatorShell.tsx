import Link from "next/link";
import type { ReactNode } from "react";
import { PageHero } from "@/components/PageHero";
import { Faq } from "@/components/Faq";
import { CtaBanner } from "@/components/CtaBanner";
import { FadeIn } from "@/components/motion/FadeIn";
import { CalculatorCard } from "@/components/calculators/CalculatorCard";
import { getRelatedCalculators, type CalculatorItem } from "@/lib/content";

export function CalculatorShell({ item, children }: { item: CalculatorItem; children: ReactNode }) {
  const related = getRelatedCalculators(item.slug, 3);

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: item.faq.items.map((faqItem) => ({
      "@type": "Question",
      name: faqItem.question,
      acceptedAnswer: { "@type": "Answer", text: faqItem.answer },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      <PageHero eyebrow={item.hero.eyebrow} headline={item.hero.headline} subheadline={item.hero.subheadline} />

      <section className="mx-auto max-w-2xl px-6 pb-12">
        <FadeIn>
          <div className="rounded-2xl border border-indigo/15 bg-white p-6 shadow-sm sm:p-8">{children}</div>
        </FadeIn>
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-12">
        <FadeIn>
          <h2 className="text-2xl font-bold tracking-tight text-ink">{item.about.headline}</h2>
          {item.about.paragraphs.map((paragraph) => (
            <p key={paragraph} className="mt-4 text-lg leading-relaxed text-muted">
              {paragraph}
            </p>
          ))}
        </FadeIn>

        <FadeIn className="mt-8">
          <Link href="/calculators" className="text-sm font-semibold text-indigo hover:underline">
            ← All calculators
          </Link>
        </FadeIn>
      </section>

      <Faq headline={item.faq.headline} items={item.faq.items} />

      {related.length > 0 && (
        <section className="border-t border-muted-line/20 py-16">
          <div className="mx-auto max-w-5xl px-6">
            <h2 className="text-2xl font-bold tracking-tight text-ink">More calculators</h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-3">
              {related.map((relatedItem) => (
                <CalculatorCard key={relatedItem.slug} item={relatedItem} />
              ))}
            </div>
          </div>
        </section>
      )}

      <CtaBanner headline={item.cta.headline} subtext={item.cta.subtext} cta={item.cta.cta} />
    </>
  );
}
