import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLanguageCode, type LanguageCode } from "@/lib/i18n/config";
import {
  HOME_LOCALES,
  dirFor,
  homeLanguageAlternates,
  homePathFor,
  hreflangFor,
  ogLocaleFor,
} from "@/lib/i18n/home-locales";
import { getLocalizedHomeContent } from "@/lib/i18n/home-content";
import { faqPageSchema, localizedHomePageSchema } from "@/lib/schema";
import { HomeSections } from "@/components/home/HomeSections";
import { LocaleDocumentAttrs } from "@/components/home/LocaleDocumentAttrs";

/**
 * The homepage in every language the toolkit switcher offers — `/hi`, `/bn`,
 * `/es` and so on, one prerendered page each.
 *
 * The switcher itself only swaps labels in the browser, which a crawler never
 * runs, so it cannot rank anything. These URLs can: the translated copy is in
 * the served HTML, each page carries its own title, description and FAQ
 * structured data, and the whole set is tied together with hreflang.
 */

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

export function generateStaticParams() {
  return HOME_LOCALES.map((lang) => ({ lang }));
}

// This segment sits at the root, so without it every unknown one-segment path
// (`/foo`) would try to render as a language. Only the listed ones exist.
export const dynamicParams = false;

/** The param is a language code or the route does not exist. */
function resolveLang(lang: string): LanguageCode {
  if (!isLanguageCode(lang) || lang === "en" || !HOME_LOCALES.includes(lang)) notFound();
  return lang;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const lang = resolveLang((await params).lang);
  const content = getLocalizedHomeContent(lang);
  const path = homePathFor(lang);

  return {
    title: content.seo.title,
    description: content.seo.description,
    keywords: content.seo.keywords,
    alternates: {
      canonical: path,
      // The full cluster — English, every translation, and x-default — repeated
      // on each version, because hreflang is only honoured when the pages point
      // at each other both ways.
      languages: homeLanguageAlternates(),
    },
    openGraph: {
      title: content.seo.title,
      description: content.seo.description,
      url: path,
      locale: ogLocaleFor(lang),
      images: OG_IMAGES,
    },
    twitter: {
      card: "summary_large_image",
      title: content.seo.title,
      description: content.seo.description,
      images: OG_IMAGES.map((image) => image.url),
    },
  };
}

export default async function LocalizedHomePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const lang = resolveLang((await params).lang);
  const content = getLocalizedHomeContent(lang);
  const path = homePathFor(lang);
  const hreflang = hreflangFor(lang);

  const pageSchema = localizedHomePageSchema({
    path,
    hreflang,
    name: content.seo.title,
    description: content.seo.description,
  });
  const faqSchema = faqPageSchema(content.faq.items, { hreflang, path });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pageSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      {/* Sets the document language during parsing, before hydration, so RTL
          Arabic never renders left-to-right first. The root layout owns
          <html> and has no dynamic segment to read the language from — see
          LocaleDocumentAttrs, which keeps this correct across client-side
          navigation. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `document.documentElement.lang=${JSON.stringify(lang)};document.documentElement.dir=${JSON.stringify(dirFor(lang))}`,
        }}
      />
      <LocaleDocumentAttrs lang={lang} dir={dirFor(lang)} />
      <HomeSections content={content} lang={lang} />
    </>
  );
}
