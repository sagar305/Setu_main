import type { Metadata } from "next";
import Link from "next/link";
import { getBlogCategories, getBlogContent, slugifyCategory } from "@/lib/content";
import { PageHero } from "@/components/PageHero";

const content = getBlogContent();

export const metadata: Metadata = {
  title: content.seo.title,
  description: content.seo.description,
  keywords: content.seo.keywords,
  alternates: { canonical: "/blog" },
  openGraph: {
    title: content.seo.title,
    description: content.seo.description,
    url: "/blog",
  },
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function BlogPage() {
  const categories = getBlogCategories();

  return (
    <>
      <PageHero
        eyebrow={content.hero.eyebrow}
        headline={content.hero.headline}
        subheadline={content.hero.subheadline}
      />

      <section className="mx-auto max-w-4xl px-6 pt-4">
        <div className="flex flex-wrap gap-3">
          {categories.map((category) => (
            <Link
              key={category.slug}
              href={`/blog/category/${category.slug}`}
              className="rounded-full border border-muted-line/30 px-4 py-1.5 text-sm font-semibold text-ink transition hover:border-indigo hover:text-indigo"
            >
              {category.name}
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-12">
        <div className="flex flex-col gap-6">
          {content.posts.map((post) => (
            <article
              key={post.slug}
              className="rounded-2xl border border-muted-line/20 bg-white p-6 shadow-sm"
            >
              <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-muted-warm">
                <Link href={`/blog/category/${slugifyCategory(post.category)}`} className="hover:text-indigo">
                  {post.category}
                </Link>
                <span aria-hidden="true">·</span>
                <time dateTime={post.date}>{formatDate(post.date)}</time>
              </div>
              <Link href={`/blog/${post.slug}`}>
                <h2 className="mt-3 text-xl font-bold text-ink transition hover:text-indigo">
                  {post.title}
                </h2>
              </Link>
              <p className="mt-2 text-muted leading-relaxed">{post.excerpt}</p>
              <Link
                href={`/blog/${post.slug}`}
                className="mt-3 inline-block text-sm font-semibold text-indigo hover:underline"
              >
                Read more →
              </Link>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
