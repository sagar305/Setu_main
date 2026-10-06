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

/**
 * Substitutes `{name}` placeholders in a translated string.
 *
 * The placeholders are named rather than positional so each language can put
 * them where its own grammar needs them — an amount that falls mid-sentence in
 * English lands in a different place in Hindi or Arabic, and a positional
 * format would force every language into the English word order.
 *
 * An unknown placeholder is left as written, so a typo shows up as the literal
 * `{foo}` on screen rather than silently rendering "undefined".
 */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    key in values ? String(values[key]) : match,
  );
}

/**
 * Splits a translated string around a single `{name}` placeholder.
 *
 * `fill` cannot help where the value is not text but an element — a link, a
 * bold name — because a React element has no string form to substitute in. So
 * the sentence still lives in the dictionary as one string, with the
 * placeholder marking where the element goes, and the caller renders the two
 * halves around it.
 *
 * Keeping the whole sentence in one key is what matters: a language that puts
 * the link first, or last, or inside a different clause, writes it that way,
 * instead of being forced into the English order by a pair of
 * before-the-link / after-the-link keys.
 *
 * A string without the placeholder returns as the first half, so the sentence
 * still renders in full and only the element is missing.
 */
export function splitAround(template: string, name: string): [string, string] {
  const token = `{${name}}`;
  const at = template.indexOf(token);
  if (at === -1) return [template, ""];
  return [template.slice(0, at), template.slice(at + token.length)];
}
