// The customer's tracking link, and the estimate reply channel behind it.
//
// This is the one part of the job card that puts anything on a server, and it
// is off until a shop switches it on. What makes it possible without a backend
// of our own is a property the shortener already has for published QR menus: a
// code can be *repointed*. `shortenPayload` mints a code together with an
// `editToken`, and `updateShortLink` rewrites what that code resolves to. The
// printed QR on a restaurant table survives a price change for exactly this
// reason; a repair's tracking URL survives a status change the same way.
//
// So the URL is minted once, at intake, and every later status change rewrites
// the payload behind it. The customer bookmarks one link and it is never stale.
//
// ---------------------------------------------------------------------------
// Why the estimate reply needs a second code
// ---------------------------------------------------------------------------
//
// Approving an estimate means the customer has to *write* something, and the
// only write this infrastructure has is "PUT this payload, with the editToken".
// Giving the customer the tracking link's own token would let them rewrite
// their status, their bill and their warranty — so they never get it.
//
// Instead an estimate mints a second, throwaway code holding nothing but a
// yes/no, and *that* code's token travels in the tracking payload. The worst a
// customer (or anyone they forwarded the link to) can do with it is set the
// answer to a question that was addressed to them, which they could equally do
// by sending another WhatsApp. The repair record itself stays write-protected
// by a token that never leaves the shop's device.
//
// The shop learns the answer by polling that code while the app is open. There
// is no push and there cannot be one, so approval arrives within a minute of
// somebody looking at the board rather than the instant it is tapped.

import LZString from "lz-string";
import {
  ShortenError,
  resolveShortLink,
  shortenPayload,
  shortLinksConfigured,
  updateShortLink,
} from "@/lib/toolkit/shortLink";
import type { Business } from "@/lib/pos/types";
import {
  JOB_STATUS_LABELS,
  deviceLabel,
  nowIso,
  type Bill,
  type Job,
  type JobStatus,
  type JobTracking,
  type RepairSettings,
} from "./types";
import { billTotals, warrantyEndOf } from "./calc";

/** How the tracking page is addressed: {origin}/track/{code}. */
export function trackUrl(code: string, origin: string): string {
  return `${origin}/track/${code}`;
}

// ---------------------------------------------------------------------------
// The payload
// ---------------------------------------------------------------------------

/**
 * What the customer sees, and deliberately nothing else.
 *
 * Absent by design: the intake photos and signature (evidence the shop holds,
 * not something to put behind a forwardable URL), the unlock code, the internal
 * notes, the diagnosis, the parts list and their prices, and the customer's own
 * address. A tracking link gets forwarded and screenshotted; everything in here
 * is something the customer already knows or is entitled to be told.
 *
 * Versioned, because a link minted today may be opened by a page deployed in a
 * year — the code outlives the build that created it.
 */
export type TrackPayload = {
  v: 1;
  /** Shop identity, so the page does not look like it came from nowhere. */
  shop: string;
  shopPhone?: string;
  jobNo: string;
  device: string;
  status: JobStatus;
  statusLabel: string;
  receivedOn: string;
  updatedAt: string;
  promisedDate?: string;
  /** The estimate while quoting, the bill total once billed. */
  amount?: number;
  amountKind?: "estimate" | "bill";
  currency: string;
  upiId?: string;
  /** Status changes only — the nag entries and internal notes are stripped. */
  timeline: { to: JobStatus; at: string }[];
  warrantyEnd?: string;
  invoiceNo?: string;
  /** Present only while an estimate is genuinely awaiting an answer. */
  reply?: { code: string; token: string; decided?: "yes" | "no" };
};

export function encodeTrack(payload: TrackPayload): string {
  return LZString.compressToEncodedURIComponent(JSON.stringify(payload));
}

