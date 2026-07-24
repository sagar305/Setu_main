"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import type { BlogPostSummary } from "@/lib/blog";
import { BlogCard } from "@/components/blog/BlogCard";

type Category = { name: string; slug: string };

export function BlogSearchList({
  posts,
  categories,
}: {
  posts: BlogPostSummary[];
  categories: Category[];
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter((post) => post.title.toLowerCase().includes(q));
  }, [posts, query]);

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
          placeholder="Search articles by title…"
          aria-label="Search articles by title"
          className="w-full rounded-full border border-muted-line/30 bg-white py-3 pl-12 pr-4 text-sm text-ink shadow-sm outline-none transition focus:border-indigo focus:ring-2 focus:ring-indigo/20"
        />
      </div>

      {categories.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-3">
          {categories.map((category) => (
            <Link
              key={category.slug}
              href={`/blog/${category.slug}`}
              className="rounded-full border border-muted-line/30 px-4 py-1.5 text-sm font-semibold text-ink transition hover:border-indigo hover:text-indigo"
            >
              {category.name}
            </Link>
          ))}
        </div>
      )}

      <p className="mt-8 text-sm text-muted-warm" aria-live="polite">
        {query.trim()
          ? `${filtered.length} ${filtered.length === 1 ? "result" : "results"} for “${query.trim()}”`
          : `${posts.length} articles`}
      </p>

      {filtered.length > 0 ? (
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((post) => (
            <BlogCard key={post.slug} post={post} />
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-muted-line/40 bg-white/60 p-10 text-center">
          <p className="text-muted">No articles match your search. Try a different title.</p>
        </div>
      )}
    </>
  );
}
