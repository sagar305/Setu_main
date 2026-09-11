// ---------------------------------------------------------------------------
// The only analytics surface the rest of the site is allowed to import.
//
// One function. No component anywhere calls `gtag`, touches the queue, or
// knows the collector's URL, which is what makes the vendor behind all this
// swappable in one file rather than in two hundred.
//
// `trackEvent` never throws, never awaits, and never blocks. It stamps the
// event and hands it to the queue; whether that event reaches a server in a
// second or in three days is the transport's problem, not the caller's.
// ---------------------------------------------------------------------------

"use client";

import { addDroppedCount, clearAll, putEvents, readDroppedCount, readQueue } from "./db";
import { applyCap } from "./policy";
import { flush, flushWithBeacon, resetCircuit } from "./transport";
import { MAX_QUEUED_EVENTS, OPT_OUT_STORAGE_KEY, type AnalyticsEvent, type EventProps } from "./types";
import { currentIdentity, nextSeq } from "./visitor";

export type { EventProps } from "./types";
export { flush, resetCircuit } from "./transport";

/**
 * Whether this visitor has asked not to be counted.
 *
 * Three ways to say no, all honoured equally: the opt-out control on the
 * privacy page, the browser's Do Not Track header, and Global Privacy Control.
 * The last two are set by people who have already expressed a preference once
 * and should not have to express it again per site.
 */
export function hasOptedOut(): boolean {
  if (typeof window === "undefined") return true;
  try {
    if (window.localStorage.getItem(OPT_OUT_STORAGE_KEY) === "1") return true;
  } catch {
    // Storage blocked. Fall through to the browser signals.
  }
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean; doNotTrack?: string };
  if (nav.globalPrivacyControl === true) return true;
  if (nav.doNotTrack === "1") return true;
  return false;
}

/** Record the visitor's choice, and throw away anything already queued. */
export function setOptedOut(optedOut: boolean): void {
  try {
    if (optedOut) window.localStorage.setItem(OPT_OUT_STORAGE_KEY, "1");
    else window.localStorage.removeItem(OPT_OUT_STORAGE_KEY);
  } catch {
    // Nothing else to try.
  }
  if (optedOut) void clearAll();
}

/**
 * How long to gather events before sending.
 *
 * Long enough that a burst — a page view, then the clicks that follow it —
 * travels as one request rather than several, short enough that a visitor who
 * leaves immediately has already been counted.
 */
const FLUSH_DEBOUNCE_MS = 2_000;

let flushTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Ask for a flush soon.
 *
 * Without this an event waits for the provider's interval tick, which is up to
 * half a minute of exposure to a closed tab for no reason.
 */
function scheduleFlush(): void {
  if (flushTimer !== null) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush();
  }, FLUSH_DEBOUNCE_MS);
}

/**
 * Queue one event.
 *
 * Fire and forget by design: the storage write is not awaited, so a click
 * handler that calls this returns immediately and a navigation is never
 * delayed. Ordering is still exact because `seq` is taken synchronously.
 */
export function trackEvent(name: string, props: EventProps = {}): void {
  if (typeof window === "undefined") return;
  if (hasOptedOut()) return;

  try {
    const now = Date.now();
    const identity = currentIdentity(now);

    const event: AnalyticsEvent = {
      eventId: crypto.randomUUID(),
      seq: nextSeq(),
      name,
      props,
      clientTs: now,
      visitorId: identity.visitorId,
      sessionId: identity.sessionId,
      visitorType: identity.visitorType,
      visitNumber: identity.visitNumber,
      path: window.location.pathname,
      referrer: document.referrer,
    };

    void enqueue(event);
    scheduleFlush();
  } catch {
    // An event that cannot be built is not worth a broken page.
  }
}

async function enqueue(event: AnalyticsEvent): Promise<void> {
  const stored = await putEvents([event]);
  if (!stored) {
    // No durable storage available. The event is lost, and that is recorded as
    // a loss so the reporting side can see it rather than reading a quiet
    // under-count as real.
    await addDroppedCount(1);
    return;
  }

  // Trim eagerly so a long offline stretch cannot grow without bound and start
  // competing with the tools' own data for the origin's storage quota.
  const queued = await readQueue();
  const { dropped } = applyCap(queued, MAX_QUEUED_EVENTS);
  if (dropped > 0) await addDroppedCount(dropped);
}

/**
 * Send everything now, for a tab that is closing.
 *
 * Reads the queue and hands it straight to a beacon. Nothing is deleted, so a
 * beacon that never arrives costs nothing and one that does arrive twice is
 * deduplicated by the collector.
 */
export async function flushOnExit(): Promise<void> {
  if (hasOptedOut()) return;
  const [queued, dropped] = await Promise.all([readQueue(), readDroppedCount()]);
  flushWithBeacon(queued, dropped);
}
