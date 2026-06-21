export function PageHero({
  eyebrow,
  headline,
  subheadline,
}: {
  eyebrow: string;
  headline: string;
  subheadline: string;
}) {
  return (
    <section className="mx-auto max-w-4xl px-6 pb-12 pt-20 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-warm">{eyebrow}</p>
      <h1 className="mt-4 text-4xl font-bold tracking-tight text-ink md:text-5xl">{headline}</h1>
      <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted">{subheadline}</p>
    </section>
  );
}
