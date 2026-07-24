import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FadeIn, FadeInStagger, FadeInStaggerItem } from "@/components/motion/FadeIn";

type ShowcaseCard = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  variant?: string;
  cta: { label: string; href: string };
};

type ShowcaseSection = {
  eyebrow: string;
  headline: string;
  subtext: string;
  cards: ShowcaseCard[];
};

export function ShowcaseGrid({
  id,
  section,
  className = "",
}: {
  id: string;
  section: ShowcaseSection;
  className?: string;
}) {
  return (
    <section id={id} className={className}>
      <div className="mx-auto max-w-6xl px-6 py-20">
        <FadeIn className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-warm">{section.eyebrow}</p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-ink">{section.headline}</h2>
          <p className="mt-4 text-lg text-muted">{section.subtext}</p>
        </FadeIn>

        <FadeInStagger className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {section.cards.map((card) => {
            const isMore = card.variant === "more";
            return (
              <FadeInStaggerItem
                key={card.id}
                className={`flex flex-col gap-3 rounded-2xl border p-6 transition hover:-translate-y-1 hover:shadow-md ${
                  isMore
                    ? "border-indigo/30 bg-indigo/5"
                    : "border-indigo/15 bg-white shadow-sm"
                }`}
              >
                <h3 className="text-lg font-semibold text-ink">{card.name}</h3>
                <p className="text-sm font-medium text-indigo">{card.tagline}</p>
                <p className="text-sm leading-relaxed text-muted">{card.description}</p>
                <Link
                  href={card.cta.href}
                  className="mt-auto inline-flex items-center gap-1.5 pt-1 text-sm font-semibold text-indigo hover:underline"
                >
                  {card.cta.label}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </FadeInStaggerItem>
            );
          })}
        </FadeInStagger>
      </div>
    </section>
  );
}
