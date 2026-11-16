// ---------------------------------------------------------------------------
// Setu Workflow license keys.
//
// A paid order on setutechnology.com (or a quote agreed with sales) is turned
// into a key the firm's account owner pastes into Admin → Subscription. Redeeming
// it extends the firm's subscription by the key's days and sets how many users
// it covers.
//
// Same design as the Setu QR Menu keys (lib/qrMenuLicense.ts), with a seat
// count added and its own AAD and prefix, so a QR Menu key can never redeem in
// Workflow or vice versa.
// THE SAME FILE LIVES IN Setu-workflow/src/lib/license-key.ts: this site issues
// keys and the app redeems them, so both sides must agree byte for byte and
// share WORKFLOW_LICENSE_SECRET. The test vector in
// tests/workflow/checkout.test.ts (and the app's tests/license-key.test.ts)
// pins the format.
//
// Format (43 bytes, then base32 for typing):
//
//   iv (12) | AES-256-GCM( version (1) | days (uint16) | seats (uint16) | keyId (10) ) | tag (16)
//
// - Encrypted and authenticated, so a key cannot be read, forged or have its
//   days or seats edited without the secret.
// - Deterministic for an order: the iv and keyId both derive from the order
//   id, so looking the same paid order up twice gives back the same key rather
//   than a second one. Redemptions record each keyId, which makes a key
//   single-use.
// ---------------------------------------------------------------------------

import { createCipheriv, createDecipheriv, createHash, createHmac } from "node:crypto";

const VERSION = 1;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_ID_BYTES = 10;
const PAYLOAD_BYTES = 1 + 2 + 2 + KEY_ID_BYTES;
const TOKEN_BYTES = IV_BYTES + PAYLOAD_BYTES + TAG_BYTES;
const BODY_CHARS = Math.ceil((TOKEN_BYTES * 8) / 5);
const AAD = Buffer.from("setu-workflow-license");
export const LICENSE_PREFIX = "SETUWF";
const GROUP = 6;

/** Ten years. Anything larger is not a key Setu would ever sell. */
export const MAX_LICENSE_DAYS = 3660;
/** A firm larger than this is a conversation, not a key. */
export const MAX_LICENSE_SEATS = 1000;

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/**
 * A plan key adds days (1 or more) and sets the plan's users. A key with 0
 * days is an additional-users top-up: it adds `seats` users to a plan that is
 * already running, without changing its end date.
 */
export type License = {
  /** Hex. Stable per order; stored on redemption to refuse a second one. */
  keyId: string;
  days: number;
  seats: number;
};

function deriveKeys(secret: string) {
  if (!secret) throw new Error("A license secret is required.");
  return {
    enc: createHash("sha256").update(`enc:${secret}`).digest(),
    mac: createHash("sha256").update(`mac:${secret}`).digest(),
  };
}

function base32Encode(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(text: string): Buffer | null {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of text) {
    const index = ALPHABET.indexOf(char);
    if (index === -1) return null;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** Groups the key so it can be read aloud or typed from a printout. */
function format(body: string): string {
  const groups = body.match(new RegExp(`.{1,${GROUP}}`, "g")) ?? [];
  return [LICENSE_PREFIX, ...groups].join("-");
}

/**
 * Undoes formatting and the usual misreadings. Base32 has no 0, 1 or 8, so a
 * typed one can only have been O, I or B.
 */
function normalise(input: string): string {
  let text = input.toUpperCase().replace(/[\s-]+/g, "");
  // Length-checked, so a key pasted without its prefix whose body happens to
  // start with the same letters is not mangled.
  if (text.length === LICENSE_PREFIX.length + BODY_CHARS && text.startsWith(LICENSE_PREFIX)) {
    text = text.slice(LICENSE_PREFIX.length);
  }
  return text.replace(/0/g, "O").replace(/1/g, "I").replace(/8/g, "B");
}

export function issueLicenseKey(
  orderId: string,
  days: number,
  seats: number,
  secret: string,
): string {
  if (!orderId) throw new Error("An order id is required.");
  if (!Number.isInteger(days) || days < 0 || days > MAX_LICENSE_DAYS) {
    throw new Error(`License days must be a whole number from 0 to ${MAX_LICENSE_DAYS}.`);
  }
  if (!Number.isInteger(seats) || seats < 1 || seats > MAX_LICENSE_SEATS) {
    throw new Error(`License seats must be a whole number from 1 to ${MAX_LICENSE_SEATS}.`);
  }
  const keys = deriveKeys(secret);
  const iv = createHmac("sha256", keys.mac).update(`iv:${orderId}`).digest().subarray(0, IV_BYTES);
  const keyId = createHmac("sha256", keys.mac)
    .update(`id:${orderId}`)
    .digest()
    .subarray(0, KEY_ID_BYTES);

  const payload = Buffer.alloc(PAYLOAD_BYTES);
  payload.writeUInt8(VERSION, 0);
  payload.writeUInt16BE(days, 1);
  payload.writeUInt16BE(seats, 3);
  keyId.copy(payload, 5);

  const cipher = createCipheriv("aes-256-gcm", keys.enc, iv);
  cipher.setAAD(AAD);
  const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
  const token = Buffer.concat([iv, encrypted, cipher.getAuthTag()]);
  return format(base32Encode(token));
}

/** The license inside a key, or null for anything mistyped, forged or tampered with. */
export function readLicenseKey(input: string, secret: string): License | null {
  const bytes = base32Decode(normalise(input));
  if (!bytes || bytes.length !== TOKEN_BYTES) return null;

  const keys = deriveKeys(secret);
  const iv = bytes.subarray(0, IV_BYTES);
  const encrypted = bytes.subarray(IV_BYTES, IV_BYTES + PAYLOAD_BYTES);
  const tag = bytes.subarray(IV_BYTES + PAYLOAD_BYTES);

  let payload: Buffer;
  try {
    const decipher = createDecipheriv("aes-256-gcm", keys.enc, iv);
    decipher.setAAD(AAD);
    decipher.setAuthTag(tag);
    payload = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  } catch {
    return null;
  }

  if (payload.readUInt8(0) !== VERSION) return null;
  const days = payload.readUInt16BE(1);
  const seats = payload.readUInt16BE(3);
  if (days > MAX_LICENSE_DAYS) return null;
  if (seats < 1 || seats > MAX_LICENSE_SEATS) return null;
  return { keyId: payload.subarray(5).toString("hex"), days, seats };
}
