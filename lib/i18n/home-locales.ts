// Locale routing for the translated homepage.
//
// The toolkit's language switcher (lib/i18n/index.tsx) is a client-side
// preference: it swaps labels after hydration, which no crawler ever sees.
// That is fine for the tools, whose value is the app itself, but it earns the
// homepage nothing in search. So every language the switcher offers also gets
// a real, server-rendered URL — `/hi`, `/bn`, `/es` … — with its own title,
// description, copy and structured data, and all of them cross-linked with
// hreflang so Google serves the right one per query language.
//
// English stays at `/` (no `/en` duplicate) and is the x-default.

import { LANGUAGES, type LanguageCode } from "./config";

/** Languages with a translated homepage — every switcher language except English. */
export const HOME_LOCALES: LanguageCode[] = LANGUAGES.filter((l) => l.code !== "en").map(
  (l) => l.code,
);

/**
 * hreflang value for a language.
 *
 * Plain language subtags, because the copy targets a language rather than a
 * country — a Hindi speaker in Dubai should get `/hi` just as one in Delhi
 * does. Chinese is the exception: `zh` alone leaves the script ambiguous, and
 * the translation is Simplified.
 */
const HREFLANG_OVERRIDES: Partial<Record<LanguageCode, string>> = { zh: "zh-Hans" };

export function hreflangFor(code: LanguageCode): string {
  return HREFLANG_OVERRIDES[code] ?? code;
}

/** Path of the homepage in a given language. English keeps the bare root. */
export function homePathFor(code: LanguageCode): string {
  return code === "en" ? "/" : `/${code}`;
}

/** The language a homepage path belongs to, or null if it is not a homepage. */
export function homeLangFromPath(pathname: string | null | undefined): LanguageCode | null {
  if (!pathname) return null;
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (clean === "" || clean === "/") return "en";
  const code = clean.slice(1);
  return (HOME_LOCALES as string[]).includes(code) ? (code as LanguageCode) : null;
}

export function isHomePath(pathname: string | null | undefined): boolean {
  return homeLangFromPath(pathname) !== null;
}

/**
 * `alternates.languages` for Next metadata: every translation plus x-default.
 *
 * Every version lists every other version, including itself — a partial set is
 * how hreflang clusters get ignored. x-default points at English, which is
 * what an unmatched language should land on.
 */
export function homeLanguageAlternates(): Record<string, string> {
  const languages: Record<string, string> = { "x-default": "/", en: "/" };
  for (const code of HOME_LOCALES) languages[hreflangFor(code)] = homePathFor(code);
  return languages;
}

/** Writing direction, for the `dir` attribute on localized pages. */
export function dirFor(code: LanguageCode): "ltr" | "rtl" {
  return LANGUAGES.find((l) => l.code === code)?.dir ?? "ltr";
}

/** Endonym shown in the language links — a reader recognises their own name for it. */
export function languageNameFor(code: LanguageCode): string {
  return LANGUAGES.find((l) => l.code === code)?.name ?? code;
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
