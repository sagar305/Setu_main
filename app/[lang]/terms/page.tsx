import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLanguageCode, type LanguageCode } from "@/lib/i18n/config";
import { localesFor } from "@/lib/i18n/pages";
import { localizedMetadata } from "@/lib/i18n/page-metadata";
import { getLocalizedContent } from "@/lib/i18n/page-content";
import { getTermsContent } from "@/lib/content";
import { LegalPage } from "@/components/legal/LegalPage";
import { LanguageLinks } from "@/components/home/LanguageLinks";

/**
 * The terms of use in every language it has been translated into.
 *
 * Mirrors the English page at /terms: same body, same structure, its own
 * title, description and canonical, and the hreflang cluster that ties the
 * versions together. Languages without a translation are not published here —
 * see lib/i18n/pages.
 */

export function generateStaticParams() {
  return localesFor("terms").map((lang) => ({ lang }));
}

export const dynamicParams = false;

function resolveLang(lang: string): LanguageCode {
  if (!isLanguageCode(lang) || lang === "en" || !localesFor("terms").includes(lang)) notFound();
  return lang;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const lang = resolveLang((await params).lang);
  const content = getLocalizedContent("terms", lang, getTermsContent());
  return localizedMetadata({ key: "terms", lang, seo: content.seo });
}

export default async function LocalizedTermsPage({ params }: { params: Promise<{ lang: string }> }) {
  const lang = resolveLang((await params).lang);
  const content = getLocalizedContent("terms", lang, getTermsContent());

  return (
    <>
      <LegalPage content={content} translated />
      <LanguageLinks page="terms" current={lang} />
    </>
  );
}
