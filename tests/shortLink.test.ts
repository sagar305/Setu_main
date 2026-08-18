// The client half of short links: URL shapes, code validation, and the rule
// that nothing is uploaded unless it was asked for.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isShortCode,
  shortDocUrl,
  shortMenuUrl,
  ShortenError,
  shortenPayload,
  shortLinksConfigured,
} from "@/lib/toolkit/shortLink";
import { decodeDoc, encodeDoc, type SharedPrescription } from "@/lib/toolkit/shareLink";

const ORIGIN = "https://setutechnology.com";

describe("short URL shapes", () => {
  it("puts a document at /view/<code>", () => {
    expect(shortDocUrl("aB3xK9mQ2p", ORIGIN)).toBe("https://setutechnology.com/view/aB3xK9mQ2p");
  });

  it("puts a published menu at /menu/<code>", () => {
    expect(shortMenuUrl("aB3xK9mQ2p", ORIGIN)).toBe("https://setutechnology.com/menu/aB3xK9mQ2p");
  });
});

describe("code validation", () => {
  it("accepts exactly ten alphanumeric characters", () => {
    expect(isShortCode("aB3xK9mQ2p")).toBe(true);
    expect(isShortCode("0000000000")).toBe(true);
  });

  it("rejects anything else", () => {
    for (const bad of ["short", "elevenchars", "has-dash12", "with space", ""]) {
      expect(isShortCode(bad), bad).toBe(false);
    }
  });
});

describe("shortening is opt-in", () => {
  const original = process.env.NEXT_PUBLIC_SHORT_LINKS_ENABLED;

  afterEach(() => {
    process.env.NEXT_PUBLIC_SHORT_LINKS_ENABLED = original;
    vi.unstubAllGlobals();
  });

  it("reports itself unconfigured when the flag is absent", () => {
    delete process.env.NEXT_PUBLIC_SHORT_LINKS_ENABLED;
    expect(shortLinksConfigured()).toBe(false);
  });

  it("refuses to call out at all when unconfigured", async () => {
    delete process.env.NEXT_PUBLIC_SHORT_LINKS_ENABLED;
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await expect(shortenPayload("anything", "doc")).rejects.toMatchObject({
      reason: "unavailable",
    });
    // The point of the check: an unconfigured site must not leak a document to
    // a URL that happens to 404.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("reports offline without calling out", async () => {
    process.env.NEXT_PUBLIC_SHORT_LINKS_ENABLED = "true";
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubGlobal("navigator", { onLine: false });

    await expect(shortenPayload("anything", "doc")).rejects.toMatchObject({ reason: "offline" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("turns a transport failure into a retryable ShortenError", async () => {
    process.env.NEXT_PUBLIC_SHORT_LINKS_ENABLED = "true";
    vi.stubGlobal("navigator", { onLine: true });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network")));

    const error = await shortenPayload("payload", "doc").catch((e) => e);
    expect(error).toBeInstanceOf(ShortenError);
    expect(error.reason).toBe("failed");
  });

  it("posts the payload and returns the link when it works", async () => {
    process.env.NEXT_PUBLIC_SHORT_LINKS_ENABLED = "true";
    vi.stubGlobal("navigator", { onLine: true });
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: "aB3xK9mQ2p",
        url: `${ORIGIN}/view/aB3xK9mQ2p`,
        expiresAt: "2027-02-14T00:00:00.000Z",
      }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    const link = await shortenPayload("compressed", "doc");

    expect(link.code).toBe("aB3xK9mQ2p");
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("/api/short");
    expect(JSON.parse(init.body)).toEqual({ payload: "compressed", kind: "doc" });
  });
});

describe("a stored payload decodes exactly like a fragment", () => {
  // The service stores the same string the fragment carried, so the viewer runs
  // one decoder for both link shapes.
  it("round-trips a prescription", () => {
    const doc: SharedPrescription = {
      t: "rx",
      b: { n: "Sharma Clinic", cur: "INR" },
      pn: "Anita Verma",
      dt: "2026-08-18",
      dr: "Dr R Sharma",
      reg: "MH-12345",
      dx: "Viral fever",
      alg: ["Penicillin"],
      med: [{ n: "TAB Paracetamol 500mg", f: "1-0-1", d: "5 days", nt: "After food" }],
      fu: 5,
    };

    const decoded = decodeDoc(encodeDoc(doc));

    expect(decoded).toEqual(doc);
  });
});
