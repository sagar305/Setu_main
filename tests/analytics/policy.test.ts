// The delivery guarantee, stated as tests.
//
// The claim being defended is "every event counts": an event survives being
// made offline, survives a partial write, is never counted twice, and when the
// cap finally forces a loss that loss is reported rather than hidden.

import { describe, expect, it } from "vitest";
import {
  applyCap,
  backoffDelay,
  inHappenedOrder,
  isCircuitOpen,
  removeAccepted,
  selectBatch,
  shouldAttemptFlush,
} from "@/lib/analytics/policy";
import { CIRCUIT_BREAK_AFTER, RETRY_MAX_MS, type AnalyticsEvent } from "@/lib/analytics/types";

const event = (over: Partial<AnalyticsEvent> = {}): AnalyticsEvent => ({
  eventId: "e0",
  seq: 0,
  name: "click",
  props: {},
  clientTs: 0,
  visitorId: "v1",
  sessionId: "s1",
  visitorType: "new",
  visitNumber: 1,
  path: "/",
  referrer: "",
  ...over,
});

const series = (count: number): AnalyticsEvent[] =>
  Array.from({ length: count }, (_, i) => event({ eventId: `e${i}`, seq: i, clientTs: i }));

describe("the cap", () => {
  it("keeps everything while there is room", () => {
    const { kept, dropped } = applyCap(series(10), 10);
    expect(dropped).toBe(0);
    expect(kept).toHaveLength(10);
  });

  it("drops the oldest events, because the recent ones describe what is happening now", () => {
    const { kept, dropped } = applyCap(series(12), 10);
    expect(dropped).toBe(2);
    expect(kept[0].eventId).toBe("e2");
    expect(kept.at(-1)?.eventId).toBe("e11");
  });

  it("reports the loss instead of absorbing it", () => {
    expect(applyCap(series(2_500), 2_000).dropped).toBe(500);
  });
});

describe("acknowledgement", () => {
  it("removes only what the collector actually named", () => {
    const left = removeAccepted(series(5), ["e0", "e1"]);
    expect(left.map((e) => e.eventId)).toEqual(["e2", "e3", "e4"]);
  });

  it("keeps a partially written batch queued so the rest goes again", () => {
    const batch = selectBatch(series(50), 50);
    // The collector stored the first ten and then fell over.
    const left = removeAccepted(batch, batch.slice(0, 10).map((e) => e.eventId));
    expect(left).toHaveLength(40);
  });

  it("keeps everything when the collector acknowledges nothing", () => {
    expect(removeAccepted(series(5), [])).toHaveLength(5);
  });

  it("is idempotent, so a replayed acknowledgement cannot drop live events", () => {
    const once = removeAccepted(series(5), ["e0"]);
    expect(removeAccepted(once, ["e0"])).toEqual(once);
  });
});

describe("backoff", () => {
  it("grows with each attempt", () => {
    const fixed = () => 1;
    expect(backoffDelay(2, fixed)).toBeGreaterThan(backoffDelay(1, fixed));
    expect(backoffDelay(3, fixed)).toBeGreaterThan(backoffDelay(2, fixed));
  });

  it("stops growing at the ceiling", () => {
    expect(backoffDelay(50, () => 1)).toBeLessThanOrEqual(RETRY_MAX_MS);
  });

  it("jitters, so tabs that dropped together do not return together", () => {
    expect(backoffDelay(4, () => 0)).not.toBe(backoffDelay(4, () => 1));
  });
});

describe("the circuit breaker", () => {
  it("stays closed while failures are occasional", () => {
    expect(isCircuitOpen(CIRCUIT_BREAK_AFTER - 1)).toBe(false);
  });

  it("opens once the collector is plainly down", () => {
    expect(isCircuitOpen(CIRCUIT_BREAK_AFTER)).toBe(true);
  });
});

describe("deciding whether to flush", () => {
  const base = { queued: 5, online: true, inFlight: false, consecutiveFailures: 0 };

  it("flushes when there is something to send and a way to send it", () => {
    expect(shouldAttemptFlush(base)).toBe(true);
  });

  it("does not flush an empty queue", () => {
    expect(shouldAttemptFlush({ ...base, queued: 0 })).toBe(false);
  });

  it("does not start a second flush on top of one in flight", () => {
    expect(shouldAttemptFlush({ ...base, inFlight: true })).toBe(false);
  });

  it("holds events rather than burning them against a dead connection", () => {
    expect(shouldAttemptFlush({ ...base, online: false })).toBe(false);
  });

  it("stops trying once the circuit is open", () => {
    expect(shouldAttemptFlush({ ...base, consecutiveFailures: CIRCUIT_BREAK_AFTER })).toBe(false);
  });
});

describe("ordering", () => {
  it("recovers the true order from seq, not from arrival", () => {
    const shuffled = [event({ seq: 3 }), event({ seq: 1 }), event({ seq: 2 })];
    expect(inHappenedOrder(shuffled).map((e) => e.seq)).toEqual([1, 2, 3]);
  });

  it("falls back to the clock when two events share a seq", () => {
    const tied = [event({ seq: 1, clientTs: 20 }), event({ seq: 1, clientTs: 10 })];
    expect(inHappenedOrder(tied).map((e) => e.clientTs)).toEqual([10, 20]);
  });
});
