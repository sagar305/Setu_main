"use client";

// The shorten flow behind a share sheet.
//
// The hook starts idle and only calls the service when `shorten` is invoked, so
// nothing is uploaded until something asks for it. Two things ask: the user
// pressing "Shorten", and — when they have turned the preference on — the share
// sheet itself, once per document. `auto` reports which regime is in force; the
// hook never shortens on its own.
//
// Any failure leaves the caller holding the long self-contained link, which
// always works.

import { useCallback, useEffect, useState } from "react";
import { getPreferences, PREFS_CHANGED_EVENT } from "@/lib/toolkit/preferences";
import {
  ShortenError,
  shortLinksConfigured,
  shortenPayload,
  type ShortenFailure,
  type ShortLinkKind,
} from "@/lib/toolkit/shortLink";

export type ShortenStatus = "idle" | "working" | "done" | "error";

export type UseShortenLink = {
  status: ShortenStatus;
  /** The short URL, once one exists. Null at every other moment. */
  shortUrl: string | null;
  failure: ShortenFailure | null;
  /** True when the user has this turned on and the site has it configured. */
  offered: boolean;
  /** True when the user asked for every share to be shortened without asking. */
  auto: boolean;
  shorten: (payload: string, kind?: ShortLinkKind) => Promise<void>;
  /** Drop the short URL — used when the document changes underneath it. */
  reset: () => void;
};

export function useShortenLink(): UseShortenLink {
  const [status, setStatus] = useState<ShortenStatus>("idle");
  const [shortUrl, setShortUrl] = useState<string | null>(null);
  const [failure, setFailure] = useState<ShortenFailure | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [autoPreference, setAutoPreference] = useState(false);

  // Read after mount only: the preference lives in localStorage, and reading it
  // during render would make the server and client markup disagree.
  useEffect(() => {
    const read = () => {
      const preferences = getPreferences();
      setEnabled(preferences.shortLinks);
      setAutoPreference(preferences.shortLinksAuto);
    };
    read();
    window.addEventListener(PREFS_CHANGED_EVENT, read);
    return () => window.removeEventListener(PREFS_CHANGED_EVENT, read);
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setShortUrl(null);
    setFailure(null);
  }, []);

  const shorten = useCallback(async (payload: string, kind: ShortLinkKind = "doc") => {
    setStatus("working");
    setFailure(null);
    try {
      const link = await shortenPayload(payload, kind);
      setShortUrl(link.url);
      setStatus("done");
    } catch (error) {
      setFailure(error instanceof ShortenError ? error.reason : "failed");
      setStatus("error");
    }
  }, []);

  return {
    status,
    shortUrl,
    failure,
    offered: enabled && shortLinksConfigured(),
    auto: enabled && autoPreference && shortLinksConfigured(),
    shorten,
    reset,
  };
}
