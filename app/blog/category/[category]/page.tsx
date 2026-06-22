import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBlogCategories, getBlogPostUrl, getBlogPostsByCategorySlug } from "@/lib/content";
import { PageHero } from "@/components/PageHero";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function generateStaticParams() {
  return getBlogCategories().map((category) => ({ category: category.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category: categorySlug } = await params;
  const category = getBlogCategories().find((c) => c.slug === categorySlug);
  if (!category) return {};

  return {
    title: `${category.name} | Setu Technology Blog`,
    description: `Articles on ${category.name.toLowerCase()} for restaurant and business operators, from Setu Technology.`,
    alternates: { canonical: `/blog/category/${category.slug}` },
    openGraph: {
      title: `${category.name} | Setu Technology Blog`,
      url: `/blog/category/${category.slug}`,
    },
  };
}

export default async function BlogCategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category: categorySlug } = await params;
  const category = getBlogCategories().find((c) => c.slug === categorySlug);
  if (!category) notFound();

  const posts = getBlogPostsByCategorySlug(categorySlug);

  return (
    <>
      <PageHero
        eyebrow="Blog"
        headline={category.name}
        subheadline={`Articles on ${category.name.toLowerCase()} for restaurant and business operators.`}
      />

      <section className="mx-auto max-w-4xl px-6 pt-4">
        <Link href="/blog" className="text-sm font-semibold text-indigo hover:underline">
          ← All posts
        </Link>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-12">
        <div className="flex flex-col gap-6">
          {posts.map((post) => (
            <article
              key={post.slug}
              className="rounded-2xl border border-muted-line/20 bg-white p-6 shadow-sm"
            >
              <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-muted-warm">
                <span>{post.category}</span>
                <span aria-hidden="true">·</span>
                <time dateTime={post.date}>{formatDate(post.date)}</time>
              </div>
              <Link href={getBlogPostUrl(post)}>
                <h2 className="mt-3 text-xl font-bold text-ink transition hover:text-indigo">
                  {post.title}
                </h2>
              </Link>
              <p className="mt-2 text-muted leading-relaxed">{post.excerpt}</p>
              <Link
                href={getBlogPostUrl(post)}
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
