import { NextRequest } from "next/server";
import { callShortener, payloadTooLarge } from "@/lib/toolkit/shortenerServer";

// Creating a short link. The browser posts the same compressed payload it would
// otherwise have put in the URL fragment; nothing here interprets it.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: { payload?: unknown; kind?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const { payload, kind } = body;
  if (typeof payload !== "string" || payload.length === 0) {
    return Response.json({ error: "payload_required" }, { status: 400 });
  }
  if (kind !== "doc" && kind !== "menu") {
    return Response.json({ error: "invalid_kind" }, { status: 400 });
  }
  // Checked here as well as upstream so an oversized body is refused before it
  // crosses the network a second time.
  if (payloadTooLarge(payload)) {
    return Response.json({ error: "payload_too_large" }, { status: 413 });
  }

  return callShortener("/api/links", { method: "POST", body: { payload, kind } });
}
