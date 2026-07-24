import Link from "next/link";
import { Calculator, Wrench } from "lucide-react";
import type { BlogConnectedToolLink, BlogPostSummary } from "@/lib/content";
import { getBlogPostUrl } from "@/lib/content";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function BlogSidebar({
  latestPosts,
  tools,
}: {
  latestPosts: BlogPostSummary[];
  tools: BlogConnectedToolLink[];
}) {
  return (
    <div className="flex flex-col gap-8 lg:sticky lg:top-24">
      {latestPosts.length > 0 && (
        <section className="rounded-2xl border border-muted-line/20 bg-white p-6 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-warm">Latest posts</h2>
          <ul className="mt-4 flex flex-col gap-4">
            {latestPosts.map((post) => (
              <li key={post.slug} className="border-b border-muted-line/20 pb-4 last:border-none last:pb-0">
                <Link href={getBlogPostUrl(post)} className="group block">
                  <span className="text-xs font-medium text-muted-warm">{formatDate(post.date)}</span>
                  <span className="mt-1 block text-sm font-semibold leading-snug text-ink transition group-hover:text-indigo">
                    {post.title}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tools.length > 0 && (
        <section className="rounded-2xl border border-indigo/15 bg-white p-6 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-warm">
            Tools &amp; calculators
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
    </div>
  );
}
