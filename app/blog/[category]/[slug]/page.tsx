import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBlogCategoryUrl, getBlogContent, getBlogPostBySlug, getBlogPostUrl, slugifyCategory } from "@/lib/content";

const content = getBlogContent();

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function generateStaticParams() {
  return content.posts.map((post) => ({
    category: slugifyCategory(post.category),
    slug: post.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string; slug: string }>;
}): Promise<Metadata> {
  const { category, slug } = await params;
  const post = getBlogPostBySlug(slug);
  if (!post || slugifyCategory(post.category) !== category) return {};

  const url = getBlogPostUrl(post);

  return {
    title: post.seoTitle ?? `${post.title} | Setu Technology Blog`,
    description: post.metaDescription ?? post.excerpt,
    keywords: post.keywords,
    alternates: { canonical: url },
    openGraph: {
      title: post.seoTitle ?? post.title,
      description: post.metaDescription ?? post.excerpt,
      url,
      type: "article",
      publishedTime: post.date,
      images: [
        {
          url: "/og/setu-og-image-1200x627.png",
          width: 1200,
          height: 627,
          alt: "Setu Technology - Setu for your business",
        },
        {
          url: "/og/setu-og-image-800x418.png",
          width: 800,
          height: 418,
          alt: "Setu Technology - Setu for your business",
        },
        {
          url: "/og/setu-og-image-500x261.png",
          width: 500,
          height: 261,
          alt: "Setu Technology - Setu for your business",
        },
      ],
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ category: string; slug: string }>;
}) {
  const { category, slug } = await params;
  const post = getBlogPostBySlug(slug);
  if (!post || slugifyCategory(post.category) !== category) notFound();

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.metaDescription ?? post.excerpt,
    datePublished: post.date,
    author: { "@type": "Organization", name: "Setu Technology" },
    publisher: { "@type": "Organization", name: "Setu Technology" },
    mainEntityOfPage: `https://setutechnology.com${getBlogPostUrl(post)}`,
  };

  return (
    <article className="mx-auto max-w-3xl px-6 py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />

      <Link href="/blog" className="text-sm font-semibold text-indigo hover:underline">
        ← Back to blog
      </Link>

      <div className="mt-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-muted-warm">
        <Link href={getBlogCategoryUrl(slugifyCategory(post.category))} className="hover:text-indigo">
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
