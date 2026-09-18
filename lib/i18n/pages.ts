// Which pages exist in which languages, and where they live.
//
// The homepage was the first page published in all seventeen languages; this is
// the same idea generalised, so any page can be. A page is registered here with
// the English path it mirrors, and `TRANSLATED_PAGES` (generated from the files
// in content/i18n — see scripts/sync-translations.mjs) says which languages it
// has actually been translated into.
//
// Availability is per page, not site-wide, because the translations land page
// by page. A language is published for a page only once its file exists, so a
// reader never lands on a URL that is half English and hreflang never points at
// a page that is not there.
//
// Client-safe: the language switcher needs this to move a reader between
// versions of the page they are on.

import { LANGUAGES, type LanguageCode } from "./config";
import { TRANSLATED_ITEMS, TRANSLATED_PAGES } from "./translated-pages";

/** A page that can be published in more than one language. */
export type PageKey =
  | "home"
  | "privacy"
  | "terms"
  | "contact"
  | "consultancy"
  | "products"
  | "tools"
  | "calculators";

/** English path for each page. The homepage is the root; the rest mirror their route. */
export const PAGE_PATHS: Record<PageKey, string> = {
  home: "/",
  privacy: "/privacy",
  terms: "/terms",
  contact: "/contact",
  consultancy: "/consultancy",
  products: "/products",
  tools: "/tools",
  calculators: "/calculators",
};

export const PAGE_KEYS = Object.keys(PAGE_PATHS) as PageKey[];

/**
 * hreflang value for a language.
 *
 * Plain language subtags, because the copy targets a language rather than a
 * country — a Hindi speaker in Dubai should get the Hindi page just as one in
 * Delhi does. Chinese is the exception: `zh` alone leaves the script ambiguous,
 * and the translation is Simplified.
 */
const HREFLANG_OVERRIDES: Partial<Record<LanguageCode, string>> = { zh: "zh-Hans" };

export function hreflangFor(code: LanguageCode): string {
  return HREFLANG_OVERRIDES[code] ?? code;
}

/** Languages a page has been translated into, English excluded. */
export function localesFor(key: PageKey): LanguageCode[] {
  return (TRANSLATED_PAGES[key] ?? []) as LanguageCode[];
}

/** Every language a page is published in, English first. */
export function languagesFor(key: PageKey): LanguageCode[] {
  return ["en", ...localesFor(key)];
}

/** Path of a page in a given language. English keeps the untranslated path. */
export function pathFor(key: PageKey, lang: LanguageCode): string {
  const path = PAGE_PATHS[key];
  if (lang === "en") return path;
  return path === "/" ? `/${lang}` : `/${lang}${path}`;
}

/**
 * The same destination, kept in the language the reader is already in.
 *
 * Content stores one href per link, written as the English path. Rendered as-is
 * on a translated page, every link becomes a way out of the language: a reader
 * on /hi/tools taps the header and lands on English /products. This maps such a
 * link to /hi/products instead.
 *
 * A link is only moved when that page is actually published in this language.
 * Pages outside the translated set — the blog, the glossary, an individual tool
 * or calculator — stay on their English path, because the alternative is a link
 * into a 404. Anything that is not an internal path we own (an anchor, a query,
 * a mailto:, an external URL) is returned untouched.
 */
