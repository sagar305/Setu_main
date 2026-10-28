// Microphone in, speech out. Browser only.
//
// Recording produces 16 kHz mono samples for the on-device voice model. The
// browser-speech fallback is used only when the user picks it, because it
// sends audio to the browser's own speech service; reading replies aloud uses
// the device's built-in voices and works offline.

import type { VoiceLanguage } from "./ai/protocol";

const SAMPLE_RATE = 16_000;
export const MAX_RECORDING_MS = 15_000;

export function microphoneSupported(): boolean {
  return typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== "undefined";
}

export type Recording = {
  /** Stop and get the audio, resampled for the voice model. */
  stop: () => Promise<Float32Array>;
  cancel: () => void;
};

export async function startRecording(onAutoStop: () => void): Promise<Recording> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
  const recorder = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });
  recorder.start();
  const timer = window.setTimeout(onAutoStop, MAX_RECORDING_MS);

  const release = () => {
    window.clearTimeout(timer);
    stream.getTracks().forEach((track) => track.stop());
  };

  return {
    stop: async () => {
      if (recorder.state !== "inactive") recorder.stop();
      await stopped;
      release();
      return decodeTo16k(new Blob(chunks, { type: recorder.mimeType }));
    },
    cancel: () => {
      if (recorder.state !== "inactive") recorder.stop();
      release();
    },
  };
}

async function decodeTo16k(blob: Blob): Promise<Float32Array> {
  const bytes = await blob.arrayBuffer();
  const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const context = new Context();
  try {
    const decoded = await context.decodeAudioData(bytes);
    const length = Math.max(1, Math.ceil(decoded.duration * SAMPLE_RATE));
    const offline = new OfflineAudioContext(1, length, SAMPLE_RATE);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    const rendered = await offline.startRendering();
    return rendered.getChannelData(0).slice();
  } finally {
    void context.close();
  }
}

// --- the browser's own speech recognition (online) --------------------------

type BrowserRecognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function recognitionConstructor(): (new () => BrowserRecognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => BrowserRecognition; webkitSpeechRecognition?: new () => BrowserRecognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function browserSpeechSupported(): boolean {
  return recognitionConstructor() !== null;
}

/** Listen once with the browser's speech service; resolves with what was heard. */
export function listenWithBrowser(language: VoiceLanguage): { result: Promise<string>; stop: () => void } {
  const Recognition = recognitionConstructor();
  if (!Recognition) return { result: Promise.reject(new Error("This browser has no speech recognition.")), stop: () => {} };
  const recognition = new Recognition();
  recognition.lang = language === "hindi" ? "hi-IN" : "en-IN";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  const result = new Promise<string>((resolve, reject) => {
    let heard = "";
    recognition.onresult = (event) => {
      heard = Array.from(event.results)
        .map((r) => r[0]?.transcript ?? "")
        .join(" ");
    };
    recognition.onerror = (event) =>
      reject(new Error(event.error === "network" ? "Browser voice needs internet." : event.error === "not-allowed" ? "Microphone permission was denied." : "Didn't catch that."));
    recognition.onend = () => resolve(heard.trim());
  });
  recognition.start();
  return { result, stop: () => recognition.stop() };
}

// --- reading replies aloud (offline, device voices) --------------------------

export function speechOutputSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function speak(text: string, language: VoiceLanguage): void {
  if (!speechOutputSupported() || !text.trim()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text.replace(/[“”]/g, ""));
  const wanted = language === "hindi" ? "hi" : "en-IN";
  const voices = synth.getVoices();
  utterance.voice =
    voices.find((v) => v.lang.toLowerCase().startsWith(wanted.toLowerCase()) && v.localService) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(wanted.toLowerCase())) ??
    null;
  utterance.lang = language === "hindi" ? "hi-IN" : "en-IN";
  synth.speak(utterance);
}

export function stopSpeaking(): void {
  if (speechOutputSupported()) window.speechSynthesis.cancel();
}
