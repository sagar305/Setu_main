import { describe, expect, it } from "vitest";

import { LANGUAGES, type LanguageCode } from "@/lib/i18n/config";
import {
  composePhone,
  dialCodeFor,
  dialOptions,
  isPlausibleNationalNumber,
  DEFAULT_DIAL_COUNTRY,
  DIAL_CODES,
} from "@/lib/constants/dialCodes";

/**
 * The contact form's country picker renders each country's name from its ISO
 * code through Intl, so a mistyped code shows a bare "XX" to the one reader who
 * would notice and nobody else. These checks make a bad code fail here instead.
 */
describe("DIAL_CODES", () => {
  it("has a well-formed ISO code and calling code on every row", () => {
    const codes = Object.keys(DIAL_CODES);
    expect(codes.length).toBeGreaterThan(200);
    expect(codes.filter((c) => !/^[A-Z]{2}$/.test(c))).toEqual([]);
    expect(Object.entries(DIAL_CODES).filter(([, d]) => !/^[1-9]\d{0,3}$/.test(d))).toEqual([]);
  });

  it("resolves every code to a region name", () => {
    const names = new Intl.DisplayNames(["en"], { type: "region" });
    const unresolved = Object.keys(DIAL_CODES).filter((c) => {
      const name = names.of(c);
      return !name || name === c;
    });
    expect(unresolved).toEqual([]);
  });

  it("agrees with the calling codes people actually dial", () => {
    // A sample across regions; a transposed digit here is a wrong number.
    expect({
      IN: DIAL_CODES.IN, US: DIAL_CODES.US, GB: DIAL_CODES.GB, AE: DIAL_CODES.AE,
      SG: DIAL_CODES.SG, AU: DIAL_CODES.AU, DE: DIAL_CODES.DE, BR: DIAL_CODES.BR,
      NG: DIAL_CODES.NG, BD: DIAL_CODES.BD, LK: DIAL_CODES.LK, NP: DIAL_CODES.NP,
    }).toEqual({
      IN: "91", US: "1", GB: "44", AE: "971",
      SG: "65", AU: "61", DE: "49", BR: "55",
      NG: "234", BD: "880", LK: "94", NP: "977",
    });
  });
});

describe("dialOptions", () => {
  it.each(LANGUAGES.map((l) => l.code))("names every country in %s", (code) => {
    const options = dialOptions(code as LanguageCode);
    expect(options).toHaveLength(Object.keys(DIAL_CODES).length);
    // A name that is still the bare ISO code means Intl had nothing for it.
    expect(options.filter((o) => o.name === o.code)).toEqual([]);
  });

  it("puts the home market first so the common case is one tap away", () => {
    for (const { code } of LANGUAGES) {
      expect(dialOptions(code as LanguageCode)[0].code).toBe(DEFAULT_DIAL_COUNTRY);
    }
  });

  it("sorts the rest by the name the reader sees", () => {
    const rest = dialOptions("en").slice(1).map((o) => o.name);
    expect(rest).toEqual([...rest].sort((a, b) => a.localeCompare(b, "en")));
  });
});

describe("composePhone", () => {
  it("keeps one shape however the number was typed", () => {
    for (const typed of ["98765 43210", "(98765) 43210", "98765-43210", "9876543210"]) {
      expect(composePhone("IN", typed)).toBe("+91 9876543210");
    }
  });

  it("is empty when there is no number, rather than sending a bare code", () => {
    expect(composePhone("IN", "")).toBe("");
    expect(composePhone("IN", "   ")).toBe("");
  });

  it("falls back to the home code for a country it does not know", () => {
    expect(dialCodeFor("ZZ")).toBe(DIAL_CODES[DEFAULT_DIAL_COUNTRY]);
  });
});

describe("isPlausibleNationalNumber", () => {
  it("accepts real numbers from short and long plans", () => {
    expect(isPlausibleNationalNumber("IN", "98765 43210")).toBe(true);
    expect(isPlausibleNationalNumber("US", "(415) 555-2671")).toBe(true);
    // Niue's numbers are four digits; anything stricter would reject them.
    expect(isPlausibleNationalNumber("NU", "1234")).toBe(true);
  });

  it("rejects what is too short to call", () => {
    expect(isPlausibleNationalNumber("IN", "")).toBe(false);
    expect(isPlausibleNationalNumber("IN", "123")).toBe(false);
    expect(isPlausibleNationalNumber("IN", "abc")).toBe(false);
  });

  it("rejects what cannot fit in E.164", () => {
    // 15 digits is the whole number, country code included.
    expect(isPlausibleNationalNumber("IN", "1".repeat(13))).toBe(true);
    expect(isPlausibleNationalNumber("IN", "1".repeat(14))).toBe(false);
  });
});
