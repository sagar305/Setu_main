// ---------------------------------------------------------------------------
// Who is here, and whether we have seen them before.
//
// Two records. The visitor lives in localStorage and is what makes "new" and
// "returning" mean anything; the session lives in sessionStorage and groups a
// sitting into one visit. Both are derived by pure functions that take the
// clock as an argument, so the awkward cases — a returning visitor at a
// timezone boundary, a device whose clock was corrected backwards — are
// testable rather than hoped about.
//
// Storage can be absent entirely (private windows, hardened browsers, a user
// who blocked site data). That is not an error worth surfacing: identity
// degrades to a per-page-load id and the site carries on knowing less.
// ---------------------------------------------------------------------------

import {
  SESSION_STORAGE_KEY,
  SESSION_TIMEOUT_MS,
  VISITOR_STORAGE_KEY,
  type VisitorType,
} from "./types";

export type VisitorRecord = {
  id: string;
  firstSeen: number;
  lastSeen: number;
  /** Sessions started, not page views. Incremented once per new session. */
  visitCount: number;
  /** Last `seq` handed out, so ordering survives across reloads. */
  lastSeq: number;
};

export type SessionRecord = {
  id: string;
  startedAt: number;
  lastActivityAt: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** A random id. `crypto.randomUUID` where it exists, and a usable one where it doesn't. */
export function mintId(): string {
  const cryptoObj = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (cryptoObj && typeof cryptoObj.randomUUID === "function") return cryptoObj.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** The UTC day a timestamp falls in, for the midnight session rollover. */
function utcDay(at: number): number {
  return Math.floor(at / DAY_MS);
}

/**
 * Coerce whatever came out of storage into a visitor.
 *
 * Anything unrecognised reads as absent rather than throwing. A half-written
 * or hand-edited value must never be able to break a page.
 */
export function parseVisitor(raw: string | null): VisitorRecord | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<VisitorRecord>;
    if (
      typeof value?.id !== "string" ||
      typeof value.firstSeen !== "number" ||
      typeof value.lastSeen !== "number" ||
      typeof value.visitCount !== "number"
    ) {
      return null;
    }
    return {
      id: value.id,
      firstSeen: value.firstSeen,
      lastSeen: value.lastSeen,
      visitCount: value.visitCount,
      lastSeq: typeof value.lastSeq === "number" ? value.lastSeq : 0,
    };
  } catch {
    return null;
  }
}

export function parseSession(raw: string | null): SessionRecord | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<SessionRecord>;
    if (
      typeof value?.id !== "string" ||
      typeof value.startedAt !== "number" ||
      typeof value.lastActivityAt !== "number"
    ) {
      return null;
    }
    return { id: value.id, startedAt: value.startedAt, lastActivityAt: value.lastActivityAt };
  } catch {
    return null;
  }
}

/**
 * Whether a stored session has ended by `now`.
 *
 * Two ways it can. Half an hour of silence is the usual one. A crossed UTC
 * midnight is the other, and it exists so a session cannot straddle two days
 * and make a day's numbers depend on when the previous day's visitor stopped
 * moving.
 *
 * A clock that moved backwards — a corrected device clock, a timezone change —
 * makes the elapsed time negative. Treat that as expired: minting a fresh
 * session costs one row, whereas trusting it would let a stale session absorb
 * events for as long as the clock stays behind.
 */
export function isSessionExpired(session: SessionRecord, now: number): boolean {
  const idle = now - session.lastActivityAt;
  if (idle < 0) return true;
  if (idle > SESSION_TIMEOUT_MS) return true;
  return utcDay(now) !== utcDay(session.startedAt);
}

/**
 * Bring the visitor record up to date for a session that is starting now.
 *
 * `visitorType` is the answer to the question this whole feature was built
 * for. It is decided by whether a record already existed, not by the visit
 * count, so a returning visitor whose count was somehow lost still reads as
 * returning.
 */
