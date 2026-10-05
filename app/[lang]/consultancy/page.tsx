import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLanguageCode, type LanguageCode } from "@/lib/i18n/config";
import { localesFor } from "@/lib/i18n/pages";
import { localizedMetadata } from "@/lib/i18n/page-metadata";
import { getLocalizedContent } from "@/lib/i18n/page-content";
import { getConsultancyContent } from "@/lib/content";
import { ConsultancySections } from "@/components/consultancy/ConsultancySections";

/**
 * The consultancy page in every language it has been translated into.
 *
 * Mirrors the English page at /consultancy: same body, same structure, its own
 * title, description and canonical, and the hreflang cluster that ties the
 * versions together. Languages without a translation are not published here —
 * see lib/i18n/pages.
 */

export function generateStaticParams() {
  return localesFor("consultancy").map((lang) => ({ lang }));
}

export const dynamicParams = false;

function resolveLang(lang: string): LanguageCode {
  if (!isLanguageCode(lang) || lang === "en" || !localesFor("consultancy").includes(lang)) notFound();
  return lang;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const lang = resolveLang((await params).lang);
  const content = getLocalizedContent("consultancy", lang, getConsultancyContent());
  return localizedMetadata({ key: "consultancy", lang, seo: content.seo });
}

export default async function LocalizedConsultancyPage({ params }: { params: Promise<{ lang: string }> }) {
  const lang = resolveLang((await params).lang);
  const content = getLocalizedContent("consultancy", lang, getConsultancyContent());

  return <ConsultancySections content={content} lang={lang} />;
}
