// On-device AI categorisation — the knobs, in one place.
// ---------------------------------------------------------------------------
// Everything here is deliberately a constant rather than a magic number buried
// in the worker, because all of it has to be tuned against real statements once
// the feature meets one. Nothing in this file reaches the network by itself:
// the model identifier is only consulted when the CA asks for AI categorisation
// and the worker actually starts (see ./client.ts).

/**
 * Sentence-embedding model. Small on purpose — 6 layers, 384 dimensions, a few
 * tens of MB quantised. It is used to *compare* meanings, never to generate
 * text, so nothing it could hallucinate can reach a category.
 */
export const MODEL_ID = "Xenova/all-MiniLM-L6-v2";

/**
 * Device/precision candidates, best first. The worker walks this list and keeps
 * the first combination that loads, so a browser without WebGPU — or a model
 * repository that never published a q4 file — degrades instead of failing.
 *
 * q4 is preferred for download size (roughly half of q8). It is also the
 * lossiest: if real statements show the score separating categories poorly,
 * moving q8 to the front of this list is the first thing to try.
 */
export const BACKEND_CANDIDATES: { device: "webgpu" | "wasm"; dtype: "q4f16" | "q4" | "q8" | "fp32" }[] = [
  { device: "webgpu", dtype: "q4f16" },
  { device: "webgpu", dtype: "q4" },
  { device: "webgpu", dtype: "q8" },
  { device: "wasm", dtype: "q4" },
  { device: "wasm", dtype: "q8" },
  { device: "wasm", dtype: "fp32" },
];

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

/** How many learned corrections to keep. Oldest-used are dropped first. */
export const LEARNED_LIMIT = 400;

/**
 * How many times a merchant must have been corrected the same way before the
 * learned answer is trusted ahead of the model. One correction is enough — the
 * CA typing a category *is* the ground truth — but the count is tracked so a
 * merchant the CA keeps changing their mind about does not thrash.
 */
export const LEARNED_MIN_COUNT = 1;
