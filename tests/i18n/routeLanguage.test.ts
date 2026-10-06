import { describe, expect, it } from "vitest";

import { routeLanguage } from "@/lib/i18n/route-language";

/**
 * The reported bug, as a test: the MDR calculator kept showing the last
 * language picked anywhere on the site, even on its English URL, and selecting
 * English did nothing about it.
 */
describe("routeLanguage", () => {
  it("renders an English item page in English however the preference was left", () => {
    // The reported case. A reader had been on /hi somewhere, so the stored
    // preference is Hindi; the English URL must still be English.
    expect(routeLanguage(undefined, "/calculators/mdr-calculator", "hi")).toBe("en");
  });

  it.each(["hi", "ar", "zh", "ta"])(
    "is unaffected by a stored preference of %s on an English route",
    (stored) => {
      expect(routeLanguage(undefined, "/calculators/mdr-calculator", stored)).toBe("en");
      expect(routeLanguage(undefined, "/tools/cash-book", stored)).toBe("en");
      expect(routeLanguage(undefined, "/", stored)).toBe("en");
      expect(routeLanguage(undefined, "/privacy", stored)).toBe("en");
    },
  );

  it("takes the language from a translated URL", () => {
    expect(routeLanguage(undefined, "/hi/calculators/mdr-calculator", "en")).toBe("hi");
    expect(routeLanguage(undefined, "/ar/tools/cash-book", "en")).toBe("ar");
    expect(routeLanguage(undefined, "/zh", "en")).toBe("zh");
  });

  it("prefers an explicit route language over everything", () => {
    // What /[lang]/layout passes. It has already rendered in that language on
    // the server, so nothing may move it afterwards.
    expect(routeLanguage("ta", "/ta/tools/cash-book", "hi")).toBe("ta");
  });

  it("falls back to the stored preference outside any published cluster", () => {
    // This is what the preference is for: a path with no translated URL of its
    // own still follows the reader's choice.
    expect(routeLanguage(undefined, "/glossary/contra-entry", "hi")).toBe("hi");
    expect(routeLanguage(undefined, "/products/qr-menu", "ta")).toBe("ta");
  });

  it("falls back to English when the stored preference is missing or junk", () => {
    for (const stored of [undefined, null, "", "xx", 42, {}]) {
      expect(routeLanguage(undefined, "/glossary/contra-entry", stored)).toBe("en");
    }
  });
});
