// Data model for the Free Token System (/products/free-token-system).
//
// The whole app is one day wide. Every screen except Reports asks the same
// question — who is waiting *now* — so `Token.date` is the axis everything
// hangs off, and it is a business day rather than a calendar day: a clinic
// that runs past midnight keeps one logical day until the reset hour.

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
   * When a skipped token was put back in the line.
   *
   * Restoring sends someone to the back of the queue, which is an ordering
   * change, not a re-issue — so `issuedAt` is left alone and the wait this
   * person actually endured stays in the reports honestly. Ordering reads
   * `restoredAt ?? issuedAt`.
   */
  restoredAt: string | null;
};

export type MessageTemplateKey = "tokenIssued" | "almostYourTurn";

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

export const DEFAULT_VOICE_TEMPLATE = "Token {token}, please proceed to {counter}";
export const HINDI_VOICE_TEMPLATE = "टोकन {token}, कृपया {counter} पर जाएं";

export const DEFAULT_MESSAGE_TEMPLATES: Record<MessageTemplateKey, string> = {
  tokenIssued:
    "Namaste {name}, your token at {business} is {token} for {service}. About {wait} of waiting. Please be seated.",
  almostYourTurn:
    "{name}, your token {token} at {business} is next but one. Please come to the waiting area.",
};

export const MESSAGE_PLACEHOLDERS: { token: string; meaning: string }[] = [
  { token: "{name}", meaning: "Customer's name (falls back to \"Sir/Ma'am\")" },
  { token: "{token}", meaning: "Token, e.g. A-42" },
  { token: "{service}", meaning: "Service name" },
  { token: "{business}", meaning: "Your business name" },
  { token: "{wait}", meaning: "Estimated wait, e.g. about 20 min" },
  { token: "{ahead}", meaning: "How many people are ahead" },
  { token: "{counter}", meaning: "Counter name, once called" },
];

export const DEFAULT_SETTINGS: TokenSettings = {
  id: "main",
  dailyResetHour: 0,
  displayTitle: "",
  tickerText: "",
  showNextCount: 5,
  voiceEnabled: true,
  voiceLang: "en-IN",
  voiceRate: 0.9,
  voiceTemplate: DEFAULT_VOICE_TEMPLATE,
  chimeEnabled: true,
  chimeSound: "bell",
  announceRepeat: 2,
  theme: "light",
  selfIssueEnabled: false,
  messageTemplates: DEFAULT_MESSAGE_TEMPLATES,
  lastBackupAt: null,
  lastResetAt: null,
  sheetUrl: "",
  sheetAutoSync: false,
  lastSyncAt: null,
};

/** Tokens older than this are dropped on load; Reports covers the same window. */
export const TOKEN_RETENTION_DAYS = 90;

/** Recalls after which the Counter offers Skip. */
export const RECALLS_BEFORE_SKIP = 2;

/** How close to the front a token must be for the "almost your turn" nudge. */
export const ALMOST_YOUR_TURN_POSITION = 3;

export const TOKEN_STATUS_LABELS: Record<TokenStatus, string> = {
  waiting: "Waiting",
  called: "Called",
  serving: "Serving",
  served: "Served",
  skipped: "Skipped",
  cancelled: "Cancelled",
};

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
