"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import {
  getGlossaryTermUrl,
  glossaryInitial,
  type GlossaryCategory,
  type GlossaryTermSummary,
} from "@/lib/glossary";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

/**
 * A–Z browser for the glossary. The full list is server-rendered into the page
 * (so crawlers see every term and every link); the filtering here only narrows
 * what is already present.
 */
export function GlossaryIndexList({
  terms,
  categories,
}: {
  terms: GlossaryTermSummary[];
  categories: GlossaryCategory[];
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return terms.filter((term) => {
      if (category && term.category !== category) return false;
      if (!q) return true;
      if (term.term.toLowerCase().includes(q)) return true;
      if (term.short.toLowerCase().includes(q)) return true;
      return (term.aliases ?? []).some((alias) => alias.toLowerCase().includes(q));
    });
  }, [terms, query, category]);

  const groups = useMemo(() => {
    const map = new Map<string, GlossaryTermSummary[]>();
    for (const term of filtered) {
      const letter = glossaryInitial(term.term);
      const bucket = map.get(letter);
      if (bucket) bucket.push(term);
      else map.set(letter, [term]);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const activeLetters = new Set(groups.map(([letter]) => letter));

  return (
    <>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-warm"
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search terms — GST, food cost, EMI, SKU…"
          aria-label="Search glossary terms"
          className="w-full rounded-full border border-muted-line/30 bg-white py-3 pl-12 pr-4 text-sm text-ink shadow-sm outline-none transition focus:border-indigo focus:ring-2 focus:ring-indigo/20"
        />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCategory(null)}
          aria-pressed={category === null}
          className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
            category === null
              ? "border-indigo bg-indigo text-cream-paper"
              : "border-muted-line/30 text-ink hover:border-indigo hover:text-indigo"
          }`}
        >
          All
        </button>
        {categories.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setCategory(category === item.id ? null : item.id)}
            aria-pressed={category === item.id}
            title={item.description}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
              category === item.id
                ? "border-indigo bg-indigo text-cream-paper"
                : "border-muted-line/30 text-ink hover:border-indigo hover:text-indigo"
            }`}
          >
            {item.name}
          </button>
        ))}
      </div>

      <nav aria-label="Jump to letter" className="mt-6 flex flex-wrap gap-1.5">
        {LETTERS.map((letter) => {
          const enabled = activeLetters.has(letter);
          return enabled ? (
            <a
              key={letter}
              href={`#letter-${letter}`}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-muted-line/30 text-xs font-semibold text-ink transition hover:border-indigo hover:text-indigo"
            >
              {letter}
            </a>
          ) : (
            <span
              key={letter}
              aria-hidden="true"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-xs font-semibold text-muted-line/60"
            >
              {letter}
            </span>
          );
        })}
      </nav>

      <p className="mt-8 text-sm text-muted-warm" aria-live="polite">
        {query.trim() || category
          ? `${filtered.length} ${filtered.length === 1 ? "term" : "terms"} matching`
          : `${terms.length} terms`}
      </p>

      {groups.length === 0 && (
        <p className="mt-8 text-sm text-muted">No terms match that search. Try a shorter word.</p>
      )}

      {groups.map(([letter, items]) => (
        <section key={letter} id={`letter-${letter}`} className="mt-10 scroll-mt-24">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-warm">{letter}</h2>
          <ul className="mt-4 grid gap-x-8 gap-y-4 border-t border-muted-line/25 pt-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((term) => (
              <li key={term.slug}>
                <Link href={getGlossaryTermUrl(term.slug)} className="group block">
                  <span className="block text-sm font-semibold text-ink transition group-hover:text-indigo">
                    {term.term}
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-muted">{term.short}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
