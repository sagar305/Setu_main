// End-to-end encryption for Google Drive team sync.
//
// Every file the POS writes to Drive is gzip-compressed, then encrypted with
// AES-256-GCM using a key created on the owner's device. Opened in Drive, a
// file is unreadable. Setu never has any key: keys travel only inside invite
// links (after "#", which browsers never send to a server) and in each team
// member's hidden app folder in their own Drive, so signing in on another
// device still works.
//
// Two keys per shop:
//   shop key  — products, stock, team list, changes files (everyone)
//   books key — sales, stock history, cost prices, customer details, tool
//               data and staff phone numbers (owners only)
//
// Works in the browser and in Node 20+ (WebCrypto + CompressionStream).

export const ENVELOPE_APP = "setu-pos-team";
export const ENVELOPE_VERSION = 2;

export type KeyName = "shop" | "books";

/** What is stored in Drive: nothing readable but the format marker. */
export type Envelope = {
  app: typeof ENVELOPE_APP;
  v: typeof ENVELOPE_VERSION;
  /** Which key opens it (not the key itself). */
  key: KeyName;
  iv: string;
  data: string;
};

export type ShopKeys = { shop: string; books: string | null };

// ---------------------------------------------------------------------------
// base64 / base64url without Buffer (browser) — Node has atob/btoa too.
// ---------------------------------------------------------------------------

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export const toBase64Url = (bytes: Uint8Array) =>
  toBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export function fromBase64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/");
  return fromBase64(b64 + "===".slice((b64.length + 3) % 4));
}

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

/** A new random 256-bit key, as base64url text. */
export function newKey(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export function isKey(text: unknown): text is string {
  if (typeof text !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(text)) return false;
  try {
    return fromBase64Url(text).length === 32;
  } catch {
    return false;
  }
}

const keyCache = new Map<string, Promise<CryptoKey>>();

function importKey(raw: string): Promise<CryptoKey> {
  let key = keyCache.get(raw);
  if (!key) {
    key = crypto.subtle.importKey("raw", fromBase64Url(raw) as BufferSource, "AES-GCM", false, ["encrypt", "decrypt"]);
    keyCache.set(raw, key);
  }
  return key;
}

// ---------------------------------------------------------------------------
// Compression
// ---------------------------------------------------------------------------

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

export const gzip = (bytes: Uint8Array) => pipe(bytes, new CompressionStream("gzip"));
export const gunzip = (bytes: Uint8Array) => pipe(bytes, new DecompressionStream("gzip"));

// ---------------------------------------------------------------------------
// Seal / open
// ---------------------------------------------------------------------------

export class DecryptError extends Error {
  constructor(message = "This shop file can't be opened with this device's key.") {
    super(message);
    this.name = "DecryptError";
  }
}

/**
 * Compress and encrypt `value`. `label` (e.g. "live", "changes:C1") is bound
 * into the encryption, so a file can't be swapped in for a different one.
 */
export async function seal(keyName: KeyName, key: string, label: string, value: unknown): Promise<Envelope> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const packed = await gzip(new TextEncoder().encode(JSON.stringify(value)));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource, additionalData: new TextEncoder().encode(label) as BufferSource },
    await importKey(key),
    packed as BufferSource,
  );
  return { app: ENVELOPE_APP, v: ENVELOPE_VERSION, key: keyName, iv: toBase64Url(iv), data: toBase64(new Uint8Array(cipher)) };
}

export function isEnvelope(value: unknown): value is Envelope {
  const v = value as Partial<Envelope> | null;
  return !!v && v.app === ENVELOPE_APP && v.v === ENVELOPE_VERSION && typeof v.iv === "string" && typeof v.data === "string";
}

/** Decrypt and decompress; throws DecryptError for a wrong key, label or tampered file. */
export async function openEnvelope<T>(key: string, label: string, envelope: unknown): Promise<T> {
  if (!isEnvelope(envelope)) {
    throw new DecryptError(
      "This shop uses an older, unencrypted sync format. Turn team sync off on the main device and on again.",
    );
  }
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: fromBase64Url(envelope.iv) as BufferSource,
        additionalData: new TextEncoder().encode(label) as BufferSource,
      },
      await importKey(key),
      fromBase64(envelope.data) as BufferSource,
    );
  } catch {
    throw new DecryptError();
  }
  return JSON.parse(new TextDecoder().decode(await gunzip(new Uint8Array(plain)))) as T;
}

/** Short fingerprint of content, to upload a file only when it changed. */
export async function fingerprint(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text) as BufferSource);
  return toBase64Url(new Uint8Array(digest)).slice(0, 22);
}

// ---------------------------------------------------------------------------
// Keys in invite links and the printable recovery key
// ---------------------------------------------------------------------------

/** "#k=<shop>~<books>" for an invite link; the part after # never reaches a server. */
export function keysToFragment(keys: ShopKeys): string {
  return `k=${keys.shop}${keys.books ? `~${keys.books}` : ""}`;
}

export function keysFromFragment(hash: string): ShopKeys | null {
  const match = /(?:^|[#&])k=([A-Za-z0-9_-]{43})(?:~([A-Za-z0-9_-]{43}))?/.exec(hash);
  if (!match || !isKey(match[1])) return null;
  const books = match[2] && isKey(match[2]) ? match[2] : null;
  return { shop: match[1], books };
}

const RECOVERY_PREFIX = "SETU-POS-KEY";

/** The owner's recovery key: both keys in one line to print or store safely. */
export function recoveryKey(keys: ShopKeys): string {
  return `${RECOVERY_PREFIX}.${keys.shop}.${keys.books ?? ""}`;
}

export function parseRecoveryKey(text: string): ShopKeys | null {
  const parts = text.trim().replace(/\s+/g, "").split(".");
  if (parts.length !== 3 || parts[0] !== RECOVERY_PREFIX || !isKey(parts[1])) return null;
  return { shop: parts[1], books: isKey(parts[2]) ? parts[2] : null };
}
