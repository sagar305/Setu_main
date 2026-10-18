// The contract between the page and the AI worker.
// ---------------------------------------------------------------------------
// Types only — importing this file pulls in no model, no worker and no browser
// API, so both sides can share it and Next can render the page on the server
// without any of it mattering.
//
// What crosses this boundary is deliberately narrow: a narration, a direction
// and an id. No amount, no balance, no account number, no statement metadata.
// The worker is in the same browser, but the smaller the message the easier the
// privacy claim is to check.

import type { CategoryProfile } from "@/lib/bankStatement/ai/categoryProfiles";
import type { ModelInfo } from "@/lib/bankStatement/ai/embeddingProvider";
import type { EmbeddingModelId } from "@/lib/bankStatement/ai/models";

/** What the worker ended up running. Reported so the panel can say. */
export type AiBackend = ModelInfo;

/** One transaction, as the worker needs to see it. */
export type AiRequestItem = {
  id: string;
  narration: string;
  direction: "DEBIT" | "CREDIT";
};

export type AiResultItem = {
  id: string;
  categoryId?: string;
  categoryName?: string;
  /** 0–100 model confidence score — see ./scoring.ts. */
  score: number;
  /** Raw cosine similarity of the winning category, 0–1. */
  similarity: number;
  /** The category that came second, kept so the UI can explain a close call. */
  runnerUpName?: string;
  runnerUpSimilarity?: number;
};

// --- main thread → worker --------------------------------------------------

export type InitModelMessage = {
  type: "INIT_MODEL";
  profiles: CategoryProfile[];
  /** Which model to try. Omitted means the registry's default. */
  model?: EmbeddingModelId;
  /**
   * Roughly how many transactions this session will embed. Decides whether
   * starting a GPU is worth its fixed cost — see WEBGPU_BATCH_THRESHOLD.
   */
  expectedBatchSize?: number;
};

export type ClassifyMessage = {
  type: "CLASSIFY_TRANSACTIONS";
  requestId: number;
  items: AiRequestItem[];
  /** Sent with every request so retuning the thresholds needs no reload. */
  profiles: CategoryProfile[];
};

/**
 * Ask which of these transactions belong together. Sent only for the ones the
 * model already declined to categorise, so the answer is "here are the kinds of
 * spending your category list is missing".
 */
export type ClusterMessage = {
  type: "CLUSTER_TRANSACTIONS";
  requestId: number;
  items: AiRequestItem[];
};

export type CancelMessage = { type: "CANCEL"; requestId: number };

export type MainToWorkerMessage =
  | InitModelMessage
  | ClassifyMessage
  | ClusterMessage
  | CancelMessage;

// --- worker → main thread --------------------------------------------------

/**
 * What the worker is doing, as a code rather than a sentence.
 *
 * The worker has no language context — it is a module running off the main
 * thread, with no React and no preference to read. So it reports the state and
 * its numbers, and the panel that displays it does the wording.
 */
export type AiProgress =
  | { code: "PREPARING" }
  | { code: "DOWNLOADING"; loadedBytes: number; totalBytes: number };

export type ModelLoadingMessage = {
  type: "MODEL_LOADING";
  /** 0–100 across all model files, or undefined before any file has a size. */
  percent?: number;
  progress: AiProgress;
};

export type ModelReadyMessage = { type: "MODEL_READY"; backend: AiBackend };

export type ModelErrorMessage = { type: "MODEL_ERROR"; message: string };

export type ProgressMessage = {
  type: "PROGRESS";
  requestId: number;
  current: number;
  total: number;
};

export type ResultMessage = {
  type: "RESULT";
  requestId: number;
  results: AiResultItem[];
};

/** Groups of merchant keys, biggest first. The page maps them back to rows. */
export type ClustersMessage = {
  type: "CLUSTERS";
  requestId: number;
  clusters: string[][];
};

export type ErrorMessage = { type: "ERROR"; requestId: number; message: string };

export type WorkerToMainMessage =
  | ModelLoadingMessage
  | ModelReadyMessage
  | ModelErrorMessage
  | ProgressMessage
  | ResultMessage
  | ClustersMessage
  | ErrorMessage;
