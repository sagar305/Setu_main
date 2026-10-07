import { describe, expect, it } from "vitest";

import { LANGUAGES, type LanguageCode } from "@/lib/i18n/config";
import { docTitle, type SharedDoc } from "@/lib/toolkit/shareLink";

const business = { n: "Shop", cur: "INR" } as SharedDoc["b"];

/**
 * docTitle is read by both sides of a share — the sender composing the message
 * and the recipient opening the page — so each has to get it in their own
 * language. Every document kind is listed here, because a kind that falls
 * through to English is one whole category of shared document arriving in the
 * wrong language.
 */
const DOCS: SharedDoc[] = [
  { t: "inv", b: business, no: "INV-1", it: [], sub: 0, tot: 0 } as SharedDoc,
  { t: "quo", b: business, no: "QUO-1", it: [], sub: 0, tot: 0 } as SharedDoc,
  { t: "led", b: business, cn: "A", bal: 0 } as SharedDoc,
  { t: "apt", b: business, cn: "A", svc: "S", dt: "2026-01-01", tm: "10:00" } as SharedDoc,
  { t: "fee", b: business, no: "F-1", sn: "A", amt: 0 } as SharedDoc,
  { t: "mrk", b: business, sn: "A", tn: "T", mk: 1, max: 10 } as SharedDoc,
  { t: "att", b: business, sn: "A", pd: "Aug", prs: 1, tot: 2, pct: 50 } as SharedDoc,
  { t: "rx", b: business, pn: "A", med: [] } as SharedDoc,
  { t: "rnt", b: business, no: "R-1", st: "confirmed", it: [], sub: 0, tot: 0 } as SharedDoc,
];

describe("docTitle", () => {
  it("names every document kind in English", () => {
    for (const doc of DOCS) {
      expect(docTitle(doc)).toBeTruthy();
    }
  });

  it.each(LANGUAGES.map((l) => l.code).filter((code) => code !== "en"))(
    "names every document kind in %s, not in English",
    (code) => {
      for (const doc of DOCS) {
        expect(docTitle(doc, code as LanguageCode)).not.toBe(docTitle(doc));
      }
    },
  );

  it("keeps the document number in the title", () => {
    // The number is how a sender and a recipient refer to the same document,
    // so a translation must not drop it.
    for (const code of LANGUAGES.map((l) => l.code)) {
      expect(docTitle(DOCS[0], code as LanguageCode)).toContain("INV-1");
      expect(docTitle(DOCS[4], code as LanguageCode)).toContain("F-1");
    }
  });

  it("distinguishes the rental reminders from the booking itself", () => {
    const booking = DOCS[8];
    const overdue = { ...booking, rm: { k: "overdue" as const } };
    const returnDue = { ...booking, rm: { k: "returnDue" as const } };
    const dispatch = { ...booking, rm: { k: "dispatch" as const } };
    for (const code of LANGUAGES.map((l) => l.code) as LanguageCode[]) {
      const titles = [booking, overdue, returnDue, dispatch].map((d) => docTitle(d, code));
      expect(new Set(titles).size).toBe(4);
    }
  });
});
