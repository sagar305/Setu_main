// The announcement.
//
// This is the reason the app exists. Commercial token systems charge for a
// voice calling numbers across a waiting room and every one of them needs a
// server; the browser has done it for free since 2014. What it does not do is
// do it *reliably* — which voices exist varies by browser, by operating
// system, by whether the device has ever been online, and on the cheap smart
// TV in the corner there may be no speech engine at all.
//
// So nothing here fails silently. The voice actually chosen is reported back
// so Settings can name it, and when there is no voice the caller is told, so
// the display can fall back to the chime and then to the flash rather than
// standing there mute and looking broken.

import { fillTemplate } from "./messages";

export type VoiceChoice = {
  voice: SpeechSynthesisVoice | null;
  /** How we arrived at it, for Settings to explain. */
  reason: "exact" | "language" | "indian-english" | "default" | "none";
  label: string;
};

export function speechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/**
 * Voices load asynchronously in Chrome — the first `getVoices()` after a cold
 * load returns nothing, and `voiceschanged` fires a moment later. A Settings
 * screen that reads once shows an empty picker on every first visit.
 */
export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!speechSupported()) return Promise.resolve([]);
  const existing = window.speechSynthesis.getVoices();
  if (existing.length > 0) return Promise.resolve(existing);
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve(window.speechSynthesis.getVoices());
    };
    window.speechSynthesis.addEventListener("voiceschanged", done, { once: true });
    // Some builds never fire the event at all. Do not wait forever for them.
    window.setTimeout(done, 1500);
  });
}

/**
 * Pick the voice for a language, down a chain that always terminates.
 *
 * Exact tag, then the same language in any region (a device with `hi-IN`
 * absent but `hi` present should still speak Hindi), then Indian English,
 * then whatever the browser calls default, then nothing.
 */
export function chooseVoice(voices: SpeechSynthesisVoice[], lang: string): VoiceChoice {
  const wanted = (lang || "").toLowerCase();
  const base = wanted.split("-")[0];

  const exact = voices.find((v) => v.lang.toLowerCase() === wanted);
  if (exact) return { voice: exact, reason: "exact", label: exact.name };

  const sameLanguage = voices.find((v) => v.lang.toLowerCase().split("-")[0] === base && base);
  if (sameLanguage) {
    return { voice: sameLanguage, reason: "language", label: sameLanguage.name };
  }

  const indianEnglish = voices.find((v) => v.lang.toLowerCase() === "en-in");
  if (indianEnglish) {
    return { voice: indianEnglish, reason: "indian-english", label: indianEnglish.name };
  }

  const fallback = voices.find((v) => v.default) ?? voices[0];
  if (fallback) return { voice: fallback, reason: "default", label: fallback.name };

  return { voice: null, reason: "none", label: "No voice available" };
}

export function describeVoiceChoice(choice: VoiceChoice, lang: string): string {
  switch (choice.reason) {
    case "exact":
      return `Will speak with "${choice.label}".`;
    case "language":
      return `No ${lang} voice on this device — will use "${choice.label}", the closest match.`;
    case "indian-english":
      return `No ${lang} voice on this device — will speak Indian English with "${choice.label}".`;
    case "default":
      return `No ${lang} voice on this device — will use this browser's default, "${choice.label}".`;
    default:
      return "This browser has no speech voices. Announcements will play the chime only.";
  }
}

export type AnnounceOptions = {
  template: string;
  token: string;
  counter: string;
  lang: string;
  rate: number;
  repeat: 1 | 2;
};

/** The sentence that will be spoken, with the token split so "A-42" reads right. */
export function announcementText(options: Pick<AnnounceOptions, "template" | "token" | "counter">) {
  return fillTemplate(options.template, { token: options.token, counter: options.counter });
}

/**
 * Speak an announcement. Resolves false when the browser could not, so the
 * caller knows to lean on the chime instead of assuming the room heard it.
 */
export function speakAnnouncement(options: AnnounceOptions, voice: SpeechSynthesisVoice | null) {
  if (!speechSupported()) return false;
  const text = announcementText(options);
  if (!text) return false;

  try {
    // Cancel anything still queued: a rush of calls should announce the token
    // being called now, not work through a backlog the room has moved past.
    window.speechSynthesis.cancel();
    for (let i = 0; i < options.repeat; i += 1) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = options.lang || "en-IN";
      utterance.rate = Math.min(1.5, Math.max(0.5, options.rate || 1));
      if (voice) utterance.voice = voice;
      window.speechSynthesis.speak(utterance);
    }
    return true;
  } catch {
    return false;
  }
}

export function cancelSpeech(): void {
  if (!speechSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // Nothing to do; the next announcement will queue behind it at worst.
  }
}

/* -------------------------------------------------------------------------
 * The chime
 * ---------------------------------------------------------------------- */

export type ChimeSound = "bell" | "ding" | "chime";

/** Frequencies and lengths, in the order they play. */
const CHIMES: Record<ChimeSound, { freq: number; start: number; length: number }[]> = {
  bell: [
    { freq: 880, start: 0, length: 0.45 },
    { freq: 660, start: 0.18, length: 0.5 },
  ],
  ding: [{ freq: 1046, start: 0, length: 0.3 }],
  chime: [
    { freq: 784, start: 0, length: 0.3 },
    { freq: 988, start: 0.15, length: 0.3 },
    { freq: 1319, start: 0.3, length: 0.45 },
  ],
};

type AudioContextCtor = typeof AudioContext;

function audioContextCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

let sharedContext: AudioContext | null = null;

/**
 * Browsers refuse to make noise until the page has been interacted with, and
 * a display left running on a TV is interacted with exactly once — when
 * somebody opens it. That tap is where this gets called.
 */
export function unlockAudio(): boolean {
  const Ctor = audioContextCtor();
  if (!Ctor) return false;
  try {
    if (!sharedContext) sharedContext = new Ctor();
    if (sharedContext.state === "suspended") void sharedContext.resume();
    return true;
  } catch {
    return false;
  }
}

export function chimeSupported(): boolean {
  return audioContextCtor() !== null;
}

/**
 * Play the chime. Synthesised rather than shipped as audio files: three notes
 * of sine wave cost nothing to download and cannot 404 on a device that has
 * been offline since it was installed.
 */
export function playChime(sound: ChimeSound): boolean {
  if (!unlockAudio() || !sharedContext) return false;
  const context = sharedContext;
  try {
    const now = context.currentTime;
    for (const note of CHIMES[sound] ?? CHIMES.bell) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = note.freq;
      // Ramp both ends: a square-edged sine is a click through a cheap TV
      // speaker, and the click is what people in the room actually hear.
      gain.gain.setValueAtTime(0.0001, now + note.start);
      gain.gain.exponentialRampToValueAtTime(0.35, now + note.start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + note.start + note.length);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now + note.start);
      oscillator.stop(now + note.start + note.length + 0.05);
    }
    return true;
  } catch {
    return false;
  }
}
