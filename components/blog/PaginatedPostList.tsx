"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { BlogPostSummary } from "@/lib/blog";
import { BlogCard } from "@/components/blog/BlogCard";

export const PER_PAGE_OPTIONS = [5, 10, 20, 50] as const;
const DEFAULT_PER_PAGE = 10;

/** Page numbers to show, collapsing long runs to an ellipsis. */
function pageWindow(current: number, total: number): (number | "gap")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages = new Set([1, total, current, current - 1, current + 1]);
  const shown = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);

  const out: (number | "gap")[] = [];
  let previous = 0;
  for (const page of shown) {
    if (previous && page - previous > 1) out.push("gap");
    out.push(page);
    previous = page;
  }
  return out;
}

export function PaginatedPostList({
  posts,
  emptyMessage = "No articles to show.",
}: {
  posts: BlogPostSummary[];
  emptyMessage?: string;
}) {
  const [perPage, setPerPage] = useState<number>(DEFAULT_PER_PAGE);
  const [page, setPage] = useState(1);

  // Jump back to the first page when the incoming list changes — otherwise a
  // search that narrows the results can leave you on a page that no longer
  // exists. `posts` is memoised by the caller, so this fires on real changes.
  useEffect(() => setPage(1), [posts]);

  const totalPages = Math.max(1, Math.ceil(posts.length / perPage));
  // Guard against a stale page for the render that happens before the effect.
  const currentPage = Math.min(page, totalPages);

  const visible = useMemo(() => {
    const start = (currentPage - 1) * perPage;
    return posts.slice(start, start + perPage);
  }, [posts, currentPage, perPage]);

  if (posts.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-dashed border-muted-line/40 bg-white/60 p-10 text-center">
        <p className="text-muted">{emptyMessage}</p>
      </div>
    );
  }

  const first = (currentPage - 1) * perPage + 1;
  const last = Math.min(currentPage * perPage, posts.length);

  const goTo = (next: number) => {
    setPage(Math.min(Math.max(1, next), totalPages));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted-warm" aria-live="polite">
          Showing {first}–{last} of {posts.length}
        </p>

        <label className="flex items-center gap-2 text-sm text-muted-warm">
          Per page
          <select
            value={perPage}
            onChange={(event) => {
              setPerPage(Number(event.target.value));
              setPage(1);
            }}
            className="rounded-lg border border-muted-line/40 bg-white px-3 py-1.5 text-sm font-semibold text-ink outline-none transition focus:border-indigo focus:ring-2 focus:ring-indigo/20"
          >
            {PER_PAGE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-6 flex flex-col gap-6">
        {visible.map((post) => (
          <BlogCard key={post.slug} post={post} layout="horizontal" />
        ))}
      </div>

      {totalPages > 1 && (
        <nav
          aria-label="Pagination"
          className="mt-10 flex flex-wrap items-center justify-center gap-2"
        >
          <button
            type="button"
            onClick={() => goTo(currentPage - 1)}
            disabled={currentPage === 1}
            aria-label="Previous page"
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-muted-line/40 px-3 text-sm font-semibold text-ink transition enabled:hover:border-indigo enabled:hover:text-indigo disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Prev
          </button>

          {pageWindow(currentPage, totalPages).map((entry, index) =>
            entry === "gap" ? (
              <span key={`gap-${index}`} className="px-1 text-sm text-muted-warm" aria-hidden="true">
                …
              </span>
            ) : (
              <button
                key={entry}
                type="button"
                onClick={() => goTo(entry)}
                aria-label={`Page ${entry}`}
                aria-current={entry === currentPage ? "page" : undefined}
                className={`h-9 min-w-9 rounded-lg border px-3 text-sm font-semibold transition ${
                  entry === currentPage
                    ? "border-indigo bg-indigo text-cream-paper"
                    : "border-muted-line/40 text-ink hover:border-indigo hover:text-indigo"
                }`}
              >
                {entry}
              </button>
            ),
          )}

          <button
            type="button"
            onClick={() => goTo(currentPage + 1)}
            disabled={currentPage === totalPages}
            aria-label="Next page"
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-muted-line/40 px-3 text-sm font-semibold text-ink transition enabled:hover:border-indigo enabled:hover:text-indigo disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </nav>
      )}
    </>
  );
}
