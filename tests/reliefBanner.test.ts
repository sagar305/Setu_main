// The Nepal relief banner's schedule: on by default, off on request, and
// bounded by dates that are compared against the visitor's clock.

import { describe, expect, it } from "vitest";
import { isBannerVisible, parseBound } from "@/lib/reliefBanner";

const DURING = new Date("2026-09-15T12:00:00Z");

describe("the enabled flag", () => {
  it("shows the banner when nothing is configured", () => {
    expect(isBannerVisible(DURING, {})).toBe(true);
  });

  it("hides the banner when explicitly disabled", () => {
    expect(isBannerVisible(DURING, { enabled: false })).toBe(false);
  });

  it("stays hidden when disabled even inside the scheduled window", () => {
    expect(
      isBannerVisible(DURING, { enabled: false, start: "2026-09-01", end: "2026-10-01" }),
    ).toBe(false);
  });
});

describe("the scheduled window", () => {
  const window = { start: "2026-09-01", end: "2026-10-31" };

  it("hides the banner before the start date", () => {
    expect(isBannerVisible(new Date("2026-08-31T23:59:59Z"), window)).toBe(false);
  });

  it("shows the banner from midnight UTC on the start date", () => {
    expect(isBannerVisible(new Date("2026-09-01T00:00:00Z"), window)).toBe(true);
  });

  it("shows the banner in the middle of the window", () => {
    expect(isBannerVisible(DURING, window)).toBe(true);
  });

  it("runs a bare end date through the whole of that day", () => {
    expect(isBannerVisible(new Date("2026-10-31T23:59:59Z"), window)).toBe(true);
  });

  it("hides the banner once the end date has passed", () => {
    expect(isBannerVisible(new Date("2026-11-01T00:00:00Z"), window)).toBe(false);
  });

  it("takes a full ISO end timestamp literally", () => {
    const exact = { end: "2026-10-31T18:30:00Z" };
    expect(isBannerVisible(new Date("2026-10-31T18:29:59Z"), exact)).toBe(true);
    expect(isBannerVisible(new Date("2026-10-31T18:30:00Z"), exact)).toBe(false);
  });

  it("treats either bound as optional", () => {
    expect(isBannerVisible(DURING, { start: "2026-09-01" })).toBe(true);
    expect(isBannerVisible(DURING, { end: "2026-10-31" })).toBe(true);
  });
});

describe("unusable dates", () => {
  it("drops a bound it cannot parse rather than blanking the banner", () => {
    expect(parseBound("not a date", "end")).toBe(null);
    expect(isBannerVisible(DURING, { end: "not a date" })).toBe(true);
  });

  it("ignores empty and whitespace-only values", () => {
    expect(parseBound("", "start")).toBe(null);
    expect(parseBound("   ", "start")).toBe(null);
    expect(parseBound(undefined, "start")).toBe(null);
  });

  it("tolerates surrounding whitespace in a real date", () => {
    expect(parseBound(" 2026-09-01 ", "start")).toBe(Date.parse("2026-09-01T00:00:00Z"));
  });
});
