import { NextRequest } from "next/server";
import { callShortener, isValidShortCode, payloadTooLarge } from "@/lib/toolkit/shortenerServer";

// Reading a short link, and repointing a published menu at new content.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!isValidShortCode(code)) {
    return Response.json({ error: "invalid_code" }, { status: 400 });
  }
  return callShortener(`/api/links/${code}`, { method: "GET" });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!isValidShortCode(code)) {
    return Response.json({ error: "invalid_code" }, { status: 400 });
  }

  let body: { payload?: unknown; editToken?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const { payload, editToken } = body;
  if (typeof payload !== "string" || payload.length === 0) {
    return Response.json({ error: "payload_required" }, { status: 400 });
  }
  // The edit token is never the public code, so it is validated as its own
  // ten-character credential rather than trusted from the request shape.
  if (typeof editToken !== "string" || !isValidShortCode(editToken)) {
    return Response.json({ error: "invalid_edit_token" }, { status: 400 });
  }
  if (payloadTooLarge(payload)) {
    return Response.json({ error: "payload_too_large" }, { status: 413 });
  }

  return callShortener(`/api/links/${code}`, { method: "PUT", body: { payload, editToken } });
}
