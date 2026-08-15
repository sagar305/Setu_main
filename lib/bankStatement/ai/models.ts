// Which embedding model, and on what.
// ---------------------------------------------------------------------------
// The classification engine does not name a model anywhere. It asks this
// registry for one, which is what makes swapping MiniLM for something else a
// configuration change rather than a rewrite — and what makes benchmarking the
// two against real statements possible at all.
//
// Nothing here loads anything. It is a table of identifiers and preferences,
// consulted only when the worker actually starts.

export type EmbeddingModelId = "all-MiniLM-L6-v2" | "mxbai-embed-xsmall-v1";

export type Quantization = "q4f16" | "q4" | "q8" | "fp32";
export type Device = "webgpu" | "wasm";

export type BackendCandidate = { device: Device; dtype: Quantization };

export type EmbeddingModelSpec = {
  id: EmbeddingModelId;
  /** Hugging Face repository the weights come from. */
  repo: string;
  /** Output width. Used to sanity-check what comes back, and to report it. */
  dimensions: number;
  /** Rough download size of the preferred quantisation, for the UI. */
  approximateMb: number;
  /**
   * Some models are trained asymmetrically and expect a prefix on one side of
   * the comparison. Ours is symmetric — a transaction and a category
   * description are both just descriptions — so this is empty for both models
   * and exists so a model that needs one can be added without touching the
   * engine.
   */
  transactionPrefix: string;
  categoryPrefix: string;
  notes: string;
};

/**
 * The models the tool can use.
 *
 * MiniLM stays the default until there is evidence to move: it is the one that
 * has been exercised, and "newer" is not the same as "better on Indian bank
 * narrations". That evidence is what lib/bankStatement/ai/benchmark.ts exists
 * to produce.
 */
export const EMBEDDING_MODELS: Record<EmbeddingModelId, EmbeddingModelSpec> = {
  "all-MiniLM-L6-v2": {
    id: "all-MiniLM-L6-v2",
    repo: "Xenova/all-MiniLM-L6-v2",
    dimensions: 384,
    approximateMb: 23,
    transactionPrefix: "",
    categoryPrefix: "",
    notes: "6 layers, 384 dimensions. The baseline: small, well understood, and already proven in this pipeline.",
  },
  "mxbai-embed-xsmall-v1": {
    id: "mxbai-embed-xsmall-v1",
    repo: "mixedbread-ai/mxbai-embed-xsmall-v1",
    dimensions: 384,
    approximateMb: 24,
    transactionPrefix: "",
    categoryPrefix: "",
    notes: "Candidate. Same width as MiniLM, trained more recently. Unproven on this data — benchmark before switching.",
  },
};

/** The model in use until a benchmark says otherwise. */
export const DEFAULT_MODEL: EmbeddingModelId = "all-MiniLM-L6-v2";

/**
 * If the chosen model cannot be loaded at all — a repository that never
 * published an ONNX export, a network that blocks it — fall back to this one
 * rather than failing the feature. Never leaves the user with nothing.
 */
export const FALLBACK_MODEL: EmbeddingModelId = "all-MiniLM-L6-v2";

// --- device and precision --------------------------------------------------

/**
 * Precision order, per device.
 *
 * On WebGPU q4 is worth having: the download is roughly half of q8 and the GPU
 * absorbs the extra dequantisation work. On WASM it is not — q8 is the format
 * the CPU kernels are actually optimised for, and the download saving does not
 * pay for the slower inference on a phone. So the two lists differ on purpose.
 */
const WEBGPU_ORDER: Quantization[] = ["q4f16", "q4", "q8"];
const WASM_ORDER: Quantization[] = ["q8", "q4", "fp32"];

/**
 * How many transactions make a GPU worth starting.
 *
 * WebGPU has real fixed costs — adapter request, shader compilation, buffer
 * setup — that a handful of transactions will never repay. Below this we go
 * straight to WASM and finish sooner. This is a threshold, not a benchmark:
 * measuring the device properly would cost more than it saves.
 */
export const WEBGPU_BATCH_THRESHOLD = 48;

export async function webGpuAvailable(): Promise<boolean> {
  const gpu = (globalThis.navigator as { gpu?: { requestAdapter(): Promise<unknown> } } | undefined)
    ?.gpu;
  if (!gpu) return false;
  try {
    return (await gpu.requestAdapter()) !== null;
  } catch {
    return false;
  }
}

/**
 * The device/precision combinations to try, best first, for a run of this size.
 *
 * WASM always appears at the end, whatever the size: it is the configuration
 * that works everywhere, so there is always somewhere left to fall back to.
 */
export function backendCandidates(options: {
  batchSize: number;
  webgpu: boolean;
}): BackendCandidate[] {
  const wasm: BackendCandidate[] = WASM_ORDER.map((dtype) => ({ device: "wasm", dtype }));

  if (!options.webgpu || options.batchSize < WEBGPU_BATCH_THRESHOLD) return wasm;

  return [...WEBGPU_ORDER.map((dtype) => ({ device: "webgpu" as const, dtype })), ...wasm];
}
