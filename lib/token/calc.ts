// The rules of the queue.
//
// Everything here is pure. The store owns the database and the clock; this
// file owns the arithmetic, so the four things that are easy to get wrong —
// what day it is, who is next, how long the wait is, and how a token is
// spoken — can be tested without a browser.

import {
  RECALLS_BEFORE_SKIP,
  type Counter,
  type Service,
  type Token,
  type TokenStatus,
} from "./types";

/* -------------------------------------------------------------------------
 * The business day
 * ---------------------------------------------------------------------- */

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** Local "YYYY-MM-DD" for a Date. Never UTC — a queue runs on wall time. */
export function isoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * The business day a moment belongs to.
 *
 * With a reset hour of 6, a token issued at 02:00 on the 21st still belongs to
 * the 20th — the clinic that is still seeing the last of last night's patients
 * has not started a new day, and its numbering should not restart under it.
 */
export function businessDate(at: Date, dailyResetHour: number): string {
  const hour = Math.min(23, Math.max(0, Math.round(dailyResetHour || 0)));
  if (hour === 0 || at.getHours() >= hour) return isoDate(at);
  const previous = new Date(at.getTime());
  previous.setDate(previous.getDate() - 1);
  return isoDate(previous);
}

/**
 * The next moment the business day rolls over.
 *
 * The Counter and the Display are both left open for a whole shift, so the
 * rollover has to happen under a running tab rather than waiting for someone
 * to reload at 6am.
 */
export function nextResetAt(at: Date, dailyResetHour: number): Date {
  const hour = Math.min(23, Math.max(0, Math.round(dailyResetHour || 0)));
  const next = new Date(at.getTime());
  next.setHours(hour, 0, 0, 0);
  if (next.getTime() <= at.getTime()) next.setDate(next.getDate() + 1);
  return next;
}

/** The oldest business day worth keeping, given a retention window. */
export function retentionCutoff(today: string, days: number): string {
  const [y, m, d] = today.split("-").map(Number);
  const cutoff = new Date(y, (m || 1) - 1, d || 1);
  cutoff.setDate(cutoff.getDate() - days);
  return isoDate(cutoff);
}

/* -------------------------------------------------------------------------
 * Numbering
 * ---------------------------------------------------------------------- */

/**
 * Next number for a service on a day.
 *
 * Derived from the rows rather than a stored counter, and deliberately: the
 * highest number ever issued today is the only definition that cannot drift
 * out of step with the tokens themselves. Cancelled and skipped tokens still
 * count — a number is spent once it has been handed to a person, and reusing
 * it would put two people in the room holding A-42.
 */
export function nextTokenNumber(
  tokens: Token[],
  serviceId: string,
  date: string,
  /** Ignore anything issued before this — a manual reset restarts at 1. */
  since: string | null = null
): number {
  let highest = 0;
  for (const token of tokens) {
    if (token.serviceId !== serviceId || token.date !== date) continue;
    if (since && token.issuedAt < since) continue;
    if (token.number > highest) highest = token.number;
  }
  return highest + 1;
}

/* -------------------------------------------------------------------------
 * Ordering
 * ---------------------------------------------------------------------- */

/**
 * Priority first, then oldest first.
 *
 * Priority means a senior citizen, an emergency or someone with an
 * appointment. It jumps the *waiting* line only — a token already called or
 * being served is never re-ordered under the person standing at the counter.
 *
 * Somebody who missed their call and came back needs no special handling here:
 * they hold a token issued just now, so being last is simply what the clock
 * says.
 */
export function compareQueue(a: Token, b: Token): number {
  if (a.priority !== b.priority) return a.priority ? -1 : 1;
  if (a.issuedAt !== b.issuedAt) return a.issuedAt < b.issuedAt ? -1 : 1;
  return a.number - b.number;
}

/** Whether a counter is allowed to serve a service. Empty list = all of them. */
export function counterServes(counter: Counter, serviceId: string): boolean {
  return counter.serviceIds.length === 0 || counter.serviceIds.includes(serviceId);
}

export function tokensWithStatus(tokens: Token[], status: TokenStatus): Token[] {
  return tokens.filter((token) => token.status === status);
}

/** Today's waiting tokens in call order, optionally narrowed to one counter. */
export function waitingQueue(tokens: Token[], counter?: Counter | null): Token[] {
  return tokens
    .filter((token) => token.status === "waiting")
    .filter((token) => !counter || counterServes(counter, token.serviceId))
    .sort(compareQueue);
}

/** The token Call next would take, or null when nobody is waiting for us. */
export function nextInQueue(tokens: Token[], counter?: Counter | null): Token | null {
  return waitingQueue(tokens, counter)[0] ?? null;
}

/** 1-based place in the line, or 0 for a token that is no longer waiting. */
export function queuePosition(tokens: Token[], token: Token): number {
  if (token.status !== "waiting") return 0;
  const queue = waitingQueue(tokens.filter((t) => t.serviceId === token.serviceId));
  return queue.findIndex((t) => t.id === token.id) + 1;
}

/** How many waiting tokens sit ahead of a would-be new token for a service. */
export function waitingAhead(tokens: Token[], serviceId: string): number {
  return tokens.filter((token) => token.status === "waiting" && token.serviceId === serviceId)
    .length;
}

export function shouldOfferSkip(token: Token): boolean {
  return token.recallCount >= RECALLS_BEFORE_SKIP;
}

