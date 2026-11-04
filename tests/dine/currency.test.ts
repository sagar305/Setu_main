import { describe, expect, it } from "vitest";
import { amountInWords, currencySymbol, formatPaise } from "@/lib/dine/money";
import { CURRENCIES } from "@/lib/dine/types";

describe("Pakistani Rupee in the restaurant POS", () => {
  it("is offered at setup and in settings", () => {
    expect(CURRENCIES.map((c) => c.code)).toContain("PKR");
  });

  it("formats bills in rupees", () => {
    expect(currencySymbol("PKR")).toBe("Rs");
    expect(formatPaise(125050, "PKR").replace(/\s/g, " ")).toBe("Rs 1,250.50");
  });

  it("writes the amount in words with lakh and paisa", () => {
    expect(amountInWords(12345650, "PKR")).toBe("Rupees One Lakh Twenty Three Thousand Four Hundred Fifty Six and Fifty Paisa Only");
  });
});
