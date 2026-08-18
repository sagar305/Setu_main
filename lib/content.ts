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
import qrMenuData from "@/content/en/qr-menu.json";
import retailData from "@/content/en/retail.json";
import clinicData from "@/content/en/clinic.json";
import tuitionData from "@/content/en/tuition.json";
import calculatorsData from "@/content/en/calculators.json";
import toolsData from "@/content/en/tools.json";
import consultancyData from "@/content/en/consultancy.json";
import teamData from "@/content/en/team.json";
import pricingData from "@/content/en/pricing.json";

export type Cta = { label: string; href: string };

export type SiteContent = typeof siteData;
export type HomeContent = typeof homeData;
export type AboutContent = typeof aboutData;
export type ProductsContent = typeof productsData;
export type ContactContent = typeof contactData;
export type RestaurantPosContent = typeof restaurantPosData;
export type QueueContent = typeof queueData;
export type QrMenuContent = typeof qrMenuData;
export type RetailContent = typeof retailData;
export type ClinicContent = typeof clinicData;
export type TuitionContent = typeof tuitionData;
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

export function getQrMenuContent(): QrMenuContent {
  return qrMenuData;
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
  BlogCategoryMeta,
  BlogConnectedToolLink,
} from "@/lib/blog";
export { slugifyCategory, getBlogPostUrl, getBlogCategoryUrl } from "@/lib/blog";

