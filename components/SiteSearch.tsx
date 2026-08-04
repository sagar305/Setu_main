"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export type SearchItem = {
  title: string;
  description: string;
  href: string;
  kind: "Calculator" | "Tool" | "Article";
};

function score(item: SearchItem, terms: string[]) {
  const title = item.title.toLowerCase();
  const body = `${title} ${item.description.toLowerCase()}`;
  let total = 0;
  for (const term of terms) {
    if (!body.includes(term)) return 0; // every term must appear somewhere
    total += title.includes(term) ? 2 : 1;
  }
  return total;
}

export function SiteSearch({ items }: { items: SearchItem[] }) {
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");

  const results = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return [];
    return items
      .map((item) => ({ item, rank: score(item, terms) }))
      .filter((entry) => entry.rank > 0)
      .sort((a, b) => b.rank - a.rank)
      .map((entry) => entry.item);
  }, [items, query]);

  const trimmed = query.trim();

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight text-ink md:text-4xl">Search Setu</h1>
      <p className="mt-3 text-muted">
        Search across every free calculator, business tool and article on the site.
      </p>

      <label htmlFor="site-search" className="sr-only">
        Search calculators, tools and articles
      </label>
      <input
        id="site-search"
        type="search"
        value={query}
        autoFocus
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Try “GST”, “food cost” or “inventory”"
        className="mt-8 w-full rounded-xl border border-muted-line/40 bg-white px-4 py-3 text-ink shadow-sm outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/20"
      />

      <div className="mt-8" role="status" aria-live="polite">
        {trimmed === "" ? (
          <p className="text-sm text-muted">Start typing to search.</p>
        ) : results.length === 0 ? (
          <p className="text-sm text-muted">
            No matches for “{trimmed}”. Try a shorter or more general term.
          </p>
        ) : (
          <p className="text-sm text-muted">
            {results.length} {results.length === 1 ? "result" : "results"} for “{trimmed}”
          </p>
        )}
      </div>

      <ul className="mt-6 space-y-4">
        {results.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="block rounded-xl border border-muted-line/30 bg-white p-5 shadow-sm transition hover:border-indigo/40 hover:shadow-md"
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-warm">
                {item.kind}
              </span>
              <span className="mt-1 block font-semibold text-ink">{item.title}</span>
              <span className="mt-1 block text-sm text-muted">{item.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
