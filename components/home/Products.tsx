import Link from "next/link";
import type { HomeContent } from "@/lib/content";
import { FadeIn, FadeInStagger, FadeInStaggerItem } from "@/components/motion/FadeIn";

export function Products({ products }: { products: HomeContent["products"] }) {
  return (
    <section id="products" className="mx-auto max-w-6xl px-6 py-20">
      <FadeIn className="max-w-2xl">
        <h2 className="text-3xl font-bold tracking-tight text-ink">{products.headline}</h2>
        <p className="mt-4 text-lg text-muted">{products.subtext}</p>
      </FadeIn>

      <FadeInStagger className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {products.cards.map((card) => {
          const isLive = card.status === "live";
          return (
            <FadeInStaggerItem
              key={card.id}
              className={`flex flex-col gap-4 rounded-2xl border p-6 ${
                isLive
                  ? "border-indigo/15 bg-white shadow-sm"
                  : "border-muted-line/30 bg-white/50"
              }`}
            >
              {!isLive && (
                <span className="self-start rounded-full bg-cream px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-warm">
                  Coming Soon
                </span>
              )}
              <h3 className={`text-lg font-semibold ${isLive ? "text-ink" : "text-ink/70"}`}>
                {card.name}
              </h3>
              <p className={`text-sm font-medium ${isLive ? "text-indigo" : "text-muted"}`}>
                {card.headline}
              </p>
              <p className={`text-sm leading-relaxed ${isLive ? "text-muted" : "text-muted/80"}`}>
                {card.description}
              </p>
              <Link
                href={card.cta.href}
                className={`mt-auto text-sm font-semibold ${
                  isLive ? "text-indigo hover:underline" : "text-muted-warm hover:underline"
                }`}
              >
                {card.cta.label} →
              </Link>
            </FadeInStaggerItem>
          );
        })}
      </FadeInStagger>
    </section>
  );
}
