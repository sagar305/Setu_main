"use client";

import Link from "next/link";
import { motion } from "motion/react";
import type { HomeContent } from "@/lib/content";
import { HeroVisual } from "@/components/home/HeroVisual";

export function Hero({
  hero,
  hiddenProductIds = [],
}: {
  hero: HomeContent["hero"];
  /** Panel entries whose feature flag is off — see HeroVisual. */
  hiddenProductIds?: string[];
}) {
  return (
    <section className="mx-auto grid max-w-6xl gap-12 px-6 pb-12 pt-14 md:grid-cols-2 md:items-center md:gap-16 md:pb-14 md:pt-16">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-warm">
          {hero.eyebrow}
        </p>
        <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight text-ink md:text-5xl">
          {hero.headline}
        </h1>
        <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted">{hero.subheadline}</p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href={hero.primaryCta.href}
            className="rounded-full bg-indigo px-6 py-3 text-sm font-semibold text-cream-paper transition hover:bg-ink"
          >
            {hero.primaryCta.label} →
          </Link>
          <Link
            href={hero.secondaryCta.href}
            className="rounded-full border border-indigo/30 px-6 py-3 text-sm font-semibold text-indigo transition hover:border-indigo hover:bg-indigo/5"
          >
            {hero.secondaryCta.label}
          </Link>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
        className="flex items-center justify-center md:justify-end"
      >
        <HeroVisual hiddenIds={hiddenProductIds} />
      </motion.div>
    </section>
  );
}
