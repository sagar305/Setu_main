import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import {
  OAUTH_COOKIE,
  OAUTH_MAX_AGE,
  authorizeUrl,
  cleanNonce,
  cookieOptions,
  pkcePair,
  redirectUri,
  resultPage,
  safeReturnPath,
  seal,
  sessionConfig,
  type OAuthCookie,
} from "@/lib/pos/drive/googleSession";

// Starts the one-time Google sign-in for POS Drive sync. Opened in a popup
// (or the whole tab, if popups are blocked) from a tap in the POS.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const nonce = cleanNonce(url.searchParams.get("n"));
  const popup = url.searchParams.get("popup") === "1";
  const returnTo = safeReturnPath(url.searchParams.get("return"));
  const config = sessionConfig();
  if (!config) {
    // Not set up on this deployment: tell the POS to use its popup sign-in.
    return new NextResponse(resultPage({ nonce, ok: false, error: "not_configured", popup, returnTo }), {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  const state = randomBytes(24).toString("base64url");
  const { verifier, challenge } = pkcePair();
  const cookie: OAuthCookie = { state, verifier, nonce, returnTo, popup };
  const response = NextResponse.redirect(
    authorizeUrl({
      clientId: config.clientId,
      redirectUri: redirectUri(request),
      state,
      challenge,
      loginHint: url.searchParams.get("hint"),
    }),
  );
  // Lax: it must come back with Google's redirect to /callback.
  response.cookies.set(OAUTH_COOKIE, seal(config.key, cookie), cookieOptions(OAUTH_MAX_AGE, "lax"));
  response.headers.set("Cache-Control", "no-store");
  return response;
}
