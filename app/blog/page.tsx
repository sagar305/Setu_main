import type { Metadata } from "next";
import { getBlogCategories, getBlogContent } from "@/lib/content";
import { PageHero } from "@/components/PageHero";
import { BlogSearchList } from "@/components/blog/BlogSearchList";

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

export default function BlogPage() {
  const categories = getBlogCategories();

  return (
    <>
      <PageHero
        eyebrow={content.hero.eyebrow}
        headline={content.hero.headline}
        subheadline={content.hero.subheadline}
      />

      <section className="mx-auto max-w-6xl px-6 py-12">
        <BlogSearchList posts={content.posts} categories={categories} />
      </section>
    </>
  );
}
