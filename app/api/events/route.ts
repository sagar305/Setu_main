// ---------------------------------------------------------------------------
// The collector.
//
// Same-origin on purpose: a first-party endpoint is not blocked the way a
// vendor script is, which is most of the reason the numbers here will be
// higher and truer than the ones the existing GA4 tag reports.
//
// It answers with the ids it actually forwarded rather than a bare 200. The
// client deletes only those, so a batch that is half-written goes again
// instead of quietly disappearing.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

/** Refuse absurd bodies before parsing them. */
const MAX_BODY_BYTES = 256 * 1024;
const MAX_EVENTS_PER_BATCH = 200;
const MAX_PROP_KEYS = 40;
const MAX_STRING_LENGTH = 500;

type IncomingEvent = {
  eventId: string;
  seq: number;
  name: string;
  props: Record<string, string | number | boolean>;
  clientTs: number;
  visitorId: string;
  sessionId: string;
  visitorType: string;
  visitNumber: number;
  path: string;
  referrer: string;
};

function isScalar(value: unknown): value is string | number | boolean {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

/**
 * Validate one event.
 *
 * Anything malformed is dropped rather than failing the whole batch: one bad
 * row from an old client version must not block the good ones behind it.
 */
function parseEvent(raw: unknown): IncomingEvent | null {
  if (typeof raw !== "object" || raw === null) return null;
  const value = raw as Record<string, unknown>;

  if (typeof value.eventId !== "string" || value.eventId.length > 64) return null;
  if (typeof value.name !== "string" || value.name.length > 64) return null;
  if (typeof value.visitorId !== "string" || value.visitorId.length > 64) return null;
  if (typeof value.sessionId !== "string" || value.sessionId.length > 64) return null;
  if (typeof value.seq !== "number" || !Number.isFinite(value.seq)) return null;
  if (typeof value.clientTs !== "number" || !Number.isFinite(value.clientTs)) return null;

  const props: Record<string, string | number | boolean> = {};
  if (typeof value.props === "object" && value.props !== null) {
    for (const [key, entry] of Object.entries(value.props).slice(0, MAX_PROP_KEYS)) {
      if (!isScalar(entry)) continue;
      props[key.slice(0, 64)] =
        typeof entry === "string" ? entry.slice(0, MAX_STRING_LENGTH) : entry;
    }
  }

  return {
    eventId: value.eventId,
    seq: value.seq,
    name: value.name,
    props,
    clientTs: value.clientTs,
    visitorId: value.visitorId,
    sessionId: value.sessionId,
    visitorType: typeof value.visitorType === "string" ? value.visitorType : "unknown",
    visitNumber: typeof value.visitNumber === "number" ? value.visitNumber : 0,
    path: typeof value.path === "string" ? value.path.slice(0, MAX_STRING_LENGTH) : "",
    referrer: typeof value.referrer === "string" ? value.referrer.slice(0, MAX_STRING_LENGTH) : "",
  };
}

/**
 * What the request tells us about where it came from.
 *
 * Country and coarse device only. The IP itself is read from the header and
 * never written anywhere — deriving the country is the entire reason it is
 * touched, and the privacy page says so.
 */
function requestContext(request: Request): Record<string, string> {
  const country = request.headers.get("x-vercel-ip-country") ?? "";
  const agent = request.headers.get("user-agent") ?? "";
  const mobile = /Mobi|Android|iPhone|iPad/i.test(agent);
  return {
    country,
    device: mobile ? "mobile" : "desktop",
  };
}

/**
 * Our event names, as PostHog's own products expect them.
 *
 * Web Analytics only reads `$pageview`; under any other name the page views
 * are just a custom event and its dashboard reports the install as broken.
 * The client keeps its own neutral name so the vendor stays swappable here.
 */
const POSTHOG_EVENT_NAMES: Record<string, string> = {
  page_view: "$pageview",
};

function referringDomain(referrer: string): string {
  if (!referrer) return "$direct";
  try {
    return new URL(referrer).hostname;
  } catch {
    return "$direct";
  }
}

export async function POST(request: Request) {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Batch too large" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const batch = body as { events?: unknown; droppedCount?: unknown; sentTs?: unknown };
  if (!Array.isArray(batch?.events)) {
    return NextResponse.json({ error: "Missing events" }, { status: 400 });
  }

  const events = batch.events
    .slice(0, MAX_EVENTS_PER_BATCH)
    .map(parseEvent)
    .filter((event): event is IncomingEvent => event !== null);

  if (events.length === 0) {
    return NextResponse.json({ accepted: [] });
  }

  const apiKey = process.env.POSTHOG_API_KEY;
  // US Cloud, matching the project this site forwards to. PostHog fixes a
  // project's region when it is created and it cannot be moved afterwards, so
  // a wrong host here is not a slow degradation — every batch is rejected
  // outright by a region that has never heard of the key.
  const posthogHost = process.env.POSTHOG_HOST ?? "https://us.i.posthog.com";

  if (!apiKey) {
    // Not configured. Acknowledging nothing keeps the events on the device;
    // the client's circuit breaker notices after a few attempts and stops
    // trying, so an unconfigured deployment costs a handful of requests rather
    // than a retry loop.
    return NextResponse.json({ error: "Collector not configured" }, { status: 501 });
  }

  const context = requestContext(request);
  const receivedTs = Date.now();
  // The page's own origin, so $current_url is a full URL as PostHog expects.
  const origin = new URL(request.url).origin;
  const host = new URL(request.url).host;

  const posthogBatch = events.map((event) => ({
    event: POSTHOG_EVENT_NAMES[event.name] ?? event.name,
    // `uuid` is what lets a replayed batch collapse rather than double-count.
    // The client re-sends anything it could not get an acknowledgement for —
    // notably the beacon it fires as a tab closes — so duplicates are expected
    // and must be harmless.
    uuid: event.eventId,
    timestamp: new Date(event.clientTs).toISOString(),
    properties: {
      ...event.props,
      ...context,
      distinct_id: event.visitorId,
      $session_id: event.sessionId,
      $current_url: `${origin}${event.path}`,
      $host: host,
      $pathname: event.path,
      $referrer: event.referrer || "$direct",
      $referring_domain: referringDomain(event.referrer),
      $device_type: context.device === "mobile" ? "Mobile" : "Desktop",
      // These requests come from our server, so PostHog's own IP lookup
      // would place every visitor wherever the function runs. Use the
      // country Vercel read from the visitor's request instead.
      $geoip_disable: true,
      ...(context.country ? { $geoip_country_code: context.country } : {}),
      seq: event.seq,
      visitor_type: event.visitorType,
      visit_number: event.visitNumber,
      // How long the event sat on the device before it could be sent. Non-zero
      // means it was made offline, which is worth being able to see.
      queued_ms: Math.max(0, receivedTs - event.clientTs),
      dropped_since_last_flush:
        typeof batch.droppedCount === "number" ? batch.droppedCount : 0,
    },
  }));

  try {
    const response = await fetch(`${posthogHost}/batch/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: apiKey, batch: posthogBatch }),
    });

    if (!response.ok) {
      // Acknowledge nothing. The events stay on the device and go again.
      return NextResponse.json({ accepted: [] }, { status: 502 });
    }
  } catch (error) {
    console.error("Analytics forward failed:", error);
    return NextResponse.json({ accepted: [] }, { status: 502 });
  }

  return NextResponse.json({ accepted: events.map((event) => event.eventId) });
}
