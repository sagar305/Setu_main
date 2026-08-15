// Deciding between models with evidence instead of opinion.
// ---------------------------------------------------------------------------
// "Newer" is not "better on Indian bank narrations". The only way to know
// whether mxbai-embed-xsmall-v1 beats MiniLM on this data is to run the same
// labelled transactions through both and compare, which is what this does.
//
// It reuses the real pipeline end to end — the same normalisation, the same
// category profiles, the same scoring, the same thresholds — so a result here
// means what it says. Only the provider is swapped.
//
// DEVELOPMENT ONLY. Nothing imports this from the application; it is reached
// from the dev-only benchmark page, which is why the model comparison never
// costs a user a byte. It is deliberately not wired into any UI a CA can see.

import { buildCategoryProfiles, type CategoryProfile } from "@/lib/bankStatement/ai/categoryProfiles";
import { narrationToSentence } from "@/lib/bankStatement/ai/narration";
import { outcomeFor, scoreTransaction } from "@/lib/bankStatement/ai/scoring";
import {
  TransformersEmbeddingProvider,
  type EmbeddingProvider,
  type ModelInfo,
} from "@/lib/bankStatement/ai/embeddingProvider";
import { EMBEDDING_MODELS, type EmbeddingModelId } from "@/lib/bankStatement/ai/models";
import { DEFAULT_AI_THRESHOLDS } from "@/lib/bankStatement/ai/config";
import { defaultCategories } from "@/lib/bankStatement/classification/categories";
import type { Category, TransactionType } from "@/lib/bankStatement/types";

/**
 * One labelled example. `expected` is a category id, and the label is the
 * judgement of whoever prepared the set — a CA, ideally, over real narrations
 * with the names removed.
 */
export type LabelledTransaction = {
  narration: string;
  direction: TransactionType;
  expected: string;
};

export type BenchmarkResult = {
  model: EmbeddingModelId;
  info: ModelInfo;

  /** Share of examples whose top category was the labelled one, 0–1. */
  accuracy: number;
  /** Accuracy counting only examples the thresholds would have acted on. */
  accuracyWhenActed: number;
  /** Share the thresholds declined to categorise at all. */
  abstained: number;

  /** Milliseconds to a working model, including download on a cold cache. */
  initialiseMs: number;
  /** Milliseconds to embed every category description once. */
  categoryEmbeddingMs: number;
  /** Milliseconds to embed the whole labelled set in batches. */
  batchEmbeddingMs: number;
  /** batchEmbeddingMs divided by the number of examples. */
  perTransactionMs: number;

  /** Bytes the model downloaded, when the runtime reported it. */
  downloadedBytes?: number;
  /** JS heap growth across the run, where the browser exposes it. */
  heapGrowthBytes?: number;

  /** Calibrated score distribution, to see where the thresholds should sit. */
  scoreDistribution: { band: string; count: number }[];
  /** Raw cosine of the winning category, averaged. */
  meanTopSimilarity: number;

  /** Every example that came out wrong, for reading afterwards. */
  mistakes: { narration: string; expected: string; got?: string; score: number }[];
};

function heapUsed(): number | undefined {
  const memory = (performance as { memory?: { usedJSHeapSize?: number } }).memory;
  return memory?.usedJSHeapSize;
}

