// Cosine similarity, and the honest conversion of one into a score.
// ---------------------------------------------------------------------------
// Pure maths, no model. Kept out of the worker so it can be tested in Node,
// and so the one piece of this feature a CA might reasonably challenge — "where
// does 91% come from?" — is readable in isolation.

import { SCORE_CALIBRATION } from "@/lib/bankStatement/ai/config";
import type { CategoryProfile } from "@/lib/bankStatement/ai/categoryProfiles";

/**
 * Cosine similarity of two vectors. The model returns normalised embeddings, so
 * this is a dot product in practice, but the magnitudes are divided out anyway:
 * it costs nothing and it stops a change of pooling options from silently
 * inflating every score.
 */
export function cosineSimilarity(a: Float32Array | number[], b: Float32Array | number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

export type CategoryMatch = {
  categoryId: string;
  categoryName: string;
  /** Raw cosine similarity, 0–1. Reported as-is, never dressed up. */
  similarity: number;
};

export type ScoredMatch = {
  /** Undefined when no category was eligible at all. */
  best?: CategoryMatch;
  runnerUp?: CategoryMatch;
  /**
   * 0–100. A *model confidence score*, not a probability: see
   * SCORE_CALIBRATION for exactly how it is derived and why.
   */
  score: number;
};

/**
 * Compare one transaction embedding against every category embedding, and turn
 * the result into the number the table shows.
 *
 * Only categories that can appear on this side of the ledger are considered —
 * a debit is never scored against "Sales" — so the runner-up the margin is
 * measured against is a genuine rival, not an impossibility.
 */
export function scoreTransaction(
  transactionEmbedding: Float32Array,
  categoryEmbeddings: Map<string, Float32Array>,
  profiles: CategoryProfile[],
  direction: "DEBIT" | "CREDIT"
): ScoredMatch {
  const matches: CategoryMatch[] = [];

  for (const profile of profiles) {
    if (!profile.directions.includes(direction)) continue;
    const embedding = categoryEmbeddings.get(profile.id);
    if (!embedding) continue;
    matches.push({
      categoryId: profile.id,
      categoryName: profile.name,
      similarity: cosineSimilarity(transactionEmbedding, embedding),
    });
  }

  if (matches.length === 0) return { score: 0 };

  matches.sort((a, b) => b.similarity - a.similarity);
  const best = matches[0];
  const runnerUp = matches[1];

  return { best, runnerUp, score: calibrateScore(best.similarity, runnerUp?.similarity) };
}

/**
 * Blend "how close is the winner" with "how far ahead of the field is it",
 * and express the result out of 100.
 *
 * The second half is what stops a transaction that is vaguely near everything
 * from being reported as confidently near one thing.
 */
export function calibrateScore(topSimilarity: number, runnerUpSimilarity?: number): number {
  const { similarityFloor, similarityCeiling, marginSpan, absoluteWeight } = SCORE_CALIBRATION;

  const absolute = clamp01((topSimilarity - similarityFloor) / (similarityCeiling - similarityFloor));
  const margin =
    runnerUpSimilarity === undefined
      ? 1 // nothing to be confused with
      : clamp01((topSimilarity - runnerUpSimilarity) / marginSpan);

  const blended = absoluteWeight * absolute + (1 - absoluteWeight) * margin;
  return Math.round(clamp01(blended) * 100);
}

export type AiOutcome = "AUTO" | "REVIEW" | "NONE";

/** Which band a score falls in, given the CA's configured thresholds. */
export function outcomeFor(
  score: number,
  thresholds: { auto: number; review: number }
): AiOutcome {
  if (score >= thresholds.auto) return "AUTO";
  if (score >= thresholds.review) return "REVIEW";
  return "NONE";
}
