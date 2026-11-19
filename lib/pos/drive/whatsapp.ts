// Sending a team invite on WhatsApp. No WhatsApp API or account at Setu: the
// owner's own WhatsApp opens with the message ready, through a wa.me link.

/**
 * A mobile number as WhatsApp wants it in a wa.me link: country code and
 * number, digits only. `defaultCountry` (e.g. "91") is added to a local
 * 10-digit number; anything else must already carry its country code.
 * Returns null when it can't be a valid number.
 */
export function normalizePhone(raw: string, defaultCountry: string | null): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let digits = trimmed.replace(/[^\d]/g, "");
  const international = trimmed.startsWith("+") || trimmed.startsWith("00");
  if (trimmed.startsWith("00")) digits = digits.slice(2);
  if (!international) {
    // Indian style: a leading 0 before a 10-digit mobile number.
    if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
    if (digits.length === 10 && defaultCountry) digits = defaultCountry + digits;
  }
  // E.164 allows up to 15 digits; real mobile numbers have at least 10.
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

/** "+91 98765 43210" style, for showing a saved number. */
export function formatPhone(digits: string): string {
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  return `+${digits}`;
}

export function inviteMessage(input: {
  name?: string;
  shopName: string;
  email: string;
  link: string;
}): string {
  const hello = input.name?.trim() ? `Hi ${input.name.trim()},` : "Hi,";
  return [
    `${hello} you're invited to ${input.shopName} on Setu POS.`,
    ``,
    `1. Open this link once and sign in with Google as ${input.email}:`,
    input.link,
    `2. Select the shop files Google shows you.`,
    ``,
    `After that, just open Setu POS and tap "Sign in with Google" on any phone or computer.`,
  ].join("\n");
}

/** wa.me link that opens WhatsApp to this number with the message typed in. */
export function whatsappUrl(phoneDigits: string, message: string): string {
  return `https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`;
}

/** Default country code for local numbers, from the shop's currency. */
export function defaultCountryFor(currency: string | undefined): string | null {
  return currency === "INR" ? "91" : null;
}
