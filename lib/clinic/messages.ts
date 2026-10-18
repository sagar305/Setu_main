// WhatsApp message building for the Free Clinic Manager.
//
// Nothing here sends a message. The app has no server and no login, so it can
// only prepare the text and hand it to WhatsApp — the front desk taps send, one
// patient at a time. That is a deliberate limit of the offline model; automated
// sending needs a WhatsApp Business API account and lives in the paid product.
//
// Clinic templates use {{double}} braces (spec §6) rather than the tuition
// manager's {single}. Both forms are accepted so a template pasted from either
// app still fills in.

import { getWhatsAppShareUrl } from "@/lib/share";
import { whatsAppNumber } from "./types";
import type { LanguageCode } from "@/lib/i18n/config";
import { translate, type TKey } from "@/lib/i18n/translate";

export type MessageVars = Record<string, string | number | undefined>;

/**
 * Replace {{placeholders}} with values. Unknown placeholders are stripped so a
 * half-edited template never sends "{{amount}}" to a patient.
 */
export function fillTemplate(template: string, vars: MessageVars): string {
  const lookup = (key: string) => {
    const value = vars[key];
    return value === undefined || value === null ? "" : String(value);
  };
  return (template || "")
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => lookup(key))
    .replace(/\{\s*(\w+)\s*\}/g, (_match, key: string) => lookup(key))
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** wa.me link for a patient's number, or the generic chooser when unknown. */
export function whatsAppLink(phone: string, message: string): string {
  const number = whatsAppNumber(phone);
  return getWhatsAppShareUrl(message, number || undefined);
}

/** SMS fallback for patients who do not use WhatsApp. */
export function smsLink(phone: string, message: string): string {
  const digits = (phone || "").replace(/[^\d+]/g, "");
  // iOS wants &body=, Android accepts ?body= — the ?& form works on both.
  return `sms:${digits}?&body=${encodeURIComponent(message)}`;
}

/** One prepared, unsent message in a send queue. */
export type OutboundMessage = {
  id: string;
  /** Patient name, shown in the queue. */
  name: string;
  phone: string;
  message: string;
  /** Optional callback marker so the caller can record "sent" state. */
  ref?: string;
};

/**
 * What each placeholder stands for, listed beside the template editor in
 * Settings. The tokens themselves are part of the template syntax and stay
 * as written; only the explanation beside them follows the reader.
 */
const PLACEHOLDER_KEYS: { token: string; key: TKey }[] = [
  { token: "{{patientName}}", key: "clPhPatientName" },
  { token: "{{patientCode}}", key: "clPhPatientCode" },
  { token: "{{doctorName}}", key: "clPhDoctorName" },
  { token: "{{clinicName}}", key: "clPhClinicName" },
  { token: "{{clinicPhone}}", key: "clPhClinicPhone" },
  { token: "{{date}}", key: "clPhDate" },
  { token: "{{time}}", key: "clPhTime" },
  { token: "{{amount}}", key: "clPhAmount" },
  { token: "{{upiId}}", key: "clPhUpiId" },
];

export function clinicPlaceholders(
  lang: LanguageCode
): { token: string; meaning: string }[] {
  return PLACEHOLDER_KEYS.map(({ token, key }) => ({
    token,
    meaning: translate(lang, key),
  }));
}
