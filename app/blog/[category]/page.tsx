import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBlogCategories, getBlogCategoryUrl, getBlogPostsByCategorySlug } from "@/lib/content";
import { PageHero } from "@/components/PageHero";
import { BlogCard } from "@/components/blog/BlogCard";

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

  const url = getBlogCategoryUrl(category.slug);

  return {
    title: `${category.name} | Setu Technology Blog`,
    description: `Articles on ${category.name.toLowerCase()} for restaurant and business operators, from Setu Technology.`,
    alternates: { canonical: url },
    openGraph: {
      title: `${category.name} | Setu Technology Blog`,
      url,
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

      <section className="mx-auto max-w-6xl px-6 pt-4">
        <Link href="/blog" className="text-sm font-semibold text-indigo hover:underline">
          ← All posts
        </Link>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <BlogCard key={post.slug} post={post} />
          ))}
        </div>
      </section>
    </>
  );
}
