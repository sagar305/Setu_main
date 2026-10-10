// WhatsApp message building for the Tuition Class Manager.
//
// Nothing here sends a message. The app has no server and no login, so it can
// only prepare the text and hand it to WhatsApp (or the OS share sheet) — the
// teacher taps send, one parent at a time. That is a deliberate limit of the
// offline model, not an oversight; automated sending needs a WhatsApp Business
// API account and lives in the paid product.

import type { LanguageCode } from "@/lib/i18n/config";
import { translate, type TKey } from "@/lib/i18n/translate";
import { getWhatsAppShareUrl } from "@/lib/share";
import { whatsAppNumber } from "./types";

export type MessageVars = Record<string, string | number | undefined>;

/**
 * Replace {placeholders} with values. Unknown placeholders are stripped so a
 * half-edited template never sends "{amount}" to a parent.
 */
export function fillTemplate(template: string, vars: MessageVars): string {
  return template
    .replace(/\{(\w+)\}/g, (_match, key: string) => {
      const value = vars[key];
      return value === undefined || value === null ? "" : String(value);
    })
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** wa.me link for a parent's number, or the generic chooser when unknown. */
export function whatsAppLink(phone: string, message: string): string {
  const number = whatsAppNumber(phone);
  return getWhatsAppShareUrl(message, number || undefined);
}

/** SMS fallback for parents who do not use WhatsApp. */
export function smsLink(phone: string, message: string): string {
  const digits = (phone || "").replace(/[^\d+]/g, "");
  // iOS wants &body=, Android accepts ?body= — the ?& form works on both.
  return `sms:${digits}?&body=${encodeURIComponent(message)}`;
}

/** One prepared, unsent message in a send queue. */
export type OutboundMessage = {
  id: string;
  /** Student / recipient name, shown in the queue. */
  name: string;
  phone: string;
  message: string;
  /** Optional callback marker so the caller can record "sent" state. */
  ref?: string;
};

const PLACEHOLDER_KEYS: { token: string; key: TKey }[] = [
  { token: "{student}", key: "tuPhStudent" },
  { token: "{parent}", key: "tuPhParent" },
  { token: "{teacher}", key: "tuPhTeacher" },
  { token: "{class}", key: "tuPhClass" },
  { token: "{batch}", key: "tuPhBatch" },
  { token: "{amount}", key: "tuPhAmount" },
  { token: "{period}", key: "tuPhPeriod" },
  { token: "{date}", key: "tuPhDate" },
  { token: "{due}", key: "tuPhDue" },
  { token: "{test}", key: "tuPhTest" },
  { token: "{subject}", key: "tuPhSubject" },
  { token: "{marks}", key: "tuPhMarks" },
  { token: "{max}", key: "tuPhMax" },
  { token: "{percent}", key: "tuPhPercent" },
  { token: "{average}", key: "tuPhAverage" },
  { token: "{present}", key: "tuPhPresent" },
  { token: "{total}", key: "tuPhTotal" },
  { token: "{note}", key: "tuPhNote" },
  { token: "{link}", key: "tuPhLink" },
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
