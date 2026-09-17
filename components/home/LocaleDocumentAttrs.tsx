"use client";

import { useEffect } from "react";
import { useI18n, type LanguageCode } from "@/lib/i18n";

/**
 * Puts a translated homepage's language onto the document.
 *
 * `<html lang>` is owned by the root layout, which has no dynamic segment and
 * so cannot see which language is being rendered; the alternative — splitting
 * the whole app into per-language root layouts — would move every existing
 * route for one attribute. Search engines take the language from the copy,
 * hreflang and the canonical URL, all of which are in the served HTML; this
 * fixes up the attribute for screen readers and for `dir` on Arabic, and keeps
 * the toolkit switcher showing the language the reader actually opened.
 */
export function LocaleDocumentAttrs({ lang, dir }: { lang: LanguageCode; dir: "ltr" | "rtl" }) {
  const { lang: current, setLang } = useI18n();

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);

  useEffect(() => {
    // Opening /hi is a language choice, so carry it into the shared preference
    // the tools and calculators read.
    if (current !== lang) setLang(lang);
    // `setLang` is recreated on every provider render; depending on it here
    // would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, current]);

  return null;
}
