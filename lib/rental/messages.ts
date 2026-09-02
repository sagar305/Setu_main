// WhatsApp and SMS message building for the rental book.
//
// Nothing here sends anything. The app has no server and no login, so it can
// only prepare the text and hand it to WhatsApp or the OS share sheet — the
// owner taps send, one customer at a time. Automated sending needs a WhatsApp
// Business API account and lives in the paid product.
//
// Placeholders are {{doubled}} here rather than {single}, matching the spec's
// templates. The rest of the site uses single braces; both are deliberate and
// neither is going to be typed by hand often, since Settings lists the tokens.

import { getWhatsAppShareUrl } from "@/lib/share";
import { formatDate, whatsAppNumber, type RentalTemplateKey } from "./types";

export type MessageVars = Record<string, string | number | undefined | null>;

/**
 * Replace {{placeholders}} with values. Unknown or empty placeholders are
 * stripped so a half-edited template never sends "{{amount}}" to a customer.
 */
export function fillTemplate(template: string, vars: MessageVars): string {
  return template
    .replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
      const value = vars[key];
      return value === undefined || value === null ? "" : String(value);
    })
    .replace(/[ \t]{2,}/g, " ")
    // A placeholder that resolved to nothing leaves the punctuation that framed
    // it — "…to 04 Sept, ." for a booking with no venue. Tidy that up rather
    // than sending it to a customer.
    .replace(/,\s*([.!?])/g, "$1")
    .replace(/\s+([,.!?])/g, "$1")
    .replace(/([(\[])\s*([)\]])/g, "")
    .replace(/\s+\n/g, "\n")
    .trim();
}

/** wa.me link for a customer's number, or the generic chooser when unknown. */
export function whatsAppLink(phone: string, message: string): string {
  const number = whatsAppNumber(phone);
  return getWhatsAppShareUrl(message, number || undefined);
}

/** SMS fallback for customers who do not use WhatsApp. */
export function smsLink(phone: string, message: string): string {
  const digits = (phone || "").replace(/[^\d+]/g, "");
  // iOS wants &body=, Android accepts ?body= — the ?& form works on both.
  return `sms:${digits}?&body=${encodeURIComponent(message)}`;
}

export const TEMPLATE_LABELS: Record<RentalTemplateKey, string> = {
  quotation: "Quotation sent",
  confirmed: "Booking confirmed",
  dispatchReminder: "Dispatch reminder",
  returnDue: "Return due",
  overdue: "Overdue",
  settlement: "Settled",
};

/** Money as the templates want it: a bare figure, since they write the ₹. */
export function plainAmount(value: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(
    Number.isFinite(value) ? value : 0
  );
}

/** Dates in messages are read by a customer, not a machine. */
export function messageDate(key: string): string {
  return key ? formatDate(key) : "";
}
