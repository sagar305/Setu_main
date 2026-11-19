import { NextResponse, type NextRequest } from "next/server";
import {
  OAUTH_COOKIE,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  cookieOptions,
  exchangeCode,
  hasRequiredScopes,
  redirectUri,
  resultPage,
  seal,
  sessionConfig,
  unseal,
  type OAuthCookie,
  type SessionCookie,
} from "@/lib/pos/drive/googleSession";

// Google sends the person back here with a one-time code. We trade it for a
// refresh token (needs the client secret, which never leaves the server) and
// keep that token for this device in an encrypted, HttpOnly cookie.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const html = (body: string) =>
  new NextResponse(body, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });

export async function GET(request: NextRequest) {
  const config = sessionConfig();
  const url = request.nextUrl;
  const saved = config ? unseal<OAuthCookie>(config.key, request.cookies.get(OAUTH_COOKIE)?.value) : null;
  const nonce = saved?.nonce ?? "";
  const popup = saved?.popup ?? true;
  const returnTo = saved?.returnTo ?? "/products/browser-based-pos";

  const fail = (error: string) => {
    const response = html(resultPage({ nonce, ok: false, error, popup, returnTo }));
    response.cookies.delete({ name: OAUTH_COOKIE, path: "/api/pos-google" });
    return response;
  };

  if (!config) return fail("not_configured");
  if (!saved || !saved.state || url.searchParams.get("state") !== saved.state) {
    return fail("The sign-in took too long or was started in another window. Please try again.");
  }
  const googleError = url.searchParams.get("error");
  if (googleError) return fail(googleError === "access_denied" ? "Google sign-in was cancelled." : googleError);
  const code = url.searchParams.get("code");
  if (!code) return fail("Google didn't send a sign-in code. Please try again.");

  const token = await exchangeCode(config, code, saved.verifier, redirectUri(request));
  if (!token.access_token) {
    return fail(token.error_description || token.error || "Google refused the sign-in.");
  }
  if (!hasRequiredScopes(token.scope)) {
    return fail("Google Drive permission wasn't given. Try again and tick both Google Drive boxes.");
  }
  if (!token.refresh_token) {
    return fail("Google didn't allow staying signed in. Please try again.");
  }

  const session: SessionCookie = { rt: token.refresh_token, at: new Date().toISOString() };
  const response = html(resultPage({ nonce, ok: true, popup, returnTo }));
  response.cookies.set(SESSION_COOKIE, seal(config.key, session), cookieOptions(SESSION_MAX_AGE, "strict"));
  response.cookies.delete({ name: OAUTH_COOKIE, path: "/api/pos-google" });
  return response;
}
