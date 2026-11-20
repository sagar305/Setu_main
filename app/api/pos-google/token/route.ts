import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  hasRequiredScopes,
  refreshAccess,
  sameOrigin,
  sessionConfig,
  unseal,
  type SessionCookie,
} from "@/lib/pos/drive/googleSession";

// A fresh Google access key for this device, from its encrypted cookie. The
// POS calls this on page load and before the key expires, so sync stays
// connected after a refresh or reopening the tab.
//   200 { access_token, expires_in }   connected
//   401 { error: "signin_required" }   no or expired sign-in on this device
//   501 { error: "not_configured" }    this deployment has no secret/key
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (status: number, body: unknown) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return json(403, { error: "forbidden" });
  const config = sessionConfig();
  if (!config) return json(501, { error: "not_configured" });

  const session = unseal<SessionCookie>(config.key, request.cookies.get(SESSION_COOKIE)?.value);
  if (!session?.rt) return json(401, { error: "signin_required" });

  const token = await refreshAccess(config, session.rt);
  if (!token.access_token) {
    // Revoked, expired (7 days while the Google app is in Testing) or unused
    // for months: this device must sign in again.
    if (token.error === "invalid_grant" || token.status === 400 || token.status === 401) {
      const response = json(401, { error: "signin_required" });
      response.cookies.delete({ name: SESSION_COOKIE, path: "/api/pos-google" });
      return response;
    }
    return json(502, { error: "google_unavailable" });
  }
  if (token.scope && !hasRequiredScopes(token.scope)) return json(401, { error: "signin_required" });
  return json(200, { access_token: token.access_token, expires_in: token.expires_in ?? 3600 });
}
