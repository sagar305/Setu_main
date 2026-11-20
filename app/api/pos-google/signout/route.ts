import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, revoke, sameOrigin, sessionConfig, unseal, type SessionCookie } from "@/lib/pos/drive/googleSession";

// Sign this device out of Google for POS sync: revoke the token at Google and
// delete the cookie. Used when someone leaves a team or is removed.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const config = sessionConfig();
  if (config) {
    const session = unseal<SessionCookie>(config.key, request.cookies.get(SESSION_COOKIE)?.value);
    if (session?.rt) await revoke(session.rt);
  }
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.delete({ name: SESSION_COOKIE, path: "/api/pos-google" });
  return response;
}
