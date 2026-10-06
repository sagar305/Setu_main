import { describe, expect, it } from "vitest";

import { LANGUAGES, type LanguageCode } from "@/lib/i18n/config";
import { createSampleMenu, countMenuItems } from "@/lib/qrmenu";

/**
 * "Load sample" is how most people find out what the QR menu tool does, so the
 * sample has to arrive in their language. Every string in it lands in an
 * editable field, which is why it is built per language rather than stored in
 * English and translated on the way out.
 */
describe("createSampleMenu", () => {
  const english = createSampleMenu("en");

  it("has the same shape in every language", () => {
    for (const { code } of LANGUAGES) {
      const menu = createSampleMenu(code);
      expect(menu.categories).toHaveLength(english.categories.length);
      expect(countMenuItems(menu)).toBe(countMenuItems(english));
      menu.categories.forEach((category, index) => {
        expect(category.items).toHaveLength(english.categories[index].items.length);
      });
    }
  });

  it("keeps the prices, diet tags and the one variant", () => {
    // These are the parts a translation must not touch: a Hindi reader and an
    // English one are looking at the same priced menu.
    for (const { code } of LANGUAGES) {
      const menu = createSampleMenu(code);
      menu.categories.forEach((category, c) =>
        category.items.forEach((item, i) => {
          const same = english.categories[c].items[i];
          expect(item.price).toBe(same.price);
          expect(item.tag).toBe(same.tag);
          expect(item.variant?.options.map((o) => o.price)).toEqual(
            same.variant?.options.map((o) => o.price),
          );
        }),
      );
    }
  });

  it.each(LANGUAGES.map((l) => l.code).filter((code) => code !== "en"))(
    "is translated, not inherited, in %s",
    (code) => {
      const menu = createSampleMenu(code as LanguageCode);
      // The tagline and the category names are the plainest prose in the
      // sample, so an untranslated one of those means the whole sample is
      // falling through to English.
      expect(menu.tagline).not.toBe(english.tagline);
      expect(menu.categories.map((c) => c.name)).not.toEqual(
        english.categories.map((c) => c.name),
      );
      for (const category of menu.categories) {
        for (const item of category.items) {
          expect(item.name.trim()).not.toBe("");
        }
      }
    },
  );
});
