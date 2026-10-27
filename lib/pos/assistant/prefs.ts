// What the assistant remembers in this browser: the downloaded language pack,
// which models were installed (so they restart from the browser's cache with
// no internet), and the voice settings. None of it is shop data.
//
// localStorage can be missing or throw (private windows, blocked storage);
// every read falls back to "nothing saved" and every write is best-effort.

import { PACK_URL, validatePack, type AssistantPack } from "./pack";
import type { VoiceLanguage } from "./ai/protocol";

const PACK_KEY = "setu-pos-assistant:pack";
const PREFS_KEY = "setu-pos-assistant:prefs";

/**
 * How the mic listens. "offline" = the on-device voice model; "browser" = the
 * browser's own speech service, which needs internet and sends audio to it.
 */
export type VoiceMode = "offline" | "browser" | null;

export type AssistantPrefs = {
  meaningInstalled: boolean;
  voiceInstalled: boolean;
  voiceMode: VoiceMode;
  language: VoiceLanguage;
  speakReplies: boolean;
};

export const DEFAULT_PREFS: AssistantPrefs = {
  meaningInstalled: false,
  voiceInstalled: false,
  voiceMode: null,
  language: "english",
  speakReplies: false,
};

export function loadPrefs(): AssistantPrefs {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<AssistantPrefs>) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs: AssistantPrefs): void {
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Settings simply won't survive a reload.
  }
}

export function loadSavedPack(): AssistantPack | null {
  try {
    const raw = window.localStorage.getItem(PACK_KEY);
    return raw ? validatePack(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/** Fetch the language pack from this site and keep it in the browser. */
export async function downloadPack(): Promise<AssistantPack> {
  const response = await fetch(PACK_URL, { cache: "no-cache" });
  if (!response.ok) throw new Error(`Couldn't download the language pack (${response.status}).`);
  const pack = validatePack(await response.json());
  try {
    window.localStorage.setItem(PACK_KEY, JSON.stringify(pack));
  } catch {
    // Still usable this session.
  }
  return pack;
}

export function removePack(): void {
  try {
    window.localStorage.removeItem(PACK_KEY);
  } catch {
    // Nothing to remove.
  }
}
