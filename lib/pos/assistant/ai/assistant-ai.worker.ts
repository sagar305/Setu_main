// The POS assistant's AI worker: models run here, never on the page's thread,
// so the till stays responsive while a model loads or listens.
//
//   LOAD        start the meaning or voice model, reporting download progress
//   INDEX       embed the pack's example phrasings once
//   MATCH       embed one request and return the nearest example
//   TRANSCRIBE  turn recorded audio into text
//
// See protocol.ts for what is allowed to cross into this worker.

/// <reference lib="webworker" />

import { loadMeaningModel, loadVoiceModel, type ProgressEvent } from "./modelProvider";
import type { AiTask, MainToWorker, WorkerToMain } from "./protocol";

declare const self: DedicatedWorkerGlobalScope;

const post = (message: WorkerToMain, transfer: Transferable[] = []) => self.postMessage(message, transfer);

type Embed = (texts: string[]) => Promise<Float32Array[]>;
type Transcribe = (audio: Float32Array, language: "english" | "hindi") => Promise<string>;

let embedPromise: Promise<Embed> | null = null;
let transcribePromise: Promise<Transcribe> | null = null;
let index: Float32Array[] = [];

/** Fold the library's per-file events into one percentage, once totals are known. */
function progressReporter(task: AiTask) {
  const files = new Map<string, { loaded: number; total: number }>();
  let lastSent = -1;
  return (event: ProgressEvent) => {
    if (!event.file || typeof event.total !== "number" || event.total <= 0) return;
    files.set(event.file, { loaded: event.loaded ?? 0, total: event.total });
    let loaded = 0;
    let total = 0;
    for (const file of files.values()) {
      loaded += file.loaded;
      total += file.total;
    }
    const percent = Math.min(99, Math.floor((loaded / total) * 100));
    if (percent !== lastSent) {
      lastSent = percent;
      post({ type: "PROGRESS", task, percent });
    }
  };
}

function load(task: AiTask): Promise<unknown> {
  if (task === "meaning") {
    embedPromise ??= loadMeaningModel(progressReporter("meaning"));
    return embedPromise;
  }
  transcribePromise ??= loadVoiceModel(progressReporter("voice"));
  return transcribePromise;
}

function cosine(a: Float32Array, b: Float32Array): number {
  // Both sides are normalised by the model, so the dot product is the cosine.
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += a[i] * b[i];
  return sum;
}

self.onmessage = async (event: MessageEvent<MainToWorker>) => {
  const message = event.data;
  switch (message.type) {
    case "LOAD": {
      post({ type: "PROGRESS", task: message.task, percent: null });
      try {
        await load(message.task);
        post({ type: "READY", task: message.task });
      } catch (error) {
        if (message.task === "meaning") embedPromise = null;
        else transcribePromise = null;
        post({ type: "LOAD_FAILED", task: message.task, message: error instanceof Error ? error.message : String(error) });
      }
      return;
    }

    case "INDEX": {
      try {
        const embed = await (embedPromise ?? Promise.reject(new Error("Meaning model not loaded.")));
        index = await embed(message.examples);
        post({ type: "INDEXED", count: index.length });
      } catch (error) {
        post({ type: "LOAD_FAILED", task: "meaning", message: error instanceof Error ? error.message : String(error) });
      }
      return;
    }

    case "MATCH": {
      try {
        if (!embedPromise || index.length === 0) throw new Error("Meaning model not ready.");
        const [vector] = await (await embedPromise)([message.text]);
        let best = -1;
        let score = -Infinity;
        index.forEach((candidate, i) => {
          const s = cosine(vector, candidate);
          if (s > score) {
            score = s;
            best = i;
          }
        });
        post({ type: "MATCH_RESULT", id: message.id, exampleIndex: best, score });
      } catch (error) {
        post({ type: "REQUEST_FAILED", id: message.id, message: error instanceof Error ? error.message : String(error) });
      }
      return;
    }

    case "TRANSCRIBE": {
      try {
        if (!transcribePromise) throw new Error("Voice model not loaded.");
        const text = await (await transcribePromise)(message.audio, message.language);
        post({ type: "TRANSCRIPT", id: message.id, text });
      } catch (error) {
        post({ type: "REQUEST_FAILED", id: message.id, message: error instanceof Error ? error.message : String(error) });
      }
      return;
    }
  }
};
