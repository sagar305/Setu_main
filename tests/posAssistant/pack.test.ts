import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { respond } from "@/lib/pos/assistant/agent";
import {
  applySynonyms,
  exampleShape,
  extractSlots,
  flatExamples,
  keywordIntent,
  smartRespond,
  validatePack,
  type MeaningMatcher,
} from "@/lib/pos/assistant/pack";
import { NOW, data } from "./fixtures";

const pack = validatePack(
  JSON.parse(readFileSync(join(process.cwd(), "public", "pos-assistant", "pack-v1.json"), "utf8"))
);

const smart = (text: string, meaning?: MeaningMatcher) => smartRespond(text, data, { pack, meaning, now: NOW });

describe("the pack file", () => {
  it("is valid and substantial", () => {
    expect(pack.intents.length).toBeGreaterThan(40);
    expect(Object.keys(pack.synonyms).length).toBeGreaterThan(100);
    expect(flatExamples(pack).length).toBeGreaterThan(300);
  });

  it("rejects a damaged pack", () => {
    expect(() => validatePack({ version: 1, synonyms: {}, intents: [{ id: "x", template: "help:nope", examples: [] }] })).toThrow(
      /unknown help article/
    );
    expect(() => validatePack(null)).toThrow(/damaged/);
  });

  it("routes almost every example back to its own intent by keywords alone", () => {
    // A sanity check on the dataset: an example that keyword matching sends to
    // a different intent is one that teaches the wrong thing.
    const examples = flatExamples(pack);
    const wrong = examples.filter(({ intent, shape }) => keywordIntent(shape, pack)?.intent.id !== intent.id);
    expect(wrong.length / examples.length).toBeLessThan(0.05);
  });
});

describe("synonyms", () => {
  it("rewords Hinglish and Hindi", () => {
    expect(applySynonyms("aaj ki bikri", pack)).toBe("today ki sales");
    expect(applySynonyms("आज की बिक्री", pack)).toBe("today की sales");
  });

  it("never rewrites a word that is part of the shop's own names", () => {
    const shop = { ...data, products: [...data.products, { ...data.products[0], id: "tel", name: "Thanda Tel" }] };
    expect(applySynonyms("thanda tel price", pack, shop)).toBe("thanda tel price");
    expect(applySynonyms("thanda pani", pack, data)).toBe("drink pani");
  });
});

describe("slots", () => {
  it("pulls products, quantities, customers and payment out of a request", () => {
    const slots = extractSlots("ramesh ne 2 maggi aur parle g 3 liye upi se", data);
    expect(slots.items).toEqual([
      { productName: "Maggi Noodles 70g", qty: 2 },
      { productName: "Parle-G Biscuit 100g", qty: 3 },
    ]);
    expect(slots.customerName).toBe("Ramesh Kumar");
    expect(slots.paymentName).toBe("UPI");
    expect(slots.shape).toBe("xcustomer ne xnumber xproduct aur xproduct xnumber liye xpayment se");
    expect(exampleShape("{qty} {product} to {customer}")).toBe("xnumber xproduct to xcustomer");
  });
});

describe("smart replies", () => {
  it("leaves what the rules already understand untouched", async () => {
    expect(await smart("today's sales")).toEqual(respond("today's sales", data, NOW));
  });

  it("understands requests the rules alone do not", async () => {
    expect(respond("aaj ka hisaab batao", data, NOW).guess).toBe(true);
    for (const text of ["12 maggi aaye hai", "kya mangwana hai", "2 maggi de do"]) {
      const direct = respond(text, data, NOW);
      expect(direct.notUnderstood || direct.guess, text).toBe(true);
    }

    const stock = await smart("12 maggi aaye hai");
    expect(stock.proposal?.action).toMatchObject({ kind: "stock", productId: "maggi", mode: "add", quantity: 12 });
    expect(stock.understoodAs).toBe("add 12 stock to maggi noodles 70g");

    expect((await smart("aaj ka hisaab batao")).text).toBe("Today: ₹108.00 from 2 bills.");
    expect((await smart("kya mangwana hai")).bullets).toContain("Maggi Noodles 70g — 3 left");
    expect((await smart("coke ka daam 45 kar do")).proposal?.action).toEqual({ kind: "price", productId: "coke", price: 45 });
    expect((await smart("2 maggi de do")).proposal?.action).toMatchObject({
      kind: "sale",
      lines: [{ productId: "maggi", quantity: 2 }],
    });
  });

  it("understands Hindi in Devanagari", async () => {
    expect((await smart("आज की बिक्री")).text).toBe("Today: ₹108.00 from 2 bills.");
  });

  it("answers how-to questions phrased in ways the articles don't list", async () => {
    expect((await smart("baad me paise dega")).text).toBe("Credit / Udhaar sales");
    expect((await smart("net nahi hai")).text).toBe("Working offline");
  });

  it("asks for a missing value instead of inventing one", async () => {
    expect((await smart("maggi aaya hai")).text).toBe("How many Maggi Noodles 70g?");
  });

  it("falls back to the meaning model, and only above its threshold", async () => {
    const examples = flatExamples(pack);
    const lowStockIndex = examples.findIndex((e) => e.intent.id === "low_stock");
    const meaning: MeaningMatcher = async () => ({ exampleIndex: lowStockIndex, score: 0.8 });
    expect((await smart("zyxw qrst", meaning)).text).toMatch(/need restocking/);

    const weak: MeaningMatcher = async () => ({ exampleIndex: lowStockIndex, score: 0.3 });
    expect((await smart("zyxw qrst", weak)).notUnderstood).toBe(true);

    const broken: MeaningMatcher = async () => {
      throw new Error("model crashed");
    };
    expect((await smart("zyxw qrst", broken)).notUnderstood).toBe(true);
  });
});
