import Link from "next/link";
import { getBlogContent, getBlogPostUrl } from "@/lib/content";
import { FadeIn, FadeInStagger, FadeInStaggerItem } from "@/components/motion/FadeIn";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function LatestBlogs() {
  const content = getBlogContent();
  const posts = content.posts.slice(0, 3);

  if (posts.length === 0) return null;

  return (
    <section className="bg-white">
    <div className="mx-auto max-w-6xl px-6 py-20">
      <FadeIn className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight text-ink">From the blog</h2>
          <p className="mt-4 text-lg text-muted">
            Practical thinking for business operators, from the team building software for it.
          </p>
        </div>
        <Link href="/blog" className="text-sm font-semibold text-indigo hover:underline">
          See more →
        </Link>
      </FadeIn>

      <FadeInStagger className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <FadeInStaggerItem
            key={post.slug}
            className="flex flex-col rounded-2xl border border-muted-line/20 bg-white p-6 shadow-sm"
          >
            <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-muted-warm">
              <span>{post.category}</span>
              <span aria-hidden="true">·</span>
              <time dateTime={post.date}>{formatDate(post.date)}</time>
            </div>
            <Link href={getBlogPostUrl(post)}>
              <h3 className="mt-3 text-lg font-bold text-ink transition hover:text-indigo">
                {post.title}
              </h3>
            </Link>
            <p className="mt-2 text-sm leading-relaxed text-muted">{post.excerpt}</p>
            <Link
              href={getBlogPostUrl(post)}
              className="mt-4 text-sm font-semibold text-indigo hover:underline"
            >
              Read more →
            </Link>
          </FadeInStaggerItem>
        ))}
      </FadeInStagger>
    </div>
    </section>
  );
}
