import Link from "next/link";
import type { HomeContent } from "@/lib/content";
import { LogoMark } from "@/components/Logo";

export function Hero({ hero }: { hero: HomeContent["hero"] }) {
  return (
    <section className="mx-auto grid max-w-6xl gap-12 px-6 pb-20 pt-16 md:grid-cols-2 md:items-center md:pt-24">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-warm">
          {hero.eyebrow}
        </p>
        <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight text-ink md:text-5xl">
          {hero.headline}
        </h1>
        <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted">{hero.subheadline}</p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link
            href={hero.primaryCta.href}
            className="rounded-full bg-indigo px-6 py-3 text-sm font-semibold text-cream-paper transition hover:bg-ink"
          >
            {hero.primaryCta.label} →
          </Link>
          <Link
            href={hero.secondaryCta.href}
            className="text-sm font-semibold text-indigo underline-offset-4 transition hover:underline"
          >
            {hero.secondaryCta.label}
          </Link>
        </div>
      </div>

      <div className="flex items-center justify-center">
        <div className="flex aspect-square w-full max-w-sm items-center justify-center rounded-2xl bg-white shadow-sm">
          <LogoMark size={140} className="text-indigo" />
        </div>
      </div>
    </section>
  );
}
