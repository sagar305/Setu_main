import Link from "next/link";
import type { Cta } from "@/lib/content";

export function CtaBanner({
  headline,
  subtext,
  cta,
}: {
  headline: string;
  subtext: string;
  cta: Cta;
}) {
  return (
    <section className="bg-indigo py-20 text-center text-cream-paper">
      <div className="mx-auto max-w-2xl px-6">
        <h2 className="text-3xl font-bold tracking-tight">{headline}</h2>
        <p className="mt-4 text-lg text-cream-paper/85">{subtext}</p>
        <Link
          href={cta.href}
          className="mt-8 inline-block rounded-full bg-saffron px-7 py-3 text-sm font-semibold text-ink transition hover:brightness-95"
        >
          {cta.label} →
        </Link>
      </div>
    </section>
  );
}
