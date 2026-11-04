import { describe, expect, it } from "vitest";
import { currencyOptions, detectCurrency } from "@/lib/toolkit/currencyDetect";

describe("detectCurrency", () => {
  it("uses the time zone first — India stays INR even with an en-US browser", () => {
    expect(detectCurrency({ timeZone: "Asia/Kolkata", languages: ["en-US"] })).toBe("INR");
    expect(detectCurrency({ timeZone: "Asia/Calcutta", languages: [] })).toBe("INR");
  });

  it("maps other countries' time zones to their currency", () => {
    expect(detectCurrency({ timeZone: "Asia/Karachi" })).toBe("PKR");
    expect(detectCurrency({ timeZone: "Asia/Dubai" })).toBe("AED");
    expect(detectCurrency({ timeZone: "Europe/Berlin" })).toBe("EUR");
    expect(detectCurrency({ timeZone: "Europe/London" })).toBe("GBP");
    expect(detectCurrency({ timeZone: "America/Toronto" })).toBe("CAD");
    expect(detectCurrency({ timeZone: "Asia/Dhaka" })).toBe("BDT");
  });

  it("falls back to the language region for zones it does not know", () => {
    expect(detectCurrency({ timeZone: "Etc/UTC", languages: ["en-NP"] })).toBe("NPR");
    expect(detectCurrency({ timeZone: "Etc/UTC", languages: ["en", "fr-CA"] })).toBe("CAD");
  });

  it("shows US dollars outside India when nothing places the browser", () => {
    expect(detectCurrency({ timeZone: "Etc/UTC", languages: ["en"] })).toBe("USD");
    expect(detectCurrency({})).toBe("USD");
  });
});

describe("currencyOptions", () => {
  it("lists every shop currency with INR first and the chosen one next", () => {
    const opts = currencyOptions("PKR");
    expect(opts[0].code).toBe("INR");
    expect(opts[1].code).toBe("PKR");
    expect(opts.length).toBeGreaterThan(100);
    expect(opts.some((o) => o.code === "XAU")).toBe(false);
    expect(new Set(opts.map((o) => o.code)).size).toBe(opts.length);
  });

  it("still shows a saved currency the browser does not list", () => {
    expect(currencyOptions("ZZZ")[0]).toEqual({ code: "ZZZ", label: "ZZZ" });
  });
});
