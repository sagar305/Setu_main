import type { HomeContent } from "@/lib/content";
import { FadeIn, FadeInStagger, FadeInStaggerItem } from "@/components/motion/FadeIn";

export function WhySetu({ whySetu }: { whySetu: HomeContent["whySetu"] }) {
  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-6xl px-6">
        <FadeIn className="max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight text-ink">{whySetu.headline}</h2>
          <p className="mt-4 text-lg text-muted">{whySetu.subtext}</p>
        </FadeIn>

        <FadeInStagger className="mt-12 grid gap-8 sm:grid-cols-2">
          {whySetu.items.map((item) => (
            <FadeInStaggerItem key={item.heading} className="flex gap-4">
              <span className="mt-1 h-10 w-10 shrink-0 rounded-xl bg-cream" aria-hidden="true" />
              <div>
                <h3 className="text-lg font-semibold text-ink">{item.heading}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{item.body}</p>
              </div>
            </FadeInStaggerItem>
          ))}
        </FadeInStagger>
      </div>
    </section>
  );
}