export function advanceVisitor(
  stored: VisitorRecord | null,
  now: number,
  newId: string
): { record: VisitorRecord; visitorType: VisitorType } {
  if (!stored) {
    return {
      record: { id: newId, firstSeen: now, lastSeen: now, visitCount: 1, lastSeq: 0 },
      visitorType: "new",
    };
  }
  return {
    record: {
      ...stored,
      lastSeen: now,
      visitCount: stored.visitCount + 1,
      // A first visit that never left the same session should still read as
      // one visit, and a clock moving backwards must not rewind the count.
      firstSeen: Math.min(stored.firstSeen, now),
    },
    visitorType: "returning",
  };
}

/** Whole days between a visitor's first sighting and now, floored at zero. */
export function daysSinceFirstVisit(record: VisitorRecord, now: number): number {
  return Math.max(0, Math.floor((now - record.firstSeen) / DAY_MS));
}

// -- Storage binding --------------------------------------------------------
//
// Everything above is pure. Everything below touches the browser and does so
// inside try/catch, because reading storage is allowed to throw outright in a
// browser configured to block it.

function readRaw(store: "local" | "session", key: string): string | null {
  try {
    const storage = store === "local" ? window.localStorage : window.sessionStorage;
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function writeRaw(store: "local" | "session", key: string, value: string): void {
  try {
    const storage = store === "local" ? window.localStorage : window.sessionStorage;
    storage.setItem(key, value);
  } catch {
    // Blocked or full. Identity is best-effort by design.
  }
}

export function readVisitor(): VisitorRecord | null {
  return parseVisitor(readRaw("local", VISITOR_STORAGE_KEY));
}

export function writeVisitor(record: VisitorRecord): void {
  writeRaw("local", VISITOR_STORAGE_KEY, JSON.stringify(record));
}

export function readSession(): SessionRecord | null {
  return parseSession(readRaw("session", SESSION_STORAGE_KEY));
}

export function writeSession(record: SessionRecord): void {
  writeRaw("session", SESSION_STORAGE_KEY, JSON.stringify(record));
}

/** The identity stamped onto every event. */
export type Identity = {
  visitorId: string;
  sessionId: string;
  visitorType: VisitorType;
  visitNumber: number;
  daysSinceFirst: number;
  /** True only on the event that opened a new session, for `session_start`. */
  sessionStarted: boolean;
};

/**
 * Read identity for an event happening at `now`, rolling the session over and
 * banking a visit if this is the first activity in a while.
 */
export function currentIdentity(now: number): Identity {
  const storedSession = readSession();
  const live = storedSession && !isSessionExpired(storedSession, now) ? storedSession : null;

  if (live) {
    writeSession({ ...live, lastActivityAt: now });
    const visitor = readVisitor() ?? advanceVisitor(null, now, mintId()).record;
    return {
      visitorId: visitor.id,
      sessionId: live.id,
      // Within a live session, the type is settled by whether this visitor
      // existed before the session began.
      visitorType: visitor.visitCount > 1 ? "returning" : "new",
      visitNumber: visitor.visitCount,
      daysSinceFirst: daysSinceFirstVisit(visitor, now),
      sessionStarted: false,
    };
  }

  const { record, visitorType } = advanceVisitor(readVisitor(), now, mintId());
  writeVisitor(record);
  const session: SessionRecord = { id: mintId(), startedAt: now, lastActivityAt: now };
  writeSession(session);

  return {
    visitorId: record.id,
    sessionId: session.id,
    visitorType,
    visitNumber: record.visitCount,
    daysSinceFirst: daysSinceFirstVisit(record, now),
    sessionStarted: true,
  };
}

/** Hand out the next per-visitor sequence number. */
export function nextSeq(): number {
  const visitor = readVisitor();
  if (!visitor) return 0;
  const next = visitor.lastSeq + 1;
  writeVisitor({ ...visitor, lastSeq: next });
  return next;
}