export function decodeTrack(raw: string): TrackPayload | null {
  if (!raw) return null;
  try {
    const json = LZString.decompressFromEncodedURIComponent(raw);
    if (!json) return null;
    const parsed = JSON.parse(json) as TrackPayload;
    if (!parsed || typeof parsed !== "object" || parsed.v !== 1 || !parsed.jobNo) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Build the payload for a job as it stands right now.
 *
 * A job is only "awaiting a decision" while its status is `estimate-sent` and
 * nothing has been recorded yet — so an approved job's page loses its buttons
 * rather than inviting a second answer that nobody would read.
 */
export function buildTrackPayload(
  job: Job,
  business: Business | null,
  settings: RepairSettings,
  bill: Bill | null
): TrackPayload {
  const totals = billTotals(job, settings);
  const hasBill = bill !== null;
  const amount = hasBill ? bill.total : totals.total > 0 ? totals.total : job.estimateAmount ?? 0;
  const warrantyEnd = warrantyEndOf(job);
  const reply = job.tracking?.reply;
  const awaiting = job.status === "estimate-sent" && Boolean(reply) && !reply?.decision;

  return {
    v: 1,
    shop: business?.name || "Repair shop",
    shopPhone: business?.phone || undefined,
    jobNo: job.jobNo,
    device: deviceLabel(job),
    status: job.status,
    statusLabel: JOB_STATUS_LABELS[job.status],
    receivedOn: job.createdAt,
    updatedAt: nowIso(),
    promisedDate: job.promisedDate ?? undefined,
    amount: amount > 0 ? amount : undefined,
    amountKind: amount > 0 ? (hasBill ? "bill" : "estimate") : undefined,
    currency: business?.currency ?? "INR",
    upiId: business?.upiId || undefined,
    // Nag entries are ready → ready; they are the shop chasing the customer,
    // not the repair moving, and repeating them back reads as noise.
    timeline: job.statusHistory
      .filter((change) => change.from !== change.to)
      .map((change) => ({ to: change.to, at: change.at })),
    warrantyEnd: warrantyEnd || undefined,
    invoiceNo: bill?.invoiceNo,
    reply:
      awaiting && reply
        ? { code: reply.code, token: reply.editToken }
        : reply?.decision
          ? { code: reply.code, token: reply.editToken, decided: reply.decision }
          : undefined,
  };
}

// ---------------------------------------------------------------------------
// Publishing and updating
// ---------------------------------------------------------------------------

export type TrackingUnavailable = "disabled" | "not-configured" | "offline" | "failed";

export class TrackingError extends Error {
  reason: TrackingUnavailable;

  constructor(reason: TrackingUnavailable, message: string) {
    super(message);
    this.name = "TrackingError";
    this.reason = reason;
  }
}

function assertUsable(settings: RepairSettings): void {
  if (!settings.trackingEnabled) {
    throw new TrackingError("disabled", "Customer tracking links are switched off in Settings.");
  }
  if (!shortLinksConfigured()) {
    throw new TrackingError("not-configured", "Tracking links are not configured on this site.");
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new TrackingError("offline", "Publishing a tracking link needs an internet connection.");
  }
}

function asTrackingError(error: unknown): TrackingError {
  if (error instanceof TrackingError) return error;
  if (error instanceof ShortenError) {
    return new TrackingError(
      error.reason === "offline" ? "offline" : error.reason === "unavailable" ? "not-configured" : "failed",
      error.message
    );
  }
  return new TrackingError("failed", "Could not reach the tracking service.");
}

/**
 * Mint the code for a job.
 *
 * Published as kind "menu" rather than "doc" because that is the kind the
 * shortener mints an `editToken` for, and a token is the whole point — a "doc"
 * link is a frozen snapshot, which is exactly what a tracking URL must not be.
 * The kind is the service's own bookkeeping and never reaches the customer; the
 * page they open is /track/<code>, which this site routes itself.
 */
export async function publishTracking(
  job: Job,
  business: Business | null,
  settings: RepairSettings,
  bill: Bill | null,
  origin: string
): Promise<JobTracking> {
  assertUsable(settings);

  const payload = encodeTrack(buildTrackPayload(job, business, settings, bill));
  try {
    const link = await shortenPayload(payload, "menu");
    if (!link.editToken) {
      // Without a token the link could never be updated again, which would make
      // it a snapshot pretending to be a tracker — worse than no link at all.
      throw new TrackingError("failed", "The service did not return an edit token.");
    }
    return {
      code: link.code,
      editToken: link.editToken,
      url: trackUrl(link.code, origin),
      publishedAt: nowIso(),
      expiresAt: link.expiresAt,
      pushedPayload: payload,
      pendingSince: null,
      reply: job.tracking?.reply ?? null,
    };
  } catch (error) {
    throw asTrackingError(error);
  }
}

/**
 * Rewrite what an existing code resolves to.
 *
 * Skipped when the payload has not actually changed, so opening a job does not
 * cost a round trip. `updatedAt` is excluded from that comparison for the same
 * reason — it changes on every build and would defeat the check.
 */
export async function pushTracking(
  tracking: JobTracking,
  job: Job,
  business: Business | null,
  settings: RepairSettings,
  bill: Bill | null
): Promise<JobTracking> {
  assertUsable(settings);

  const payload = encodeTrack(buildTrackPayload(job, business, settings, bill));
  if (sameExceptTimestamp(payload, tracking.pushedPayload)) return tracking;

  try {
    const link = await updateShortLink(tracking.code, payload, tracking.editToken);
    return {
      ...tracking,
      expiresAt: link.expiresAt || tracking.expiresAt,
      pushedPayload: payload,
      pendingSince: null,
    };
  } catch (error) {
    throw asTrackingError(error);
  }
}

/** Two payloads that differ only in when they were built. */
function sameExceptTimestamp(next: string, previous: string | undefined): boolean {
  if (!previous) return false;
  const a = decodeTrack(next);
  const b = decodeTrack(previous);
  if (!a || !b) return next === previous;
  return JSON.stringify({ ...a, updatedAt: "" }) === JSON.stringify({ ...b, updatedAt: "" });
}

// ---------------------------------------------------------------------------
// The estimate reply channel
// ---------------------------------------------------------------------------

export type ReplyPayload = {
  v: 1;
  jobNo: string;
  decision: "yes" | "no" | null;
  at: string | null;
};

export function encodeReply(payload: ReplyPayload): string {
  return LZString.compressToEncodedURIComponent(JSON.stringify(payload));
}

export function decodeReply(raw: string): ReplyPayload | null {
  if (!raw) return null;
  try {
    const json = LZString.decompressFromEncodedURIComponent(raw);
    if (!json) return null;
    const parsed = JSON.parse(json) as ReplyPayload;
    if (!parsed || typeof parsed !== "object" || parsed.v !== 1) return null;
    if (parsed.decision !== "yes" && parsed.decision !== "no" && parsed.decision !== null) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Mint the throwaway code an estimate is answered on.
 *
 * It holds one field and the job number — nothing about the device, the
 * customer or the price. If this code alone leaked it would say only that
 * somebody said yes to job JC-0412.
 */
export async function mintReplyChannel(
  job: Job,
  settings: RepairSettings
): Promise<NonNullable<JobTracking["reply"]>> {
  assertUsable(settings);

  const payload = encodeReply({ v: 1, jobNo: job.jobNo, decision: null, at: null });
  try {
    const link = await shortenPayload(payload, "menu");
    if (!link.editToken) {
      throw new TrackingError("failed", "The service did not return an edit token.");
    }
    return { code: link.code, editToken: link.editToken, decision: null, decidedAt: null };
  } catch (error) {
    throw asTrackingError(error);
  }
}

/**
 * The customer's side: record an answer.
 *
 * Called from the public tracking page with the token that travelled in the
 * tracking payload. It can write nothing else, and nothing it writes is trusted
 * beyond the yes/no — the shop still moves the job itself.
 */
export async function submitDecision(
  code: string,
  editToken: string,
  jobNo: string,
  decision: "yes" | "no"
): Promise<void> {
  const payload = encodeReply({ v: 1, jobNo, decision, at: nowIso() });
  try {
    await updateShortLink(code, payload, editToken);
  } catch (error) {
    throw asTrackingError(error);
  }
}

/**
 * The shop's side: has the customer answered yet?
 *
 * Returns null when nothing has been decided, the code is gone, or the service
 * is unreachable — all three mean the same thing to the caller, which is "carry
 * on waiting". A tracking failure must never be able to stall the board.
 */
export async function readDecision(
  code: string
): Promise<{ decision: "yes" | "no"; at: string } | null> {
  try {
    const resolved = await resolveShortLink(code);
    if (!resolved) return null;
    const parsed = decodeReply(resolved.payload);
    if (!parsed || !parsed.decision) return null;
    return { decision: parsed.decision, at: parsed.at ?? nowIso() };
  } catch {
    return null;
  }
}

/** Read a tracking code back — what the public page does. */
export async function readTracking(code: string): Promise<TrackPayload | null> {
  const resolved = await resolveShortLink(code);
  if (!resolved) return null;
  return decodeTrack(resolved.payload);
}

/** Roughly how long a link has left, for warning a shop before one dies. */
export function daysUntilExpiry(tracking: JobTracking, now = new Date()): number | null {
  if (!tracking.expiresAt) return null;
  const end = new Date(tracking.expiresAt).getTime();
  if (Number.isNaN(end)) return null;
  return Math.round((end - now.getTime()) / 86_400_000);
}
