import { describe, expect, it } from "vitest";

import { LANGUAGES, type LanguageCode } from "@/lib/i18n/config";
import { COUNTRY_VAT_RATES } from "@/lib/constants/taxRates";
import { translate } from "@/lib/i18n/translate";

/**
 * The VAT calculator renders each country's name from its ISO 3166-1 code via
 * Intl, so the table reads in the page's language without 65 hand-translated
 * names. The cost of that is a silent failure mode: a mistyped code resolves to
 * nothing, the row falls back to the English name, and only a reader of that
 * language would notice. These checks make a bad code fail here instead.
 */
describe("COUNTRY_VAT_RATES", () => {
  it("has a unique, well-formed code per row", () => {
    const codes = COUNTRY_VAT_RATES.map((c) => c.code);
    expect(codes.filter((c) => !/^[A-Z]{2}$/.test(c))).toEqual([]);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("resolves every code to a region name", () => {
    const names = new Intl.DisplayNames(["en"], { type: "region" });
    const unresolved = COUNTRY_VAT_RATES.filter((c) => {
      const name = names.of(c.code);
      // Intl hands back the code itself when it knows nothing about it.
      return !name || name === c.code;
    }).map((c) => `${c.code} (${c.country})`);
    expect(unresolved).toEqual([]);
  });

  it("names the country the English label says it is", () => {
    // Guards a transposed code — "SE" for Switzerland would resolve cleanly and
    // show the wrong country beside the right rate.
    //
    // Where Intl's name and the common business name genuinely differ, the pair
    // is listed rather than the check loosened: the point is to notice a wrong
    // code, and a looser match would stop noticing.
    const ALTERNATES: Record<string, string> = {
      CZ: "Czechia",
      TR: "Türkiye",
      AE: "United Arab Emirates",
    };
    const names = new Intl.DisplayNames(["en"], { type: "region" });
    const mismatched = COUNTRY_VAT_RATES.filter((c) => {
      const name = (names.of(c.code) ?? "").toLowerCase();
      if (ALTERNATES[c.code]?.toLowerCase() === name) return false;
      const label = c.country.toLowerCase();
      return !name.includes(label) && !label.includes(name);
    }).map((c) => `${c.code}: ${names.of(c.code)} != ${c.country}`);
    expect(mismatched).toEqual([]);
  });

  it("keeps reduced rates as figures and notes as prose", () => {
    // Reduced rates are percentages, which read the same in every language, so
    // they stay untranslated; anything wordier belongs in `note`.
    const prose = COUNTRY_VAT_RATES.filter((c) => c.reduced && /[A-Za-z]{3}/.test(c.reduced));
    expect(prose).toEqual([]);
  });

  it("translates every note it carries", () => {
    const keys = [...new Set(COUNTRY_VAT_RATES.flatMap((c) => (c.note ? [c.note] : [])))];
    expect(keys.length).toBeGreaterThan(0);
    for (const code of LANGUAGES.map((l) => l.code).filter((c) => c !== "en")) {
      for (const key of keys) {
        expect(translate(code as LanguageCode, key)).not.toBe(translate("en", key));
      }
    }
  });
});
