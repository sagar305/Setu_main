// Google sign-in for POS Drive sync, entirely in the browser.
//
// Uses Google Identity Services' token client: the user approves the
// `drive.file` scope (only files this app creates or the user picks), and we
// get a short-lived access token. No client secret, no Setu server, nothing
// stored at our end. The token is kept in memory only — never in
// localStorage — so a stolen page snapshot can't reuse it.

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
/**
 * The app's hidden folder in the user's Drive. It holds a small "my shops"
 * note so signing in on any device finds the shop. Invisible in Drive's
 * file list and readable only by this app.
 */
export const APPDATA_SCOPE = "https://www.googleapis.com/auth/drive.appdata";
const SCOPES = `${DRIVE_SCOPE} ${APPDATA_SCOPE}`;

const GIS_SRC = "https://accounts.google.com/gsi/client";

export type DriveConfig = { clientId: string; apiKey: string; projectNumber: string };

/** The public values from .env (see .env.example). Null hides Drive sync. */
export function driveConfig(): DriveConfig | null {
  // Trimmed: a stray space or quote pasted into Vercel breaks Google sign-in.
  const clean = (value: string | undefined) => (value ?? "").trim().replace(/^["']|["']$/g, "");
  const clientId = clean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);
  const apiKey = clean(process.env.NEXT_PUBLIC_GOOGLE_API_KEY);
  const projectNumber = clean(process.env.NEXT_PUBLIC_GOOGLE_PROJECT_NUMBER);
  if (!clientId || !apiKey || !projectNumber) return null;
  return { clientId, apiKey, projectNumber };
}

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

type TokenClient = { requestAccessToken: (overrides?: { prompt?: string }) => void };

type GoogleOAuth2 = {
  initTokenClient: (config: {
    client_id: string;
    scope: string;
    callback: (response: TokenResponse) => void;
    error_callback?: (error: { type: string; message?: string }) => void;
  }) => TokenClient;
  revoke: (token: string, done?: () => void) => void;
  hasGrantedAllScopes: (response: TokenResponse, ...scopes: string[]) => boolean;
};

declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GoogleOAuth2 } };
  }
}

const scriptLoads = new Map<string, Promise<void>>();

/** Load a third-party script once; later calls reuse the same promise. */
export function loadScript(src: string): Promise<void> {
  const existing = scriptLoads.get(src);
  if (existing) return existing;
  const promise = new Promise<void>((resolve, reject) => {
    const tag = document.createElement("script");
    tag.src = src;
    tag.async = true;
    tag.onload = () => resolve();
    tag.onerror = () => {
      scriptLoads.delete(src);
      reject(new Error("Could not load Google sign-in. Check your internet connection."));
    };
    document.head.appendChild(tag);
  });
  scriptLoads.set(src, promise);
  return promise;
}

let token: { value: string; expiresAt: number } | null = null;

/** A token still valid for at least a minute, or null. */
export function currentToken(): string | null {
  if (token && token.expiresAt - 60_000 > Date.now()) return token.value;
  return null;
}

/**
 * Browser-only sign-in (Google's token popup), used when this site isn't set
 * up with the stay-signed-in routes. The key it gives lives an hour and is
 * lost on refresh.
 */
async function popupToken(interactive: boolean): Promise<string> {
  const config = driveConfig();
  if (!config) throw new Error("Google Drive sync is not set up on this site.");
  await loadScript(GIS_SRC);
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) throw new Error("Google sign-in did not load.");

  return new Promise<string>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: config.clientId,
      scope: SCOPES,
      callback: (response) => {
        if (!response.access_token) {
          reject(new Error(response.error_description || response.error || "Google sign-in was cancelled."));
          return;
        }
        // Google lets people untick individual permissions on its consent
        // screen. Without the Drive one, every Drive request fails.
        if (!oauth2.hasGrantedAllScopes(response, DRIVE_SCOPE, APPDATA_SCOPE)) {
          reject(
            new Error(
              "Google Drive permission wasn't given. Try again and tick both Google Drive boxes on Google's screen (the shop's files, and this app's own settings).",
            ),
          );
          return;
        }
        token = {
          value: response.access_token,
          expiresAt: Date.now() + (response.expires_in ?? 3600) * 1000,
        };
        resolve(response.access_token);
      },
      error_callback: (error) => {
        reject(
          new Error(
            error.type === "popup_closed"
              ? "Google sign-in was closed before finishing."
              : error.type === "popup_failed_to_open"
                ? "Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again."
                : error.message || "Google sign-in failed.",
          ),
        );
      },
    });
    client.requestAccessToken({ prompt: interactive ? "consent" : "" });
  });
}

// ---------------------------------------------------------------------------
// Stay signed in: the site's /api/pos-google routes keep a refresh token for
// this device in an encrypted HttpOnly cookie, so a refresh, a reopened tab or
// the hourly expiry renews silently. Falls back to the popup above when the
// deployment doesn't have GOOGLE_CLIENT_SECRET / POS_TOKEN_COOKIE_KEY.
// ---------------------------------------------------------------------------

type ServerMode = "unknown" | "on" | "off";
let serverMode: ServerMode = "unknown";
let refreshing: Promise<string | null> | null = null;

