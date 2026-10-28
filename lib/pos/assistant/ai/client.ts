// The page's side of the assistant's AI worker. Browser only, and lazy: no
// worker exists until a model is asked for, so a shop that never downloads
// one never pays for it.

import type { AiTask, MainToWorker, VoiceLanguage, WorkerToMain } from "./protocol";

export type TaskState = {
  phase: "idle" | "loading" | "ready" | "error";
  /** 0–100 while downloading, once the size is known. */
  percent: number | null;
  error?: string;
};

export type AiState = Record<AiTask, TaskState> & { indexed: boolean };

type Listener = (state: AiState) => void;

export function aiSupported(): boolean {
  return typeof window !== "undefined" && typeof Worker !== "undefined" && typeof WebAssembly !== "undefined";
}

class AssistantAi {
  private worker: Worker | null = null;
  private state: AiState = {
    meaning: { phase: "idle", percent: null },
    voice: { phase: "idle", percent: null },
    indexed: false,
  };
  private listeners = new Set<Listener>();
  private nextId = 1;
  private pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  private indexedFor: string | null = null;
  private loadWaiters: Record<AiTask, { resolve: () => void; reject: (error: Error) => void }[]> = { meaning: [], voice: [] };

  getState(): AiState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private set(update: Partial<AiState>) {
    this.state = { ...this.state, ...update };
    for (const listener of this.listeners) listener(this.state);
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    const worker = new Worker(new URL("./assistant-ai.worker.ts", import.meta.url), {
      type: "module",
      name: "setu-pos-assistant-ai",
    });
    worker.onmessage = (event: MessageEvent<WorkerToMain>) => this.onMessage(event.data);
    worker.onerror = () => {
      const error = new Error("The assistant's AI worker stopped.");
      for (const { reject } of this.pending.values()) reject(error);
      this.pending.clear();
      for (const task of ["meaning", "voice"] as const) {
        for (const waiter of this.loadWaiters[task]) waiter.reject(error);
        this.loadWaiters[task] = [];
      }
      this.worker = null;
      this.indexedFor = null;
      this.set({
        meaning: { phase: "error", percent: null, error: error.message },
        voice: { phase: "error", percent: null, error: error.message },
        indexed: false,
      });
    };
    this.worker = worker;
    return worker;
  }

  private send(message: MainToWorker, transfer: Transferable[] = []) {
    this.ensureWorker().postMessage(message, transfer);
  }

  private onMessage(message: WorkerToMain) {
    switch (message.type) {
      case "PROGRESS":
        this.set({ [message.task]: { phase: "loading", percent: message.percent } } as Partial<AiState>);
        return;
      case "READY":
        this.set({ [message.task]: { phase: "ready", percent: 100 } } as Partial<AiState>);
        for (const waiter of this.loadWaiters[message.task]) waiter.resolve();
        this.loadWaiters[message.task] = [];
        return;
      case "LOAD_FAILED":
        this.set({ [message.task]: { phase: "error", percent: null, error: message.message } } as Partial<AiState>);
        for (const waiter of this.loadWaiters[message.task]) waiter.reject(new Error(message.message));
        this.loadWaiters[message.task] = [];
        return;
      case "INDEXED":
        this.set({ indexed: true });
        return;
      case "MATCH_RESULT":
        this.pending.get(message.id)?.resolve({ exampleIndex: message.exampleIndex, score: message.score });
        this.pending.delete(message.id);
        return;
      case "TRANSCRIPT":
        this.pending.get(message.id)?.resolve(message.text);
        this.pending.delete(message.id);
        return;
      case "REQUEST_FAILED":
        this.pending.get(message.id)?.reject(new Error(message.message));
        this.pending.delete(message.id);
        return;
    }
  }

  /** Start a model; resolves when it is ready (downloading it the first time). */
  load(task: AiTask): Promise<void> {
    if (!aiSupported()) return Promise.reject(new Error("This browser cannot run on-device AI."));
    if (this.state[task].phase === "ready") return Promise.resolve();
    const done = new Promise<void>((resolve, reject) => this.loadWaiters[task].push({ resolve, reject }));
    if (this.state[task].phase !== "loading") {
      this.set({ [task]: { phase: "loading", percent: null } } as Partial<AiState>);
      this.send({ type: "LOAD", task });
    }
    return done;
  }

  /** Embed the pack's examples once per pack. Only phrasings, never shop data. */
  index(examples: string[]) {
    const key = `${examples.length}:${examples[0] ?? ""}:${examples[examples.length - 1] ?? ""}`;
    if (this.indexedFor === key || this.state.meaning.phase !== "ready") return;
    this.indexedFor = key;
    this.set({ indexed: false });
    this.send({ type: "INDEX", examples });
  }

  private request<T>(message: MainToWorker & { id: number }, transfer: Transferable[] = []): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.pending.set(message.id, { resolve: resolve as (value: unknown) => void, reject });
      this.send(message, transfer);
    });
  }

  match(text: string): Promise<{ exampleIndex: number; score: number }> | null {
    if (this.state.meaning.phase !== "ready" || !this.state.indexed) return null;
    return this.request({ type: "MATCH", id: this.nextId++, text });
  }

  transcribe(audio: Float32Array, language: VoiceLanguage): Promise<string> {
    return this.request({ type: "TRANSCRIBE", id: this.nextId++, audio, language }, [audio.buffer]);
  }
}

let instance: AssistantAi | null = null;

export function assistantAi(): AssistantAi {
  instance ??= new AssistantAi();
  return instance;
}
