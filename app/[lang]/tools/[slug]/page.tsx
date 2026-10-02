import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ToolPageShell } from "@/components/tools/ToolPageShell";
import { TOOL_PAGES } from "@/components/tools/registry";
import { getToolsContent, type ToolItem } from "@/lib/content";
import { isLanguageCode, type LanguageCode } from "@/lib/i18n/config";
import { toolMetadata } from "@/lib/i18n/item-metadata";
import { getLocalizedContent } from "@/lib/i18n/page-content";
import { itemLocalesFor, itemRoutesFor } from "@/lib/i18n/pages";

/**
 * One tool's own page, in every language it has been translated into.
 *
 * The English pages are a folder each under app/tools, because each one imports
 * its own tool. There is one file here instead: the copy comes from the same
 * content the English page reads, and the tool comes from a registry generated
 * off those pages, so a tool cannot exist in English and be silently missing in
 * the other sixteen languages.
 *
 * A (language, slug) pair is only prerendered once that tool's copy is
 * translated into that language — see TRANSLATED_ITEMS. Until then only the
 * English page exists, which is what hreflang on it says.
 */

export function generateStaticParams() {
  return itemRoutesFor("tools");
}

export const dynamicParams = false;

type Params = Promise<{ lang: string; slug: string }>;

/** The tool in this language, or a 404 if it is not published in it. */
function resolve(
  lang: string,
  slug: string,
): { lang: LanguageCode; item: ToolItem; labels: { freeTool: string; loading: string } } {
  if (!isLanguageCode(lang) || lang === "en") notFound();
  if (!itemLocalesFor("tools", slug).includes(lang)) notFound();

  const english = getToolsContent();
  const index = english.items.findIndex((item) => item.slug === slug);
  if (index === -1) notFound();

  // The whole page is merged at once rather than item by item, so an item's
  // copy falls back to English exactly as every other translated page does.
  const localized = getLocalizedContent("tools", lang, english);
  return {
    lang,
    item: localized.items[index] as ToolItem,
    labels: localized.labels,
  };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang: rawLang, slug } = await params;
  const { lang } = resolve(rawLang, slug);
  return toolMetadata(slug, lang);
}

export default async function LocalizedToolPage({ params }: { params: Params }) {
  const { lang: rawLang, slug } = await params;
  const { lang, item, labels } = resolve(rawLang, slug);

  // Which blocks this page carries is read off the English page by the
  // registry generator, so the two routes cannot drift apart over it.
  const page = TOOL_PAGES[slug];
  if (!page) notFound();
  const { Tool, schema, suggested, suspense } = page;

  return (
    <ToolPageShell
      item={item}
      lang={lang}
      eyebrow={labels.freeTool}
      schema={schema}
      suggested={suggested}
    >
      {suspense ? (
        <Suspense
          fallback={
            <div className="rounded-2xl border border-dashed border-muted-line/40 bg-cream p-10 text-center text-muted">
              {labels.loading}
            </div>
          }
        >
          <Tool />
        </Suspense>
      ) : (
        <Tool />
      )}
    </ToolPageShell>
  );
}
