"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PageHero } from "@/components/PageHero";

export type ContactHeroContent = { eyebrow: string; headline: string; subheadline: string };

/**
 * The contact page hero, swapped for a variant when the URL carries a ?topic.
 *
 * The variant is picked here in the browser rather than from `searchParams` on
 * the server, so /contact stays a static page instead of rendering on every
 * request. The default hero is what is prerendered and what crawlers see; the
 * canonical URL has no ?topic anyway.
 */
export function ContactHero({
  hero,
  variants,
}: {
  hero: ContactHeroContent;
  variants?: Record<string, ContactHeroContent>;
}) {
  if (!variants) return <DefaultHero hero={hero} />;
  return (
    // useSearchParams would otherwise opt the page into client rendering — see
    // AnalyticsProvider.
    <Suspense fallback={<DefaultHero hero={hero} />}>
      <TopicHero hero={hero} variants={variants} />
    </Suspense>
  );
}

function TopicHero({
  hero,
  variants,
}: {
  hero: ContactHeroContent;
  variants: Record<string, ContactHeroContent>;
}) {
  const topic = useSearchParams().get("topic");
  return <DefaultHero hero={(topic && variants[topic]) || hero} />;
}

function DefaultHero({ hero }: { hero: ContactHeroContent }) {
  return <PageHero eyebrow={hero.eyebrow} headline={hero.headline} subheadline={hero.subheadline} />;
}
