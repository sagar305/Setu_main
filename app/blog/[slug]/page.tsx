import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBlogContent, getBlogPostBySlug, slugifyCategory } from "@/lib/content";

const content = getBlogContent();

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function generateStaticParams() {
  return content.posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);
  if (!post) return {};

  return {
    title: post.seoTitle ?? `${post.title} | Setu Technology Blog`,
    description: post.metaDescription ?? post.excerpt,
    keywords: post.keywords,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title: post.seoTitle ?? post.title,
      description: post.metaDescription ?? post.excerpt,
      url: `/blog/${post.slug}`,
      type: "article",
      publishedTime: post.date,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);
  if (!post) notFound();

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.metaDescription ?? post.excerpt,
    datePublished: post.date,
    author: { "@type": "Organization", name: "Setu Technology" },
    publisher: { "@type": "Organization", name: "Setu Technology" },
    mainEntityOfPage: `https://setutechnology.com/blog/${post.slug}`,
  };

  return (
    <article className="mx-auto max-w-3xl px-6 py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />

      <Link href="/blog" className="text-sm font-semibold text-indigo hover:underline">
        ← Back to blog
      </Link>

      <div className="mt-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-muted-warm">
        <Link href={`/blog/category/${slugifyCategory(post.category)}`} className="hover:text-indigo">
          {post.category}
        </Link>
        <span aria-hidden="true">·</span>
        <time dateTime={post.date}>{formatDate(post.date)}</time>
      </div>

      <h1 className="mt-4 text-3xl font-bold tracking-tight text-ink md:text-4xl">{post.title}</h1>

      <div className="blog-content mt-8" dangerouslySetInnerHTML={{ __html: post.bodyHtml }} />
    </article>
  );
}
