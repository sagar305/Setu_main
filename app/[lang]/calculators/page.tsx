import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLanguageCode, type LanguageCode } from "@/lib/i18n/config";
import { localesFor } from "@/lib/i18n/pages";
import { localizedMetadata } from "@/lib/i18n/page-metadata";
import { getLocalizedContent } from "@/lib/i18n/page-content";
import { getCalculatorsContent } from "@/lib/content";
import { CalculatorsSections } from "@/components/calculators/CalculatorsSections";

/**
 * The calculator directory in every language it has been translated into.
 *
 * Mirrors the English page at /calculators: same body, same structure, its own
 * title, description and canonical, and the hreflang cluster that ties the
 * versions together. Languages without a translation are not published here —
 * see lib/i18n/pages.
 */

export function generateStaticParams() {
  return localesFor("calculators").map((lang) => ({ lang }));
}

export const dynamicParams = false;

function resolveLang(lang: string): LanguageCode {
  if (!isLanguageCode(lang) || lang === "en" || !localesFor("calculators").includes(lang)) notFound();
  return lang;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const lang = resolveLang((await params).lang);
  const content = getLocalizedContent("calculators", lang, getCalculatorsContent());
  return localizedMetadata({ key: "calculators", lang, seo: content.seo });
}

export default async function LocalizedCalculatorsPage({ params }: { params: Promise<{ lang: string }> }) {
  const lang = resolveLang((await params).lang);
  const content = getLocalizedContent("calculators", lang, getCalculatorsContent());

  return <CalculatorsSections content={content} lang={lang} />;
}
