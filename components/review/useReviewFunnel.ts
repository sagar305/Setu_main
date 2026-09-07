"use client";

// ---------------------------------------------------------------------------
// Measuring the Google review ask.
//
// A bare count of clicks on the review button would be close to meaningless.
// lib/review.ts shows the prompt only after a completion, at most once per
// visitor, with a 45-day cooldown for anyone who ignores it — so the click
// total mostly tracks how often the prompt was *shown*. It would rise because
// a tool got more traffic and fall because it got less, and say nothing about
// whether the ask itself works.
//
// So the whole funnel is recorded: shown, clicked, declined. Clicks over
// shows is the number that means something, and `surface` says which tool
// earned them.
//
// Two limits worth being honest about, because no dashboard will show them:
// a click is not a review — Google offers no callback, so this measures
// "opened the review link" and nothing further — and a click still counts when
// the popup was blocked.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { trackEvent } from "@/lib/analytics";
import { gaEvent } from "@/lib/analytics/ga";

export type ReviewVariant = "inline" | "dialog";
export type DeclineMethod = "button" | "close_x" | "escape" | "backdrop";

export function useReviewFunnel(open: boolean, variant: ReviewVariant) {
  const pathname = usePathname();
  const shownAt = useRef<number | null>(null);

  // The surface is the route, which means every calculator and every tool
  // reports itself correctly without a prop threaded through ten call sites —
  // and a tool added later is covered the day it ships.
  const surface = pathname ?? "unknown";

  useEffect(() => {
    if (!open) {
      shownAt.current = null;
      return;
    }
    shownAt.current = Date.now();
    trackEvent("review_prompt_shown", { surface, variant });
  }, [open, surface, variant]);

  const secondsSinceShown = useCallback(() => {
    if (shownAt.current === null) return 0;
    return Math.max(0, Math.round((Date.now() - shownAt.current) / 1000));
  }, []);

  const trackAccept = useCallback(() => {
    const props = { surface, variant, secondsSinceShown: secondsSinceShown() };
    trackEvent("review_google_clicked", props);
    // Mirrored into GA4: this is a conversion, and it is the one event worth
    // being able to see next to the traffic history already held there.
    gaEvent("review_google_clicked", props);
  }, [surface, variant, secondsSinceShown]);

  const trackDecline = useCallback(
    (method: DeclineMethod) => {
      trackEvent("review_prompt_declined", {
        surface,
        variant,
        method,
        secondsSinceShown: secondsSinceShown(),
      });
    },
    [surface, variant, secondsSinceShown]
  );

  return { trackAccept, trackDecline };
}
