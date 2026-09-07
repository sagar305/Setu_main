// ---------------------------------------------------------------------------
// The shape of one tracked event, and the numbers that govern the pipeline.
//
// Everything here is plain data with no browser API in sight, so the policy
// that decides what is kept, batched and dropped can be tested in Node.
// ---------------------------------------------------------------------------

/** What a visitor is, the second time we see them. */
export type VisitorType = "new" | "returning";

/**
 * One event, as it sits in the queue.
 *
 * `clientTs` is stamped when the event happens, not when it is sent. That is
 * the whole point of the queue: a click made in a basement with no signal is
 * still reported with the time it actually happened, and the server can see
 * how long it waited by comparing against its own clock.
 */
export type AnalyticsEvent = {
  /** Idempotency key. The server dedupes on this, so a replayed batch is a no-op. */
  eventId: string;
  /** Per-visitor counter. Survives reordering, so the true order is recoverable. */
  seq: number;
  name: string;
  props: EventProps;
  clientTs: number;
  visitorId: string;
  sessionId: string;
  visitorType: VisitorType;
  visitNumber: number;
  path: string;
  referrer: string;
};

/**
 * Event properties.
 *
 * Deliberately not `unknown`: a payload is a flat bag of scalars, which keeps
 * it impossible to accidentally serialise a DOM node, a React element, or an
 * object holding something the visitor typed.
 */
export type EventProps = Record<string, string | number | boolean>;

/** A batch as it goes over the wire. */
export type EventBatch = {
  /** Events dropped to stay inside the cap since the last successful flush. */
  droppedCount: number;
  sentTs: number;
  events: AnalyticsEvent[];
};

/**
 * What the collector says came back.
 *
 * It answers with the ids it actually stored rather than a bare 200, so a
 * partial write cannot look like a complete one and quietly lose the rest.
 */
export type CollectorResponse = {
  accepted: string[];
};

// -- Queue limits -----------------------------------------------------------

/**
 * How many events may wait at once.
 *
 * The ceiling exists for the offline products, not for us. Someone running the
 * POS or the token screen through a whole shift with no signal must not have
 * their real work — bills, tokens, invoices — pushed out of storage by a
 * backlog of click events. When the cap is hit the oldest events go and the
 * count of what went is reported, so the loss is visible rather than silent.
 */
export const MAX_QUEUED_EVENTS = 2_000;

/** Events per request. Small enough that one failure costs little. */
export const MAX_BATCH_SIZE = 50;

/** A session ends after this much inactivity. */
export const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

// -- Retry ------------------------------------------------------------------

/** First retry delay. Doubles per attempt, up to the ceiling. */
export const RETRY_BASE_MS = 2_000;

/** Longest a retry will ever wait. */
export const RETRY_MAX_MS = 5 * 60 * 1000;

/**
 * Consecutive failures before the circuit opens.
 *
 * A device on a metered 2G connection should not spend its data and its
 * battery retrying a collector that is plainly down. The queue keeps filling;
 * only the sending stops, and the next `online` event closes the circuit.
 */
export const CIRCUIT_BREAK_AFTER = 5;

// -- Storage keys -----------------------------------------------------------

export const VISITOR_STORAGE_KEY = "setu.analytics.visitor.v1";
export const SESSION_STORAGE_KEY = "setu.analytics.session.v1";
export const OPT_OUT_STORAGE_KEY = "setu.analytics.optout.v1";
