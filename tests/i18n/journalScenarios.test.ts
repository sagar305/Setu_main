import { describe, expect, it } from "vitest";

import { LANGUAGES, type LanguageCode } from "@/lib/i18n/config";
import {
  journalScenarios,
  scenarioCategoryLabel,
  SCENARIO_CATEGORIES,
} from "@/lib/journalScenarios";
import { SCENARIO_TEXT } from "@/lib/journalScenarioText";

const LANGS = LANGUAGES.map((l) => l.code) as LanguageCode[];
const OTHERS = LANGS.filter((code) => code !== "en");
const FIELDS = ["name", "narration", "explanation", "mistake"] as const;

/**
 * The scenario library lives in its own module rather than the shared
 * dictionaries, so the completeness suite in dictionaries.test.ts does not
 * cover it. Without this, a scenario missing from one language would fall back
 * to four English sentences in the middle of a translated page — and a reader
 * hunting for the right entry would not be able to tell whether the gap was in
 * the wording or in the accounting.
 */
describe("the journal scenario library", () => {
  const base = journalScenarios("en");

  it("has scenarios in every category", () => {
    expect(base.length).toBeGreaterThan(0);
    const used = new Set(base.map((s) => s.category));
    expect([...SCENARIO_CATEGORIES].filter((c) => !used.has(c))).toEqual([]);
  });

  it("balances every scenario's debits against its credits", () => {
    // An unbalanced example would load into the form and refuse to post, which
    // is the one thing a worked example must never do.
    const unbalanced = base.filter((s) => {
      const debit = s.lines.filter((l) => l.side === "debit").reduce((n, l) => n + l.amount, 0);
      const credit = s.lines.filter((l) => l.side === "credit").reduce((n, l) => n + l.amount, 0);
      return Math.abs(debit - credit) > 0.005 || s.lines.length < 2;
    });
    expect(unbalanced.map((s) => s.id)).toEqual([]);
  });

  it.each(OTHERS)("is complete in %s", (lang) => {
    const book = SCENARIO_TEXT[lang];
    const blank: string[] = [];
    for (const s of base) {
      const text = book.scenarios[s.id];
      if (!text) {
        blank.push(s.id);
        continue;
      }
      for (const field of FIELDS) {
        if (!text[field]?.trim()) blank.push(`${s.id}.${field}`);
      }
    }
    expect(blank).toEqual([]);
    expect(SCENARIO_CATEGORIES.filter((c) => !book.categories[c]?.trim())).toEqual([]);
  });

  it.each(OTHERS)("is translated, not inherited, in %s", (lang) => {
    // Four sentences per scenario is enough text that an identical string means
    // the translation was skipped, not that the languages happen to agree.
    const inherited: string[] = [];
    for (const s of base) {
      const text = SCENARIO_TEXT[lang].scenarios[s.id];
      for (const field of FIELDS) {
        if (text[field] === s[field]) inherited.push(`${s.id}.${field}`);
      }
    }
    expect(inherited).toEqual([]);
  });

  it("keeps the same entries in every language", () => {
    // Only the wording changes with the language: the ids, the accounts and the
    // amounts are the accounting, and must not drift between languages.
    const shape = (lang: LanguageCode) =>
      JSON.stringify(
        journalScenarios(lang).map((s) => [s.id, s.category, s.lines]),
      );
    for (const lang of OTHERS) {
      expect(shape(lang)).toBe(shape("en"));
    }
  });

  it("labels every category in every language", () => {
    for (const lang of LANGS) {
      for (const category of SCENARIO_CATEGORIES) {
        expect(scenarioCategoryLabel(category, lang)).toBeTruthy();
      }
    }
  });

  it("falls back to English for a language it has no book for", () => {
    const unknown = "xx" as LanguageCode;
    expect(journalScenarios(unknown)[0].name).toBe(base[0].name);
    expect(scenarioCategoryLabel("sales", unknown)).toBe(scenarioCategoryLabel("sales", "en"));
  });
});
