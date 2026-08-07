import Link from "next/link";
import { getGlossaryTermUrl } from "@/lib/glossary";
import { getGlossaryTermsForTool } from "@/lib/content";

/**
 * "Terms explained" strip for a tool or calculator page.
 *
 * Driven by the reverse index of glossary entries that name this tool, so a
 * page picks up new vocabulary as terms are added, without editing the page.
 */
export function GlossaryTermsStrip({
  type,
  slug,
  limit = 8,
  headline = "Terms explained",
}: {
  type: "tool" | "calculator";
  slug: string;
  limit?: number;
  headline?: string;
}) {
  const terms = getGlossaryTermsForTool(type, slug, limit);
  if (terms.length === 0) return null;

  return (
    <div>
      <h2 className="mb-4 text-2xl font-bold text-ink">{headline}</h2>
      <div className="flex flex-wrap gap-3">
        {terms.map((term) => (
          <Link
            key={term.slug}
            href={getGlossaryTermUrl(term.slug)}
            title={term.short}
            className="inline-block rounded-lg border border-muted-line/30 px-4 py-2 text-sm font-semibold text-ink transition hover:border-indigo hover:text-indigo"
          >
            {term.term}
          </Link>
        ))}
      </div>
      <Link
        href="/glossary"
        className="mt-4 inline-block text-sm font-semibold text-indigo hover:underline"
      >
        Browse the full business glossary →
      </Link>
    </div>
  );
}
