import { describe, expect, it } from "vitest";

import { keepTranslatedOnly } from "@/lib/i18n/translated-only";

const PATHS = [["body"], ["faq", "items"]] as const;

const english = {
  slug: "cash-book",
  body: [{ headline: "One" }, { headline: "Two" }, { headline: "Three" }],
  faq: { items: [{ q: "a" }, { q: "b" }, { q: "c" }, { q: "d" }] },
};

describe("keepTranslatedOnly", () => {
  it("cuts each list back to what the translation carries", () => {
    const patch = { body: [{ headline: "Eins" }], faq: { items: [{}, {}, {}] } };
    const result = keepTranslatedOnly(english, patch, PATHS);
    expect(result.body).toHaveLength(1);
    expect(result.faq.items).toHaveLength(3);
    expect(result.slug).toBe("cash-book");
  });

  it("drops a top-level section the translation lacks, but keeps an empty FAQ list", () => {
    const result = keepTranslatedOnly(english, { faq: {} }, PATHS);
    expect("body" in result).toBe(false);
    expect(result.faq.items).toEqual([]);
  });

  it("leaves a fully translated item untouched", () => {
    const patch = { body: [{}, {}, {}], faq: { items: [{}, {}, {}, {}] } };
    expect(keepTranslatedOnly(english, patch, PATHS)).toBe(english);
  });

  it("never lengthens a list past English", () => {
    const patch = { body: [{}, {}, {}, {}, {}] };
    expect(keepTranslatedOnly(english, patch, [["body"]]).body).toHaveLength(3);
  });

  it("does not mutate the English content", () => {
    keepTranslatedOnly(english, null, PATHS);
    expect(english.body).toHaveLength(3);
    expect(english.faq.items).toHaveLength(4);
  });
});