/** Run one model over the labelled set. */
export async function benchmarkModel(
  model: EmbeddingModelId,
  dataset: LabelledTransaction[],
  options: { categories?: Category[]; thresholds?: { auto: number; review: number } } = {}
): Promise<BenchmarkResult> {
  const categories = options.categories ?? defaultCategories();
  const thresholds = options.thresholds ?? DEFAULT_AI_THRESHOLDS;
  const profiles: CategoryProfile[] = buildCategoryProfiles(categories);

  let downloadedBytes = 0;
  const heapBefore = heapUsed();

  const provider: EmbeddingProvider = new TransformersEmbeddingProvider({
    model,
    // Force the same conditions for both models, or the comparison measures the
    // device policy rather than the models.
    expectedBatchSize: Number.MAX_SAFE_INTEGER,
    onProgress: (event) => {
      if (event.status === "done" && event.total) downloadedBytes += event.total;
    },
  });

  const initialiseStart = performance.now();
  await provider.initialize();
  const initialiseMs = performance.now() - initialiseStart;

  const categoryStart = performance.now();
  const categoryVectors = await provider.embed(profiles.map((profile) => profile.text));
  const categoryEmbeddingMs = performance.now() - categoryStart;

  const categoryEmbeddings = new Map<string, Float32Array>();
  profiles.forEach((profile, index) => categoryEmbeddings.set(profile.id, categoryVectors[index]));

  // The same sentences the real pipeline would produce — normalisation included,
  // because that is a large part of what makes a narration comparable at all.
  const sentences = dataset.map((entry) => narrationToSentence(entry.narration, entry.direction));

  const batchStart = performance.now();
  const vectors = await provider.embed(sentences);
  const batchEmbeddingMs = performance.now() - batchStart;

  let correct = 0;
  let acted = 0;
  let correctWhenActed = 0;
  let abstained = 0;
  let similaritySum = 0;
  const bands = new Map<string, number>();
  const mistakes: BenchmarkResult["mistakes"] = [];

  dataset.forEach((entry, index) => {
    const scored = scoreTransaction(
      vectors[index],
      categoryEmbeddings,
      profiles,
      entry.direction
    );
    const outcome = outcomeFor(scored.score, thresholds);
    const got = scored.best?.categoryId;

    similaritySum += scored.best?.similarity ?? 0;

    const band = `${Math.floor(scored.score / 10) * 10}-${Math.floor(scored.score / 10) * 10 + 9}`;
    bands.set(band, (bands.get(band) ?? 0) + 1);

    if (got === entry.expected) correct += 1;
    else mistakes.push({ narration: entry.narration, expected: entry.expected, got, score: scored.score });

    if (outcome === "NONE") {
      abstained += 1;
    } else {
      acted += 1;
      if (got === entry.expected) correctWhenActed += 1;
    }
  });

  const heapAfter = heapUsed();

  return {
    model,
    info: provider.getModelInfo(),
    accuracy: dataset.length === 0 ? 0 : correct / dataset.length,
    accuracyWhenActed: acted === 0 ? 0 : correctWhenActed / acted,
    abstained: dataset.length === 0 ? 0 : abstained / dataset.length,
    initialiseMs,
    categoryEmbeddingMs,
    batchEmbeddingMs,
    perTransactionMs: dataset.length === 0 ? 0 : batchEmbeddingMs / dataset.length,
    downloadedBytes: downloadedBytes > 0 ? downloadedBytes : undefined,
    heapGrowthBytes:
      heapBefore !== undefined && heapAfter !== undefined ? heapAfter - heapBefore : undefined,
    scoreDistribution: [...bands.entries()]
      .map(([band, count]) => ({ band, count }))
      .sort((a, b) => a.band.localeCompare(b.band)),
    meanTopSimilarity: dataset.length === 0 ? 0 : similaritySum / dataset.length,
    mistakes,
  };
}

/** Run every registered model over the same set, in order. */
export async function benchmarkAll(
  dataset: LabelledTransaction[],
  options: { categories?: Category[]; thresholds?: { auto: number; review: number } } = {}
): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];

  for (const model of Object.keys(EMBEDDING_MODELS) as EmbeddingModelId[]) {
    try {
      results.push(await benchmarkModel(model, dataset, options));
    } catch (error) {
      // A model that will not load is a result too — it just is not a candidate.
      // Recording it and moving on beats failing the whole comparison.
      results.push({
        model,
        info: {
          name: model,
          repo: EMBEDDING_MODELS[model].repo,
          dimensions: 0,
          device: "unavailable",
          quantization: "unavailable",
          initializedInMs: 0,
        },
        accuracy: 0,
        accuracyWhenActed: 0,
        abstained: 1,
        initialiseMs: 0,
        categoryEmbeddingMs: 0,
        batchEmbeddingMs: 0,
        perTransactionMs: 0,
        scoreDistribution: [],
        meanTopSimilarity: 0,
        mistakes: [
          {
            narration: `Model could not be loaded: ${error instanceof Error ? error.message : String(error)}`,
            expected: "",
            score: 0,
          },
        ],
      });
    }
  }

  return results;
}

/** A plain-text comparison, for pasting into a decision record. */
export function formatComparison(results: BenchmarkResult[]): string {
  const lines = ["model                     acc    acted   abstain  init(ms)  batch(ms)  per-tx(ms)  meanSim"];

  for (const result of results) {
    lines.push(
      [
        result.model.padEnd(25),
        result.accuracy.toFixed(3).padStart(5),
        result.accuracyWhenActed.toFixed(3).padStart(7),
        result.abstained.toFixed(3).padStart(8),
        result.initialiseMs.toFixed(0).padStart(9),
        result.batchEmbeddingMs.toFixed(0).padStart(10),
        result.perTransactionMs.toFixed(2).padStart(11),
        result.meanTopSimilarity.toFixed(3).padStart(8),
      ].join("")
    );
  }

  return lines.join("\n");
}
