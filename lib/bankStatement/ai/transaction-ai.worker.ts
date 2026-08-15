// The AI worker. Nothing here ever runs on the page's thread.
// ---------------------------------------------------------------------------
// This file is the *only* place in the tool that touches a model. It is loaded
// by `new Worker(...)` from ./client.ts, which is itself only reached when the
// CA presses "Categorise with AI" — so a visitor who never uses the feature
// never downloads a byte of it, and the analyzer's own bundle is unchanged.
//
// What it does:
//
//   INIT_MODEL             load the embedding model once, report progress
//                          honestly, embed every category description once
//   CLASSIFY_TRANSACTIONS  turn narrations into sentences, embed them in
//                          batches, compare against the cached category
//                          embeddings, return category + score
//
// The model is a *sentence embedding* model. It has no decoder and generates no
// text: the only thing it can produce is a 384-number vector, which we compare
// with cosine similarity. There is nothing here that could invent a category.
//
// Nothing in this file sends transaction text anywhere. The one network access
// in the whole feature is the library fetching the model's own weights from the
// CDN on first use, which happens before any transaction is read and carries
// none of them. See the AI panel copy and tests/privacy.test.ts.

/// <reference lib="webworker" />

import { EMBED_BATCH_SIZE } from "@/lib/bankStatement/ai/config";
import {
  TransformersEmbeddingProvider,
  type EmbeddingProvider,
} from "@/lib/bankStatement/ai/embeddingProvider";
import type { EmbeddingModelId } from "@/lib/bankStatement/ai/models";
import type { CategoryProfile } from "@/lib/bankStatement/ai/categoryProfiles";
import { profilesFingerprint } from "@/lib/bankStatement/ai/categoryProfiles";
import { merchantKey, narrationToSentence } from "@/lib/bankStatement/ai/narration";
import { clusterByMeaning } from "@/lib/bankStatement/ai/clustering";
import { CLUSTERING } from "@/lib/bankStatement/ai/config";
import { scoreTransaction } from "@/lib/bankStatement/ai/scoring";
import { loadAiRecord, saveAiRecord } from "@/lib/bankStatement/storage/db";
import type {
  AiBackend,
  AiResultItem,
  MainToWorkerMessage,
  WorkerToMainMessage,
} from "@/lib/bankStatement/ai/protocol";

declare const self: DedicatedWorkerGlobalScope;

function post(message: WorkerToMainMessage): void {
  self.postMessage(message);
}

// --- model loading ---------------------------------------------------------

let providerPromise: Promise<EmbeddingProvider> | null = null;
let providerSettings: { model?: EmbeddingModelId; expectedBatchSize?: number } = {};

/**
 * Turn the library's per-file download events into one honest percentage.
 * Progress is only reported once we know a total; before that the panel says
 * "Preparing…" rather than drawing a bar that means nothing.
 */
function createProgressReporter() {
  const files = new Map<string, { loaded: number; total: number }>();

  return (event: { status?: string; file?: string; loaded?: number; total?: number }) => {
    if (event.status === "progress" && event.file && event.total) {
      files.set(event.file, { loaded: event.loaded ?? 0, total: event.total });
    } else if (event.status === "done" && event.file) {
      const entry = files.get(event.file);
      if (entry) entry.loaded = entry.total;
    }

    let loaded = 0;
    let total = 0;
    for (const entry of files.values()) {
      loaded += entry.loaded;
      total += entry.total;
    }

    post({
      type: "MODEL_LOADING",
      percent: total > 0 ? Math.min(99, Math.round((loaded / total) * 100)) : undefined,
      message:
        total > 0
          ? `Downloading the categorisation model (${formatMb(loaded)} of ${formatMb(total)})`
          : "Preparing AI categorisation…",
    });
  };
}

function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * The one provider for this worker, therefore for this browser session.
 *
 * Which model, which device and which quantisation are all decided inside the
 * provider — this file no longer knows any of them, which is what lets the
 * model be swapped or benchmarked without touching classification.
 */
