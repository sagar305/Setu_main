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
  AiRequestItem,
  AiResultItem,
  MainToWorkerMessage,
  WorkerToMainMessage,
} from "@/lib/bankStatement/ai/protocol";
import type { CategoryProfile } from "@/lib/bankStatement/ai/categoryProfiles";

export type AiPhase = "idle" | "loading" | "ready" | "error";

export type AiClientState = {
  phase: AiPhase;
  /** 0–100 while the model downloads, when the size is known. */
  percent?: number;
  message?: string;
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
  start(profiles: CategoryProfile[]): Promise<void> {
    if (this.state.phase === "ready") return Promise.resolve();

    if (!aiSupported()) {
      const error = "This browser cannot run on-device categorisation. Rules and manual categorising still work.";
      this.setState({ phase: "error", error });
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
      this.worker.addEventListener("error", (event) => this.fail(event.message || "The AI worker stopped unexpectedly."));
    }

    const waiter = new Promise<void>((resolve, reject) => {
      this.readyWaiters.push({ resolve, reject });
    });

    if (this.state.phase !== "loading") {
      this.setState({ phase: "loading", message: "Preparing AI categorisation…", error: undefined });
      this.send({ type: "INIT_MODEL", profiles });
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

    return this.start(profiles).then(
      () =>
        new Promise<AiResultItem[]>((resolve, reject) => {
          const requestId = this.nextRequestId++;
          this.pending.set(requestId, { resolve, reject, onProgress });
          this.send({ type: "CLASSIFY_TRANSACTIONS", requestId, items, profiles });
        })
    );
  }

  /** Abandon every in-flight batch. The model stays loaded. */
  cancelAll(): void {
    for (const requestId of this.pending.keys()) {
      this.send({ type: "CANCEL", requestId });
      this.pending.get(requestId)?.reject(new Error("Cancelled."));
    }
    this.pending.clear();
  }

  private send(message: MainToWorkerMessage): void {
    this.worker?.postMessage(message);
  }

  private handle(message: WorkerToMainMessage): void {
    switch (message.type) {
      case "MODEL_LOADING":
        this.setState({ phase: "loading", percent: message.percent, message: message.message });
        break;

      case "MODEL_READY": {
        this.setState({ phase: "ready", percent: 100, message: undefined, backend: message.backend, error: undefined });
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

      case "ERROR": {
        const entry = this.pending.get(message.requestId);
        this.pending.delete(message.requestId);
        entry?.reject(new Error(message.message));
        break;
      }
    }
  }

  private fail(error: string): void {
    this.setState({ phase: "error", error, message: undefined, percent: undefined });

    const waiters = this.readyWaiters;
    this.readyWaiters = [];
    for (const waiter of waiters) waiter.reject(new Error(error));

    for (const entry of this.pending.values()) entry.reject(new Error(error));
    this.pending.clear();
  }
}

let instance: AiCategoriser | null = null;

/** The one categoriser for this browser session. */
export function getAiCategoriser(): AiCategoriser {
  if (!instance) instance = new AiCategoriser();
  return instance;
}

export type { AiCategoriser };
