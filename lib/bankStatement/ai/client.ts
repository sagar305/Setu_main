// The page's side of the AI worker. Browser only, and lazy on purpose.
// ---------------------------------------------------------------------------
// Importing this module costs nothing: the worker is not constructed until
// `start()` is called, and the model is not fetched until the worker runs. The
// analyzer therefore loads exactly as it did before the feature existed, and a
// CA who never presses the button never pays for it.
//
// One worker per browser session, held here at module scope. Every batch, every
// statement and every re-run reuses it — the model is initialised once, not
// once per transaction and not once per press.

import type {
  AiBackend,
  AiProgress,
  AiRequestItem,
  AiResultItem,
  MainToWorkerMessage,
  WorkerToMainMessage,
} from "@/lib/bankStatement/ai/protocol";
import type { CategoryProfile } from "@/lib/bankStatement/ai/categoryProfiles";
import type { EmbeddingModelId } from "@/lib/bankStatement/ai/models";

export type AiPhase = "idle" | "loading" | "ready" | "error";

/**
 * Why categorisation is not running, as a code the panel words.
 *
 * "WORKER_FAILED" covers anything the worker itself reported — a model that
 * would not load, a runtime fault — and keeps the worker's own English text
 * alongside it in `error`, because that text is the only description of what
 * actually went wrong and is worth more to whoever is debugging than a
 * generic sentence.
 */
export type AiErrorCode = "UNSUPPORTED" | "WORKER_STOPPED" | "WORKER_FAILED";

/** Rejection for a request the caller cancelled, rather than a failure. */
export class AiCancelledError extends Error {
  constructor() {
    super("Cancelled.");
    this.name = "AiCancelledError";
  }
}

export type AiClientState = {
  phase: AiPhase;
  /** 0–100 while the model downloads, when the size is known. */
  percent?: number;
  /** What is happening, for the panel to word. */
  progress?: AiProgress;
  /** Why it failed, for the panel to word. */
  errorCode?: AiErrorCode;
  backend?: AiBackend;
  error?: string;
};

type Listener = (state: AiClientState) => void;

/**
 * Web Workers and WebAssembly are both required. Everything else — WebGPU, fp16,
 * a particular quantisation — is handled by falling back inside the worker.
 */
export function aiSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof Worker !== "undefined" &&
    typeof WebAssembly !== "undefined"
  );
}

class AiCategoriser {
  private worker: Worker | null = null;
  private state: AiClientState = { phase: "idle" };
  private listeners = new Set<Listener>();

  private nextRequestId = 1;
  private pending = new Map<
    number,
    {
      resolve: (results: AiResultItem[]) => void;
      reject: (error: Error) => void;
      onProgress?: (current: number, total: number) => void;
    }
  >();

  /** Clustering requests, kept apart because they resolve to a different shape. */
  private clustering = new Map<
    number,
    { resolve: (clusters: string[][]) => void; reject: (error: Error) => void }
  >();

  private readyWaiters: { resolve: () => void; reject: (error: Error) => void }[] = [];

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  getState(): AiClientState {
    return this.state;
  }

  private setState(patch: Partial<AiClientState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener(this.state);
  }

  /**
   * Spin the worker up and load the model. Safe to call repeatedly: after the
   * first call this resolves immediately from the already-loaded model.
   */
  start(
    profiles: CategoryProfile[],
    options: { model?: EmbeddingModelId; expectedBatchSize?: number } = {}
  ): Promise<void> {
    if (this.state.phase === "ready") return Promise.resolve();

    if (!aiSupported()) {
      // The thrown Error keeps an English message: it is a diagnostic that ends
      // up in a console or a log, not something a CA reads. What they read is
      // the code, worded by the panel.
      const error = "This browser cannot run on-device categorisation. Rules and manual categorising still work.";
      this.setState({ phase: "error", error, errorCode: "UNSUPPORTED" });
      return Promise.reject(new Error(error));
    }

    if (!this.worker) {
      // Constructed here and nowhere else — this line is what actually pulls
      // the AI code into the browser, and it only runs on request.
      this.worker = new Worker(
        new URL("./transaction-ai.worker.ts", import.meta.url),
        { type: "module", name: "setu-transaction-ai" }
      );
      this.worker.addEventListener("message", (event: MessageEvent<WorkerToMainMessage>) =>
        this.handle(event.data)
      );
      this.worker.addEventListener("error", (event) =>
        this.fail(event.message || "The AI worker stopped unexpectedly.", "WORKER_STOPPED")
      );
    }

    const waiter = new Promise<void>((resolve, reject) => {
      this.readyWaiters.push({ resolve, reject });
    });

    if (this.state.phase !== "loading") {
      this.setState({
        phase: "loading",
        progress: { code: "PREPARING" },
        error: undefined,
        errorCode: undefined,
      });
      this.send({
        type: "INIT_MODEL",
        profiles,
        model: options.model,
        expectedBatchSize: options.expectedBatchSize,
      });
    }

    return waiter;
  }

