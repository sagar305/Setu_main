// New versus returning, and where one visit ends and the next begins.
//
// These are the numbers the whole feature exists to produce, and they are the
// ones most easily got wrong by a clock: a device corrected backwards, a
// timezone change on a flight, a session left open across midnight.

import { describe, expect, it } from "vitest";
import {
  advanceVisitor,
  daysSinceFirstVisit,
  isSessionExpired,
  parseSession,
  parseVisitor,
  type SessionRecord,
  type VisitorRecord,
} from "@/lib/analytics/visitor";
import { SESSION_TIMEOUT_MS } from "@/lib/analytics/types";

const NOW = Date.parse("2026-09-07T12:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;

const visitor = (over: Partial<VisitorRecord> = {}): VisitorRecord => ({
  id: "v1",
  firstSeen: NOW - 10 * DAY_MS,
  lastSeen: NOW - DAY_MS,
  visitCount: 3,
  lastSeq: 0,
  ...over,
});

const session = (over: Partial<SessionRecord> = {}): SessionRecord => ({
  id: "s1",
  startedAt: NOW,
  lastActivityAt: NOW,
  ...over,
});

describe("a visitor we have never seen", () => {
  it("is new, on their first visit", () => {
    const { record, visitorType } = advanceVisitor(null, NOW, "fresh");
    expect(visitorType).toBe("new");
    expect(record.visitCount).toBe(1);
    expect(record.firstSeen).toBe(NOW);
  });
});

describe("a visitor we have seen before", () => {
  it("is returning, and their visit count goes up", () => {
    const { record, visitorType } = advanceVisitor(visitor(), NOW, "unused");
    expect(visitorType).toBe("returning");
    expect(record.visitCount).toBe(4);
  });

  it("keeps the id they already had", () => {
    expect(advanceVisitor(visitor(), NOW, "unused").record.id).toBe("v1");
  });

  it("is not un-aged by a clock that moved backwards", () => {
    const past = NOW - 30 * DAY_MS;
    const { record } = advanceVisitor(visitor({ firstSeen: past }), NOW, "unused");
    expect(record.firstSeen).toBe(past);
  });
});

describe("days since first visit", () => {
  it("counts whole days", () => {
    expect(daysSinceFirstVisit(visitor({ firstSeen: NOW - 3 * DAY_MS }), NOW)).toBe(3);
  });

  it("never goes negative when the clock is behind", () => {
    expect(daysSinceFirstVisit(visitor({ firstSeen: NOW + DAY_MS }), NOW)).toBe(0);
  });
});

describe("when a session ends", () => {
  it("stays live while the visitor is still moving", () => {
    expect(isSessionExpired(session({ lastActivityAt: NOW - 60_000 }), NOW)).toBe(false);
  });

  it("survives a pause just short of the timeout", () => {
    const record = session({ lastActivityAt: NOW - (SESSION_TIMEOUT_MS - 1_000) });
    expect(isSessionExpired(record, NOW)).toBe(false);
  });

  it("ends after the timeout", () => {
    const record = session({ lastActivityAt: NOW - (SESSION_TIMEOUT_MS + 1_000) });
    expect(isSessionExpired(record, NOW)).toBe(true);
  });

  it("ends at UTC midnight, so a session cannot straddle two days", () => {
    const lateLastNight = Date.parse("2026-09-06T23:55:00Z");
    const justAfterMidnight = Date.parse("2026-09-07T00:02:00Z");
    const record = session({ startedAt: lateLastNight, lastActivityAt: lateLastNight });
    // Only seven minutes idle, well inside the timeout — but a new day.
    expect(isSessionExpired(record, justAfterMidnight)).toBe(true);
  });

  it("treats a clock that moved backwards as expired rather than trusting it", () => {
    expect(isSessionExpired(session({ lastActivityAt: NOW + 60_000 }), NOW)).toBe(true);
  });
});

describe("reading storage that cannot be trusted", () => {
  it("treats absent storage as a first visit", () => {
    expect(parseVisitor(null)).toBeNull();
  });

  it("survives a half-written value", () => {
    expect(parseVisitor('{"id":"v1","firstSeen":')).toBeNull();
  });

  it("rejects a hand-edited value missing its fields", () => {
    expect(parseVisitor('{"id":"v1"}')).toBeNull();
  });

  it("defaults lastSeq for a record written before sequencing existed", () => {
    const raw = JSON.stringify({ id: "v1", firstSeen: 1, lastSeen: 2, visitCount: 1 });
    expect(parseVisitor(raw)?.lastSeq).toBe(0);
  });

  it("rejects a session whose timestamps are not numbers", () => {
    expect(parseSession('{"id":"s1","startedAt":"today","lastActivityAt":2}')).toBeNull();
  });
});
