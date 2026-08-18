// The only thing in the tool that knows a model exists.
// ---------------------------------------------------------------------------
// Everything above this line — scoring, clustering, the classification engine —
// deals in Float32Arrays and never names a model, a runtime or a quantisation.
// That is what makes swapping MiniLM for a candidate a configuration change,
// and what lets the benchmark run the same dataset through both without
// touching a line of classification logic.
//
// Loaded only inside the worker. Importing this module still costs nothing:
// the library import is dynamic, inside initialize().

import {
  DEFAULT_MODEL,
  EMBEDDING_MODELS,
  FALLBACK_MODEL,
  backendCandidates,
  webGpuAvailable,
  type BackendCandidate,
  type EmbeddingModelId,
} from "@/lib/bankStatement/ai/models";

export type ModelInfo = {
  name: EmbeddingModelId;
  repo: string;
  dimensions: number;
  device: string;
  quantization: string;
  /** Milliseconds from initialize() to a working model. */
  initializedInMs: number;
};

/**
 * What the rest of the application is allowed to assume about a model: it can
 * be started, it turns text into vectors, and it can say what it is.
 */
export interface EmbeddingProvider {
  initialize(): Promise<void>;
  embed(texts: string[]): Promise<Float32Array[]>;
  getModelInfo(): ModelInfo;
}

export type ProviderOptions = {
  model?: EmbeddingModelId;
  /**
   * How many texts this run will embed. Decides whether starting a GPU is
   * worth it — see WEBGPU_BATCH_THRESHOLD.
   */
  expectedBatchSize?: number;
  /** Texts embedded per forward pass. */
  batchSize?: number;
  onProgress?: (event: { status?: string; file?: string; loaded?: number; total?: number }) => void;
  /** Told which combination is being tried, so a slow load can be explained. */
  onAttempt?: (candidate: BackendCandidate, model: EmbeddingModelId) => void;
};

type Pipeline = (
  texts: string[],
  options: { pooling: "mean"; normalize: boolean }
) => Promise<{ dims: number[]; data: Float32Array | number[] }>;

/** Transformers.js over ONNX Runtime Web — the only implementation today. */
export class TransformersEmbeddingProvider implements EmbeddingProvider {
  private pipeline: Pipeline | null = null;
  private info: ModelInfo | null = null;
  private readonly options: ProviderOptions;

  constructor(options: ProviderOptions = {}) {
    this.options = options;
  }

  async initialize(): Promise<void> {
    if (this.pipeline) return;

    const started = Date.now();
    const requested = this.options.model ?? DEFAULT_MODEL;

    // Try what was asked for; if the model itself cannot be had, drop to the
    // one that always can rather than leaving the CA with nothing.
    const models: EmbeddingModelId[] =
      requested === FALLBACK_MODEL ? [requested] : [requested, FALLBACK_MODEL];

    const { pipeline, env } = await import(
      /* webpackChunkName: "transformers" */ "@huggingface/transformers"
    );

    env.allowLocalModels = false;

    // Multi-threaded WASM needs the page cross-origin isolated, and this site
    // is not. Left alone the runtime asks for threads, fails, and warns.
    const wasmBackend = env.backends.onnx?.wasm;
    if (wasmBackend && !(globalThis as { crossOriginIsolated?: boolean }).crossOriginIsolated) {
      wasmBackend.numThreads = 1;
    }

    const candidates = backendCandidates({
      batchSize: this.options.expectedBatchSize ?? Number.MAX_SAFE_INTEGER,
      webgpu: await webGpuAvailable(),
    });

    const failures = new Set<string>();

    for (const model of models) {
      const spec = EMBEDDING_MODELS[model];

      for (const candidate of candidates) {
        try {
          this.options.onAttempt?.(candidate, model);

          const extractor = (await pipeline("feature-extraction", spec.repo, {
            device: candidate.device,
            dtype: candidate.dtype,
            progress_callback: this.options.onProgress,
          })) as unknown as Pipeline;

          // Loading can succeed where inference cannot — a WebGPU adapter that
          // advertises fp16 it will not actually run. Prove it before claiming
          // the provider is ready.
          const probe = await extractor(["warm up"], { pooling: "mean", normalize: true });
          const width = probe.dims[probe.dims.length - 1];

          this.pipeline = extractor;
          this.info = {
            name: model,
            repo: spec.repo,
            dimensions: width,
            device: candidate.device,
            quantization: candidate.dtype,
            initializedInMs: Date.now() - started,
          };
          return;
        } catch (error) {
          failures.add(error instanceof Error ? error.message : String(error));
        }
      }
    }

    throw new Error(
      `No embedding model could be started in this browser — it may need a working connection the first time, or this device may not have enough memory. (${[...failures].join("; ")})`
    );
  }

  async embed(texts: string[]): Promise<Float32Array[]> {
    if (!this.pipeline) throw new Error("The embedding model has not been initialised.");
    if (texts.length === 0) return [];

    const size = this.options.batchSize ?? 32;
    const out: Float32Array[] = [];

    for (let start = 0; start < texts.length; start += size) {
      const batch = texts.slice(start, start + size);
      const tensor = await this.pipeline(batch, { pooling: "mean", normalize: true });

      const width = tensor.dims[tensor.dims.length - 1];
      const data =
        tensor.data instanceof Float32Array ? tensor.data : Float32Array.from(tensor.data);

      for (let i = 0; i < batch.length; i += 1) {
        out.push(data.slice(i * width, (i + 1) * width));
      }
    }

    return out;
  }

  getModelInfo(): ModelInfo {
    if (!this.info) throw new Error("The embedding model has not been initialised.");
    return this.info;
  }
}
