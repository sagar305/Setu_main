// WhatsApp message building for the Tuition Class Manager.
//
// Nothing here sends a message. The app has no server and no login, so it can
// only prepare the text and hand it to WhatsApp (or the OS share sheet) — the
// teacher taps send, one parent at a time. That is a deliberate limit of the
// offline model, not an oversight; automated sending needs a WhatsApp Business
// API account and lives in the paid product.

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

export const MESSAGE_PLACEHOLDERS: { token: string; meaning: string }[] = [
  { token: "{student}", meaning: "Student's name" },
  { token: "{parent}", meaning: "Parent's name (falls back to \"Sir/Ma'am\")" },
  { token: "{teacher}", meaning: "Your name / institute name" },
  { token: "{class}", meaning: "Student's class" },
  { token: "{batch}", meaning: "Batch name" },
  { token: "{amount}", meaning: "Amount, formatted" },
  { token: "{period}", meaning: "Month, e.g. Aug 2026" },
  { token: "{date}", meaning: "Date of the class / payment" },
  { token: "{due}", meaning: "Due date" },
  { token: "{test}", meaning: "Test name" },
  { token: "{subject}", meaning: "Subject" },
  { token: "{marks}", meaning: "Marks scored" },
  { token: "{max}", meaning: "Maximum marks" },
  { token: "{percent}", meaning: "Percentage" },
  { token: "{average}", meaning: "Class average" },
  { token: "{present}", meaning: "Classes attended" },
  { token: "{total}", meaning: "Total classes" },
  { token: "{note}", meaning: "The diary note" },
  { token: "{link}", meaning: "Shareable link to the receipt / report" },
];
