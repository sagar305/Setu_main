import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalculatorShell } from "@/components/calculators/CalculatorShell";
import { CALCULATOR_TOOLS } from "@/components/calculators/tools/registry";
import { getCalculatorsContent, type CalculatorItem } from "@/lib/content";
import { isLanguageCode, type LanguageCode } from "@/lib/i18n/config";
import { getLocalizedContent } from "@/lib/i18n/page-content";
import {
  itemLanguageAlternates,
  itemLocalesFor,
  itemPathFor,
  itemRoutesFor,
  ogLocaleFor,
} from "@/lib/i18n/pages";

/**
 * One calculator's own page, in every language it has been translated into.
 *
 * The English pages are a folder each under app/calculators, because each one
 * imports its own tool. There is one file here instead: the copy comes from the
 * same content the English page reads, and the tool comes from a registry
 * generated off those pages, so a calculator cannot exist in English and be
 * silently missing in the other sixteen languages.
 *
 * A (language, slug) pair is only prerendered once that calculator's copy is
 * translated into that language — see TRANSLATED_ITEMS. Until then only the
 * English page exists, which is what hreflang on it says.
 */

const OG_IMAGES = [
  { url: "/og/setu-og-image-1200x627.png", width: 1200, height: 627 },
  { url: "/og/setu-og-image-800x418.png", width: 800, height: 418 },
  { url: "/og/setu-og-image-500x261.png", width: 500, height: 261 },
].map((image) => ({ ...image, alt: "Setu Technology - Setu for your business" }));

export function generateStaticParams() {
  return itemRoutesFor("calculators");
}

export const dynamicParams = false;

type Params = Promise<{ lang: string; slug: string }>;

/** The calculator in this language, or a 404 if it is not published in it. */
function resolve(lang: string, slug: string): { lang: LanguageCode; item: CalculatorItem } {
  if (!isLanguageCode(lang) || lang === "en") notFound();
  if (!itemLocalesFor("calculators", slug).includes(lang)) notFound();

  const english = getCalculatorsContent();
  const index = english.items.findIndex((item) => item.slug === slug);
  if (index === -1) notFound();

  // The whole page is merged at once rather than item by item, so an item's
  // copy falls back to English exactly as every other translated page does.
  const localized = getLocalizedContent("calculators", lang, english);
  return { lang, item: localized.items[index] };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang: rawLang, slug } = await params;
  const { lang, item } = resolve(rawLang, slug);
  const path = itemPathFor("calculators", slug, lang);

  return {
    title: item.seo.title,
    description: item.seo.description,
    keywords: item.seo.keywords,
    alternates: {
      canonical: path,
      languages: itemLanguageAlternates("calculators", slug),
    },
    openGraph: {
      title: item.seo.title,
      description: item.seo.description,
      url: path,
      locale: ogLocaleFor(lang),
      images: OG_IMAGES,
    },
    twitter: {
      card: "summary_large_image",
      title: item.seo.title,
      description: item.seo.description,
      images: OG_IMAGES.map((image) => image.url),
    },
  };
}

export default async function LocalizedCalculatorPage({ params }: { params: Params }) {
  const { lang: rawLang, slug } = await params;
  const { lang, item } = resolve(rawLang, slug);

  const Tool = CALCULATOR_TOOLS[slug];
  if (!Tool) notFound();

  return (
    <CalculatorShell item={item} lang={lang}>
      <Tool />
    </CalculatorShell>
  );
}
