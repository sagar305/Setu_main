// ---------------------------------------------------------------------------
// Setu QR Menu license keys.
//
// A paid order on setutechnology.com is turned into a key the owner pastes into
// Settings in the QR Menu app, which extends their premium by the key's days.
//
// THE SAME FILE LIVES IN menu-qr-generator-be/src/lib/licenseKey.ts. The site
// issues keys and the backend redeems them, so both sides must agree byte for
// byte — change one, change the other, and keep the shared test vector in each
// repo's tests passing.
//
// Format (41 bytes, then base32 for typing):
//
//   iv (12) | AES-256-GCM( version (1) | days (uint16) | keyId (10) ) | tag (16)
//
// - Encrypted and authenticated, so a key cannot be read, forged or have its
//   days edited without QR_MENU_LICENSE_SECRET.
// - Deterministic for an order: the iv and keyId are both derived from the
//   order id, so looking the same paid order up twice hands back the same key
//   rather than a second one. The backend records each redeemed keyId, which
//   is what makes a key single-use.
// ---------------------------------------------------------------------------

import { createCipheriv, createDecipheriv, createHash, createHmac } from "node:crypto";

const VERSION = 1;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_ID_BYTES = 10;
const PAYLOAD_BYTES = 1 + 2 + KEY_ID_BYTES;
const TOKEN_BYTES = IV_BYTES + PAYLOAD_BYTES + TAG_BYTES;
const BODY_CHARS = Math.ceil((TOKEN_BYTES * 8) / 5);
const AAD = Buffer.from("setu-qr-menu-license");
const PREFIX = "SETU";
const GROUP = 6;

/** Ten years. Anything larger is not a key this site would ever sell. */
export const MAX_LICENSE_DAYS = 3660;

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export type License = {
  /** Hex. Stable per order; the backend stores it to refuse a second redemption. */
  keyId: string;
  days: number;
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
  return [PREFIX, ...groups].join("-");
}

/**
 * Undoes formatting and the usual misreadings. Base32 has no 0, 1 or 8, so a
 * typed one can only have been O, I or B.
 */
function normalise(input: string): string {
  let text = input.toUpperCase().replace(/[\s-]+/g, "");
  // Length-checked, so a key pasted without its prefix whose body happens to
  // start with the same four letters is not mangled.
  if (text.length === PREFIX.length + BODY_CHARS && text.startsWith(PREFIX)) {
    text = text.slice(PREFIX.length);
  }
  return text.replace(/0/g, "O").replace(/1/g, "I").replace(/8/g, "B");
}

export function issueLicenseKey(orderId: string, days: number, secret: string): string {
  if (!Number.isInteger(days) || days < 1 || days > MAX_LICENSE_DAYS) {
    throw new Error(`License days must be a whole number from 1 to ${MAX_LICENSE_DAYS}.`);
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
  keyId.copy(payload, 3);

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
  if (days < 1 || days > MAX_LICENSE_DAYS) return null;
  return { keyId: payload.subarray(3).toString("hex"), days };
}
