import "server-only";

// Server half of the Free Dine → premium QR Menu sync.
//
// Free Dine runs on this origin and the QR Menu API lives on another, so the
// browser posts here and this forwards to it. That keeps the API's CORS list
// down to its own dashboard, and keeps its address configurable without a
// rebuild. The sync key passes straight through — this route never stores or
// logs it.

const POS_KEY_HEADER = "x-setu-pos-key";
const MAX_BODY_BYTES = 512 * 1024;

/** e.g. https://api.qr-menu.setutechnology.com/api — note the /api suffix. */
function apiBase(): string | null {
  const url = process.env.QR_MENU_API_URL;
  return url ? url.replace(/\/+$/, "") : null;
}

export async function forwardToQrMenu(
  request: Request,
  path: string,
  method: "GET" | "PUT"
): Promise<Response> {
  const base = apiBase();
  if (!base) {
    return Response.json(
      { error: "Premium QR Menu sync is not configured on this site (QR_MENU_API_URL)." },
      { status: 503 }
    );
  }

  const key = request.headers.get(POS_KEY_HEADER)?.trim() ?? "";
  if (!key) {
    return Response.json({ error: "Paste your QR Menu sync key first." }, { status: 401 });
  }

  let body: string | undefined;
  if (method === "PUT") {
    body = await request.text();
    if (Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) {
      return Response.json({ error: "This menu is too large to sync." }, { status: 413 });
    }
  }

  try {
    const upstream = await fetch(`${base}${path}`, {
      method,
      headers: { "Content-Type": "application/json", [POS_KEY_HEADER]: key },
      body,
      cache: "no-store",
    });
    const text = await upstream.text();
    try {
      JSON.parse(text);
    } catch {
      // A gateway page from whatever sits in front of the API, not its answer.
      return Response.json(
        { error: "Setu QR Menu is not responding right now. Try again in a minute." },
        { status: 502 }
      );
    }
    return new Response(text, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return Response.json(
      { error: "Setu QR Menu is not reachable right now. Try again in a minute." },
      { status: 502 }
    );
  }
}
