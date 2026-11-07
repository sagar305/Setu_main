// What's new: which launches carry a "New"/"Updated" tag and which in-app
// updates an existing business hears about.

import { describe, expect, it } from "vitest";
import {
  APP_UPDATES,
  NEW_FOR_DAYS,
  isFresh,
  isNewPosTool,
  isNewTool,
  productNotes,
  productTag,
  updatesFor,
} from "@/lib/whatsNew";
import { POS_TOOLS } from "@/lib/pos/posTools";
import { BASE_DICT } from "@/lib/i18n/dictionaries";

const at = (iso: string) => Date.parse(iso);

describe("isFresh", () => {
  it("is fresh from the launch day until the window closes", () => {
    expect(isFresh("2026-10-31", at("2026-10-30T23:59:59Z"))).toBe(false);
    expect(isFresh("2026-10-31", at("2026-10-31T00:00:00Z"))).toBe(true);
    expect(isFresh("2026-10-31", at("2026-10-31T00:00:00Z") + (NEW_FOR_DAYS - 1) * 86_400_000)).toBe(true);
    expect(isFresh("2026-10-31", at("2026-10-31T00:00:00Z") + NEW_FOR_DAYS * 86_400_000)).toBe(false);
  });

  it("treats an unreadable date as not fresh", () => {
    expect(isFresh("soon", at("2026-11-01T00:00:00Z"))).toBe(false);
  });
});

describe("website tags", () => {
  const nov1 = at("2026-11-01T00:00:00Z");

  it("no longer tags the Supplier Ledger tool New", () => {
    expect(isNewTool("supplier-ledger", nov1)).toBe(false);
    expect(isNewTool("customer-ledger", nov1)).toBe(false);
  });

  it("tags TB Analyser New and the POS and Free Dine Updated", () => {
    expect(productTag("tb-analyzer", nov1)).toBe("new");
    // The latest POS update shipped on 5 Nov: not tagged before it, tagged after.
    expect(productTag("browser-pos", nov1)).toBeNull();
    expect(productTag("browser-pos", at("2026-11-05T12:00:00Z"))).toBe("updated");
    expect(productTag("free-dine", nov1)).toBe("updated");
    expect(productTag("free-clinic", nov1)).toBeNull();
  });

  it("drops every tag and note once the window has passed", () => {
    const later = at("2027-03-01T00:00:00Z");
    expect(productTag("tb-analyzer", later)).toBeNull();
    expect(productTag("browser-pos", later)).toBeNull();
    expect(productNotes("browser-pos", later)).toEqual([]);
  });
});

describe("updatesFor", () => {
  const nov2 = at("2026-11-02T00:00:00Z");

  it("no longer announces the Supplier Ledger or Payables Aging", () => {
    expect(updatesFor("pos", "2026-06-01T10:00:00.000Z", nov2)).toEqual([]);
  });

  it("adds batch tracking and the Cash Book from 3 Nov", () => {
    const ids = updatesFor("pos", "2026-06-01T10:00:00.000Z", at("2026-11-04T00:00:00Z")).map((u) => u.id);
    expect(ids).toEqual(["pos-batch-tracking", "pos-cash-book"]);
    expect(updatesFor("pos", "2026-11-03T12:00:00.000Z", at("2026-11-04T00:00:00Z"))).toEqual([]);
    expect(isNewPosTool("cash-book", at("2026-11-04T00:00:00Z"))).toBe(true);
  });

  it("stays quiet for a business set up after the launch", () => {
    expect(updatesFor("pos", "2026-11-01T09:00:00.000Z", nov2)).toEqual([]);
    expect(updatesFor("dine", "2026-11-01T09:00:00.000Z", nov2)).toEqual([]);
  });

  it("keeps each app to its own updates", () => {
    const ids = updatesFor("dine", "2026-01-01T00:00:00.000Z", nov2).map((u) => u.id);
    expect(ids).toEqual(["dine-qr-sync"]);
  });

  it("flags only the tools of announced updates", () => {
    const nov4 = at("2026-11-04T00:00:00Z");
    expect(isNewPosTool("cash-book", nov4)).toBe(true);
    expect(isNewPosTool("supplier-ledger", nov4)).toBe(false);
    expect(isNewPosTool("accounts-payable-aging", nov4)).toBe(false);
    expect(isNewPosTool("expense-tracker", nov4)).toBe(false);
  });
});

describe("APP_UPDATES", () => {
  it("names only POS tools that exist", () => {
    const slugs = new Set(POS_TOOLS.map((tool) => tool.slug));
    for (const update of APP_UPDATES) {
      for (const feature of update.features ?? []) expect(slugs.has(feature), feature).toBe(true);
    }
  });

  it("has copy for every string it shows", () => {
    for (const update of APP_UPDATES) {
      for (const key of [update.title, update.body, update.cta]) expect(key in BASE_DICT, key).toBe(true);
    }
  });

  it("uses unique ids", () => {
    const ids = APP_UPDATES.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
