// The only module in the POS assistant that touches a model library.
//
// Loaded inside the worker only. The library import is dynamic, so importing
// this file costs nothing until a model is actually asked for. The one network
// access is the library fetching each model's weights from the model host the
// first time; the browser caches them, and from then on both models start
// with the internet off. No request, no audio and no shop data is ever sent.

import { AI_MODELS } from "./models";
import type { VoiceLanguage } from "./protocol";

export type ProgressEvent = { status?: string; file?: string; loaded?: number; total?: number };

type FeatureExtractor = (
  texts: string[],
  options: { pooling: "mean"; normalize: boolean }
) => Promise<{ dims: number[]; data: Float32Array | number[] }>;

type SpeechRecognizer = (
  audio: Float32Array,
  options: { language: string; task: "transcribe" }
) => Promise<{ text: string } | { text: string }[]>;

async function library() {
  const transformers = await import(/* webpackChunkName: "transformers" */ "@huggingface/transformers");
  transformers.env.allowLocalModels = false;
  // Threads need a cross-origin isolated page, which this site is not.
  const wasm = transformers.env.backends.onnx?.wasm;
  if (wasm && !(globalThis as { crossOriginIsolated?: boolean }).crossOriginIsolated) wasm.numThreads = 1;
  return transformers;
}

/** Turns a list of sentences into unit-length vectors. */
export async function loadMeaningModel(onProgress: (event: ProgressEvent) => void) {
  const { pipeline } = await library();
  const extractor = (await pipeline("feature-extraction", AI_MODELS.meaning.repo, {
    device: "wasm",
    dtype: "q8",
    progress_callback: onProgress,
  })) as unknown as FeatureExtractor;

  return async (texts: string[]): Promise<Float32Array[]> => {
    const out: Float32Array[] = [];
    for (let start = 0; start < texts.length; start += 32) {
      const batch = texts.slice(start, start + 32);
      const tensor = await extractor(batch, { pooling: "mean", normalize: true });
      const width = tensor.dims[tensor.dims.length - 1];
      const data = tensor.data instanceof Float32Array ? tensor.data : Float32Array.from(tensor.data);
      for (let i = 0; i < batch.length; i += 1) out.push(data.slice(i * width, (i + 1) * width));
    }
    return out;
  };
}

/** Turns 16 kHz mono audio into text. */
export async function loadVoiceModel(onProgress: (event: ProgressEvent) => void) {
  const { pipeline } = await library();
  const recognizer = (await pipeline("automatic-speech-recognition", AI_MODELS.voice.repo, {
    device: "wasm",
    dtype: "q8",
    progress_callback: onProgress,
  })) as unknown as SpeechRecognizer;

  return async (audio: Float32Array, language: VoiceLanguage): Promise<string> => {
    const result = await recognizer(audio, { language, task: "transcribe" });
    const text = Array.isArray(result) ? result.map((r) => r.text).join(" ") : result.text;
    return text.trim();
  };
}
