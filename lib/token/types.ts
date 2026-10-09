// Data model for the Free Token System (/products/free-token-system).
//
// The whole app is one day wide. Every screen except Reports asks the same
// question — who is waiting *now* — so `Token.date` is the axis everything
// hangs off, and it is a business day rather than a calendar day: a clinic
// that runs past midnight keeps one logical day until the reset hour.

import type { LanguageCode } from "@/lib/i18n/config";
import { relabelSeed } from "@/lib/i18n/seed-labels";
import { translate, type TKey } from "@/lib/i18n/translate";

/** A queue line. Most businesses have one; banks and RTOs have several. */
export type Service = {
  id: string;
  name: string;
  /** Single letter prefixing the token number: A-42. "" = plain numbers. */
  prefix: string;
  /** Estimated minutes per person; drives the wait estimate. */
  avgServiceMinutes: number;
  colour: string;
  active: boolean;
  sortOrder: number;
  createdAt: string;
};

export type Counter = {
  id: string;
  name: string;
  /** Services this counter can serve. Empty = all. */
  serviceIds: string[];
  staffName: string;
  active: boolean;
  createdAt: string;
};

export type TokenStatus =
  | "waiting"
  | "called"
  | "serving"
  | "served"
  | "skipped"
  | "cancelled";

export type Token = {
  id: string;
  serviceId: string;
  /** Per service, per business day, from 1. Display value is prefix + number. */
  number: number;
  /** "YYYY-MM-DD" — the reset key. */
  date: string;
  status: TokenStatus;
  priority: boolean;
  counterId: string | null;
  customerName: string;
  phone: string;
  note: string;
  issuedAt: string;
  calledAt: string | null;
  servingStartedAt: string | null;
  closedAt: string | null;
  /** Times this token has been recalled. Two recalls → skip is offered. */
  recallCount: number;
  /** Set when the token was issued by the customer's own phone via QR. */
  selfIssued: boolean;
  /**
   * The skipped token this one replaces, when somebody came back.
   *
   * A person who missed their call does not get their old number back — they
   * are handed a fresh one and join behind everyone currently waiting. The
   * skipped row stays exactly as it was, so the reports still show that a call
   * went unanswered, and this pointer is what ties the two halves of that
   * person's visit together.
   */
  reissuedFromId: string | null;
  /** The replacement token, set on the skipped row. The other half of the link. */
  reissuedAsId: string | null;
};

export type MessageTemplateKey =
  | "tokenIssued"
  | "almostYourTurn"
  | "waitingForYou"
  | "skipped";

export type DisplayTheme = "light" | "dark" | "high-contrast";

export type TokenSettings = {
  id: "main";
  /** Tokens reset to 1 at this hour daily. */
  dailyResetHour: number;
  displayTitle: string;
  tickerText: string;
  showNextCount: number;
  voiceEnabled: boolean;
  voiceLang: string;
  voiceRate: number;
  /** Spoken pattern; {token} and {counter} substituted. */
  voiceTemplate: string;
  /**
   * Skip a called token automatically when nobody comes.
   *
   * A queue stalls on the person who wandered off, and a staff member with a
   * customer in front of them is the last person who will remember to tap
   * Skip. The clock does it instead — and the customer is told the clock is
   * running before it runs out, which is what makes it fair rather than
   * merely efficient.
   */
  autoSkipEnabled: boolean;
  /** How long a called token has to reach the counter. */
  autoSkipMinutes: number;
  chimeEnabled: boolean;
  chimeSound: "bell" | "ding" | "chime";
  /** Announce each call this many times. */
  announceRepeat: 1 | 2;
  theme: DisplayTheme;
  selfIssueEnabled: boolean;
  messageTemplates: Record<MessageTemplateKey, string>;
  pinHash?: string;
  pinSalt?: string;
  autoLockMinutes?: number;
  lastBackupAt: string | null;
  /**
   * When the queue was last reset by hand.
   *
   * Numbering restarts from 1 after it, on the same business day. That is the
   * whole point of a manual reset: a night shift that ends at 2am has finished
   * its day even though the reset hour has not come round, and the owner who
   * taps Reset now expects the next person to be number 1.
   */
  lastResetAt: string | null;
  /** Google Sheet sync target, shared shape with the other Setu apps. */
  sheetUrl?: string;
  sheetAutoSync?: boolean;
  lastSyncAt?: string | null;
};

/**
 * Chip colours, fixed rather than a free picker.
 *
 * A display seen from across a waiting room needs colours that stay apart from
 * each other at small size and in daylight; an owner given a colour wheel
 * reliably picks two blues. These are the same eight the rest of the site
 * uses for category chips.
 */
export const SERVICE_COLOURS = [
  "#26306B", // indigo
  "#F2A03D", // saffron
  "#0F766E", // teal
  "#B91C1C", // red
  "#6D28D9", // violet
  "#0369A1", // blue
  "#4D7C0F", // olive
  "#9A3412", // rust
] as const;

/**
 * Languages we commit to testing the announcement in. The Settings picker also
 * lists everything `speechSynthesis.getVoices()` reports on the device, so a
 * language missing here is never a blocker — it is just untested by us.
 */
export const VOICE_LANGUAGES: { code: string; label: string }[] = [
  { code: "hi-IN", label: "हिन्दी — Hindi" },
  { code: "en-IN", label: "English (India)" },
  { code: "mr-IN", label: "मराठी — Marathi" },
  { code: "ta-IN", label: "தமிழ் — Tamil" },
  { code: "te-IN", label: "తెలుగు — Telugu" },
  { code: "bn-IN", label: "বাংলা — Bengali" },
  { code: "gu-IN", label: "ગુજરાતી — Gujarati" },
  { code: "kn-IN", label: "ಕನ್ನಡ — Kannada" },
];

