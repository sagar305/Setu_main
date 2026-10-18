// The Google review banner: which pages it asks on, in which language, and that
// every language the site is published in has its own copy.

import { describe, expect, it } from "vitest";
import { LANGUAGES } from "@/lib/i18n/config";
import { REVIEW_BANNER_COPY, reviewBannerRoute } from "@/lib/reviewBanner";

describe("reviewBannerRoute", () => {
  it("asks on every tool, calculator, glossary, product and blog page", () => {
    for (const path of [
      "/tools",
      "/tools/invoice-generator",
      "/calculators/gst-calculator",
      "/glossary",
      "/glossary/gstin",
      "/products",
      "/products/qr-menu",
      "/products/bank-statement-analyzer/import",
      "/blog",
      "/blog/gst/some-post",
    ]) {
      expect(reviewBannerRoute(path), path).toEqual({ lang: null });
    }
  });

  it("reads the language from a translated URL", () => {
    expect(reviewBannerRoute("/hi/tools/journal-entry")).toEqual({ lang: "hi" });
    expect(reviewBannerRoute("/ar/calculators/vat-calculator")).toEqual({ lang: "ar" });
    expect(reviewBannerRoute("/zh/products")).toEqual({ lang: "zh" });
  });

  it("stays off the rest of the site", () => {
    for (const path of ["/", "/hi", "/about", "/pricing", "/contact", "/hi/contact", "/menu/abc", "/track/x", "/sitemap"]) {
      expect(reviewBannerRoute(path), path).toBeNull();
    }
    expect(reviewBannerRoute(null)).toBeNull();
    expect(reviewBannerRoute("")).toBeNull();
  });

  it("stays off the screens that are an app on a counter or a wall", () => {
    for (const path of [
      "/products/free-token-system/display",
      "/products/free-token-system/view",
      "/products/free-restaurant-pos/kitchen",
      "/products/qr-menu/payment",
      "/hi/products/free-restaurant-pos/kitchen",
    ]) {
      expect(reviewBannerRoute(path), path).toBeNull();
    }
    // A product page that merely starts with the same letters still asks.
    expect(reviewBannerRoute("/products/free-token-system")).toEqual({ lang: null });
  });

  it("ignores a query string or hash", () => {
    expect(reviewBannerRoute("/tools/cash-book?tab=1#top")).toEqual({ lang: null });
  });

  it("does not mistake a section-like word for a language", () => {
    expect(reviewBannerRoute("/xx/tools")).toBeNull();
    // English has no prefix, so /en/… is not a page.
    expect(reviewBannerRoute("/en/tools")).toBeNull();
  });
});

describe("REVIEW_BANNER_COPY", () => {
  it("has every field, filled in, for every language the site is published in", () => {
    for (const { code } of LANGUAGES) {
      const copy = REVIEW_BANNER_COPY[code];
      expect(copy, `${code} has no review banner copy`).toBeTruthy();
      for (const field of ["lead", "body", "cta", "label", "dismiss"] as const) {
        expect(copy[field]?.trim(), `${code}.${field} is empty`).toBeTruthy();
      }
    }
  });

  it("is actually translated, apart from the brand names", () => {
    const english = REVIEW_BANNER_COPY.en;
    for (const { code } of LANGUAGES.filter((language) => language.code !== "en")) {
      const copy = REVIEW_BANNER_COPY[code];
      for (const field of ["lead", "body", "cta", "label"] as const) {
        expect(copy[field], `${code}.${field} is still English`).not.toBe(english[field]);
      }
      // The brand and the platform keep their names in every language.
      expect(copy.lead + copy.label, `${code} drops the name Setu`).toContain("Setu");
      expect(copy.body + copy.label, `${code} does not say where to review`).toContain("Google");
    }
  });
});