function getProvider(): Promise<EmbeddingProvider> {
  if (!providerPromise) {
    post({ type: "MODEL_LOADING", message: "Preparing AI categorisation…" });

    const provider = new TransformersEmbeddingProvider({
      model: providerSettings.model,
      expectedBatchSize: providerSettings.expectedBatchSize,
      batchSize: EMBED_BATCH_SIZE,
      onProgress: createProgressReporter(),
    });

    providerPromise = provider
      .initialize()
      .then(() => provider)
      .catch((error) => {
        providerPromise = null; // let the CA retry after fixing whatever it was
        throw error;
      });
  }
  return providerPromise;
}

// --- embedding -------------------------------------------------------------

/**
 * Embed a list of sentences. Batching lives in the provider, so this is only
 * here to keep the call sites unchanged.
 */
async function embedAll(provider: EmbeddingProvider, sentences: string[]): Promise<Float32Array[]> {
  return provider.embed(sentences);
}

// --- category embeddings, computed once ------------------------------------
//
// Three tiers, cheapest first: the worker's own memory, then IndexedDB, then
// the model. The middle tier is what stops a page reload from spending a second
// re-embedding thirty-five category descriptions that have not changed.

let categoryCache: { key: string; embeddings: Map<string, Float32Array> } | null = null;

/** FNV-1a. The fingerprint is every category description concatenated; this
 * turns it into something short enough to be a storage key. */
