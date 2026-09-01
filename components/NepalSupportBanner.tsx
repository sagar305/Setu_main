"use client";

// Solidarity banner for the August 2026 Bhote Koshi / Rasuwa flood in Nepal.
//
// The donation link points at the Government of Nepal's Prime Minister
// Disaster Relief Fund portal, which accepts domestic and international cards
// as well as NEPALPAY QR, connectIPS and wallets. Nepal Police has warned about
// fake relief QR codes and phishing pages, so only ever link the government
// portal here — never a third-party collection page.
//
// This is a time-bound banner: remove it (and its render in app/layout.tsx)
// once the relief appeal closes.

import { useEffect, useState } from "react";
import { Heart, X } from "lucide-react";

const DONATE_URL = "https://pmdrf.nchl.com.np/";
const DISMISS_KEY = "setu.nepal-relief-banner.dismissed";

export function NepalSupportBanner() {
  // Render nothing until mount so the server HTML and the first client render
  // agree — the dismissal only exists in localStorage.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(DISMISS_KEY) !== "1") setVisible(true);
    } catch {
      // Private mode / storage blocked: still show the banner.
      setVisible(true);
    }
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Nothing to persist to — the banner returns on the next page load.
    }
  }

  if (!visible) return null;

  return (
    <aside
      aria-label="Nepal flood relief"
      className="relative z-[60] bg-indigo text-cream-paper"
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-2.5 pr-12 sm:pr-14">
        <Heart className="hidden h-4 w-4 shrink-0 text-saffron sm:block" aria-hidden="true" />
        <p className="text-xs leading-relaxed sm:text-sm">
          <span className="font-semibold">We stand with Nepal.</span>{" "}
          <span className="text-cream-paper/85">
            Our thoughts are with everyone affected by the floods.
          </span>{" "}
          <a
            href={DONATE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="whitespace-nowrap font-semibold text-saffron underline underline-offset-4 transition hover:brightness-110"
          >
            Donate to the PM Disaster Relief Fund →
          </a>
        </p>
      </div>

      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss Nepal relief banner"
        className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-cream-paper/70 transition hover:bg-white/10 hover:text-cream-paper"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </aside>
  );
}
