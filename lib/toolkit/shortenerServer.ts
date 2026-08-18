import "server-only";

// Server-side half of the shortener. The API key lives here and only here:
// browsers talk to /api/short on this origin, and this module is the only thing
// that ever holds the credential or knows the service's address. That is what
// keeps the shortener from being an open one.

const MAX_PAYLOAD_BYTES = 256 * 1024;

export type ShortenerConfig = { baseUrl: string; apiKey: string };

export function shortenerConfig(): ShortenerConfig | null {
  const baseUrl = process.env.SHORTENER_API_URL;
  const apiKey = process.env.SHORTENER_API_KEY;
  if (!baseUrl || !apiKey) return null;
  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}

export function isValidShortCode(value: string): boolean {
  return /^[A-Za-z0-9]{10}$/.test(value);
}

export function payloadTooLarge(payload: unknown): boolean {
  return typeof payload === "string" && Buffer.byteLength(payload, "utf8") > MAX_PAYLOAD_BYTES;
}

/**
 * Call the shortener and hand its answer straight back. Status codes are passed
 * through unchanged so the browser can tell "expired" from "went wrong", and a
 * transport failure becomes a 502 rather than an unhandled rejection.
 */
export async function callShortener(
  path: string,
  init: { method: string; body?: unknown }
): Promise<Response> {
  const config = shortenerConfig();
  if (!config) {
    return Response.json({ error: "shortener_not_configured" }, { status: 503 });
  }

  try {
    const upstream = await fetch(`${config.baseUrl}${path}`, {
      method: init.method,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
    });

    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    // Railway asleep, DNS failure, TLS problem — the caller falls back to the
    // long self-contained link, so this is a soft failure by design.
    return Response.json({ error: "shortener_unreachable" }, { status: 502 });
  }
}
