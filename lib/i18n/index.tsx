"use client";

// Language context for the toolkit UI. The chosen language is a shared
// preference (never asked twice); missing translations fall back to English.
// Direction (RTL for Arabic) is applied to <html> when the language changes.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getPreferences, markHydrated, setPreferences } from "@/lib/toolkit/preferences";
import { isLanguageCode, LANGUAGES, type LanguageCode } from "./config";
import { BASE_DICT, DICTIONARIES, type DictKey } from "./dictionaries";
import { CALC_BASE, CALC_DICTIONARIES, type CalcDictKey } from "./calc-dictionaries";

// `t` resolves against both the shared chrome dictionary and the calculator
// dictionary; each falls back to its English base when a key is missing.
type TKey = DictKey | CalcDictKey;

function translate(lang: LanguageCode, key: TKey): string {
  if (key in BASE_DICT) {
    const k = key as DictKey;
    return DICTIONARIES[lang]?.[k] ?? BASE_DICT[k];
  }
  const k = key as CalcDictKey;
  return CALC_DICTIONARIES[lang]?.[k] ?? CALC_BASE[k];
}

type I18n = {
  lang: LanguageCode;
  setLang: (code: LanguageCode) => void;
  t: (key: TKey) => string;
};

const I18nContext = createContext<I18n>({
  lang: "en",
  setLang: () => {},
  t: (key) => translate("en", key),
});

export function LanguageProvider({
  children,
  routeLang,
}: {
  children: ReactNode;
  /**
   * The language of the URL, on a route that is published in one.
   *
   * Without it the toolkit starts in English and only switches after mount,
   * once the stored preference has been read — which is fine for a preference
   * but useless to a search engine, because the HTML that gets crawled is the
   * English one. Passing the language the route is published in renders the
   * toolkit in that language on the server, so /hi/calculators/... is Hindi in
   * the markup rather than only after hydration.
   *
   * It also wins over the stored preference for as long as the reader is on
   * that route: the address bar is the more explicit request of the two, and a
   * Hindi URL that renders in whatever language was last picked elsewhere would
   * be neither what the reader asked for nor what the crawler is told it is.
   */
  routeLang?: LanguageCode;
}) {
  // Without a language in the route, start at "en" to match the server render
  // and adopt the stored preference after mount; with one, that language is
  // already what the server rendered.
  const [lang, setLangState] = useState<LanguageCode>(routeLang ?? "en");

  useEffect(() => {
    markHydrated();
    if (routeLang) return;
    const stored = getPreferences().language;
    if (isLanguageCode(stored)) applyLang(stored, false);
  }, [routeLang]);

  const applyLang = (code: LanguageCode, persist = true) => {
    setLangState(code);
    if (persist) setPreferences({ language: code });
    const language = LANGUAGES.find((l) => l.code === code);
    document.documentElement.lang = code;
    document.documentElement.dir = language?.dir ?? "ltr";
  };

  const t = useCallback((key: TKey) => translate(lang, key), [lang]);

  return (
    <I18nContext.Provider value={{ lang, setLang: applyLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18n {
  return useContext(I18nContext);
}

export { LANGUAGES } from "./config";
export type { LanguageCode } from "./config";
export type { DictKey } from "./dictionaries";
export type { CalcDictKey } from "./calc-dictionaries";