import type {
  BlogCategoryMeta,
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
    const index = JSON.parse(raw) as BlogIndex;

    // Listing cards and the article read different images on purpose: the card
    // crops to 3:2 while social platforms crop a shared link to about 1.91:1,
    // so index.json points at /blog/thumbnails/listing/<slug> and the post file
    // at /blog/thumbnails/<slug>. Where index.json has no thumbnail, fall back
    // to the post's own image so older posts keep working with one file.
    index.posts = index.posts.map((post) => {
      if (post.thumbnail) return post;
      const file = path.join(BLOG_POSTS_DIR, `${post.slug}.json`);
      try {
        const full = JSON.parse(fs.readFileSync(file, "utf8")) as { thumbnail?: string | null };
        return full.thumbnail ? { ...post, thumbnail: full.thumbnail } : post;
      } catch {
        return post;
      }
    });

    blogIndexCache = index;
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

/** Hand-written SEO copy for a category listing page, if one is defined. */
export function getBlogCategoryMeta(categorySlug: string): BlogCategoryMeta | undefined {
  return loadBlogIndex().categories?.[categorySlug];
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

// ---------------------------------------------------------------------------
// Glossary
//
// Same layout as the blog (see /content/glossary):
//   - index.json          -> landing SEO/hero, categories, term summaries
//   - terms/<slug>.json   -> full entry (definition, body, FAQ, related tools)
// Everything is read at build time; the pages are statically rendered.
// ---------------------------------------------------------------------------

const GLOSSARY_DIR = path.join(process.cwd(), "content", "glossary");
const GLOSSARY_TERMS_DIR = path.join(GLOSSARY_DIR, "terms");

export type {
  GlossaryCategory,
  GlossaryFaqItem,
  GlossaryIndex,
  GlossaryMatcher,
  GlossarySegment,
  GlossaryTerm,
  GlossaryTermSummary,
  GlossaryToolLink,
  GlossaryToolRef,
} from "@/lib/glossary";
export { getGlossaryTermUrl, glossaryInitial } from "@/lib/glossary";

import type {
  GlossaryCategory,
  GlossaryIndex,
  GlossaryLinkState,
  GlossaryMatcher,
  GlossarySegment,
  GlossaryTerm,
  GlossaryTermSummary,
  GlossaryToolLink,
  GlossaryToolRef,
} from "@/lib/glossary";
import {
  buildGlossaryMatcher,
  createGlossaryLinkState,
  linkGlossaryHtml,
  segmentGlossaryText,
} from "@/lib/glossary";

let glossaryIndexCache: GlossaryIndex | null = null;

function loadGlossaryIndex(): GlossaryIndex {
  if (!glossaryIndexCache) {
    const raw = fs.readFileSync(path.join(GLOSSARY_DIR, "index.json"), "utf8");
    glossaryIndexCache = JSON.parse(raw) as GlossaryIndex;
  }
  return glossaryIndexCache;
}

export function getGlossaryContent(): GlossaryIndex {
  return loadGlossaryIndex();
}

export function getGlossaryTerms(): GlossaryTermSummary[] {
  return loadGlossaryIndex().terms;
}

export function getGlossaryCategories(): GlossaryCategory[] {
  return loadGlossaryIndex().categories;
}

export function getGlossaryCategory(id: string): GlossaryCategory | undefined {
  return loadGlossaryIndex().categories.find((category) => category.id === id);
}

export function getGlossaryTermBySlug(slug: string): GlossaryTerm | undefined {
  // Guard against path traversal via the [slug] route segment.
  if (!/^[a-z0-9-]+$/i.test(slug)) return undefined;
  const file = path.join(GLOSSARY_TERMS_DIR, `${slug}.json`);
  if (!fs.existsSync(file)) return undefined;
  return JSON.parse(fs.readFileSync(file, "utf8")) as GlossaryTerm;
}

/** Term summaries for a list of slugs, in the order given, skipping unknowns. */
export function getGlossaryTermSummaries(slugs: string[]): GlossaryTermSummary[] {
  const bySlug = new Map(loadGlossaryIndex().terms.map((term) => [term.slug, term]));
  return slugs.map((slug) => bySlug.get(slug)).filter((term): term is GlossaryTermSummary => Boolean(term));
}

/** Resolve a term's tool/calculator references to displayable links. */
export function getGlossaryToolLinks(refs: GlossaryToolRef[], limit = 5): GlossaryToolLink[] {
  const links: GlossaryToolLink[] = [];
  for (const ref of refs ?? []) {
    if (links.length >= limit) break;
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

// Reverse index: which glossary terms name a given tool or calculator. Built
// once by reading every term file, so tool pages can link the vocabulary that
// belongs to them without each page hardcoding a list.
let glossaryTermsByToolCache: Map<string, GlossaryTermSummary[]> | null = null;

function loadGlossaryTermsByTool(): Map<string, GlossaryTermSummary[]> {
  if (glossaryTermsByToolCache) return glossaryTermsByToolCache;

  const summaries = new Map(loadGlossaryIndex().terms.map((term) => [term.slug, term]));
  // Rank carries how prominently a term names the tool: a term that lists it
  // first is more about that tool than one listing it fifth, so tool pages show
  // the closest vocabulary rather than whatever sorts first alphabetically.
  const index = new Map<string, { summary: GlossaryTermSummary; rank: number }[]>();

  for (const file of fs.readdirSync(GLOSSARY_TERMS_DIR)) {
    if (!file.endsWith(".json")) continue;
    const term = JSON.parse(
      fs.readFileSync(path.join(GLOSSARY_TERMS_DIR, file), "utf8"),
    ) as GlossaryTerm;
    const summary = summaries.get(term.slug);
    if (!summary) continue;
    (term.relatedTools ?? []).forEach((ref, rank) => {
      const key = `${ref.type}:${ref.slug}`;
      const entry = { summary, rank };
      const bucket = index.get(key);
      if (bucket) bucket.push(entry);
      else index.set(key, [entry]);
    });
  }

  const ranked = new Map<string, GlossaryTermSummary[]>();
  for (const [key, bucket] of index) {
    bucket.sort((a, b) => a.rank - b.rank || a.summary.term.localeCompare(b.summary.term));
    ranked.set(
      key,
      bucket.map((entry) => entry.summary),
    );
  }

  glossaryTermsByToolCache = ranked;
  return ranked;
}

/** Glossary terms that reference a given tool or calculator. */
export function getGlossaryTermsForTool(
  type: "tool" | "calculator",
  slug: string,
  limit = 8,
): GlossaryTermSummary[] {
  return (loadGlossaryTermsByTool().get(`${type}:${slug}`) ?? []).slice(0, limit);
}

// --- Auto-linking -----------------------------------------------------------

let glossaryMatcherCache: GlossaryMatcher | null = null;

function getGlossaryMatcher(): GlossaryMatcher {
  if (!glossaryMatcherCache) {
    glossaryMatcherCache = buildGlossaryMatcher(loadGlossaryIndex().terms);
  }
  return glossaryMatcherCache;
}

export type GlossaryLinker = {
  /** Link glossary terms inside an HTML string (blog bodies, term bodies). */
  html: (input: string) => string;
  /** Split a plain-text paragraph into text and link segments. */
  text: (input: string) => GlossarySegment[];
};

/**
 * One linker per rendered page. State is shared across every call so a term is
 * linked at most once on the page, and `maxLinks` keeps articles readable
 * rather than turning every other noun into a link.
 */
export function createGlossaryLinker(
  options: { maxLinks?: number; exclude?: string[] } = {},
): GlossaryLinker {
  const matcher = getGlossaryMatcher();
  const state: GlossaryLinkState = createGlossaryLinkState(options.maxLinks ?? 14, options.exclude ?? []);
  return {
    html: (input: string) => linkGlossaryHtml(input, matcher, state),
    text: (input: string) => segmentGlossaryText(input, matcher, state),
  };
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

export function getTuitionContent(): TuitionContent {
  return tuitionData;
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

// ---------------------------------------------------------------------------
// Team
// ---------------------------------------------------------------------------

export type { TeamContent, TeamMember, TeamSocialLink } from "@/lib/team";
export { blogAuthorSlug, FINANCE_AUTHOR_SLUG, GENERAL_AUTHOR_SLUG } from "@/lib/team";

import type { TeamContent, TeamMember } from "@/lib/team";

export function getTeamContent(): TeamContent {
  return teamData as TeamContent;
}

export function getTeamMember(slug: string): TeamMember | undefined {
  return getTeamContent().members.find((member) => member.slug === slug);
}

// ---------------------------------------------------------------------------
// Pricing
// ---------------------------------------------------------------------------

export type { PricingContent, PricingPlan, PricingRegionId } from "@/lib/pricing";

import type { PricingContent, PricingPlan } from "@/lib/pricing";

export function getPricingContent(): PricingContent {
  return pricingData as PricingContent;
}

export function getPricingPlan(slug: string): PricingPlan | undefined {
  return getPricingContent().plans.find((plan) => plan.slug === slug);
}
