import "server-only";

import fs from "node:fs";
import path from "node:path";

import siteData from "@/content/en/site.json";
import homeData from "@/content/en/home.json";
import aboutData from "@/content/en/about.json";
import productsData from "@/content/en/products.json";
import contactData from "@/content/en/contact.json";
import restaurantPosData from "@/content/en/restaurant-pos.json";
import queueData from "@/content/en/queue.json";
import retailData from "@/content/en/retail.json";
import clinicData from "@/content/en/clinic.json";
import calculatorsData from "@/content/en/calculators.json";
import toolsData from "@/content/en/tools.json";
import consultancyData from "@/content/en/consultancy.json";

export type Cta = { label: string; href: string };

export type SiteContent = typeof siteData;
export type HomeContent = typeof homeData;
export type AboutContent = typeof aboutData;
export type ProductsContent = typeof productsData;
export type ContactContent = typeof contactData;
export type RestaurantPosContent = typeof restaurantPosData;
export type QueueContent = typeof queueData;
export type RetailContent = typeof retailData;
export type ClinicContent = typeof clinicData;
export type CalculatorsContent = typeof calculatorsData;
export type CalculatorItem = CalculatorsContent["items"][number];
export type ToolsContent = typeof toolsData;
export type ToolItem = ToolsContent["items"][number];
export type ConsultancyContent = typeof consultancyData;

export function getSiteContent(): SiteContent {
  return siteData;
}

export function getHomeContent(): HomeContent {
  return homeData;
}

export function getAboutContent(): AboutContent {
  return aboutData;
}

export function getProductsContent(): ProductsContent {
  return productsData;
}

// ---------------------------------------------------------------------------
// Blog
//
// Blog content is split across many files (see /content/blog):
//   - index.json          -> landing SEO/hero + lightweight post metadata
//   - posts/<slug>.json    -> full post (bodyHtml, FAQ, connected tools, ...)
// A post's file name is its slug, which is unique across the blog.
// ---------------------------------------------------------------------------

const BLOG_DIR = path.join(process.cwd(), "content", "blog");
const BLOG_POSTS_DIR = path.join(BLOG_DIR, "posts");

// Client-safe types and URL helpers live in lib/blog; re-export them here so
// existing server-side imports from "@/lib/content" keep working.
export type {
  BlogFaqItem,
  BlogConnectedTool,
  BlogPostSummary,
  BlogPost,
  BlogIndex,
  BlogConnectedToolLink,
} from "@/lib/blog";
export { slugifyCategory, getBlogPostUrl, getBlogCategoryUrl } from "@/lib/blog";

import type {
  BlogConnectedToolLink,
  BlogIndex,
  BlogPost,
  BlogPostSummary,
} from "@/lib/blog";
import { slugifyCategory } from "@/lib/blog";

// Kept as `BlogContent` for the landing/list pages that consumed the old shape.
export type BlogContent = BlogIndex;

let blogIndexCache: BlogIndex | null = null;

function loadBlogIndex(): BlogIndex {
  if (!blogIndexCache) {
    const raw = fs.readFileSync(path.join(BLOG_DIR, "index.json"), "utf8");
    blogIndexCache = JSON.parse(raw) as BlogIndex;
  }
  return blogIndexCache;
}

export function getBlogContent(): BlogContent {
  return loadBlogIndex();
}

export function getBlogPostBySlug(slug: string): BlogPost | undefined {
  // Guard against path traversal via the [slug] route segment.
  if (!/^[a-z0-9-]+$/i.test(slug)) return undefined;
  const file = path.join(BLOG_POSTS_DIR, `${slug}.json`);
  if (!fs.existsSync(file)) return undefined;
  return JSON.parse(fs.readFileSync(file, "utf8")) as BlogPost;
}

export function getBlogCategories(): { name: string; slug: string }[] {
  const seen = new Map<string, string>();
  for (const post of loadBlogIndex().posts) {
    seen.set(slugifyCategory(post.category), post.category);
  }
  return Array.from(seen, ([slug, name]) => ({ slug, name }));
}

export function getBlogPostsByCategorySlug(categorySlug: string): BlogPostSummary[] {
  return loadBlogIndex().posts.filter((post) => slugifyCategory(post.category) === categorySlug);
}

/** Latest posts in the same category, excluding the given slug. */
export function getRelatedBlogPostsByCategory(
  category: string,
  excludeSlug: string,
  count = 4,
): BlogPostSummary[] {
  const categorySlug = slugifyCategory(category);
  return loadBlogIndex()
    .posts.filter((post) => slugifyCategory(post.category) === categorySlug && post.slug !== excludeSlug)
    .slice(0, count);
}

/** Most recent posts across all categories, excluding the given slug. */
export function getLatestBlogPosts(count = 5, excludeSlug?: string): BlogPostSummary[] {
  return loadBlogIndex()
    .posts.filter((post) => post.slug !== excludeSlug)
    .slice(0, count);
}

/** Resolve a post's connected tools/calculators to displayable links. */
export function getBlogConnectedTools(post: BlogPost): BlogConnectedToolLink[] {
  const links: BlogConnectedToolLink[] = [];
  for (const ref of post.connectedTools ?? []) {
    if (ref.type === "calculator") {
      const calc = getCalculatorBySlug(ref.slug);
      if (calc) {
        links.push({
          type: "calculator",
          slug: ref.slug,
          name: calc.name,
          description: calc.shortDescription,
          href: `/calculators/${ref.slug}`,
        });
      }
    } else {
      const tool = getToolBySlug(ref.slug);
      if (tool) {
        links.push({
          type: "tool",
          slug: ref.slug,
          name: tool.name,
          description: tool.shortDescription,
          href: "href" in tool && tool.href ? tool.href : `/tools/${ref.slug}`,
        });
      }
    }
  }
  return links;
}

export function getContactContent(): ContactContent {
  return contactData;
}

export function getRestaurantPosContent(): RestaurantPosContent {
  return restaurantPosData;
}

export function getQueueContent(): QueueContent {
  return queueData;
}

export function getRetailContent(): RetailContent {
  return retailData;
}

export function getClinicContent(): ClinicContent {
  return clinicData;
}

export function getCalculatorsContent(): CalculatorsContent {
  return calculatorsData;
}

export function getCalculatorBySlug(slug: string): CalculatorItem | undefined {
  return calculatorsData.items.find((item) => item.slug === slug);
}

export function getRelatedCalculators(slug: string, count = 3): CalculatorItem[] {
  const current = getCalculatorBySlug(slug);
  const rest = calculatorsData.items.filter((item) => item.slug !== slug);
  if (!current) return rest.slice(0, count);

  const sameCategory = rest.filter((item) => item.category === current.category);
  const others = rest.filter((item) => item.category !== current.category);
  return [...sameCategory, ...others].slice(0, count);
}

export function getToolsContent(): ToolsContent {
  return toolsData;
}

export function getToolBySlug(slug: string): ToolItem | undefined {
  return toolsData.items.find((item) => item.slug === slug);
}

export function getConsultancyContent(): ConsultancyContent {
  return consultancyData;
}
