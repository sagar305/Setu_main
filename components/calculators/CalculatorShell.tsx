import Link from "next/link";
import type { ReactNode } from "react";
import { PageHero } from "@/components/PageHero";
import { Faq } from "@/components/Faq";
import { CtaBanner } from "@/components/CtaBanner";
import { FadeIn } from "@/components/motion/FadeIn";
import { CalculatorCard } from "@/components/calculators/CalculatorCard";
import {
  createGlossaryLinker,
  getRelatedCalculators,
  getTeamMember,
  FINANCE_AUTHOR_SLUG,
  type CalculatorItem,
} from "@/lib/content";
import { toolApplicationSchema } from "@/lib/schema";
import { GlossaryText } from "@/components/glossary/GlossaryText";
import { GlossaryTermsStrip } from "@/components/glossary/GlossaryTermsStrip";

export function CalculatorShell({ item, children }: { item: CalculatorItem; children: ReactNode }) {
  const related = getRelatedCalculators(item.slug, 3);

  // Terms used in the explainer copy below link to their glossary definitions.
  const glossary = createGlossaryLinker({ maxLinks: 6 });
  const aboutParagraphs = item.about.paragraphs.map((paragraph) => ({
    key: paragraph,
    segments: glossary.text(paragraph),
  }));

  // One block here covers every calculator page.
  const applicationSchema = toolApplicationSchema({
    name: item.name,
    description: item.shortDescription,
    path: `/calculators/${item.slug}`,
    author: getTeamMember(FINANCE_AUTHOR_SLUG),
  });

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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(applicationSchema) }}
      />
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
          {aboutParagraphs.map((paragraph) => (
            <p key={paragraph.key} className="mt-4 text-lg leading-relaxed text-muted">
              <GlossaryText segments={paragraph.segments} />
            </p>
          ))}
        </FadeIn>

        <FadeIn className="mt-10">
          <GlossaryTermsStrip type="calculator" slug={item.slug} />
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
