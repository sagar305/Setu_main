import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { LANGUAGES, type LanguageCode } from "@/lib/i18n/config";
import {
  HOME_LOCALES,
  homeLangFromPath,
  homeLanguageAlternates,
  homePathFor,
  hreflangFor,
  ogLocaleFor,
} from "@/lib/i18n/home-locales";
import { mergeTranslation } from "@/lib/i18n/home-merge";

const english = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "content", "en", "home.json"), "utf8"),
) as Record<string, any>;

function translationFor(lang: LanguageCode) {
  const file = path.join(process.cwd(), "content", "i18n", "home", `${lang}.json`);
  return JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, any>;
}

describe("home locale routing", () => {
  it("gives every switcher language a homepage URL, with English at the root", () => {
    expect(homePathFor("en")).toBe("/");
    expect(HOME_LOCALES).toEqual(LANGUAGES.filter((l) => l.code !== "en").map((l) => l.code));
    for (const code of HOME_LOCALES) expect(homePathFor(code)).toBe(`/${code}`);
  });

  it("reads the language back out of a homepage path, and rejects anything else", () => {
    expect(homeLangFromPath("/")).toBe("en");
    expect(homeLangFromPath("/hi")).toBe("hi");
    expect(homeLangFromPath("/hi/")).toBe("hi");
    expect(homeLangFromPath("/tools/invoice-generator")).toBeNull();
    expect(homeLangFromPath("/about")).toBeNull();
    expect(homeLangFromPath(null)).toBeNull();
  });

  it("publishes a complete hreflang cluster including x-default", () => {
    const alternates = homeLanguageAlternates();
    expect(alternates["x-default"]).toBe("/");
    expect(alternates.en).toBe("/");
    for (const code of HOME_LOCALES) {
      expect(alternates[hreflangFor(code)]).toBe(`/${code}`);
    }
    // Every language, plus English and x-default sharing the root.
    expect(Object.keys(alternates)).toHaveLength(LANGUAGES.length + 1);
  });

  it("marks Chinese as Simplified and pairs each language with an OG territory", () => {
    expect(hreflangFor("zh")).toBe("zh-Hans");
    expect(hreflangFor("hi")).toBe("hi");
    for (const { code } of LANGUAGES) {
      expect(ogLocaleFor(code)).toMatch(new RegExp(`^${code}_[A-Z]{2}$`));
    }
  });
});

describe("translation overlay", () => {
  it("falls back to English for anything the translation leaves out", () => {
    const merged = mergeTranslation(
      { a: "english a", b: { c: "english c", d: "english d" } },
      { b: { c: "translated c" } },
    );
    expect(merged).toEqual({ a: "english a", b: { c: "translated c", d: "english d" } });
  });

  it("keeps the English value when the translation has the wrong shape", () => {
    expect(mergeTranslation({ a: "x" }, { a: 42 })).toEqual({ a: "x" });
    expect(mergeTranslation({ a: "x" }, ["nope"])).toEqual({ a: "x" });
    expect(mergeTranslation(["a", "b"], { 0: "c" })).toEqual(["a", "b"]);
    expect(mergeTranslation({ a: "x" }, null)).toEqual({ a: "x" });
  });

  it("ignores keys the English content does not have", () => {
    expect(mergeTranslation({ a: "x" }, { a: "y", rogue: "z" })).toEqual({ a: "y" });
  });

  it("lines arrays up by index and keeps extra English entries", () => {
    expect(mergeTranslation(["one", "two", "three"], ["uno"])).toEqual(["uno", "two", "three"]);
  });
});

describe("home translation files", () => {
  it.each(HOME_LOCALES)("%s keeps the English structure and links", (lang) => {
    const merged = mergeTranslation(english, translationFor(lang));

    // Structure the page renders from must be identical to English.
    expect(merged.products.cards.map((c: any) => c.id)).toEqual(
      english.products.cards.map((c: any) => c.id),
    );
    expect(merged.tools.cards).toHaveLength(english.tools.cards.length);
    expect(merged.calculators.cards).toHaveLength(english.calculators.cards.length);
    expect(merged.faq.items).toHaveLength(english.faq.items.length);
    expect(merged.services.cards[0].points).toHaveLength(english.services.cards[0].points.length);

    // Translations never redirect a link.
    expect(merged.hero.primaryCta.href).toBe(english.hero.primaryCta.href);
    for (const section of ["products", "tools", "calculators", "services"] as const) {
      expect(merged[section].cards.map((c: any) => c.cta.href)).toEqual(
        english[section].cards.map((c: any) => c.cta.href),
      );
    }
    expect(merged.ctaBanner.cta.href).toBe(english.ctaBanner.cta.href);
  });

  it.each(HOME_LOCALES)("%s actually translates the copy a reader sees", (lang) => {
    const merged = mergeTranslation(english, translationFor(lang));

    expect(merged.seo.title).not.toBe(english.seo.title);
    expect(merged.seo.description).not.toBe(english.seo.description);
    expect(merged.hero.headline).not.toBe(english.hero.headline);
    expect(merged.faq.items.map((item: any) => item.question)).not.toEqual(
      english.faq.items.map((item: any) => item.question),
    );
  });

  it.each(HOME_LOCALES)("%s has a title and description search results can show", (lang) => {
    const { title, description } = translationFor(lang).seo;

    // Matches scripts/check-seo.mjs, which enforces the same limits on the
    // built HTML: Chinese says as much in far fewer characters.
    const limits =
      lang === "zh"
        ? { title: [14, 34], description: [50, 100] }
        : { title: [30, 60], description: [120, 160] };

    expect(title.length).toBeGreaterThanOrEqual(limits.title[0]);
    expect(title.length).toBeLessThanOrEqual(limits.title[1]);
    expect(description.length).toBeGreaterThanOrEqual(limits.description[0]);
    expect(description.length).toBeLessThanOrEqual(limits.description[1]);
  });
});
