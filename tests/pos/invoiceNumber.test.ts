import { describe, expect, it } from "vitest";
import { formatInvoiceNumber, invoiceDigits } from "@/lib/pos/types";

describe("formatInvoiceNumber", () => {
  it("keeps the original 5-digit format by default", () => {
    expect(formatInvoiceNumber("INV-", 42)).toBe("INV-00042");
    expect(formatInvoiceNumber("INV-", 42, undefined)).toBe("INV-00042");
  });

  it("pads to any length from 3 to 9", () => {
    expect(formatInvoiceNumber("INV-", 7, 3)).toBe("INV-007");
    expect(formatInvoiceNumber("INV-", 7, 6)).toBe("INV-000007");
    expect(formatInvoiceNumber("", 7, 9)).toBe("000000007");
  });

  it("never cuts a number longer than the digit count", () => {
    expect(formatInvoiceNumber("INV-", 1000, 3)).toBe("INV-1000");
  });

  it("falls back to 5 digits for values outside 3–9", () => {
    for (const bad of [0, 2, 10, 4.5, NaN, null]) {
      expect(invoiceDigits(bad as number | null)).toBe(5);
    }
    expect(invoiceDigits(3)).toBe(3);
    expect(invoiceDigits(9)).toBe(9);
  });
});
