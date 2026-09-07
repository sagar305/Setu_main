// ---------------------------------------------------------------------------
// The rules the queue runs on, with no storage and no network in sight.
//
// Splitting these out is what makes the delivery guarantee testable. The
// interesting failures here are not "does IndexedDB work" but "what happens
// when the cap is reached mid-flush", "does a replayed batch double-count",
// "does the backoff actually stop growing" — all answerable in Node against
// plain arrays.
// ---------------------------------------------------------------------------

import {
  CIRCUIT_BREAK_AFTER,
  MAX_BATCH_SIZE,
  MAX_QUEUED_EVENTS,
  RETRY_BASE_MS,
  RETRY_MAX_MS,
  type AnalyticsEvent,
} from "./types";

/**
 * Trim a queue to the cap, oldest first.
 *
 * Oldest-first is the deliberate choice. When a backlog has built up offline,
 * the recent events are the ones still worth having: they describe what the
 * visitor is doing now, and the stale head of the queue is the part whose
 * absence distorts least. The count of what went is returned so it can be
 * reported rather than quietly absorbed.
 */
export function applyCap(
  events: AnalyticsEvent[],
  cap: number = MAX_QUEUED_EVENTS
): { kept: AnalyticsEvent[]; dropped: number } {
  if (events.length <= cap) return { kept: events, dropped: 0 };
  const dropped = events.length - cap;
  return { kept: events.slice(dropped), dropped };
}

/**
 * The next batch to send: oldest first, so events arrive in roughly the order
 * they happened even before `seq` is used to sort them properly.
 */
export function selectBatch(
  events: AnalyticsEvent[],
  size: number = MAX_BATCH_SIZE
): AnalyticsEvent[] {
  return events.slice(0, size);
}

/**
 * What is left after the collector acknowledges some ids.
 *
 * Only acknowledged events are removed. Anything the collector did not name —
 * a partial write, a batch cut short — stays queued and goes again, which is
 * the client half of the exactly-once guarantee. The server half is deduping
 * on `eventId`.
 */
export function removeAccepted(
  events: AnalyticsEvent[],
  accepted: readonly string[]
): AnalyticsEvent[] {
  if (accepted.length === 0) return events;
  const done = new Set(accepted);
  return events.filter((event) => !done.has(event.eventId));
}

/**
 * How long to wait before retry number `attempt` (1-based).
 *
 * Exponential with full jitter, capped. The jitter matters more than it looks:
 * without it, every tab that went offline during the same outage comes back at
 * the same instant and lands on the collector together.
 */
export function backoffDelay(attempt: number, random: () => number = Math.random): number {
  const exponential = Math.min(RETRY_BASE_MS * 2 ** Math.max(0, attempt - 1), RETRY_MAX_MS);
  return Math.round(exponential * (0.5 + random() * 0.5));
}

/** Whether consecutive failures have earned a pause. */
export function isCircuitOpen(consecutiveFailures: number): boolean {
  return consecutiveFailures >= CIRCUIT_BREAK_AFTER;
}

/**
 * Whether it is worth attempting a flush at all.
 *
 * Being offline is not a failure and must not count toward the circuit
 * breaker — it is the case the queue was built for.
 */
export function shouldAttemptFlush(state: {
  queued: number;
  online: boolean;
  inFlight: boolean;
  consecutiveFailures: number;
}): boolean {
  if (state.queued === 0) return false;
  if (state.inFlight) return false;
  if (!state.online) return false;
  return !isCircuitOpen(state.consecutiveFailures);
}

/**
 * Sort a batch into true happened-order.
 *
 * `seq` is per visitor and monotonic, so it orders correctly even when two
 * events share a millisecond or the device clock moved between them. Events
 * from different visitors never share a queue, but the fallback on `clientTs`
 * keeps this total rather than partial.
 */
export function inHappenedOrder(events: AnalyticsEvent[]): AnalyticsEvent[] {
  return [...events].sort((a, b) => a.seq - b.seq || a.clientTs - b.clientTs);
}
