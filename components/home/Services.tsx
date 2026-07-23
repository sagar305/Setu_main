import Link from "next/link";
import { Check } from "lucide-react";
import type { HomeContent } from "@/lib/content";
import { FadeIn, FadeInStagger, FadeInStaggerItem } from "@/components/motion/FadeIn";

export function Services({ services }: { services: HomeContent["services"] }) {
  return (
    <section id="services" className="bg-cream py-20">
      <div className="mx-auto max-w-6xl px-6">
        <FadeIn className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-warm">
            {services.eyebrow}
          </p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-ink">{services.headline}</h2>
          <p className="mt-4 text-lg text-muted">{services.subtext}</p>
        </FadeIn>

        <FadeInStagger className="mt-12 grid gap-6 lg:grid-cols-2">
          {services.cards.map((card) => (
            <FadeInStaggerItem
              key={card.id}
              className="flex flex-col gap-4 rounded-2xl border border-indigo/15 bg-white p-8 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
            >
              <h3 className="text-xl font-semibold text-ink">{card.name}</h3>
              <p className="text-base leading-relaxed text-muted">{card.description}</p>
              <ul className="mt-1 flex flex-col gap-3">
                {card.points.map((point) => (
                  <li key={point} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo/10 text-indigo">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    <span className="text-sm leading-relaxed text-muted">{point}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={card.cta.href}
                className="mt-auto inline-block self-start rounded-full bg-indigo px-5 py-2.5 text-sm font-semibold text-cream-paper transition hover:bg-ink"
              >
                {card.cta.label} →
              </Link>
            </FadeInStaggerItem>
          ))}
        </FadeInStagger>
      </div>
    </section>
  );
}
