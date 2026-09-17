import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { LocaleDocumentAttrs } from "@/components/home/LocaleDocumentAttrs";
import { isLanguageCode } from "@/lib/i18n/config";
import { PAGE_KEYS, dirFor, localesFor, pathFor } from "@/lib/i18n/pages";
import { getLocalizedSiteContent } from "@/lib/i18n/site-chrome";

/**
 * Header and footer for a translated homepage, in that page's language.
 *
 * The root layout owns <html> and the providers but has no dynamic segment, so
 * it cannot resolve the language; it renders the English chrome for every other
 * route and steps aside here (see components/SiteFrame). Doing it in a layout
 * rather than in the page keeps the document structure identical — banner,
 * header, <main>, footer — and keeps the translations on the server, so each
 * page ships only the language it is written in.
 */
export default async function LocalizedHomeLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLanguageCode(lang) || lang === "en") notFound();

  // This segment wraps every translated page under the language, so it accepts
  // any language some page is published in; each page 404s on its own for a
  // language it has not been translated into.
  if (!PAGE_KEYS.some((key) => localesFor(key).includes(lang))) notFound();

  const site = getLocalizedSiteContent(lang);

  return (
    <>
      {/* Sets the document language during parsing, before hydration, so RTL
          Arabic never renders left-to-right first. The root layout owns <html>
          and has no dynamic segment to read the language from — see
          LocaleDocumentAttrs, which keeps this correct across client-side
          navigation. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `document.documentElement.lang=${JSON.stringify(lang)};document.documentElement.dir=${JSON.stringify(dirFor(lang))}`,
        }}
      />
      <LocaleDocumentAttrs lang={lang} dir={dirFor(lang)} />
      <Nav site={site} homeHref={pathFor("home", lang)} />
      <main>{children}</main>
      <Footer site={site} />
    </>
  );
}
