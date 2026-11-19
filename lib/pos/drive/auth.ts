// Google sign-in for POS Drive sync, entirely in the browser.
//
// Uses Google Identity Services' token client: the user approves the
// `drive.file` scope (only files this app creates or the user picks), and we
// get a short-lived access token. No client secret, no Setu server, nothing
// stored at our end. The token is kept in memory only — never in
// localStorage — so a stolen page snapshot can't reuse it.

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

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
 * Ask Google for an access token. `interactive` shows the account chooser and
 * consent (must run from a click, or the popup is blocked); otherwise Google
 * reuses an earlier consent with as little UI as it can.
 */
export async function requestToken(interactive: boolean): Promise<string> {
  const config = driveConfig();
  if (!config) throw new Error("Google Drive sync is not set up on this site.");
  await loadScript(GIS_SRC);
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) throw new Error("Google sign-in did not load.");

  return new Promise<string>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: config.clientId,
      scope: DRIVE_SCOPE,
      callback: (response) => {
        if (!response.access_token) {
          reject(new Error(response.error_description || response.error || "Google sign-in was cancelled."));
          return;
        }
        // Google lets people untick individual permissions on its consent
        // screen. Without the Drive one, every Drive request fails.
        if (!oauth2.hasGrantedAllScopes(response, DRIVE_SCOPE)) {
          reject(
            new Error(
              "Google Drive permission wasn't given. Try again and tick the box \"See, edit, create and delete only the specific Google Drive files you use with this app\" on Google's screen.",
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

/** The current token, refreshing it quietly when it has expired. */
export async function getToken(): Promise<string> {
  return currentToken() ?? requestToken(false);
}

/** Sign out: revoke the token at Google and forget it here. */
export async function signOut(): Promise<void> {
  const value = token?.value;
  token = null;
  if (value && window.google?.accounts?.oauth2) {
    await new Promise<void>((resolve) => window.google!.accounts!.oauth2!.revoke(value, resolve));
  }
}
