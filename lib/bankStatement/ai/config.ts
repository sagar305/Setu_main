// On-device AI categorisation — the knobs, in one place.
// ---------------------------------------------------------------------------
// Everything here is deliberately a constant rather than a magic number buried
// in the worker, because all of it has to be tuned against real statements once
// the feature meets one. Nothing in this file reaches the network by itself:
// the model identifier is only consulted when the CA asks for AI categorisation
// and the worker actually starts (see ./client.ts).

// The model, its repository and the device/precision order all live in
// ./models.ts now. They are deliberately not duplicated here: two places to
// name a model is one place to change it and still get the old one.

/** Transactions embedded per worker pass, between progress messages. */
export const EMBED_BATCH_SIZE = 32;

/**
 * Turning cosine similarity into the number the table shows.
 * ---------------------------------------------------------------------------
 * A cosine similarity is NOT a probability, and MiniLM does not produce one.
 * Two sentences about the same thing typically land around 0.45–0.70 rather
 * than 0.95, so printing the raw cosine as a percentage would read as though
 * the model were permanently unsure.
 *
 * So the score the UI shows is an explicit, documented blend of two things:
 *
 *   • how close the best category is in absolute terms, and
 *   • how far ahead of the runner-up it is.
 *
 * The second half matters: a transaction sitting 0.52 from "Travel" and 0.51
 * from "Office Expenses" has been recognised by nobody, however high 0.52 looks.
 *
 * The result is a *model confidence score*, and the UI says exactly that. It is
 * still not a calibrated probability, and this file is where you retune it.
 */
export const SCORE_CALIBRATION = {
  /** Cosine at or below this scores zero on the absolute half. */
  similarityFloor: 0.15,
  /** Cosine at or above this maxes out the absolute half. */
  similarityCeiling: 0.62,
  /** A lead of this much over the runner-up maxes out the margin half. */
  marginSpan: 0.14,
  /** How much of the score comes from absolute closeness vs the lead. */
  absoluteWeight: 0.75,
} as const;

/**
 * Defaults for the two thresholds the CA can change in Review → AI settings.
 * Expressed on the 0–100 score scale the rest of the tool already uses for
 * classification confidence.
 */
export const DEFAULT_AI_THRESHOLDS = {
  /** At or above this the category is applied outright. */
  auto: 85,
  /** At or above this it is applied but flagged for review. Below: left alone. */
  review: 70,
} as const;

/** localStorage key (within the tool's namespace) for learned corrections. */
export const LEARNED_KEY = "ai-learned";

/**
 * How many learned corrections to keep. Oldest-used are dropped first.
 *
 * Generous because these now live in IndexedDB rather than localStorage — the
 * old limit existed to protect a 5 MB quota, not because a CA stops being right
 * after four hundred corrections. Still bounded, so it cannot grow for ever.
 */
export const LEARNED_LIMIT = 5000;

/**
 * How many times a merchant must have been corrected the same way before the
 * learned answer is trusted ahead of the model. One correction is enough — the
 * CA typing a category *is* the ground truth — but the count is tracked so a
 * merchant the CA keeps changing their mind about does not thrash.
 */
export const LEARNED_MIN_COUNT = 1;

/**
 * Finding the categories the CA does not yet have.
 * ---------------------------------------------------------------------------
 * When the model declines to place a transaction, that is a signal in itself.
 * If several *different* merchants are all declined and all sit close to each
 * other in embedding space, they are one kind of spending the category list is
 * missing. These knobs decide how confident we have to be before saying so.
 */
export const CLUSTERING = {
  /**
   * How close two merchants must sit to be called the same kind of thing.
   * Higher means tighter, fewer, more obviously-related groups. This compares
   * two transaction sentences rather than a transaction and a category, so it
   * runs higher than the classification thresholds — the same phrasing on both
   * sides scores better than prose against a category description.
   */
  similarity: 0.55,
  /**
   * Distinct merchants needed before a group is worth proposing. Two merchants
   * that happen to look alike are a coincidence; three are a pattern, and a
   * category the CA has to name and maintain should clear a real bar.
   */
  minMerchants: 3,
  /** Never propose more than this at once — nobody wants ten new categories. */
  maxSuggestions: 3,
} as const;
