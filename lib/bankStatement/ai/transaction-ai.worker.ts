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

import { BACKEND_CANDIDATES, EMBED_BATCH_SIZE, MODEL_ID } from "@/lib/bankStatement/ai/config";
import type { CategoryProfile } from "@/lib/bankStatement/ai/categoryProfiles";
import { profilesFingerprint } from "@/lib/bankStatement/ai/categoryProfiles";
import { merchantKey, narrationToSentence } from "@/lib/bankStatement/ai/narration";
import { clusterByMeaning } from "@/lib/bankStatement/ai/clustering";
import { CLUSTERING } from "@/lib/bankStatement/ai/config";
import { scoreTransaction } from "@/lib/bankStatement/ai/scoring";
import type {
  AiBackend,
  AiResultItem,
  MainToWorkerMessage,
  WorkerToMainMessage,
} from "@/lib/bankStatement/ai/protocol";

declare const self: DedicatedWorkerGlobalScope;

/** Minimal shape of the feature-extraction pipeline we use. */
type Embedder = (
  texts: string[],
  options: { pooling: "mean"; normalize: boolean }
) => Promise<{ dims: number[]; data: Float32Array | number[] }>;

function post(message: WorkerToMainMessage): void {
  self.postMessage(message);
}

// --- model loading ---------------------------------------------------------

let embedderPromise: Promise<{ embedder: Embedder; backend: AiBackend }> | null = null;

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

/**
 * Load the model once, trying the device/precision combinations in order.
 *
 * The fallback chain is the whole point: WebGPU is not everywhere, fp16 is not
 * on every GPU that does have WebGPU, and a model repository need not publish
 * every quantisation. Rather than detect all of that, we try the best option
 * and keep the first one that actually loads.
 */
async function loadEmbedder(): Promise<{ embedder: Embedder; backend: AiBackend }> {
  post({ type: "MODEL_LOADING", message: "Preparing AI categorisation…" });

  // Dynamic, so the library lands in its own chunk and is only ever downloaded
  // by a browser that reaches this line.
  const { pipeline, env } = await import(
    /* webpackChunkName: "transformers" */ "@huggingface/transformers"
  );

  // There is no local model server to fall back to — asking for one only
  // produces a confusing 404 before the real download.
  env.allowLocalModels = false;

  // Multi-threaded WASM needs the page to be cross-origin isolated (COOP+COEP),
  // and this site is not: those headers would break embeds and third-party
  // images elsewhere for a speed-up on one optional feature. The runtime
  // otherwise defaults to several threads, tries, warns in the console and
  // falls back to one anyway — so ask for one up front and skip the noise.
  // If the site ever does become isolated, the default is left alone.
  const wasmBackend = env.backends.onnx?.wasm;
  if (wasmBackend && !self.crossOriginIsolated) {
    wasmBackend.numThreads = 1;
  }

  // Reasons, deduplicated: six candidates failing for one reason ("offline")
  // should read as one problem, not as six.
  const failures = new Set<string>();

  for (const candidate of BACKEND_CANDIDATES) {
    try {
      const extractor = (await pipeline("feature-extraction", MODEL_ID, {
        device: candidate.device,
        dtype: candidate.dtype,
        progress_callback: createProgressReporter(),
      })) as unknown as Embedder;

      // Loading can succeed while the first inference fails — a WebGPU adapter
      // that reports fp16 it cannot actually run, say. So prove it works before
      // telling the page it is ready.
      await extractor(["warm up"], { pooling: "mean", normalize: true });

      return { embedder: extractor, backend: { device: candidate.device, dtype: candidate.dtype } };
    } catch (error) {
      failures.add(describe(error));
    }
  }

  throw new Error(
    `The categorisation model could not be loaded in this browser — it may need a working connection the first time, or this device may not have enough memory. (${[...failures].join("; ")})`
  );
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getEmbedder(): Promise<{ embedder: Embedder; backend: AiBackend }> {
  // Once per worker, therefore once per browser session: every later batch
  // reuses this promise rather than initialising anything again.
  if (!embedderPromise) {
    embedderPromise = loadEmbedder().catch((error) => {
      embedderPromise = null; // let the CA retry after fixing whatever it was
      throw error;
    });
  }
  return embedderPromise;
}

// --- embedding -------------------------------------------------------------

/**
 * Embed a list of sentences, in batches so a long list neither blows up memory
 * nor starves the progress messages.
 */
async function embedAll(
  embedder: Embedder,
  sentences: string[],
  onProgress?: (done: number) => void
): Promise<Float32Array[]> {
  const out: Float32Array[] = [];

  for (let start = 0; start < sentences.length; start += EMBED_BATCH_SIZE) {
    const batch = sentences.slice(start, start + EMBED_BATCH_SIZE);
    const tensor = await embedder(batch, { pooling: "mean", normalize: true });

    const width = tensor.dims[tensor.dims.length - 1];
    const data = tensor.data instanceof Float32Array ? tensor.data : Float32Array.from(tensor.data);
    for (let i = 0; i < batch.length; i += 1) {
      out.push(data.slice(i * width, (i + 1) * width));
    }

    onProgress?.(Math.min(start + batch.length, sentences.length));
  }

  return out;
}

// --- category embeddings, computed once ------------------------------------

let categoryCache: { fingerprint: string; embeddings: Map<string, Float32Array> } | null = null;

async function categoryEmbeddings(
  embedder: Embedder,
  profiles: CategoryProfile[]
): Promise<Map<string, Float32Array>> {
  const fingerprint = profilesFingerprint(profiles);
  if (categoryCache && categoryCache.fingerprint === fingerprint) return categoryCache.embeddings;

  const vectors = await embedAll(
    embedder,
    profiles.map((profile) => profile.text)
  );

  const embeddings = new Map<string, Float32Array>();
  profiles.forEach((profile, index) => embeddings.set(profile.id, vectors[index]));

  categoryCache = { fingerprint, embeddings };
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
    const { embedder } = await getEmbedder();
    const categories = await categoryEmbeddings(embedder, profiles);

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
      const vectors = await embedAll(embedder, batch);
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
    const { embedder } = await getEmbedder();

    const byMerchant = new Map<string, string>();
    for (const item of items) {
      const key = merchantKey(item.narration, item.direction);
      if (!byMerchant.has(key)) {
        byMerchant.set(key, narrationToSentence(item.narration, item.direction));
      }
    }

    const missing = [...byMerchant.values()].filter((sentence) => !sentenceCache.has(sentence));
    if (missing.length > 0) {
      const vectors = await embedAll(embedder, missing);
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
          const { embedder, backend } = await getEmbedder();
          await categoryEmbeddings(embedder, message.profiles);
          post({ type: "MODEL_READY", backend });
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
