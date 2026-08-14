// Grouping the transactions nothing could categorise.
// ---------------------------------------------------------------------------
// The model declining to place a transaction is usually read as a failure. It
// is also evidence: if six *different* merchants are all declined and all sit
// close to one another, they are one kind of spending the category list does
// not cover. That is a category worth proposing, and it is a plain clustering
// problem over embeddings we have already computed.
//
// Pure maths — no model, no DOM. The worker calls it; the tests call it too.

import { cosineSimilarity } from "@/lib/bankStatement/ai/scoring";

export type Clusterable = {
  /** Merchant key — one entry per distinct merchant, never per transaction. */
  key: string;
  embedding: Float32Array;
};

/**
 * Leader clustering: walk the items once, and put each into the existing
 * cluster whose centre it is closest to, provided it is close enough.
 * Otherwise it starts a cluster of its own.
 *
 * Chosen over single-link agglomerative clustering on purpose. Single-link
 * chains — A resembles B, B resembles C, so A and C end up in one group even
 * when they have nothing to do with each other — and a chained group produces
 * exactly the sort of incoherent category suggestion that would teach a CA to
 * ignore this feature. Comparing against the running centre keeps a group
 * about one thing.
 *
 * Deterministic: the input is sorted by key first, so the same statement always
 * produces the same groups.
 */
export function clusterByMeaning(items: Clusterable[], threshold: number): string[][] {
  const ordered = [...items].sort((a, b) => a.key.localeCompare(b.key));

  const clusters: { keys: string[]; centroid: Float32Array }[] = [];

  for (const item of ordered) {
    let bestIndex = -1;
    let bestSimilarity = threshold;

    for (let i = 0; i < clusters.length; i += 1) {
      const similarity = cosineSimilarity(item.embedding, clusters[i].centroid);
      if (similarity >= bestSimilarity) {
        bestSimilarity = similarity;
        bestIndex = i;
      }
    }

    if (bestIndex === -1) {
      clusters.push({ keys: [item.key], centroid: Float32Array.from(item.embedding) });
      continue;
    }

    const cluster = clusters[bestIndex];
    cluster.centroid = recentre(cluster.centroid, cluster.keys.length, item.embedding);
    cluster.keys.push(item.key);
  }

  // Biggest first: the group covering the most merchants is the most useful
  // category to be told about.
  return clusters.map((cluster) => cluster.keys).sort((a, b) => b.length - a.length);
}

/**
 * Fold one more member into a centre and renormalise.
 *
 * The embeddings arrive unit length, so the mean of several is not — and
 * cosine similarity against a shrinking vector would drift as a cluster grows.
 * Renormalising keeps the threshold meaning the same thing for a cluster of two
 * and a cluster of twenty.
 */
function recentre(centroid: Float32Array, count: number, addition: Float32Array): Float32Array {
  const next = new Float32Array(centroid.length);
  let norm = 0;

  for (let i = 0; i < centroid.length; i += 1) {
    const value = (centroid[i] * count + addition[i]) / (count + 1);
    next[i] = value;
    norm += value * value;
  }

  if (norm === 0) return next;
  const length = Math.sqrt(norm);
  for (let i = 0; i < next.length; i += 1) next[i] /= length;
  return next;
}

/**
 * The groups worth showing: large enough to be a pattern rather than a
 * coincidence, and capped so the CA is never handed a list of new categories
 * to maintain.
 */
export function significantClusters(
  clusters: string[][],
  minMerchants: number,
  maxSuggestions: number
): string[][] {
  return clusters.filter((cluster) => cluster.length >= minMerchants).slice(0, maxSuggestions);
}
