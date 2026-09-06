// When the Google review prompt is allowed on screen, and what a visitor's
// answer costs them — the whole point being that it is asked rarely and,
// once answered, never again.

import { describe, expect, it } from "vitest";
import {
  EMPTY_REVIEW_STATE,
  REVIEW_COOLDOWN_DAYS,
  parseReviewState,
  shouldAskForReview,
  type ReviewState,
} from "@/lib/review";

const NOW = Date.parse("2026-09-06T12:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;

const state = (over: Partial<ReviewState> = {}): ReviewState => ({
  ...EMPTY_REVIEW_STATE,
  ...over,
});

describe("before anything has been finished", () => {
  it("never asks a visitor who has just arrived", () => {
    expect(shouldAskForReview(EMPTY_REVIEW_STATE, NOW)).toBe(false);
  });
});

describe("after a completion", () => {
  it("asks once the first piece of work is done", () => {
    expect(shouldAskForReview(state({ completions: 1 }), NOW)).toBe(true);
  });

  it("keeps asking a visitor who has never been shown it", () => {
    expect(shouldAskForReview(state({ completions: 9 }), NOW)).toBe(true);
  });
});

describe("once the visitor has answered", () => {
  it("never asks again after they open the review link", () => {
    expect(shouldAskForReview(state({ completions: 5, ratedAt: NOW - DAY_MS }), NOW)).toBe(false);
  });

  it("never asks again after they decline", () => {
    expect(shouldAskForReview(state({ completions: 5, dismissedAt: NOW - DAY_MS }), NOW)).toBe(
      false,
    );
  });

  it("still refuses years later — an answer does not expire", () => {
    const answered = state({ completions: 99, dismissedAt: NOW - 900 * DAY_MS });
    expect(shouldAskForReview(answered, NOW)).toBe(false);
  });
});

describe("the cooldown, for a prompt that was ignored rather than answered", () => {
  it("stays quiet inside the window", () => {
    const shown = state({ completions: 4, lastShownAt: NOW - 3 * DAY_MS });
    expect(shouldAskForReview(shown, NOW)).toBe(false);
  });

  it("stays quiet right up to the boundary", () => {
    const shown = state({
      completions: 4,
      lastShownAt: NOW - (REVIEW_COOLDOWN_DAYS * DAY_MS - 1),
    });
    expect(shouldAskForReview(shown, NOW)).toBe(false);
  });

  it("asks again once the window has passed", () => {
    const shown = state({ completions: 4, lastShownAt: NOW - REVIEW_COOLDOWN_DAYS * DAY_MS });
    expect(shouldAskForReview(shown, NOW)).toBe(true);
  });

  it("treats a clock that jumped backwards as time not yet served", () => {
    // A device whose clock was corrected, or a timezone change, can put the
    // last-shown stamp in the future. That must not read as an elapsed
    // cooldown and let the prompt through on the next completion.
    const shown = state({ completions: 4, lastShownAt: NOW + 30 * DAY_MS });
    expect(shouldAskForReview(shown, NOW)).toBe(false);
  });
});

describe("reading whatever is in storage", () => {
  it("treats a missing value as a fresh visitor", () => {
    expect(parseReviewState(null)).toEqual(EMPTY_REVIEW_STATE);
  });

  it("survives a half-written value", () => {
    expect(parseReviewState('{"completions":')).toEqual(EMPTY_REVIEW_STATE);
  });

  it("survives a value that is not an object", () => {
    expect(parseReviewState('"nope"')).toEqual(EMPTY_REVIEW_STATE);
    expect(parseReviewState("null")).toEqual(EMPTY_REVIEW_STATE);
  });

  it("drops fields of the wrong type rather than trusting them", () => {
    const parsed = parseReviewState(
      '{"completions":"lots","lastShownAt":"yesterday","ratedAt":{},"dismissedAt":[]}',
    );
    expect(parsed).toEqual(EMPTY_REVIEW_STATE);
  });

  it("refuses a negative completion count", () => {
    expect(parseReviewState('{"completions":-5}').completions).toBe(0);
  });

  it("keeps a well-formed value", () => {
    const parsed = parseReviewState(
      JSON.stringify({ completions: 3, lastShownAt: NOW, ratedAt: null, dismissedAt: null }),
    );
    expect(parsed).toEqual(state({ completions: 3, lastShownAt: NOW }));
  });

  it("does not let a hand-edited value re-open an answered prompt", () => {
    const parsed = parseReviewState(JSON.stringify({ completions: 3, dismissedAt: NOW }));
    expect(shouldAskForReview(parsed, NOW + 900 * DAY_MS)).toBe(false);
  });
});
