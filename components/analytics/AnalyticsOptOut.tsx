"use client";

// The opt-out control the privacy page promises.
//
// It is a real switch, not a notice: turning it off stops `trackEvent` at the
// door and empties anything already queued on the device.

import { useEffect, useState } from "react";
import { hasOptedOut, setOptedOut } from "@/lib/analytics";

export function AnalyticsOptOut() {
  // Read on mount rather than during render: the server has no localStorage,
  // so anything else would make the markup disagree with itself on hydration.
  const [optedOut, setOptedOutState] = useState<boolean | null>(null);

  useEffect(() => {
    setOptedOutState(hasOptedOut());
  }, []);

  if (optedOut === null) return null;

  return (
    <div className="rounded-2xl border border-indigo/15 bg-white p-5 sm:p-6">
      <p className="text-sm font-semibold text-ink">
        {optedOut ? "You are not being counted" : "You are being counted"}
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">
        {optedOut
          ? "This browser is excluded from our usage measurement. Nothing about your visits is recorded."
          : "We record which pages are opened and which buttons are used, so we know which tools are worth building on. Never what you type into them."}
      </p>
      <button
        type="button"
        onClick={() => {
          const next = !optedOut;
          setOptedOut(next);
          setOptedOutState(next);
        }}
        className="mt-4 rounded-full bg-indigo px-5 py-2.5 text-sm font-semibold text-cream-paper transition hover:bg-ink"
      >
        {optedOut ? "Start counting my visits" : "Stop counting my visits"}
      </button>
      <p className="mt-3 text-xs text-muted">
        The setting is stored in this browser. Clearing your site data resets it, and other
        browsers or devices are set separately.
      </p>
    </div>
  );
}
