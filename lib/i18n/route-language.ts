import { isLanguageCode, type LanguageCode } from "./config";
import { pageFromPath } from "./pages";

/**
 * Which language the toolkit should render in, given the URL and the stored
 * preference.
 *
 * The two can disagree, and which one wins was the bug this exists to fix.
 * Every English route is served by the root layout, which passes no route
 * language, so the provider used to adopt the stored preference on all of them.
 * Once a reader had been to any `/hi/…` page the preference was Hindi, and from
 * then on `/calculators/mdr-calculator` rendered its calculator in Hindi — on a
 * URL whose own hreflang declares it English, with no way back, because the
 * language switcher reads the language from the URL and so already showed
 * "English": picking English fired no change at all.
 *
 * So a path that belongs to a published cluster decides the language itself,
 * English paths included. The URL is the more explicit of the two requests, it
 * is what the crawler is told the page is, and the switcher moves a reader who
 * wants another language to that language's URL.
 *
 * The stored preference still applies on a path outside any cluster, which is
 * what it is for: carrying a reader's choice onto a page that has no translated
 * URL of its own to land on.
 */
export function routeLanguage(
  routeLang: LanguageCode | undefined,
  pathname: string | null | undefined,
  stored: unknown,
): LanguageCode {
  // `/[lang]` already knows its language and renders in it on the server.
  if (routeLang) return routeLang;

  const page = pageFromPath(pathname);
  if (page) return page.lang;

  return typeof stored === "string" && isLanguageCode(stored) ? stored : "en";
}
