import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getBlogCategoryUrl,
  getBlogConnectedTools,
  getBlogContent,
  getBlogPostBySlug,
  getBlogPostUrl,
  getLatestBlogPosts,
  getRelatedBlogPostsByCategory,
  slugifyCategory,
} from "@/lib/content";
import { extractHeadings } from "@/lib/blog";
import { BlogTableOfContents } from "@/components/blog/BlogTableOfContents";
import { BlogFaq } from "@/components/blog/BlogFaq";
import { BlogSidebar } from "@/components/blog/BlogSidebar";
import { BlogCard } from "@/components/blog/BlogCard";
import { BlogThumbnail } from "@/components/blog/BlogThumbnail";

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

  // Use the post's own thumbnail as the social share card when one is set;
  // otherwise fall back to the default Setu OG images. Relative paths resolve
  // against metadataBase (set in the root layout) to absolute URLs for crawlers.
  const defaultOgImages = [
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
  ];

  const shareImages = post.thumbnail
    ? [{ url: post.thumbnail, alt: post.title }]
    : defaultOgImages;

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
      images: shareImages,
    },
    twitter: {
      card: "summary_large_image",
      title: post.seoTitle ?? post.title,
      description: post.metaDescription ?? post.excerpt,
      images: shareImages.map((image) => image.url),
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

  const { html, headings } = extractHeadings(post.bodyHtml);
  const latestPosts = getLatestBlogPosts(5, post.slug);
  const relatedPosts = getRelatedBlogPostsByCategory(post.category, post.slug, 4);
  const connectedTools = getBlogConnectedTools(post).slice(0, 5);

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

  const faqSchema =
    post.faq && post.faq.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: post.faq.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: { "@type": "Answer", text: item.answer },
          })),
        }
      : null;

  return (
    <div className="mx-auto max-w-7xl px-6 py-12 lg:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      {faqSchema && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      )}

      <Link href="/blog" className="text-sm font-semibold text-indigo hover:underline">
        ← Back to blog
      </Link>

      <div className="mt-8 grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)_300px] lg:gap-12">
        {/* Left: sticky in-page navigation */}
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <BlogTableOfContents headings={headings} />
          </div>
        </aside>

        {/* Center: the article */}
        <article className="min-w-0">
          <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-muted-warm">
            <Link href={getBlogCategoryUrl(slugifyCategory(post.category))} className="hover:text-indigo">
              {post.category}
            </Link>
            <span aria-hidden="true">·</span>
            <time dateTime={post.date}>{formatDate(post.date)}</time>
          </div>

          <h1 className="mt-4 text-3xl font-bold tracking-tight text-ink md:text-4xl">{post.title}</h1>

          {post.thumbnail && (
            <div className="mt-8 aspect-[16/9] w-full overflow-hidden rounded-2xl border border-muted-line/20">
              <BlogThumbnail post={post} />
            </div>
          )}

          <div className="blog-content mt-8" dangerouslySetInnerHTML={{ __html: html }} />

          {post.faq && <BlogFaq items={post.faq} />}

          {relatedPosts.length > 0 && (
            <section className="mt-14 border-t border-muted-line/30 pt-10">
              <h2 className="text-2xl font-bold tracking-tight text-ink">
                More from {post.category}
              </h2>
              <div className="mt-6 grid gap-6 sm:grid-cols-2">
                {relatedPosts.map((related) => (
                  <BlogCard key={related.slug} post={related} />
                ))}
              </div>
            </section>
          )}
        </article>

        {/* Right: latest posts + connected tools/calculators */}
        <aside className="min-w-0">
          <BlogSidebar latestPosts={latestPosts} tools={connectedTools} />
        </aside>
      </div>
    </div>
  );
}
