"use client";

import { useCallback, useState } from "react";
import {
  EMPTY_REVIEW_STATE,
  readReviewState,
  shouldAskForReview,
  writeReviewState,
  type ReviewState,
} from "@/lib/review";

export type ReviewPromptController = {
  /** Whether the prompt should currently be on screen. */
  open: boolean;
  /**
   * Call when the visitor finishes something: an invoice downloaded, a bill
   * charged, a job delivered. Banks the completion and opens the prompt if the
   * rules in lib/review allow it. Safe to call more than once for one piece of
   * work — see `once`.
   */
  complete: () => void;
  /** They opened the review link. */
  accept: () => void;
  /** They declined, or closed it. */
  decline: () => void;
};

/**
 * Drives one review prompt.
 *
 * Reading storage lazily inside `complete` rather than on mount keeps the hook
 * out of hydration: the server and the first client render both show nothing,
 * and the prompt can only appear in response to something the visitor did.
 */
export function useReviewPrompt(): ReviewPromptController {
  const [open, setOpen] = useState(false);

  const update = useCallback((change: (state: ReviewState) => ReviewState) => {
    const next = change(readReviewState());
    writeReviewState(next);
    return next;
  }, []);

  const complete = useCallback(() => {
    // Already asking — a second completion should not re-bank or re-open.
    if (open) return;

    const next = update((state) => ({ ...state, completions: state.completions + 1 }));
    if (!shouldAskForReview(next, Date.now())) return;

    writeReviewState({ ...next, lastShownAt: Date.now() });
    setOpen(true);
  }, [open, update]);

  const accept = useCallback(() => {
    update((state) => ({ ...state, ratedAt: Date.now() }));
    setOpen(false);
  }, [update]);

  const decline = useCallback(() => {
    update((state) => ({ ...state, dismissedAt: Date.now() }));
    setOpen(false);
  }, [update]);

  return { open, complete, accept, decline };
}

/** The state a fresh visitor has, exported for tests and stories. */
export { EMPTY_REVIEW_STATE };