/* -------------------------------------------------------------------------
 * The grace window
 * ---------------------------------------------------------------------- */

/**
 * The moment a called token runs out of time, or null when it is not counting.
 *
 * Measured from `calledAt`, so a Recall restarts it — asking somebody to come
 * again and then skipping them on the original clock would be a trap rather
 * than a warning. Only a token still sitting at "called" is counting: once
 * Start serving is tapped the person is standing there, and nothing about a
 * clock should be able to remove them.
 */
export function skipDeadline(token: Token, minutes: number): number | null {
  if (token.status !== "called" || !token.calledAt) return null;
  const calledAt = Date.parse(token.calledAt);
  if (Number.isNaN(calledAt)) return null;
  return calledAt + Math.max(0, minutes) * 60_000;
}

/** Seconds left before the grace window closes; 0 once it has. */
export function secondsUntilSkip(token: Token, minutes: number, now = Date.now()): number | null {
  const deadline = skipDeadline(token, minutes);
  if (deadline === null) return null;
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

/** Tokens whose grace window has closed and which the clock should now skip. */
export function tokensPastDeadline(tokens: Token[], minutes: number, now = Date.now()): Token[] {
  return tokens.filter((token) => {
    const deadline = skipDeadline(token, minutes);
    return deadline !== null && deadline <= now;
  });
}

/** mm:ss, for the countdown on the counter's card. */
export function formatCountdown(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

/* -------------------------------------------------------------------------
 * The wait estimate
 * ---------------------------------------------------------------------- */

/**
 * Counters that can take this service right now.
 *
 * A counter with no service list serves everything, so it counts towards every
 * service — which is optimistic when one such counter covers four lines, and
 * knowingly so. The estimate is never rendered as a promise: it reads "about
 * 20 min", and section 5 of the spec says exactly why.
 */
export function activeCountersForService(counters: Counter[], serviceId: string): number {
  return counters.filter((counter) => counter.active && counterServes(counter, serviceId)).length;
}

/** `ahead × avgServiceMinutes ÷ counters`, to the nearest five minutes. */
export function estimateWaitMinutes(
  ahead: number,
  avgServiceMinutes: number,
  activeCounters: number
): number {
  if (ahead <= 0) return 0;
  const perPerson = Math.max(1, avgServiceMinutes || 1);
  const raw = (ahead * perPerson) / Math.max(1, activeCounters);
  return Math.max(5, Math.round(raw / 5) * 5);
}

/** Human form of an estimate. Deliberately vague — it is a guess, not a slot. */
export function formatWait(minutes: number): string {
  if (minutes <= 0) return "You're next";
  if (minutes < 60) return `about ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const hourPart = `${hours} hr`;
  return rest === 0 ? `about ${hourPart}` : `about ${hourPart} ${rest} min`;
}

/** The estimate for a token that has not been issued yet. */
export function estimateForNewToken(
  tokens: Token[],
  service: Service,
  counters: Counter[]
): number {
  return estimateWaitMinutes(
    waitingAhead(tokens, service.id),
    service.avgServiceMinutes,
    activeCountersForService(counters, service.id)
  );
}

/* -------------------------------------------------------------------------
 * Measured times
 * ---------------------------------------------------------------------- */

function minutesBetween(from: string | null, to: string | null): number | null {
  if (!from || !to) return null;
  const start = Date.parse(from);
  const end = Date.parse(to);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  return (end - start) / 60_000;
}

/** How long a token waited: issued until announced. */
export function waitMinutes(token: Token): number | null {
  return minutesBetween(token.issuedAt, token.calledAt);
}

/** How long a token took to serve: Start serving until Done. */
export function serviceMinutes(token: Token): number | null {
  return minutesBetween(token.servingStartedAt, token.closedAt);
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function averageWaitMinutes(tokens: Token[]): number | null {
  return mean(tokens.map(waitMinutes).filter((v): v is number => v !== null));
}

export function averageServiceMinutes(tokens: Token[]): number | null {
  return mean(tokens.map(serviceMinutes).filter((v): v is number => v !== null));
}

/** Enough measured tokens before we offer to change a service's estimate. */
export const SUGGESTION_MIN_SAMPLE = 10;
export const SUGGESTION_WINDOW_DAYS = 7;

/**
 * What the last week says a service actually takes.
 *
 * Offered in Settings behind an Apply button rather than written back on its
 * own: the number drives every wait estimate on the display, and an owner who
 * finds it moving without being asked stops trusting the whole screen.
 */
export function suggestedServiceMinutes(
  tokens: Token[],
  serviceId: string,
  today: string
): number | null {
  const from = retentionCutoff(today, SUGGESTION_WINDOW_DAYS);
  const sample = tokens
    .filter((token) => token.serviceId === serviceId && token.date > from)
    .map(serviceMinutes)
    .filter((v): v is number => v !== null);
  if (sample.length < SUGGESTION_MIN_SAMPLE) return null;
  const average = mean(sample) ?? 0;
  return Math.max(1, Math.round(average));
}

/* -------------------------------------------------------------------------
 * Speech
 * ---------------------------------------------------------------------- */

/**
 * How a token is read aloud.
 *
 * "A-42" spoken literally comes out as "A dash four two". Splitting the prefix
 * off and letting the number stand alone gets "A forty-two", which is what a
 * person would have shouted.
 */
export function spokenToken(label: string): string {
  return label.replace(/[-_/]+/g, " ").replace(/\s+/g, " ").trim();
}
