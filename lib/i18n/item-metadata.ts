import type { Metadata } from "next";

import { getToolBySlug, getToolsContent } from "@/lib/content";
import type { LanguageCode } from "./config";
import { getLocalizedContent } from "./page-content";
import { itemLanguageAlternates, itemPathFor, ogLocaleFor } from "./pages";

/**
 * Metadata for one tool's own page, in a given language.
 *
 * Each of the thirty-five tool pages used to declare this itself — title,
 * description, keywords, canonical and a full OpenGraph block, around thirty
 * lines of it, none of which a translation could reach. The copy now lives in
 * content/en/tools.json beside the rest of the site's, so the same page can be
 * served in any language it has been translated into and the pages carry one
 * line instead of thirty.
 *
 * The OpenGraph title and description are their own fields rather than reuses
 * of the page title: every one of these pages words the share card differently
 * from the search result, and that was worth keeping.
 */
export function toolMetadata(slug: string, lang: LanguageCode = "en"): Metadata {
  const item = localizedTool(slug, lang);
  if (!item) {
    throw new Error(`toolMetadata: no tool in content with slug "${slug}"`);
  }

  const path = itemPathFor("tools", slug, lang);
  const { seo } = item;

  return {
    title: seo.title,
    description: seo.description,
    keywords: seo.keywords,
    alternates: {
      canonical: path,
      // Published on the English page too, so the cluster points both ways —
      // hreflang that only points one way is ignored.
      languages: itemLanguageAlternates("tools", slug),
    },
    openGraph: {
      title: seo.ogTitle ?? seo.title,
      description: seo.ogDescription ?? seo.description,
      url: path,
      type: "website",
      locale: ogLocaleFor(lang),
      images: OG_IMAGES,
    },
    twitter: {
      card: "summary_large_image",
      title: seo.ogTitle ?? seo.title,
      description: seo.ogDescription ?? seo.description,
      images: OG_IMAGES.map((image) => image.url),
    },
  };
}

function localizedTool(slug: string, lang: LanguageCode) {
  if (lang === "en") return getToolBySlug(slug);

  const english = getToolsContent();
  const index = english.items.findIndex((item) => item.slug === slug);
  if (index === -1) return undefined;

  return getLocalizedContent("tools", lang, english).items[index];
}

const OG_IMAGES = [
  { url: "/og/setu-og-image-1200x627.png", width: 1200, height: 627 },
  { url: "/og/setu-og-image-800x418.png", width: 800, height: 418 },
  { url: "/og/setu-og-image-500x261.png", width: 500, height: 261 },
].map((image) => ({ ...image, alt: "Setu Technology - Setu for your business" }));
