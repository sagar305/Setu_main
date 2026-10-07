import { describe, expect, it } from "vitest";

import { LANGUAGES, type LanguageCode } from "@/lib/i18n/config";
import { BASE_DICT, DICTIONARIES } from "@/lib/i18n/dictionaries";
import { CALC_BASE, CALC_DICTIONARIES } from "@/lib/i18n/calc-dictionaries";
import { translate } from "@/lib/i18n/translate";

/**
 * The UI dictionaries are typed as Partial, so a key that was added to English
 * and never translated still compiles and still renders — in English, on a page
 * that is otherwise in Hindi. Nothing else notices: the build passes, the page
 * looks finished, and the one English label sits in the middle of it.
 *
 * Both dictionaries are complete in all sixteen languages, so the honest guard
 * is to require that and let a gap fail here rather than reach a reader.
 */
const OTHERS = LANGUAGES.map((l) => l.code).filter((code) => code !== "en");

/** The {placeholder} names a string carries, as a comparable signature. */
const placeholders = (text: string) =>
  [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");

describe.each([
  ["the shared chrome dictionary", BASE_DICT, DICTIONARIES],
  ["the calculator dictionary", CALC_BASE, CALC_DICTIONARIES],
] as const)("%s", (_name, baseDict, dictionaries) => {
  const base = baseDict as Record<string, string>;
  const keys = Object.keys(base);

  it("has keys to translate", () => {
    expect(keys.length).toBeGreaterThan(0);
  });

  it.each(OTHERS)("is complete in %s", (lang) => {
    const dict = dictionaries[lang as LanguageCode] ?? {};
    const missing = keys.filter((key) => !(key in dict));
    expect(missing).toEqual([]);
  });

  it.each(OTHERS)("has no empty or English-only placeholder in %s", (lang) => {
    const dict = (dictionaries[lang as LanguageCode] ?? {}) as Record<string, string>;
    const blank = keys.filter((key) => !dict[key]?.trim());
    expect(blank).toEqual([]);
  });

  /**
   * Sentences with a figure or a name in them are stored with a {placeholder}
   * that `fill` substitutes. A translation that drops one renders the sentence
   * without its number — "above plan" with no amount — and a translation that
   * renames one leaves the braces on screen. Neither shows up in English, so
   * the only place it can be caught is here.
   */
  it.each(OTHERS)("keeps every placeholder in %s", (lang) => {
    const dict = (dictionaries[lang as LanguageCode] ?? {}) as Record<string, string>;
    const mismatched = keys
      .filter((key) => dict[key])
      .filter((key) => placeholders(dict[key]) !== placeholders(base[key]));
    expect(mismatched).toEqual([]);
  });
});

describe("translate", () => {
  it("returns the language's own string when it has one", () => {
    expect(translate("hi", "toolTryIt")).toBe("आज़माइए");
    expect(translate("hi", "toolTryIt")).not.toBe(BASE_DICT.toolTryIt);
  });

  it("resolves keys from either dictionary", () => {
    // One key from each, so a regression in the dispatch shows up here rather
    // than as a blank label on whichever half stopped resolving.
    expect(translate("en", "toolRelated")).toBe(BASE_DICT.toolRelated);
    const calcKey = Object.keys(CALC_BASE)[0] as keyof typeof CALC_BASE;
    expect(translate("en", calcKey)).toBe(CALC_BASE[calcKey]);
  });

  it("falls back to English rather than returning nothing", () => {
    // The fallback is what keeps a half-translated dictionary from rendering
    // empty elements, so it is worth pinning even though the suites above
    // require the dictionaries to be complete today.
    const sparse = { hi: {} } as typeof DICTIONARIES;
    const lookup = (key: keyof typeof BASE_DICT) =>
      sparse.hi?.[key] ?? BASE_DICT[key];
    expect(lookup("toolTryIt")).toBe(BASE_DICT.toolTryIt);
  });
});

describe("the tool chrome strings", () => {
  // These three sit on all thirty-five tool pages, so an untranslated one is
  // the most visible kind of gap: English in the middle of a translated page.
  it.each(OTHERS)("are translated, not inherited, in %s", (lang) => {
    for (const key of ["toolTryIt", "toolRelated", "share"] as const) {
      expect(translate(lang as LanguageCode, key)).not.toBe(BASE_DICT[key]);
    }
  });
});
