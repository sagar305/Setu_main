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

        <FadeInStagger className="mt-12 flex flex-col gap-6">
          {services.cards.map((card) => (
            <FadeInStaggerItem
              key={card.id}
              className="grid gap-6 rounded-2xl border border-indigo/15 bg-white p-8 shadow-sm transition hover:shadow-md md:grid-cols-2 md:items-center md:gap-10 md:p-10"
            >
              <div className="flex flex-col gap-4">
                <h3 className="text-2xl font-semibold text-ink">{card.name}</h3>
                <p className="text-base leading-relaxed text-muted">{card.description}</p>
                <Link
                  href={card.cta.href}
                  className="mt-2 inline-block self-start rounded-full bg-indigo px-5 py-2.5 text-sm font-semibold text-cream-paper transition hover:bg-ink"
                >
                  {card.cta.label} →
                </Link>
              </div>
              <ul className="flex flex-col gap-3 md:border-l md:border-muted-line/20 md:pl-10">
                {card.points.map((point) => (
                  <li key={point} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo/10 text-indigo">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    <span className="text-sm leading-relaxed text-muted">{point}</span>
                  </li>
                ))}
              </ul>
            </FadeInStaggerItem>
          ))}
        </FadeInStagger>
      </div>
    </section>
  );
}
