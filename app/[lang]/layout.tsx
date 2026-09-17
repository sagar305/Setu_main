import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { isLanguageCode } from "@/lib/i18n/config";
import { HOME_LOCALES, homePathFor } from "@/lib/i18n/home-locales";
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
  if (!isLanguageCode(lang) || !HOME_LOCALES.includes(lang)) notFound();

  const site = getLocalizedSiteContent(lang);

  return (
    <>
      <Nav site={site} homeHref={homePathFor(lang)} />
      <main>{children}</main>
      <Footer site={site} />
    </>
  );
}
