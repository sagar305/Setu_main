// Counter PIN hashing for the POS lock screen.
//
// The POS is entirely local (IndexedDB, no server), so a PIN is a deterrent
// against a customer or walk-past staff member poking at the till — not a
// defence against someone with full device access and dev tools. We still
// never store the PIN itself: it is salted and SHA-256 hashed, so a glance at
// the database doesn't reveal it.

const encoder = new TextEncoder();

export function generateSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashPin(pin: string, salt: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(`${salt}:${pin}`));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyPin(pin: string, salt: string, expectedHash: string): Promise<boolean> {
  if (!expectedHash || !salt) return false;
  const actual = await hashPin(pin, salt);
  // Length-equal comparison; not timing-safe, which is irrelevant for a local
  // 4-6 digit PIN with no remote attack surface.
  return actual === expectedHash;
}

export const PIN_MIN_LENGTH = 4;
export const PIN_MAX_LENGTH = 8;

export function isValidPinFormat(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_MIN_LENGTH},${PIN_MAX_LENGTH}}$`).test(pin);
}