  /**
   * Classify a batch. The worker holds the model and the embedding caches, so
   * calling this a second time with another statement costs an embedding pass
   * over whatever merchants it has not already seen — not a model load.
   */
  classify(
    items: AiRequestItem[],
    profiles: CategoryProfile[],
    onProgress?: (current: number, total: number) => void
  ): Promise<AiResultItem[]> {
    if (items.length === 0) return Promise.resolve([]);

    return this.start(profiles, { expectedBatchSize: items.length }).then(
      () =>
        new Promise<AiResultItem[]>((resolve, reject) => {
          const requestId = this.nextRequestId++;
          this.pending.set(requestId, { resolve, reject, onProgress });
          this.send({ type: "CLASSIFY_TRANSACTIONS", requestId, items, profiles });
        })
    );
  }

  /**
   * Ask which of these transactions belong together — used on the ones the
   * model declined to categorise, to find the categories the list is missing.
   * Reuses the embeddings classification already computed.
   */
  clusterUnmatched(items: AiRequestItem[], profiles: CategoryProfile[]): Promise<string[][]> {
    if (items.length === 0) return Promise.resolve([]);

    return this.start(profiles, { expectedBatchSize: items.length }).then(
      () =>
        new Promise<string[][]>((resolve, reject) => {
          const requestId = this.nextRequestId++;
          this.clustering.set(requestId, { resolve, reject });
          this.send({ type: "CLUSTER_TRANSACTIONS", requestId, items });
        })
    );
  }

  /** Abandon every in-flight batch. The model stays loaded. */
  cancelAll(): void {
    for (const requestId of this.pending.keys()) {
      this.send({ type: "CANCEL", requestId });
      this.pending.get(requestId)?.reject(new AiCancelledError());
    }
    this.pending.clear();
  }

  private send(message: MainToWorkerMessage): void {
    this.worker?.postMessage(message);
  }

  private handle(message: WorkerToMainMessage): void {
    switch (message.type) {
      case "MODEL_LOADING":
        this.setState({ phase: "loading", percent: message.percent, progress: message.progress });
        break;

      case "MODEL_READY": {
        this.setState({
          phase: "ready",
          percent: 100,
          progress: undefined,
          backend: message.backend,
          error: undefined,
          errorCode: undefined,
        });
        const waiters = this.readyWaiters;
        this.readyWaiters = [];
        for (const waiter of waiters) waiter.resolve();
        break;
      }

      case "MODEL_ERROR":
        this.fail(message.message);
        break;

      case "PROGRESS":
        this.pending.get(message.requestId)?.onProgress?.(message.current, message.total);
        break;

      case "RESULT": {
        const entry = this.pending.get(message.requestId);
        this.pending.delete(message.requestId);
        entry?.resolve(message.results);
        break;
      }

      case "CLUSTERS": {
        const entry = this.clustering.get(message.requestId);
        this.clustering.delete(message.requestId);
        entry?.resolve(message.clusters);
        break;
      }

      case "ERROR": {
        const entry = this.pending.get(message.requestId);
        this.pending.delete(message.requestId);
        entry?.reject(new Error(message.message));

        const grouping = this.clustering.get(message.requestId);
        this.clustering.delete(message.requestId);
        grouping?.reject(new Error(message.message));
        break;
      }
    }
  }

  private fail(error: string, errorCode: AiErrorCode = "WORKER_FAILED"): void {
    this.setState({ phase: "error", error, errorCode, progress: undefined, percent: undefined });

    const waiters = this.readyWaiters;
    this.readyWaiters = [];
    for (const waiter of waiters) waiter.reject(new Error(error));

    for (const entry of this.pending.values()) entry.reject(new Error(error));
    this.pending.clear();

    for (const entry of this.clustering.values()) entry.reject(new Error(error));
    this.clustering.clear();
  }
}

let instance: AiCategoriser | null = null;

/** The one categoriser for this browser session. */
export function getAiCategoriser(): AiCategoriser {
  if (!instance) instance = new AiCategoriser();
  return instance;
}

export type { AiCategoriser };
