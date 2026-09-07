"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { useReviewPrompt } from "@/lib/hooks/useReviewPrompt";
import { ReviewPrompt } from "@/components/review/ReviewPrompt";

/**
 * Edits before a calculator counts as used.
 *
 * A calculator has no "submit" — it recomputes on every keystroke, so there is
 * no single moment to hang the ask on. Instead: enough edits that this is not
 * someone who touched one field and left, followed by a pause long enough that
 * they have stopped typing and are reading the answer.
 */
const EDITS_BEFORE_ASKING = 4;

/** How long the fields must sit still before the answer counts as read. */
const IDLE_MS = 2500;

/**
 * Wraps a calculator, and puts the review ask under it once the visitor has
 * actually worked through a number.
 *
 * Listening for edits bubbling out of the calculator is what lets this cover
 * every calculator on the site from one place. The alternative — each of the
 * thirty tools reporting its own "I have a result" — is the same prompt thirty
 * times over, and a new calculator would silently arrive without one.
 */
export function CalculatorReviewPrompt({ children }: { children: ReactNode }) {
  const { open, complete, accept, decline } = useReviewPrompt();

  const edits = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const asked = useRef(false);

  const onActivity = useCallback(() => {
    if (asked.current) return;

    edits.current += 1;
    if (edits.current < EDITS_BEFORE_ASKING) return;

    // Restart the clock on every edit: the ask belongs after the typing stops,
    // not in the middle of it.
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      asked.current = true;
      complete();
    }, IDLE_MS);
  }, [complete]);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return (
    <>
      {/* A listener on the wrapper, not on each field: React's synthetic input
          event bubbles, so this sees every number typed inside. */}
      <div onInput={onActivity}>{children}</div>

      <ReviewPrompt open={open} onAccept={accept} onDecline={decline} className="mt-6" />
    </>
  );
}
