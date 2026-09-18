import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { LANGUAGES, type LanguageCode } from "@/lib/i18n/config";
import {
  hreflangFor,
  languageAlternates,
  languagesFor,
  localesFor,
  localizedHref,
  itemLanguageAlternates,
  itemLocalesFor,
  itemPathFor,
  itemRoutesFor,
  ogLocaleFor,
  pageFromPath,
  pathFor,
} from "@/lib/i18n/pages";
import { mergeTranslation } from "@/lib/i18n/home-merge";
import { localizeLinks } from "@/lib/i18n/localize-links";

const english = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "content", "en", "home.json"), "utf8"),
) as Record<string, any>;

function translationFor(lang: LanguageCode) {
  const file = path.join(process.cwd(), "content", "i18n", "home", `${lang}.json`);
  return JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, any>;
}

const englishSite = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "content", "en", "site.json"), "utf8"),
) as Record<string, any>;

function siteTranslationFor(lang: LanguageCode) {
  const file = path.join(process.cwd(), "content", "i18n", "site", `${lang}.json`);
  return JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, any>;
}

const HOME_LOCALES = localesFor("home");

describe("home locale routing", () => {
  it("gives every switcher language a homepage URL, with English at the root", () => {
    expect(pathFor("home", "en")).toBe("/");
    expect(HOME_LOCALES).toEqual(LANGUAGES.filter((l) => l.code !== "en").map((l) => l.code));
    for (const code of HOME_LOCALES) expect(pathFor("home", code)).toBe(`/${code}`);
  });

  it("reads the page and language back out of a path, and rejects anything else", () => {
    expect(pageFromPath("/")).toEqual({ key: "home", lang: "en" });
    expect(pageFromPath("/hi")).toEqual({ key: "home", lang: "hi" });
    expect(pageFromPath("/hi/")).toEqual({ key: "home", lang: "hi" });
    expect(pageFromPath("/privacy")).toEqual({ key: "privacy", lang: "en" });
    expect(pageFromPath("/tools/invoice-generator")).toBeNull();
    expect(pageFromPath("/about")).toBeNull();
    expect(pageFromPath(null)).toBeNull();
  });

  it("only claims a translated page in a language it has been translated into", () => {
    for (const lang of localesFor("privacy")) {
      expect(pageFromPath(`/${lang}/privacy`)).toEqual({ key: "privacy", lang });
    }
    const missing = LANGUAGES.map((l) => l.code).filter(
      (code) => code !== "en" && !localesFor("privacy").includes(code),
    );
    for (const lang of missing) expect(pageFromPath(`/${lang}/privacy`)).toBeNull();
  });

  it("publishes a complete hreflang cluster including x-default", () => {
    const alternates = languageAlternates("home");
    expect(alternates["x-default"]).toBe("/");
    expect(alternates.en).toBe("/");
    for (const code of HOME_LOCALES) {
      expect(alternates[hreflangFor(code)]).toBe(`/${code}`);
    }
    // Every published language, plus English and x-default sharing the root.
    expect(Object.keys(alternates)).toHaveLength(languagesFor("home").length + 1);
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

describe("hero panel translations", () => {
  it.each(HOME_LOCALES)("%s keeps the industry list the component has icons for", (lang) => {
    const merged = mergeTranslation(english, translationFor(lang));

    // HeroVisual keys its icons off these ids, so a translation that dropped or
    // reordered an entry would show the wrong icon — or none.
    expect(merged.heroPanel.industries.map((i: any) => i.id)).toEqual(
      english.heroPanel.industries.map((i: any) => i.id),
    );
    for (const [index, industry] of merged.heroPanel.industries.entries()) {
      expect(industry.points).toHaveLength(english.heroPanel.industries[index].points.length);
    }
  });

  it.each(HOME_LOCALES)("%s translates the panel copy", (lang) => {
    const merged = mergeTranslation(english, translationFor(lang));

    expect(merged.heroPanel.eyebrow).not.toBe(english.heroPanel.eyebrow);
    expect(merged.heroPanel.badge).not.toBe(english.heroPanel.badge);
    expect(merged.heroPanel.footnote).not.toBe(english.heroPanel.footnote);
    expect(merged.heroPanel.industries.map((i: any) => i.name)).not.toEqual(
      english.heroPanel.industries.map((i: any) => i.name),
    );
  });
});

describe("site chrome translations", () => {
  it.each(HOME_LOCALES)("%s translates the header and footer", (lang) => {
    const merged = mergeTranslation(englishSite, siteTranslationFor(lang));

    expect(merged.nav.links.map((l: any) => l.label)).not.toEqual(
      englishSite.nav.links.map((l: any) => l.label),
    );
    expect(merged.nav.cta.label).not.toBe(englishSite.nav.cta.label);
    expect(merged.nav.menu.open).not.toBe(englishSite.nav.menu.open);
    expect(merged.footer.description).not.toBe(englishSite.footer.description);
    expect(merged.footer.copyright).not.toBe(englishSite.footer.copyright);
    // Every column must be given a heading. Not that it differs from English:
    // "Tools" is the German word for tools, and demanding a different string
    // would push a translation into being wrong.
    const translated = siteTranslationFor(lang);
    expect(translated.footer.columns).toHaveLength(englishSite.footer.columns.length);
    for (const column of translated.footer.columns) {
      expect(column.heading.trim()).not.toBe("");
    }
  });

  it.each(HOME_LOCALES)("%s leaves every chrome link target alone", (lang) => {
    const merged = mergeTranslation(englishSite, siteTranslationFor(lang));

    expect(merged.nav.links.map((l: any) => l.href)).toEqual(
      englishSite.nav.links.map((l: any) => l.href),
    );
    expect(merged.footer.columns.map((c: any) => c.links.map((l: any) => l.href))).toEqual(
      englishSite.footer.columns.map((c: any) => c.links.map((l: any) => l.href)),
    );
    expect(merged.footer.legal.map((l: any) => l.href)).toEqual(
      englishSite.footer.legal.map((l: any) => l.href),
    );
    // Social profiles are accounts, not copy.
    expect(merged.footer.social).toEqual(englishSite.footer.social);
  });
});

describe("every translated page", () => {
  const PAGES = [
    "home",
    "privacy",
    "terms",
    "contact",
    "consultancy",
    "products",
    "tools",
    "calculators",
  ] as const;

  function englishFor(key: string) {
    const file =
      key === "home"
        ? path.join(process.cwd(), "content", "en", "home.json")
        : path.join(process.cwd(), "content", "en", `${key}.json`);
    return JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, any>;
  }

  it("publishes only languages whose translation file exists", () => {
    for (const key of PAGES) {
      for (const lang of localesFor(key)) {
        const file = path.join(process.cwd(), "content", "i18n", key, `${lang}.json`);
        expect(fs.existsSync(file), `${key}/${lang}.json`).toBe(true);
      }
    }
  });

  it("gives every translation its own title and description, within SERP limits", () => {
    // Same limits scripts/check-seo.mjs enforces on the built HTML.
    for (const key of PAGES) {
      for (const lang of localesFor(key)) {
        const file = path.join(process.cwd(), "content", "i18n", key, `${lang}.json`);
        const seo = (JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, any>).seo;
        expect(seo, `${key}/${lang} seo`).toBeTruthy();

        const limits =
          lang === "zh"
            ? { title: [14, 34], description: [50, 100] }
            : { title: [30, 60], description: [120, 160] };

        expect(seo.title.length, `${key}/${lang} title`).toBeGreaterThanOrEqual(limits.title[0]);
        expect(seo.title.length, `${key}/${lang} title`).toBeLessThanOrEqual(limits.title[1]);
        expect(seo.description.length, `${key}/${lang} description`).toBeGreaterThanOrEqual(
          limits.description[0],
        );
        expect(seo.description.length, `${key}/${lang} description`).toBeLessThanOrEqual(
          limits.description[1],
        );
        expect(seo.title).not.toBe(englishFor(key).seo?.title);
      }
    }
  });

  it("never reshapes a page: list lengths follow the English content", () => {
    for (const key of PAGES) {
      const english = englishFor(key);
      for (const lang of localesFor(key)) {
        const file = path.join(process.cwd(), "content", "i18n", key, `${lang}.json`);
        const merged = mergeTranslation(
          english,
          JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, any>,
        );
        for (const field of ["items", "products", "sections", "categories"]) {
          if (Array.isArray(english[field])) {
            expect(merged[field].length, `${key}/${lang} ${field}`).toBe(english[field].length);
          }
        }
      }
    }
  });

  /**
   * Lists merge by position, so a translation that is short by one entry does not
   * fail loudly — it silently pairs every later translation with the wrong English
   * item. Merging cannot reveal that, because it pads the tail from English, so the
   * count has to be checked on the file as written. An entry inserted into the
   * middle of an English list (rather than appended) is what makes this bite, and it
   * is exactly the change most likely to arrive from someone else's branch.
   */
  it("keeps every translated list the same length as English in the file itself", () => {
    for (const key of PAGES) {
      const english = englishFor(key);
      for (const lang of localesFor(key)) {
        const file = path.join(process.cwd(), "content", "i18n", key, `${lang}.json`);
        const raw = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, any>;
        for (const field of ["items", "products", "sections", "categories"]) {
          if (Array.isArray(english[field]) && raw[field] !== undefined) {
            expect(
              raw[field].length,
              `content/i18n/${key}/${lang}.json ${field}: translated entries must line up ` +
                `one-to-one with content/en/${key}.json`,
            ).toBe(english[field].length);
          }
        }
      }
    }
  });
});

describe("links stay in the reader's language", () => {
  it("moves a link to the version of that page in this language", () => {
    expect(localizedHref("/products", "hi")).toBe("/hi/products");
    expect(localizedHref("/", "hi")).toBe("/hi");
    expect(localizedHref("/calculators", "zh")).toBe("/zh/calculators");
  });

  it("keeps query strings and fragments", () => {
    expect(localizedHref("/contact?topic=consultancy", "hi")).toBe("/hi/contact?topic=consultancy");
    expect(localizedHref("/tools#top", "de")).toBe("/de/tools#top");
  });

  it("leaves English alone", () => {
    expect(localizedHref("/products", "en")).toBe("/products");
  });

  /** Pointing at a translation that does not exist would be a link into a 404. */
  it("leaves a page that has no version in this language on its English path", () => {
    expect(localizedHref("/blog", "hi")).toBe("/blog");
    expect(localizedHref("/tools/invoice-generator", "hi")).toBe("/tools/invoice-generator");
    expect(localizedHref("/products/restaurant-pos", "hi")).toBe("/products/restaurant-pos");
  });

  it("leaves anything that is not an internal path alone", () => {
    expect(localizedHref("https://example.com/products", "hi")).toBe("https://example.com/products");
    expect(localizedHref("//example.com/products", "hi")).toBe("//example.com/products");
    expect(localizedHref("mailto:hi@example.com", "hi")).toBe("mailto:hi@example.com");
    expect(localizedHref("#faq", "hi")).toBe("#faq");
  });

  it("can be applied twice without changing the result", () => {
    const once = localizedHref("/products", "hi");
    expect(localizedHref(once, "hi")).toBe(once);
  });

  it("rewrites every href in a content tree, at any depth", () => {
    const content = {
      hero: { primaryCta: { href: "/products", label: "x" } },
      cards: [{ cta: { href: "/tools" } }, { cta: { href: "/blog" } }],
      social: [{ href: "https://x.com/setu" }],
    };
    const localized = localizeLinks(content, "hi");

    expect(localized.hero.primaryCta.href).toBe("/hi/products");
    expect(localized.cards[0].cta.href).toBe("/hi/tools");
    expect(localized.cards[1].cta.href).toBe("/blog");
    expect(localized.social[0].href).toBe("https://x.com/setu");
    expect(localized.hero.primaryCta.label).toBe("x");
  });

  it("returns the English tree untouched, not a copy", () => {
    const content = { cta: { href: "/products" } };
    expect(localizeLinks(content, "en")).toBe(content);
  });
});

describe("links written inline in body copy", () => {
  it("localizes a markdown-style link inside a paragraph", () => {
    const merged = localizeLinks(
      { sections: [{ paragraphs: ["Siehe auch unsere [Nutzungsbedingungen](/terms)."] }] },
      "de",
    );
    expect(merged.sections[0].paragraphs[0]).toBe(
      "Siehe auch unsere [Nutzungsbedingungen](/de/terms).",
    );
  });

  it("leaves an inline link to an untranslated page alone", () => {
    const merged = localizeLinks({ p: "see the [blog](/blog)" }, "de");
    expect(merged.p).toBe("see the [blog](/blog)");
  });

  it("leaves prose without links untouched", () => {
    const text = "No links here, just **bold** and a bracket ] and a paren )";
    expect(localizeLinks({ p: text }, "de").p).toBe(text);
  });

  /**
   * RichText splits on its own pattern, so a target this rewrote into a shape it
   * does not match would render as literal text instead of a link.
   */
  it("produces links RichText still recognises", () => {
    const richTextPattern = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
    const localized = localizeLinks({ p: "our [privacy policy](/privacy) applies" }, "hi").p;
    const parts = localized.split(richTextPattern).filter((part: string) => part !== "");
    expect(parts).toContain("[privacy policy](/hi/privacy)");
  });
});

describe("item pages: one per calculator, one per tool", () => {
  it("keeps the English path for English and prefixes it otherwise", () => {
    expect(itemPathFor("calculators", "gst-calculator", "en")).toBe("/calculators/gst-calculator");
    expect(itemPathFor("calculators", "gst-calculator", "hi")).toBe(
      "/hi/calculators/gst-calculator",
    );
  });

  it("publishes an item only in the languages its own copy is translated into", () => {
    for (const key of ["calculators", "tools"] as const) {
      const english = JSON.parse(
        fs.readFileSync(path.join(process.cwd(), "content", "en", `${key}.json`), "utf8"),
      ) as Record<string, any>;

      for (const item of english.items) {
        for (const lang of itemLocalesFor(key, item.slug)) {
          // The listing has to carry the item before its own page can.
          expect(localesFor(key), `${key}/${item.slug} in ${lang}`).toContain(lang);
        }
      }
    }
  });

  it("gives every published item page a complete, two-way hreflang cluster", () => {
    for (const key of ["calculators", "tools"] as const) {
      for (const { slug, lang } of itemRoutesFor(key)) {
        const alternates = itemLanguageAlternates(key, slug);
        const english = itemPathFor(key, slug, "en");

        // The English page carries the same cluster, so both directions agree.
        expect(alternates["x-default"]).toBe(english);
        expect(alternates.en).toBe(english);
        expect(alternates[hreflangFor(lang)]).toBe(itemPathFor(key, slug, lang));
        expect(Object.keys(alternates)).toHaveLength(itemLocalesFor(key, slug).length + 2);
      }
    }
  });

  /**
   * A route is prerendered per (language, slug), and the tool it renders comes
   * from the registry — a slug missing from it would build a page with no
   * calculator on it.
   */
  it("has a tool in the registry for every calculator route it will build", async () => {
    const { CALCULATOR_TOOLS } = await import("@/components/calculators/tools/registry");
    for (const { slug } of itemRoutesFor("calculators")) {
      expect(Object.keys(CALCULATOR_TOOLS), `registry is missing ${slug}`).toContain(slug);
    }
  });
});
