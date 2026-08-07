import Link from "next/link";
import { BookOpen, Calculator, Wrench } from "lucide-react";
import type { GlossaryTermSummary, GlossaryToolLink } from "@/lib/glossary";
import { getGlossaryTermUrl } from "@/lib/glossary";

/**
 * Right rail of a glossary term page: the five tools and calculators that use
 * the term, then the terms a reader is most likely to want next.
 */
export function GlossarySidebar({
  tools,
  relatedTerms,
}: {
  tools: GlossaryToolLink[];
  relatedTerms: GlossaryTermSummary[];
}) {
  return (
    <div className="flex flex-col gap-8 lg:sticky lg:top-24">
      {tools.length > 0 && (
        <section className="rounded-2xl border border-indigo/15 bg-white p-6 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-warm">
            Top tools &amp; calculators
          </h2>
          <ul className="mt-4 flex flex-col gap-3">
            {tools.map((tool) => (
              <li key={`${tool.type}-${tool.slug}`}>
                <Link
                  href={tool.href}
                  className="group flex items-start gap-3 rounded-xl border border-muted-line/20 p-3 transition hover:border-indigo/40 hover:bg-cream/40"
                >
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo/10 text-indigo">
                    {tool.type === "calculator" ? (
                      <Calculator className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Wrench className="h-4 w-4" aria-hidden="true" />
                    )}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-ink transition group-hover:text-indigo">
                      {tool.name}
                    </span>
                    <span className="mt-0.5 block text-xs leading-snug text-muted">{tool.description}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {relatedTerms.length > 0 && (
        <section className="rounded-2xl border border-muted-line/20 bg-white p-6 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-warm">Related terms</h2>
          <ul className="mt-4 flex flex-col gap-4">
            {relatedTerms.map((term) => (
              <li key={term.slug} className="border-b border-muted-line/20 pb-4 last:border-none last:pb-0">
                <Link href={getGlossaryTermUrl(term.slug)} className="group block">
                  <span className="block text-sm font-semibold leading-snug text-ink transition group-hover:text-indigo">
                    {term.term}
                  </span>
                  <span className="mt-1 block text-xs leading-snug text-muted">{term.short}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border border-muted-line/20 bg-cream/60 p-6">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo/10 text-indigo">
          <BookOpen className="h-4 w-4" aria-hidden="true" />
        </span>
        <p className="mt-3 text-sm font-semibold text-ink">Business glossary</p>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Every GST, accounting, inventory and POS term we use across Setu, explained in plain English.
        </p>
        <Link
          href="/glossary"
          className="mt-4 inline-block text-sm font-semibold text-indigo hover:underline"
        >
          Browse all terms →
        </Link>
      </section>
    </div>
  );
}
