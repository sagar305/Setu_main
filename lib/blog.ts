// Client-safe blog helpers and shared types.
//
// This module has NO "server-only" marker, so it can be imported by both server
// and client components. The filesystem-backed loaders live in lib/content.ts
// (which re-exports the types below); anything a client component needs — pure
// types and URL builders — belongs here.

export type BlogFaqItem = { question: string; answer: string };
export type BlogConnectedTool = { type: "tool" | "calculator"; slug: string };

export type BlogPostSummary = {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  category: string;
  thumbnail: string | null;
};

export type BlogPost = BlogPostSummary & {
  seoTitle?: string;
  metaDescription?: string;
  keywords?: string[];
  connectedTools: BlogConnectedTool[];
  faq: BlogFaqItem[];
  bodyHtml: string;
};

export type BlogIndex = {
  seo: { title: string; description: string; keywords: string[] };
  hero: { eyebrow: string; headline: string; subheadline: string };
  posts: BlogPostSummary[];
};

export type BlogConnectedToolLink = {
  type: "tool" | "calculator";
  slug: string;
  name: string;
  description: string;
  href: string;
};

export function slugifyCategory(category: string): string {
  return category.toLowerCase().replace(/\s+/g, "-");
}

export function getBlogPostUrl(post: { slug: string; category: string }): string {
  return `/blog/${slugifyCategory(post.category)}/${post.slug}`;
}

export function getBlogCategoryUrl(categorySlug: string): string {
  return `/blog/${categorySlug}`;
}

// The article body is stored as an HTML string; we inject stable ids onto its
// <h2>/<h3> headings so the on-page table of contents can link to them.

export type BlogHeading = { id: string; text: string; level: 2 | 3 };

const ENTITY_MAP: Record<string, string> = {
  "&mdash;": "—",
  "&ndash;": "–",
  "&amp;": "&",
  "&rsquo;": "’",
  "&lsquo;": "‘",
  "&rdquo;": "”",
  "&ldquo;": "“",
  "&#8377;": "₹",
  "&nbsp;": " ",
  "&hellip;": "…",
};

function decodeEntities(text: string): string {
  return text.replace(/&[a-z#0-9]+;/gi, (match) => ENTITY_MAP[match] ?? match);
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "");
}

export function extractHeadings(html: string): { html: string; headings: BlogHeading[] } {
  const headings: BlogHeading[] = [];
  const used = new Set<string>();

  const slugify = (raw: string): string => {
    const base =
      decodeEntities(stripTags(raw))
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "section";
    let candidate = base;
    let i = 2;
    while (used.has(candidate)) candidate = `${base}-${i++}`;
    used.add(candidate);
    return candidate;
  };

  const withIds = html.replace(/<h([23])>([\s\S]*?)<\/h\1>/gi, (_match, lvl, inner) => {
    const level = Number(lvl) as 2 | 3;
    const id = slugify(inner);
    headings.push({ id, level, text: decodeEntities(stripTags(inner)).trim() });
    return `<h${lvl} id="${id}">${inner}</h${lvl}>`;
  });

  return { html: withIds, headings };
}
