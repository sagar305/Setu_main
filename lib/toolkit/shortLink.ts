// Short links for shared documents and published menus.
//
// Every Setu tool can already build a self-contained link that carries the
// whole document in its fragment (see shareLink.ts and qrmenu.ts). Those links
// never touch a server, but they run to thousands of characters and they cap a
// QR menu at whatever fits in a QR code.
//
// Shortening trades that: the same compressed payload is stored by the
// shortener service and replaced with a ten-character code. It is therefore
// always a deliberate act — the caller asks for it, per share — and it is never
// what happens by default. When the user has not asked, or is offline, or the
// service is unreachable, the long self-contained link is used instead and
// nothing is uploaded.
//
// The browser talks only to this site's own /api/short proxy; the shortener's
// API key lives on the server and is never shipped to a browser.

export type ShortLinkKind = "doc" | "menu";

export type ShortLink = {
  code: string;
  url: string;
  expiresAt: string;
  /** Menus only, returned once at publish. Never the same value as `code`. */
  editToken?: string;
};

export type ResolvedLink = {
  code: string;
  kind: ShortLinkKind;
  payload: string;
  expiresAt: string;
};

/**
 * Why a shorten attempt did not produce a link. The dialog says something
 * different for each: offline is worth waiting out, a failure is worth
 * retrying, and "unavailable" means the feature is not configured at all.
 */
export type ShortenFailure = "offline" | "unavailable" | "failed";

export class ShortenError extends Error {
  reason: ShortenFailure;

  constructor(reason: ShortenFailure, message: string) {
    super(message);
    this.name = "ShortenError";
    this.reason = reason;
  }
}

const PROXY = "/api/short";

/**
 * Whether the site was built with a shortener configured. A public flag rather
 * than the API URL itself, so nothing about the service leaks into the bundle.
 */
export function shortLinksConfigured(): boolean {
  return process.env.NEXT_PUBLIC_SHORT_LINKS_ENABLED === "true";
}

function assertOnline(): void {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new ShortenError("offline", "Shortening needs an internet connection.");
  }
}

async function readError(response: Response): Promise<never> {
  let code = "failed";
  try {
    code = ((await response.json()) as { error?: string }).error ?? "failed";
  } catch {
    // A proxy or gateway error may not be JSON at all.
  }
  throw new ShortenError("failed", `Shortener responded ${response.status} (${code}).`);
}

/** Store a payload and get a short link back. Throws ShortenError on failure. */
export async function shortenPayload(payload: string, kind: ShortLinkKind): Promise<ShortLink> {
  if (!shortLinksConfigured()) {
    throw new ShortenError("unavailable", "Short links are not configured on this site.");
  }
  assertOnline();

  let response: Response;
  try {
    response = await fetch(PROXY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload, kind }),
    });
  } catch {
    // fetch only rejects for a transport failure — DNS, TLS, no route.
    throw new ShortenError("failed", "Could not reach the shortener.");
  }

  if (!response.ok) await readError(response);
  return (await response.json()) as ShortLink;
}

/** Read a stored payload back. Returns null when the code is unknown or expired. */
export async function resolveShortLink(code: string): Promise<ResolvedLink | null> {
  const response = await fetch(`${PROXY}/${encodeURIComponent(code)}`, { cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) await readError(response);
  return (await response.json()) as ResolvedLink;
}

/** Repoint a published menu's code at new content, keeping the printed QR valid. */
export async function updateShortLink(
  code: string,
  payload: string,
  editToken: string
): Promise<ShortLink> {
  assertOnline();

  let response: Response;
  try {
    response = await fetch(`${PROXY}/${encodeURIComponent(code)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload, editToken }),
    });
  } catch {
    throw new ShortenError("failed", "Could not reach the shortener.");
  }

  if (!response.ok) await readError(response);
  return (await response.json()) as ShortLink;
}

// ---------------------------------------------------------------------------
// URL shapes
// ---------------------------------------------------------------------------

/** A shortened document: {origin}/view/{code}. */
export function shortDocUrl(code: string, origin: string): string {
  return `${origin}/view/${code}`;
}

/** A published menu: {origin}/menu/{code}. */
export function shortMenuUrl(code: string, origin: string): string {
  return `${origin}/menu/${code}`;
}

/** Ten alphanumeric characters, matching what the service mints. */
export function isShortCode(value: string): boolean {
  return /^[A-Za-z0-9]{10}$/.test(value);
}
