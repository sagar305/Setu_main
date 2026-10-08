import { describe, expect, it } from "vitest";

import { LANGUAGES, type LanguageCode } from "@/lib/i18n/config";
import { relabelSeed, relabelSeedLines } from "@/lib/i18n/seed-labels";
import { translate, type TKey } from "@/lib/i18n/translate";

const KEYS: TKey[] = ["stSeedCashBank", "stSeedReceivable", "stSeedInventory"];
const CODES = LANGUAGES.map((l) => l.code) as LanguageCode[];

/**
 * A worksheet's sample rows are seeded in the reader's language and then saved
 * to localStorage under a single key — so whichever language a reader first
 * opened the tool in used to become the language of the example for ever. These
 * checks pin the two halves of the fix: our own sample text follows the reader,
 * and anything they typed never moves.
 */
describe("relabelSeed", () => {
  it("re-languages a seed label from any published language", () => {
    for (const from of CODES) {
      for (const to of CODES) {
        for (const key of KEYS) {
          expect(relabelSeed(translate(from, key), KEYS, to)).toBe(translate(to, key));
        }
      }
    }
  });

  it("leaves text the user typed alone", () => {
    for (const typed of ["Petty cash tin", "नगद पेटी", "Cash & bank (branch 2)", "  "]) {
      expect(relabelSeed(typed, KEYS, "hi")).toBe(typed);
    }
  });

  it("ignores a key the caller did not list", () => {
    // stSeedEquipment is a seed, but not one of this worksheet's seeds.
    const other = translate("hi", "stSeedEquipment");
    expect(relabelSeed(other, KEYS, "en")).toBe(other);
  });

  it("matches a stored label that picked up surrounding whitespace", () => {
    expect(relabelSeed(` ${translate("hi", "stSeedInventory")} `, KEYS, "en")).toBe(
      translate("en", "stSeedInventory")
    );
  });

  it("keeps an empty label empty rather than seeding into it", () => {
    expect(relabelSeed("", KEYS, "en")).toBe("");
  });
});

describe("relabelSeedLines", () => {
  const lines = [
    { id: "1", label: translate("hi", "stSeedCashBank"), amount: 500 },
    { id: "2", label: "Chit fund float", amount: 250 },
  ];

  it("re-languages only the seeded line and keeps the rest of the row", () => {
    const next = relabelSeedLines(lines, KEYS, "en");
    expect(next[0]).toEqual({ id: "1", label: translate("en", "stSeedCashBank"), amount: 500 });
    expect(next[1]).toBe(lines[1]);
  });

  it("returns the same array when nothing changed, so storage is not rewritten", () => {
    // useLocalStore writes on every new value, so an untouched worksheet must
    // come back identical or merely reading it in its own language saves it.
    expect(relabelSeedLines(lines, KEYS, "hi")).toBe(lines);
    expect(relabelSeedLines([], KEYS, "en")).toEqual([]);
  });
});
