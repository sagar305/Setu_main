import { describe, expect, it } from "vitest";

import { LANGUAGES, type LanguageCode } from "@/lib/i18n/config";
import { splitAround, translate } from "@/lib/i18n/translate";

/**
 * `splitAround` exists so a sentence with a link in it can stay one dictionary
 * entry. The halves either side of the placeholder are what gets rendered, so
 * losing the placeholder means losing the link.
 */
describe("splitAround", () => {
  it("returns the text either side of the placeholder", () => {
    expect(splitAround("Set up your {profile} once.", "profile")).toEqual([
      "Set up your ",
      " once.",
    ]);
  });

  it("handles a placeholder that opens or closes the sentence", () => {
    expect(splitAround("{profile} is where your GSTIN lives.", "profile")).toEqual([
      "",
      " is where your GSTIN lives.",
    ]);
    expect(splitAround("Fill this in once: {profile}", "profile")).toEqual([
      "Fill this in once: ",
      "",
    ]);
  });

  it("keeps the whole sentence when the placeholder is absent", () => {
    // A language that dropped the placeholder still reads as a sentence; only
    // the link goes missing, rather than half the text.
    expect(splitAround("Set up your business profile.", "profile")).toEqual([
      "Set up your business profile.",
      "",
    ]);
  });

  it("ignores a placeholder of another name", () => {
    expect(splitAround("Delete {number}?", "profile")).toEqual(["Delete {number}?", ""]);
  });
});

describe("the Business Profile prompt", () => {
  // The link is the point of the sentence — it is how a reader reaches the one
  // screen that stops them retyping their GSTIN on every document.
  it.each(LANGUAGES.map((l) => l.code))("keeps its link placeholder in %s", (code) => {
    const sentence = translate(code as LanguageCode, "dgProfileHint");
    expect(sentence).toContain("{profile}");
    const [before, after] = splitAround(sentence, "profile");
    expect(before + after).not.toContain("{");
  });
});