function hash(value: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/**
 * Identity of a set of category embeddings: which model produced them, at what
 * width, for which category descriptions. Change any of the three and the
 * stored vectors are meaningless, so all three are in the key.
 */
function cacheKey(provider: EmbeddingProvider, profiles: CategoryProfile[]): string {
  const info = provider.getModelInfo();
  return `category-embeddings:${info.name}:${info.dimensions}:${hash(profilesFingerprint(profiles))}`;
}

async function categoryEmbeddings(
  provider: EmbeddingProvider,
  profiles: CategoryProfile[]
): Promise<Map<string, Float32Array>> {
  const key = cacheKey(provider, profiles);
  if (categoryCache && categoryCache.key === key) return categoryCache.embeddings;

  try {
    const stored = await loadAiRecord<[string, Float32Array][]>(key, []);
    if (stored.length === profiles.length) {
      const embeddings = new Map(stored);
      categoryCache = { key, embeddings };
      return embeddings;
    }
  } catch {
    // No IndexedDB, or a record we cannot read. Recomputing is always safe.
  }

  const vectors = await embedAll(
    provider,
    profiles.map((profile) => profile.text)
  );

  const embeddings = new Map<string, Float32Array>();
  profiles.forEach((profile, index) => embeddings.set(profile.id, vectors[index]));

  categoryCache = { key, embeddings };
  try {
    await saveAiRecord(key, [...embeddings.entries()]);
  } catch {
    // Best effort — an uncached run is slower, not broken.
  }
  return embeddings;
}

// --- transaction embeddings, cached by meaning -----------------------------

/**
 * Sentence → embedding, for the life of the worker.
 *
 * Fifty Swiggy orders in a statement produce one sentence, because the
 * narration is reduced to merchant, channel and context before it gets here.
 * So this cache turns "500 transactions" into "however many distinct merchants
 * there were", which is usually a small fraction of it.
 */
const sentenceCache = new Map<string, Float32Array>();

/** Requests the page has abandoned; checked between batches. */
const cancelled = new Set<number>();

async function classify(message: Extract<MainToWorkerMessage, { type: "CLASSIFY_TRANSACTIONS" }>) {
  const { requestId, items, profiles } = message;

  try {
    const provider = await getProvider();
    const categories = await categoryEmbeddings(provider, profiles);

    // One sentence per transaction, then deduplicated: identical sentences are
    // embedded once and the vector shared.
    const sentences = items.map((item) => narrationToSentence(item.narration, item.direction));
    const missing = [...new Set(sentences.filter((sentence) => !sentenceCache.has(sentence)))];

    post({ type: "PROGRESS", requestId, current: 0, total: missing.length });

    for (let start = 0; start < missing.length; start += EMBED_BATCH_SIZE) {
      if (cancelled.has(requestId)) {
        cancelled.delete(requestId);
        return;
      }
      const batch = missing.slice(start, start + EMBED_BATCH_SIZE);
      const vectors = await embedAll(provider, batch);
      batch.forEach((sentence, index) => sentenceCache.set(sentence, vectors[index]));
      post({
        type: "PROGRESS",
        requestId,
        current: Math.min(start + batch.length, missing.length),
        total: missing.length,
      });
    }

    const results: AiResultItem[] = items.map((item, index) => {
      const embedding = sentenceCache.get(sentences[index]);
      if (!embedding) return { id: item.id, score: 0, similarity: 0 };

      const scored = scoreTransaction(embedding, categories, profiles, item.direction);
      return {
        id: item.id,
        categoryId: scored.best?.categoryId,
        categoryName: scored.best?.categoryName,
        score: scored.score,
        similarity: scored.best?.similarity ?? 0,
        runnerUpName: scored.runnerUp?.categoryName,
        runnerUpSimilarity: scored.runnerUp?.similarity,
      };
    });

    post({ type: "RESULT", requestId, results });
  } catch (error) {
    post({ type: "ERROR", requestId, message: describe(error) });
  }
}

/**
 * Group the transactions the model would not place.
 *
 * One entry per distinct merchant, not per transaction: twenty rows from one
 * shop are one merchant and must not look like a pattern on their own. The
 * embeddings are the same ones classification already computed, so this costs
 * an embedding pass only over merchants that were never seen.
 */
async function cluster(message: Extract<MainToWorkerMessage, { type: "CLUSTER_TRANSACTIONS" }>) {
  const { requestId, items } = message;

  try {
    const provider = await getProvider();

    const byMerchant = new Map<string, string>();
    for (const item of items) {
      const key = merchantKey(item.narration, item.direction);
      if (!byMerchant.has(key)) {
        byMerchant.set(key, narrationToSentence(item.narration, item.direction));
      }
    }

    const missing = [...byMerchant.values()].filter((sentence) => !sentenceCache.has(sentence));
    if (missing.length > 0) {
      const vectors = await embedAll(provider, missing);
      missing.forEach((sentence, index) => sentenceCache.set(sentence, vectors[index]));
    }

    const clusterable = [...byMerchant.entries()]
      .map(([key, sentence]) => ({ key, embedding: sentenceCache.get(sentence) }))
      .filter((entry): entry is { key: string; embedding: Float32Array } => entry.embedding !== undefined);

    post({
      type: "CLUSTERS",
      requestId,
      clusters: clusterByMeaning(clusterable, CLUSTERING.similarity),
    });
  } catch (error) {
    post({ type: "ERROR", requestId, message: describe(error) });
  }
}

// --- message loop ----------------------------------------------------------

self.addEventListener("message", (event: MessageEvent<MainToWorkerMessage>) => {
  const message = event.data;

  switch (message.type) {
    case "INIT_MODEL":
      void (async () => {
        try {
          providerSettings = {
            model: message.model,
            expectedBatchSize: message.expectedBatchSize,
          };
          const provider = await getProvider();
          await categoryEmbeddings(provider, message.profiles);
          post({ type: "MODEL_READY", backend: provider.getModelInfo() });
        } catch (error) {
          post({ type: "MODEL_ERROR", message: describe(error) });
        }
      })();
      break;

    case "CLASSIFY_TRANSACTIONS":
      void classify(message);
      break;

    case "CLUSTER_TRANSACTIONS":
      void cluster(message);
      break;

    case "CANCEL":
      cancelled.add(message.requestId);
      break;
  }
});
