// Server-safe dictionary lookup.
//
// The same resolution the client hook uses, in a module with no "use client"
// and no React, so a server component can translate a string too. Before this
// existed, `translate` lived inside ./index.tsx — a client module — which meant
// the server-rendered parts of a tool page (the card grid, the suggestion
// strip, the page shell) had no way to reach the dictionaries and simply kept
// their English text on every localized route.
//
// ./index.tsx now re-uses this rather than keeping a second copy, so the two
// cannot drift apart.

import type { LanguageCode } from "./config";
import { BASE_DICT, DICTIONARIES, type DictKey } from "./dictionaries";
import { CALC_BASE, CALC_DICTIONARIES, type CalcDictKey } from "./calc-dictionaries";

/** Any key either dictionary defines. */
export type TKey = DictKey | CalcDictKey;

/**
 * The string for `key` in `lang`, falling back to English.
 *
 * Each dictionary is a Partial, so a language that has not been given this key
 * yet resolves to the English base rather than rendering an empty element.
 */
export function translate(lang: LanguageCode, key: TKey): string {
  if (key in BASE_DICT) {
    const k = key as DictKey;
    return DICTIONARIES[lang]?.[k] ?? BASE_DICT[k];
  }
  const k = key as CalcDictKey;
  return CALC_DICTIONARIES[lang]?.[k] ?? CALC_BASE[k];
}
