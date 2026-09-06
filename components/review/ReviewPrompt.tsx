"use client";

import { useEffect } from "react";
import { Star, X } from "lucide-react";
import { GOOGLE_REVIEW_URL } from "@/lib/review";

const HEADLINE = "Did this help?";
const BODY =
  "Setu's tools are free and always will be. A quick Google review is how other business owners find them.";

function ReviewActions({
  onAccept,
  onDecline,
  declineLabel,
}: {
  onAccept: () => void;
  onDecline: () => void;
  declineLabel: string;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <a
        href={GOOGLE_REVIEW_URL}
        target="_blank"
        rel="noreferrer"
        onClick={onAccept}
        className="inline-flex items-center gap-2 rounded-full bg-indigo px-5 py-2.5 text-sm font-semibold text-cream-paper transition hover:bg-ink"
      >
        <Star className="h-4 w-4" aria-hidden="true" />
        Review us on Google
      </a>
      <button
        type="button"
        onClick={onDecline}
        className="rounded-full px-4 py-2.5 text-sm font-semibold text-muted transition hover:text-ink"
      >
        {declineLabel}
      </button>
    </div>
  );
}

/**
 * The inline ask, for a page the visitor is still reading — under a calculator's
 * result, or under a tool once it has produced its file. It takes its place in
 * the flow rather than covering anything, so an ignored prompt costs nothing.
 */
export function ReviewPrompt({
  open,
  onAccept,
  onDecline,
  className = "",
}: {
  open: boolean;
  onAccept: () => void;
  onDecline: () => void;
  className?: string;
}) {
  if (!open) return null;

  return (
    <div
      className={`rounded-2xl border border-indigo/15 bg-white p-5 shadow-sm sm:p-6 ${className}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-ink">{HEADLINE}</h2>
          <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-muted">{BODY}</p>
        </div>
        <button
          type="button"
          onClick={onDecline}
          aria-label="Dismiss the review request"
          className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-cream hover:text-ink"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <ReviewActions onAccept={onAccept} onDecline={onDecline} declineLabel="No thanks" />
    </div>
  );
}

/**
 * The same ask as a dialog, for the apps — where finishing a bill or a job card
 * leaves the visitor on a screen that is about to be cleared for the next one,
 * so an inline card underneath would never be seen.
 *
 * Escape and a click on the backdrop both decline, because a prompt that traps
 * someone mid-shift is worse than never asking.
 */
export function ReviewPromptDialog({
  open,
  onAccept,
  onDecline,
}: {
  open: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDecline();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onDecline]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-ink/40 p-4 sm:items-center"
      onClick={(event) => {
        if (event.target === event.currentTarget) onDecline();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-prompt-title"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-saffron/20 text-ink">
              <Star className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 id="review-prompt-title" className="text-lg font-bold text-ink">
              {HEADLINE}
            </h2>
          </div>
          <button
            type="button"
            onClick={onDecline}
            aria-label="Dismiss the review request"
            className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-cream hover:text-ink"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-muted">{BODY}</p>

        <ReviewActions
          onAccept={onAccept}
          onDecline={onDecline}
          declineLabel="Maybe later"
        />
      </div>
    </div>
  );
}