const ROUTES = "/api/pos-google";

/** Ask the site for a fresh key from this device's cookie. Null = not signed in here. */
async function serverRefresh(): Promise<string | null> {
  if (serverMode === "off") return null;
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const response = await fetch(`${ROUTES}/token`, { method: "POST", credentials: "same-origin" });
        if (response.status === 501 || response.status === 404) {
          serverMode = "off";
          return null;
        }
        serverMode = "on";
        if (!response.ok) return null;
        const body = (await response.json()) as { access_token?: string; expires_in?: number };
        if (!body.access_token) return null;
        token = { value: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 };
        return body.access_token;
      } catch {
        return null; // offline: try again on the next sync
      } finally {
        refreshing = null;
      }
    })();
  }
  return refreshing;
}

/**
 * A valid key without showing anything: the one in memory, or a fresh one
 * from this device's stay-signed-in cookie. Null means "needs a tap".
 */
export async function silentToken(): Promise<string | null> {
  return currentToken() ?? (await serverRefresh());
}

type SignInResult = { type: "setu-pos-google"; nonce: string; ok: boolean; error: string };

const SIGN_IN_ERRORS: Record<string, string> = {
  not_configured: "not_configured",
};

/**
 * One-time sign-in through the site (popup). Must start from a tap. The
 * result comes back on a BroadcastChannel/localStorage message, because
 * Google's pages can cut the popup's link to this tab.
 */
function serverSignIn(loginHint?: string): Promise<void> {
  const nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const params = new URLSearchParams({ n: nonce, popup: "1" });
  if (loginHint) params.set("hint", loginHint);
  const popup = window.open(`${ROUTES}/start?${params}`, "setu-pos-google", "width=500,height=680");
  if (!popup) {
    // Popups blocked: do the sign-in in this tab and come back here.
    const full = new URLSearchParams({ n: nonce, return: window.location.pathname + window.location.search });
    window.location.assign(`${ROUTES}/start?${full}`);
    return new Promise(() => undefined);
  }

  return new Promise<void>((resolve, reject) => {
    let done = false;
    let closedAt = 0;
    let channel: BroadcastChannel | null = null;
    const finish = (error?: Error) => {
      if (done) return;
      done = true;
      window.clearInterval(timer);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("message", onMessage);
      channel?.close();
      if (error) reject(error);
      else resolve();
    };
    const handle = (data: unknown) => {
      const result = data as SignInResult | null;
      if (!result || result.type !== "setu-pos-google" || result.nonce !== nonce) return;
      if (result.ok) finish();
      else finish(new Error(SIGN_IN_ERRORS[result.error] ?? (result.error || "Google sign-in failed.")));
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === "setu-pos-google-result" && event.newValue) {
        try {
          handle(JSON.parse(event.newValue));
        } catch {
          // ignore
        }
      }
    };
    const onMessage = (event: MessageEvent) => {
      if (event.origin === window.location.origin) handle(event.data);
    };
    try {
      channel = new BroadcastChannel("setu-pos-google");
      channel.onmessage = (event) => handle(event.data);
    } catch {
      channel = null;
    }
    window.addEventListener("storage", onStorage);
    window.addEventListener("message", onMessage);
    // If the window is closed without a result, check whether the sign-in
    // finished anyway (the message can be missed), then give up.
    const timer = window.setInterval(async () => {
      if (done) return;
      let closed = false;
      try {
        closed = popup.closed;
      } catch {
        closed = false;
      }
      if (!closed) return;
      closedAt ||= Date.now();
      if (await serverRefresh()) finish();
      else if (Date.now() - closedAt > 4000) finish(new Error("Google sign-in was closed before finishing."));
    }, 1000);
  });
}

/**
 * Get a key, showing Google's sign-in when needed. `interactive` must come
 * from a tap. With the site's stay-signed-in routes the person signs in once
 * per device; otherwise Google's popup is used each time.
 */
export async function requestToken(interactive: boolean, loginHint?: string): Promise<string> {
  const config = driveConfig();
  if (!config) throw new Error("Google Drive sync is not set up on this site.");
  if (!interactive) {
    const quiet = await silentToken();
    if (quiet) return quiet;
    if (serverMode === "on") throw new Error("Google sign-in needed.");
    return popupToken(false);
  }
  if (serverMode !== "off") {
    try {
      await serverSignIn(loginHint);
      const fresh = await serverRefresh();
      if (fresh) return fresh;
      throw new Error("Signed in, but Google didn't give access. Please try again.");
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "not_configured") throw error;
      serverMode = "off";
    }
  }
  return popupToken(true);
}

/** The current token, refreshing it quietly when it has expired. */
export async function getToken(): Promise<string> {
  return (await silentToken()) ?? requestToken(false);
}

/** Sign this device out: revoke at Google, delete the stay-signed-in cookie. */
export async function signOut(): Promise<void> {
  const value = token?.value;
  token = null;
  await fetch(`${ROUTES}/signout`, { method: "POST", credentials: "same-origin" }).catch(() => undefined);
  if (value && window.google?.accounts?.oauth2) {
    await new Promise<void>((resolve) => window.google!.accounts!.oauth2!.revoke(value, resolve));
  }
}
