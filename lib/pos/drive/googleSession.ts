import "server-only";

// Server side of "stay signed in" for POS Google Drive sync.
//
// The browser can't keep a Google refresh token safely, so after the one-time
// sign-in this site keeps it for the device in an ENCRYPTED, HttpOnly cookie
// (page scripts can't read it; it is only sent to /api/pos-google/*). Each
// page load or hour, the POS asks /api/pos-google/token for a fresh access
// key. Nothing is stored at Setu: no database, the cookie lives on the device.
//
// Needs (server-only, never NEXT_PUBLIC_): GOOGLE_CLIENT_SECRET and
// POS_TOKEN_COOKIE_KEY, plus the public NEXT_PUBLIC_GOOGLE_CLIENT_ID.

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export const SESSION_COOKIE = "setu_pos_g";
export const OAUTH_COOKIE = "setu_pos_oauth";
export const COOKIE_PATH = "/api/pos-google";
export const SESSION_MAX_AGE = 180 * 24 * 60 * 60; // ~6 months
export const OAUTH_MAX_AGE = 10 * 60;

export const SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/drive.appdata",
];
const REQUIRED_SCOPES = SCOPES.slice(2);

const clean = (value: string | undefined) => (value ?? "").trim().replace(/^["']|["']$/g, "");

export type SessionConfig = { clientId: string; clientSecret: string; key: Buffer };

/** Null when the site isn't set up for this (the POS then uses the popup). */
export function sessionConfig(env: NodeJS.ProcessEnv = process.env): SessionConfig | null {
  const clientId = clean(env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);
  const clientSecret = clean(env.GOOGLE_CLIENT_SECRET);
  const rawKey = clean(env.POS_TOKEN_COOKIE_KEY);
  if (!clientId || !clientSecret || rawKey.length < 16) return null;
  // Any long random string works: it is hashed to the 32 bytes AES-256 needs.
  return { clientId, clientSecret, key: createHash("sha256").update(rawKey).digest() };
}

// ---------------------------------------------------------------------------
// Encryption (AES-256-GCM): a tampered or foreign cookie fails to open.
// ---------------------------------------------------------------------------

export function seal(key: Buffer, value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64url");
}

export function unseal<T>(key: Buffer, sealed: string | undefined): T | null {
  if (!sealed) return null;
  try {
    const raw = Buffer.from(sealed, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    const text = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Request checks
// ---------------------------------------------------------------------------

/**
 * A POST must come from a page on this same site. Browsers always send Origin
 * on cross-site POSTs, so another site can't make this site renew tokens.
 */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(request.url).host || origin === siteOrigin(request);
  } catch {
    return false;
  }
}

/** This deployment's public origin (Vercel sits behind a proxy). */
export function siteOrigin(request: Request): string {
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") ?? url.host;
  const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  return `${proto}://${host}`;
}

export function redirectUri(request: Request): string {
  return `${siteOrigin(request)}${COOKIE_PATH}/callback`;
}

/** A same-site path to come back to after a full-page sign-in, or the POS. */
export function safeReturnPath(value: string | null): string {
  if (value && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) return value;
  return "/products/browser-based-pos";
}

export function cookieOptions(maxAge: number, sameSite: "lax" | "strict") {
  return { httpOnly: true, secure: true, sameSite, path: COOKIE_PATH, maxAge };
}

// ---------------------------------------------------------------------------
// Google OAuth (authorization code with PKCE, offline access)
// ---------------------------------------------------------------------------

export function pkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function authorizeUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  challenge: string;
  loginHint?: string | null;
}): string {
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    // offline + consent: Google only issues the long-lived refresh token
    // reliably when consent is shown, including on a person's second device.
    access_type: "offline",
    prompt: "select_account consent",
    include_granted_scopes: "true",
    state: input.state,
    code_challenge: input.challenge,
    code_challenge_method: "S256",
  });
  if (input.loginHint) params.set("login_hint", input.loginHint);
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export function hasRequiredScopes(scope: string | undefined): boolean {
  const granted = new Set((scope ?? "").split(/\s+/));
  return REQUIRED_SCOPES.every((s) => granted.has(s));
}

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse & { status: number }> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
    cache: "no-store",
  });
  const body = (await response.json().catch(() => ({}))) as TokenResponse;
  return { ...body, status: response.status };
}

export function exchangeCode(config: SessionConfig, code: string, verifier: string, redirect: string) {
  return tokenRequest({
    grant_type: "authorization_code",
    code,
    code_verifier: verifier,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: redirect,
  });
}

export function refreshAccess(config: SessionConfig, refreshToken: string) {
  return tokenRequest({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });
}

export async function revoke(token: string): Promise<void> {
  await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
    cache: "no-store",
  }).catch(() => undefined);
}

/** What the session cookie holds (encrypted). */
export type SessionCookie = { rt: string; at: string };
/** What the short-lived sign-in cookie holds (encrypted). */
export type OAuthCookie = { state: string; verifier: string; nonce: string; returnTo: string; popup: boolean };

/**
 * The page the sign-in window lands on: tells the POS tab the result (same
 * site, through BroadcastChannel and localStorage, which still work when
 * Google's page cut the window's link to its opener), then closes. Without a
 * popup it goes back to where the person started.
 */
/** JSON safe to place inside a <script>: no "</script>", "<!--" or line separators. */
function scriptJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/** Sign-in window ids are plain letters and digits; anything else is dropped. */
export function cleanNonce(value: string | null | undefined): string {
  return /^[a-z0-9]{1,64}$/i.test(value ?? "") ? (value as string) : "";
}

export function resultPage(input: { nonce: string; ok: boolean; error?: string; popup: boolean; returnTo: string }): string {
  const payload = scriptJson({ type: "setu-pos-google", nonce: cleanNonce(input.nonce), ok: input.ok, error: input.error ?? "" });
  const returnTo = scriptJson(safeReturnPath(input.returnTo));
  const message = scriptJson(
    input.ok ? "Signed in. You can close this window." : `Sign-in didn't finish: ${input.error ?? "unknown error"}`,
  );
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Setu POS – Google sign-in</title></head>
<body style="font-family:system-ui,sans-serif;padding:24px;color:#1f2937"><p id="m"></p><script>
(function(){var p=${payload};var popup=${input.popup ? "true" : "false"};
document.getElementById("m").textContent=${message};
try{new BroadcastChannel("setu-pos-google").postMessage(p);}catch(e){}
try{localStorage.setItem("setu-pos-google-result",JSON.stringify(p));}catch(e){}
try{if(window.opener)window.opener.postMessage(p,location.origin);}catch(e){}
if(popup){setTimeout(function(){window.close();},300);}else{location.replace(${returnTo});}
})();</script></body></html>`;
}
