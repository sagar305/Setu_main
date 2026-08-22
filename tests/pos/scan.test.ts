// Matching a scanned code to a product in the catalogue.
//
// The camera and a laser scanner both end up here, so these rules decide what
// gets billed when a label is read at the counter.

import { describe, expect, it } from "vitest";
import { codeVariants, findProductByCode, normalizeCode } from "@/lib/pos/scan";
import type { Product } from "@/lib/pos/types";

function product(overrides: Partial<Product> & { id: string }): Product {
  return {
    name: "Item",
    sellingPrice: 10,
    sku: "",
    barcode: "",
    categoryId: "",
    costPrice: null,
    taxRate: null,
    taxInclusive: false,
    trackStock: false,
    stock: 0,
    unit: "pcs",
    imageDataUrl: "",
    description: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("normalizeCode", () => {
  it("ignores case and the whitespace a scanner may append", () => {
    expect(normalizeCode("  Ab12\n")).toBe("ab12");
  });
});

describe("codeVariants", () => {
  it("keeps an ordinary code as it is", () => {
    expect(codeVariants("8901234567890")).toEqual(["8901234567890"]);
  });

  it("reads a zero-padded UPC-A as its 12-digit self too", () => {
    expect(codeVariants("0012345678905")).toEqual(["0012345678905", "012345678905"]);
  });

  it("reads a 12-digit UPC-A as the EAN-13 some decoders report", () => {
    expect(codeVariants("012345678905")).toEqual(["012345678905", "0012345678905"]);
  });

  it("has nothing to try for an empty scan", () => {
    expect(codeVariants("   ")).toEqual([]);
  });
});

describe("findProductByCode", () => {
  const soap = product({ id: "soap", name: "Soap", barcode: "8901234567890" });
  const rice = product({ id: "rice", name: "Rice", sku: "RICE-5KG" });
  const catalogue = [soap, rice];

  it("finds a product by its barcode", () => {
    expect(findProductByCode(catalogue, "8901234567890")).toBe(soap);
  });

  it("falls back to the SKU", () => {
    expect(findProductByCode(catalogue, "rice-5kg")).toBe(rice);
  });

  it("prefers a barcode match over a SKU match on another product", () => {
    const clash = product({ id: "clash", sku: "8901234567890" });
    expect(findProductByCode([clash, soap], "8901234567890")).toBe(soap);
  });

  it("matches a UPC-A saved without its leading zero", () => {
    const pen = product({ id: "pen", barcode: "012345678905" });
    expect(findProductByCode([pen], "0012345678905")).toBe(pen);
  });

  it("returns nothing for an unknown code", () => {
    expect(findProductByCode(catalogue, "0000000000000")).toBeNull();
  });

  it("returns nothing for an empty scan", () => {
    expect(findProductByCode(catalogue, "")).toBeNull();
  });

  it("does not match products that have no code at all", () => {
    expect(findProductByCode([product({ id: "loose" })], "")).toBeNull();
  });
});
