// Messages between the POS page and the assistant's AI worker.
//
// What may cross into the worker is pinned here and checked by
// tests/posAssistant/privacy.test.ts: the request as typed or spoken, the
// pack's example phrasings, and microphone audio. Never products, customers,
// sales or anything else from the shop — the worker turns words into vectors
// and sound into words, and the page does everything with the shop's data.

export type AiTask = "meaning" | "voice";
export type VoiceLanguage = "english" | "hindi";

export type MainToWorker =
  | { type: "LOAD"; task: AiTask }
  /** The pack's example phrasings (placeholders, no shop data), embedded once. */
  | { type: "INDEX"; examples: string[] }
  | { type: "MATCH"; id: number; text: string }
  | { type: "TRANSCRIBE"; id: number; audio: Float32Array; language: VoiceLanguage };

export type WorkerToMain =
  | { type: "PROGRESS"; task: AiTask; percent: number | null }
  | { type: "READY"; task: AiTask }
  | { type: "INDEXED"; count: number }
  | { type: "LOAD_FAILED"; task: AiTask; message: string }
  | { type: "MATCH_RESULT"; id: number; exampleIndex: number; score: number }
  | { type: "TRANSCRIPT"; id: number; text: string }
  | { type: "REQUEST_FAILED"; id: number; message: string };
