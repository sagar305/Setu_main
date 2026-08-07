import type { Metadata } from "next";
import { Suspense } from "react";
import {
  getBlogContent,
  getBlogPostUrl,
  getCalculatorsContent,
  getToolsContent,
} from "@/lib/content";
import { SiteSearch, type SearchItem } from "@/components/SiteSearch";

export const metadata: Metadata = {
  title: "Search | Setu Technology",
  description:
    "Search every free Setu calculator, business tool and article — GST, invoicing, food cost, inventory and more.",
  // Internal search result pages are not useful in the index; the route exists
  // so the homepage WebSite/SearchAction schema has a real target.
  robots: { index: false, follow: true },
  alternates: { canonical: "/search" },
};

function buildIndex(): SearchItem[] {
  const calculators: SearchItem[] = getCalculatorsContent().items.map((item) => ({
    title: item.name,
    description: item.shortDescription,
    href: `/calculators/${item.slug}`,
    kind: "Calculator",
  }));

  const tools: SearchItem[] = getToolsContent().items.map((item) => ({
    title: item.name,
    description: item.shortDescription,
    href: "href" in item && item.href ? item.href : `/tools/${item.slug}`,
    kind: "Tool",
  }));

  const articles: SearchItem[] = getBlogContent().posts.map((post) => ({
    title: post.title,
    description: post.excerpt,
    href: getBlogPostUrl(post),
    kind: "Article",
  }));

  return [...calculators, ...tools, ...articles];
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-3xl px-6 py-12 text-muted">Loading…</div>}>
      <SiteSearch items={buildIndex()} />
    </Suspense>
  );
}
