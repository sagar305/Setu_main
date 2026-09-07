// ---------------------------------------------------------------------------
// Getting the queue to the collector.
//
// Two paths, because the browser gives us two very different budgets.
//
// The ordinary path is `fetch` with `keepalive`, which can read the response
// and therefore learn which events were actually stored. Only those are
// deleted, so a partial write goes again.
//
// The closing path is `sendBeacon`, used when the tab is going away. A beacon
// is fire-and-forget: it cannot report what the collector did with it. So
// events sent by beacon are deliberately NOT deleted — they stay queued and go
// again on the next load, where the collector's dedupe on `eventId` throws the
// duplicate away. Sending an event twice is free. Losing it is not, and that
// asymmetry decides the design everywhere it comes up.
// ---------------------------------------------------------------------------

import { clearDroppedCount, deleteEvents, readDroppedCount, readQueue } from "./db";
import {
  applyCap,
  inHappenedOrder,
  removeAccepted,
  selectBatch,
  shouldAttemptFlush,
} from "./policy";
import type { AnalyticsEvent, CollectorResponse, EventBatch } from "./types";

export const COLLECT_ENDPOINT = "/api/events";

type FlushState = {
  inFlight: boolean;
  consecutiveFailures: number;
};

const state: FlushState = { inFlight: false, consecutiveFailures: 0 };

function isOnline(): boolean {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

function encode(events: AnalyticsEvent[], droppedCount: number): string {
  const batch: EventBatch = {
    droppedCount,
    sentTs: Date.now(),
    events: inHappenedOrder(events),
  };
  return JSON.stringify(batch);
}

/**
 * The ordinary flush.
 *
 * Returns the number of events confirmed stored, or null if the attempt failed
 * outright — the caller uses that to decide whether to open the circuit.
 */
async function sendAndAcknowledge(
  events: AnalyticsEvent[],
  droppedCount: number
): Promise<number | null> {
  let response: Response;
  try {
    response = await fetch(COLLECT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: encode(events, droppedCount),
      keepalive: true,
      // Analytics is never a reason to send a cookie or read one back.
      credentials: "omit",
    });
  } catch {
    return null;
  }

  if (!response.ok) return null;

  let accepted: string[];
  try {
    const body = (await response.json()) as CollectorResponse;
    accepted = Array.isArray(body?.accepted) ? body.accepted : [];
  } catch {
    // A 2xx we cannot read tells us nothing about what was stored. Treat it as
    // a failure so the events stay queued rather than being deleted on faith.
    return null;
  }

  const remaining = removeAccepted(events, accepted);
  const storedKeys = events
    .filter((event) => !remaining.includes(event))
    .map((event) => event.seq);

  await deleteEvents(storedKeys);
  if (droppedCount > 0 && accepted.length > 0) await clearDroppedCount();

  return storedKeys.length;
}

/**
 * Send whatever is queued, one batch at a time, until the queue is empty or
 * something fails.
 */
export async function flush(): Promise<void> {
  if (typeof window === "undefined") return;

  let queued = await readQueue();
  if (
    !shouldAttemptFlush({
      queued: queued.length,
      online: isOnline(),
      inFlight: state.inFlight,
      consecutiveFailures: state.consecutiveFailures,
    })
  ) {
    return;
  }

  state.inFlight = true;
  try {
    // The cap is applied here rather than on write so that a burst is only
    // trimmed once it is clear the collector is not keeping up.
    const { kept, dropped } = applyCap(queued);
    if (dropped > 0) {
      await deleteEvents(queued.slice(0, dropped).map((event) => event.seq));
      queued = kept;
    }

    while (queued.length > 0) {
      const batch = selectBatch(queued);
      const droppedCount = await readDroppedCount();
      const stored = await sendAndAcknowledge(batch, droppedCount);

      if (stored === null) {
        state.consecutiveFailures += 1;
        return;
      }

      state.consecutiveFailures = 0;

      // A collector that accepted nothing is not making progress; stop rather
      // than spinning on the same batch forever.
      if (stored === 0) return;

      queued = await readQueue();
    }
  } finally {
    state.inFlight = false;
  }
}

/**
 * The last-gasp send, for a tab that is closing.
 *
 * Nothing is deleted: see the note at the top of the file. The events go
 * again next time and the collector deduplicates them.
 */
export function flushWithBeacon(events: AnalyticsEvent[], droppedCount: number): void {
  if (events.length === 0) return;
  if (typeof navigator === "undefined" || typeof navigator.sendBeacon !== "function") return;
  try {
    const blob = new Blob([encode(events, droppedCount)], { type: "application/json" });
    navigator.sendBeacon(COLLECT_ENDPOINT, blob);
  } catch {
    // A closing tab is the one place there is nothing useful left to do.
  }
}

/** Coming back online is a fresh start for the circuit breaker. */
export function resetCircuit(): void {
  state.consecutiveFailures = 0;
}

/** Exposed for tests and for the provider's flush scheduling. */
export function flushDiagnostics(): Readonly<FlushState> {
  return { ...state };
}
