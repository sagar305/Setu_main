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

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Always start at "en" (matches server render), then adopt the saved
  // preference after mount to avoid hydration mismatches.
  const [lang, setLangState] = useState<LanguageCode>("en");

  useEffect(() => {
    markHydrated();
    const stored = getPreferences().language;
    if (isLanguageCode(stored)) applyLang(stored, false);
  }, []);

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
