import type { Metadata } from "next";

import type { LanguageCode } from "./config";
import { languageAlternates, ogLocaleFor, pathFor, type PageKey } from "./pages";

// Shared metadata for a translated page.
//
// Every localized route needs the same six things — its own title, description
// and keywords, a canonical pointing at itself, the full hreflang cluster, and
// OpenGraph/Twitter cards in the right locale. Writing that out per page is how
// one of them ends up canonicalising to the English URL.

const OG_IMAGES = [
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

export function localizedMetadata({
  key,
  lang,
  seo,
}: {
  key: PageKey;
  lang: LanguageCode;
  seo: { title: string; description: string; keywords?: string[] };
}): Metadata {
  const path = pathFor(key, lang);

  return {
    title: seo.title,
    description: seo.description,
    ...(seo.keywords ? { keywords: seo.keywords } : {}),
    alternates: {
      canonical: path,
      // The whole cluster, repeated on each version: hreflang is only honoured
      // when the pages point at each other both ways.
      languages: languageAlternates(key),
    },
    openGraph: {
      title: seo.title,
      description: seo.description,
      url: path,
      locale: ogLocaleFor(lang),
      images: OG_IMAGES,
    },
    twitter: {
      card: "summary_large_image",
      title: seo.title,
      description: seo.description,
      images: OG_IMAGES.map((image) => image.url),
    },
  };
}
