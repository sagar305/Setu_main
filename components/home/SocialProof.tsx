import type { HomeContent } from "@/lib/content";

export function SocialProof({ socialProof }: { socialProof: HomeContent["socialProof"] }) {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="text-center text-3xl font-bold tracking-tight text-ink">
          {socialProof.headline}
        </h2>

        <div className="mt-12 grid gap-6 sm:grid-cols-4">
          {socialProof.stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-3xl font-bold text-indigo">{stat.value}</div>
              <div className="mt-1 text-sm text-muted">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {socialProof.testimonials.map((t) => (
            <figure key={t.name} className="rounded-2xl bg-white p-6 shadow-sm">
              <blockquote className="text-sm leading-relaxed text-ink/90">“{t.quote}”</blockquote>
              <figcaption className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-warm">
                {t.name} · {t.company}, {t.city}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
