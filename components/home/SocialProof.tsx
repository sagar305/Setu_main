import type { HomeContent } from "@/lib/content";
import { FadeIn, FadeInStagger, FadeInStaggerItem } from "@/components/motion/FadeIn";

export function SocialProof({ socialProof }: { socialProof: HomeContent["socialProof"] }) {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-6xl px-6">
        <FadeIn>
          <h2 className="text-center text-3xl font-bold tracking-tight text-ink">
            {socialProof.headline}
          </h2>
        </FadeIn>

        <FadeInStagger className="mt-12 grid gap-6 sm:grid-cols-4">
          {socialProof.stats.map((stat) => (
            <FadeInStaggerItem key={stat.label} className="text-center">
              <div className="text-3xl font-bold text-indigo">{stat.value}</div>
              <div className="mt-1 text-sm text-muted">{stat.label}</div>
            </FadeInStaggerItem>
          ))}
        </FadeInStagger>
      </div>
    </section>
  );
}