/**
 * The spoken line, in the reader's language.
 *
 * The template is stored, so it is seeded rather than translated on the way
 * out: an owner who rewrites it keeps their own words for ever.
 */
export function defaultVoiceTemplate(lang: LanguageCode): string {
  return translate(lang, "tkVoiceDefault");
}

/** A stored template that is still one of our seeds, in `lang`. */
export function voiceTemplateFor(text: string, lang: LanguageCode): string {
  return relabelSeed(text, ["tkVoiceDefault"], lang);
}

const MESSAGE_TEMPLATE_KEYS: Record<MessageTemplateKey, TKey> = {
  tokenIssued: "tkTplIssued",
  almostYourTurn: "tkTplAlmost",
  waitingForYou: "tkTplWaiting",
  skipped: "tkTplSkipped",
};

export const MESSAGE_TEMPLATE_ORDER: MessageTemplateKey[] = [
  "tokenIssued",
  "almostYourTurn",
  "waitingForYou",
  "skipped",
];

/** The shipped WhatsApp wording, in the reader's language. */
export function defaultMessageTemplates(
  lang: LanguageCode
): Record<MessageTemplateKey, string> {
  return {
    tokenIssued: translate(lang, MESSAGE_TEMPLATE_KEYS.tokenIssued),
    almostYourTurn: translate(lang, MESSAGE_TEMPLATE_KEYS.almostYourTurn),
    waitingForYou: translate(lang, MESSAGE_TEMPLATE_KEYS.waitingForYou),
    skipped: translate(lang, MESSAGE_TEMPLATE_KEYS.skipped),
  };
}

/** One stored template, re-languaged while it is still our seed. */
export function messageTemplateFor(
  key: MessageTemplateKey,
  text: string,
  lang: LanguageCode
): string {
  return relabelSeed(text || "", [MESSAGE_TEMPLATE_KEYS[key]], lang) || translate(lang, MESSAGE_TEMPLATE_KEYS[key]);
}

const PLACEHOLDER_KEYS: { token: string; key: TKey }[] = [
  { token: "{name}", key: "tkPhName" },
  { token: "{token}", key: "tkPhToken" },
  { token: "{service}", key: "tkPhService" },
  { token: "{business}", key: "tkPhBusiness" },
  { token: "{wait}", key: "tkPhWait" },
  { token: "{ahead}", key: "tkPhAhead" },
  { token: "{counter}", key: "tkPhCounter" },
  { token: "{minutes}", key: "tkPhMinutes" },
];

/** What each placeholder stands for, for the hint under the template editor. */
export function messagePlaceholders(
  lang: LanguageCode
): { token: string; meaning: string }[] {
  return PLACEHOLDER_KEYS.map(({ token, key }) => ({
    token,
    meaning: translate(lang, key),
  }));
}

export const DEFAULT_SETTINGS: TokenSettings = {
  id: "main",
  dailyResetHour: 0,
  displayTitle: "",
  tickerText: "",
  showNextCount: 5,
  voiceEnabled: true,
  voiceLang: "en-IN",
  voiceRate: 0.9,
  voiceTemplate: "",
  autoSkipEnabled: true,
  autoSkipMinutes: 2,
  chimeEnabled: true,
  chimeSound: "bell",
  announceRepeat: 2,
  theme: "light",
  selfIssueEnabled: false,
  messageTemplates: { tokenIssued: "", almostYourTurn: "", waitingForYou: "", skipped: "" },
  lastBackupAt: null,
  lastResetAt: null,
  sheetUrl: "",
  sheetAutoSync: false,
  lastSyncAt: null,
};

/**
 * The settings a new queue starts on, in the reader's language.
 *
 * DEFAULT_SETTINGS above keeps the wordy fields empty: it is the shape a
 * stored row is folded onto, and a default in the wrong language written over
 * somebody's own wording would be worse than an empty string.
 */
export function defaultTokenSettings(lang: LanguageCode): TokenSettings {
  return {
    ...DEFAULT_SETTINGS,
    voiceTemplate: defaultVoiceTemplate(lang),
    messageTemplates: defaultMessageTemplates(lang),
  };
}

/** Tokens older than this are dropped on load; Reports covers the same window. */
export const TOKEN_RETENTION_DAYS = 90;

/** Recalls after which the Counter offers Skip. */
export const RECALLS_BEFORE_SKIP = 2;

/** How close to the front a token must be for the "almost your turn" nudge. */
export const ALMOST_YOUR_TURN_POSITION = 3;

const STATUS_KEYS: Record<TokenStatus, TKey> = {
  waiting: "tkStWaiting",
  called: "tkStCalled",
  serving: "tkStServing",
  served: "tkStServed",
  skipped: "tkStSkipped",
  cancelled: "tkStCancelled",
};

/**
 * A status in words. The stored value stays the coded one — a row written in
 * Tamil has to still read as "served" after the owner switches to English.
 */
export function statusLabel(status: TokenStatus, lang: LanguageCode): string {
  const key = STATUS_KEYS[status];
  return key ? translate(lang, key) : status;
}

export function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** "A-42", or "42" when the service has no prefix. */
export function tokenLabel(token: Pick<Token, "number">, service: Service | undefined): string {
  const prefix = service?.prefix?.trim() ?? "";
  return prefix ? `${prefix}-${token.number}` : String(token.number);
}

/** Digits only, for wa.me. Indian numbers get the country code they omit. */
export function whatsAppNumber(phone: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `91${digits}`;
  return digits;
}
