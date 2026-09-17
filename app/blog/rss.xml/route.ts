import fs from "node:fs";
import path from "node:path";
import {
  blogAuthorSlug,
  getBlogContent,
  getBlogPostBySlug,
  getBlogPostUrl,
  getTeamMember,
  slugifyCategory,
} from "@/lib/content";
import { absolutizeHtml, buildRssFeed, type RssEnclosure, type RssItem } from "@/lib/rss";

// RSS feed for the blog, at https://setutechnology.com/blog/rss.xml.
//
// Fed to LinkedIn Page auto-posting (Admin tools -> Content -> RSS feeds), and
// to anything else that reads feeds. Everything it needs is on disk at build
// time, so the route is prerendered into a static file rather than rendered per
// request.
export const dynamic = "force-static";

const SITE = "https://setutechnology.com";
const FEED_URL = `${SITE}/blog/rss.xml`;

// Feed readers and LinkedIn only ever act on recent items, and each item here
// carries a full article body, so the feed stays to the latest posts instead of
// growing with the archive.
const MAX_ITEMS = 20;

const IMAGE_MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

/**
 * <enclosure> needs the file's real byte length, so the thumbnail is measured
 * in /public. Returns undefined when the post has no usable image.
 */
function enclosureFor(thumbnail: string | null | undefined): RssEnclosure | undefined {
  if (!thumbnail) return undefined;

  // Guard against traversal out of /public via a content-supplied path.
  const normalized = path.posix.normalize(thumbnail);
  if (!normalized.startsWith("/") || normalized.includes("..")) return undefined;

  const type = IMAGE_MIME_TYPES[path.extname(normalized).toLowerCase()];
  if (!type) return undefined;

  try {
    const { size } = fs.statSync(path.join(process.cwd(), "public", normalized));
    return { url: `${SITE}${normalized}`, type, length: size };
  } catch {
    return undefined;
  }
}

export function GET() {
  const content = getBlogContent();

  const items: RssItem[] = content.posts
    // index.json is maintained newest-first; sort anyway so a hand edit that
    // breaks the order cannot reorder the feed.
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, MAX_ITEMS)
    .map((summary) => {
      const post = getBlogPostBySlug(summary.slug);
      const categorySlug = slugifyCategory(summary.category);
      const author = getTeamMember(blogAuthorSlug(categorySlug));

      return {
        title: summary.title,
        link: `${SITE}${getBlogPostUrl(summary)}`,
        description: post?.metaDescription ?? summary.excerpt,
        contentHtml: post ? absolutizeHtml(post.bodyHtml, SITE) : undefined,
        pubDate: summary.date,
        category: summary.category,
        author: author?.name,
        // The post file points at the 1.91:1 social crop; index.json points at
        // the 3:2 listing card. Prefer the social one, which is what a preview
        // wants, and fall back to the card for posts that only have that.
        enclosure: enclosureFor(post?.thumbnail ?? summary.thumbnail),
      };
    });

  const xml = buildRssFeed({
    title: "Setu Technology Blog",
    link: `${SITE}/blog`,
    feedUrl: FEED_URL,
    description: content.seo.description,
    language: "en-IN",
    copyright: `© ${new Date().getFullYear()} Setu Technology`,
    imageUrl: `${SITE}/og/setu-og-image-1200x627.png`,
    items,
  });

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
