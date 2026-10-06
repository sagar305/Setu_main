import type { Metadata } from "next";

import type { LanguageCode } from "./config";
import { languageAlternates, ogImagesFor, ogLocaleFor, pathFor, type PageKey } from "./pages";

// Shared metadata for a translated page.
//
// Every localized route needs the same six things — its own title, description
// and keywords, a canonical pointing at itself, the full hreflang cluster, and
// OpenGraph/Twitter cards in the right locale. Writing that out per page is how
// one of them ends up canonicalising to the English URL.

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
      images: ogImagesFor(lang),
    },
    twitter: {
      card: "summary_large_image",
      title: seo.title,
      description: seo.description,
      images: ogImagesFor(lang).map((image) => image.url),
    },
  };
}