export function localizedHref(href: string, lang: LanguageCode): string {
  if (lang === "en" || !href.startsWith("/") || href.startsWith("//")) return href;

  const [path] = href.split(/[?#]/);
  const clean = path.length > 1 ? path.replace(/\/+$/, "") : path;
  const key = PAGE_KEYS.find((k) => PAGE_PATHS[k] === (clean === "" ? "/" : clean));
  if (!key || !localesFor(key).includes(lang)) return href;

  return pathFor(key, lang) + href.slice(path.length);
}

/** The page and language a pathname refers to, or null if it is not a published page. */
export function pageFromPath(
  pathname: string | null | undefined,
): { key: PageKey; lang: LanguageCode } | null {
  if (!pathname) return null;
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;

  const english = PAGE_KEYS.find((key) => PAGE_PATHS[key] === (clean === "" ? "/" : clean));
  if (english) return { key: english, lang: "en" };

  const [, first, ...rest] = clean.split("/");
  const lang = LANGUAGES.find((l) => l.code === first)?.code;
  if (!lang || lang === "en") return null;

  const remainder = rest.length === 0 ? "/" : `/${rest.join("/")}`;
  const key = PAGE_KEYS.find((k) => PAGE_PATHS[k] === remainder);
  if (!key || !localesFor(key).includes(lang)) return null;

  return { key, lang };
}

/**
 * `alternates.languages` for Next metadata: every published version of a page,
 * plus x-default.
 *
 * Every version lists every other version, including itself — a partial set is
 * how hreflang clusters get ignored. x-default points at English, which is what
 * an unmatched language should land on. Languages the page has not been
 * translated into are left out rather than pointed at a 404.
 */
export function languageAlternates(key: PageKey): Record<string, string> {
  const languages: Record<string, string> = {
    "x-default": PAGE_PATHS[key],
    en: PAGE_PATHS[key],
  };
  for (const lang of localesFor(key)) languages[hreflangFor(lang)] = pathFor(key, lang);
  return languages;
}

/* ---------------------------------------------------------------------------
 * Item pages: one per calculator, one per tool.
 *
 * These behave like the pages above but are published per item rather than per
 * page, because a directory of twenty-nine calculators can be translated long
 * before the twenty-nine pages it links to are. Each item's own page appears in
 * a language only once that item's copy has been translated into it.
 * ------------------------------------------------------------------------- */

/** A page that has one sub-page per item. */
export type ItemPageKey = "calculators" | "tools";

/** Languages an individual item's page is published in. */
export function itemLocalesFor(key: ItemPageKey, slug: string): LanguageCode[] {
  return (TRANSLATED_ITEMS[key]?.[slug] ?? []) as LanguageCode[];
}

/** Path of an item's page in a given language. English keeps the plain path. */
export function itemPathFor(key: ItemPageKey, slug: string, lang: LanguageCode): string {
  const path = `${PAGE_PATHS[key]}/${slug}`;
  return lang === "en" ? path : `/${lang}${path}`;
}

/** Every (language, slug) pair an item page is published for, for prerendering. */
export function itemRoutesFor(key: ItemPageKey): { lang: LanguageCode; slug: string }[] {
  return Object.entries(TRANSLATED_ITEMS[key] ?? {}).flatMap(([slug, langs]) =>
    (langs as LanguageCode[]).map((lang) => ({ lang, slug })),
  );
}

/** `alternates.languages` for one item's page, on the same terms as a page's. */
export function itemLanguageAlternates(key: ItemPageKey, slug: string): Record<string, string> {
  const english = itemPathFor(key, slug, "en");
  const languages: Record<string, string> = { "x-default": english, en: english };
  for (const lang of itemLocalesFor(key, slug)) {
    languages[hreflangFor(lang)] = itemPathFor(key, slug, lang);
  }
  return languages;
}

/** Writing direction, for the `dir` attribute on localized pages. */
export function dirFor(code: LanguageCode): "ltr" | "rtl" {
  return LANGUAGES.find((l) => l.code === code)?.dir ?? "ltr";
}

/**
 * OpenGraph locale (`language_TERRITORY`). OG has no "language only" form, so
 * each language is paired with the territory most of its readers are in.
 */
const OG_TERRITORY: Record<LanguageCode, string> = {
  en: "IN",
  hi: "IN",
  bn: "IN",
  ta: "IN",
  te: "IN",
  mr: "IN",
  gu: "IN",
  kn: "IN",
  ml: "IN",
  pa: "IN",
  es: "ES",
  fr: "FR",
  ar: "AE",
  pt: "BR",
  id: "ID",
  de: "DE",
  zh: "CN",
};

export function ogLocaleFor(code: LanguageCode): string {
  return `${code}_${OG_TERRITORY[code]}`;
}
