// ---------------------------------------------------------------------------
// Asking for a Google review, without becoming the thing people close.
//
// The ask only appears after someone has finished something real — an invoice
// downloaded, a bill charged, a calculation worked through — never on arrival
// and never mid-task. Once they answer, either way, they are never asked again:
// clicking through counts as done, and "no thanks" is permanent.
//
// The one case that repeats is the visitor who ignores the prompt entirely, by
// navigating away with it on screen. That is not an answer, so the ask comes
// back — but only after REVIEW_COOLDOWN_DAYS, and only on another completion.
//
// State lives in localStorage like everything else here: no login, nothing sent
// anywhere, and a visitor who clears site data simply starts over.
// ---------------------------------------------------------------------------

/** The business's Google review link. */
export const GOOGLE_REVIEW_URL = "https://g.page/r/CfC0VxfcEmG5EBM/review";

export const REVIEW_STORAGE_KEY = "setu.review.v1";

/** How long to wait before re-asking someone who neither accepted nor refused. */
export const REVIEW_COOLDOWN_DAYS = 45;

/**
 * Completions to bank before the first ask.
 *
 * One: the prompt follows the first finished piece of work, which is the moment
 * the tool has actually proved itself. Raising this delays every ask.
 */
export const REVIEW_MIN_COMPLETIONS = 1;

const DAY_MS = 24 * 60 * 60 * 1000;

export type ReviewState = {
  /** Pieces of finished work, across every tool, product and calculator. */
  completions: number;
  /** When the prompt was last put on screen. */
  lastShownAt: number | null;
  /** They opened the review link. Never ask again. */
  ratedAt: number | null;
  /** They declined. Never ask again. */
  dismissedAt: number | null;
};

export const EMPTY_REVIEW_STATE: ReviewState = {
  completions: 0,
  lastShownAt: null,
  ratedAt: null,
  dismissedAt: null,
};

/**
 * Whether to put the prompt on screen at `now`.
 *
 * Pure on purpose: the component passes the browser's clock in, and the tests
 * pass fixed dates.
 */
export function shouldAskForReview(state: ReviewState, now: number): boolean {
  // An answer, either way, is final.
  if (state.ratedAt !== null || state.dismissedAt !== null) return false;

  if (state.completions < REVIEW_MIN_COMPLETIONS) return false;

  if (state.lastShownAt !== null) {
    const waited = now - state.lastShownAt;
    // A clock that moved backwards (timezone change, a corrected device clock)
    // makes `waited` negative. Treat that as "not long enough" rather than
    // letting it read as an elapsed cooldown.
    if (waited < REVIEW_COOLDOWN_DAYS * DAY_MS) return false;
  }

  return true;
}

/**
 * Coerce whatever came out of storage into a state object.
 *
 * Anything unrecognised falls back to the empty state rather than throwing: a
 * half-written or hand-edited value must never break the page it sits on.
 */
export function parseReviewState(raw: string | null): ReviewState {
  if (!raw) return EMPTY_REVIEW_STATE;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return EMPTY_REVIEW_STATE;
  }

  if (typeof parsed !== "object" || parsed === null) return EMPTY_REVIEW_STATE;
  const value = parsed as Record<string, unknown>;

  const count = (input: unknown) =>
    typeof input === "number" && Number.isFinite(input) && input > 0 ? Math.floor(input) : 0;
  const stamp = (input: unknown) =>
    typeof input === "number" && Number.isFinite(input) ? input : null;

  return {
    completions: count(value.completions),
    lastShownAt: stamp(value.lastShownAt),
    ratedAt: stamp(value.ratedAt),
    dismissedAt: stamp(value.dismissedAt),
  };
}

/**
 * Read the stored state.
 *
 * Every accessor is wrapped: a private window, blocked site data, or a
 * thumbnailing context can throw on the property itself, not just on read.
 */
export function readReviewState(): ReviewState {
  if (typeof window === "undefined") return EMPTY_REVIEW_STATE;
  try {
    return parseReviewState(window.localStorage.getItem(REVIEW_STORAGE_KEY));
  } catch {
    return EMPTY_REVIEW_STATE;
  }
}

/** Persist the state, silently doing nothing where storage is unavailable. */
export function writeReviewState(state: ReviewState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Nothing here is worth breaking a checkout over.
  }
}
