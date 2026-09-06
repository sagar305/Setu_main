"use client";

// What the customer sees.
//
// This page is opened on a phone, usually once, usually by somebody who wants a
// single fact: is my phone ready yet. So the current status is the largest thing
// on it and everything else is arranged underneath in the order people ask —
// when will it be done, how much, who do I ring.
//
// When an estimate is waiting, it is also the place they answer it. That answer
// is written to a throwaway code whose token travelled in this page's own
// payload; it can write nothing else, and the shop still moves the job itself.
// See lib/repair/tracking.ts for why the write is contained this way.

import { useCallback, useEffect, useState } from "react";
import {
  BadgeCheck,
  Check,
  CircleAlert,
  Clock,
  PackageCheck,
  Phone,
  RefreshCw,
  Wrench,
  X,
} from "lucide-react";
import { readTracking, submitDecision, type TrackPayload } from "@/lib/repair/tracking";
import { formatDate, type JobStatus } from "@/lib/repair/types";
import { formatMoney } from "@/lib/pos/types";

/** The journey, as a customer would describe it rather than as the shop files it. */
const CUSTOMER_STEPS: { key: JobStatus; label: string }[] = [
  { key: "received", label: "Received" },
  { key: "diagnosing", label: "Being looked at" },
  { key: "in-repair", label: "Being repaired" },
  { key: "ready", label: "Ready to collect" },
  { key: "delivered", label: "Collected" },
];

/** Where a status sits on that journey; -1 for the ones that sit outside it. */
function stepIndexOf(status: JobStatus): number {
  switch (status) {
    case "received":
      return 0;
    case "diagnosing":
    case "estimate-sent":
    case "approved":
      return 1;
    case "in-repair":
    case "awaiting-parts":
      return 2;
    case "ready":
      return 3;
    case "delivered":
      return 4;
    default:
      return -1;
  }
}

function statusTone(status: JobStatus): { className: string; icon: typeof Clock } {
  switch (status) {
    case "ready":
      return { className: "border-green-300 bg-green-50 text-green-900", icon: PackageCheck };
    case "delivered":
      return { className: "border-green-300 bg-green-50 text-green-900", icon: BadgeCheck };
    case "returned-unrepaired":
    case "cancelled":
      return { className: "border-red-200 bg-red-50 text-red-800", icon: CircleAlert };
    case "awaiting-parts":
    case "estimate-sent":
      return { className: "border-amber-300 bg-amber-50 text-amber-900", icon: Clock };
    default:
      return { className: "border-indigo/40 bg-indigo/5 text-ink", icon: Wrench };
  }
}

export function RepairTracker({ code }: { code: string }) {
  const [payload, setPayload] = useState<TrackPayload | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [sending, setSending] = useState(false);
  const [answered, setAnswered] = useState<"yes" | "no" | null>(null);
  const [answerError, setAnswerError] = useState("");

  const load = useCallback(async () => {
    try {
      const resolved = await readTracking(code);
      if (!resolved) {
        setState("missing");
        return;
      }
      setPayload(resolved);
      setAnswered(resolved.reply?.decided ?? null);
      setState("ready");
    } catch {
      setState("error");
    }
  }, [code]);

  useEffect(() => {
    void load();
  }, [load]);

  const answer = async (decision: "yes" | "no") => {
    if (!payload?.reply) return;
    setSending(true);
    setAnswerError("");
    try {
      await submitDecision(payload.reply.code, payload.reply.token, payload.jobNo, decision);
      setAnswered(decision);
    } catch {
      setAnswerError(
        "That could not be sent. Check your connection and try again, or ring the shop."
      );
    } finally {
      setSending(false);
    }
  };

  if (state === "loading") {
    return <p className="py-16 text-center text-sm text-muted">Looking up your repair…</p>;
  }

  if (state === "missing") {
    return (
      <div className="rounded-2xl border border-muted-line/30 bg-white p-8 text-center">
        <CircleAlert className="mx-auto h-8 w-8 text-muted" aria-hidden="true" />
        <h1 className="mt-4 text-xl font-bold text-ink">This link is no longer active</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
          Tracking links do not last for ever. If your repair is still with the shop, please ring
          them — they have the full record and can tell you where it is.
        </p>
      </div>
    );
  }

  if (state === "error" || !payload) {
    return (
      <div className="rounded-2xl border border-muted-line/30 bg-white p-8 text-center">
        <CircleAlert className="mx-auto h-8 w-8 text-red-500" aria-hidden="true" />
        <h1 className="mt-4 text-xl font-bold text-ink">Could not load your repair</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
          Something went wrong reaching the server. Try again in a moment.
        </p>
        <button
          type="button"
          onClick={() => {
            setState("loading");
            void load();
          }}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo px-4 py-2 text-sm font-semibold text-white"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Try again
        </button>
      </div>
    );
  }

  const tone = statusTone(payload.status);
  const StatusIcon = tone.icon;
  const currentStep = stepIndexOf(payload.status);
  const money = (value: number) => formatMoney(value, payload.currency || "INR");
  const awaitingAnswer = Boolean(payload.reply && !payload.reply.decided && !answered);

  return (
    <div className="grid gap-4">
      <header className="text-center">
        <p className="text-sm font-semibold text-muted">{payload.shop}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">{payload.device}</h1>
        <p className="text-sm text-muted">Job {payload.jobNo}</p>
      </header>

      {/* The one fact the page exists to deliver. */}
      <div className={`rounded-2xl border p-6 text-center ${tone.className}`}>
        <StatusIcon className="mx-auto h-8 w-8" aria-hidden="true" />
        <p className="mt-3 text-xl font-bold">{payload.statusLabel}</p>
        {payload.status === "ready" && (
          <p className="mt-1 text-sm">Your device is ready to collect.</p>
        )}
        {payload.status === "awaiting-parts" && payload.promisedDate && (
          <p className="mt-1 text-sm">
            We are waiting for a part. New estimated date {formatDate(payload.promisedDate)}.
          </p>
        )}
      </div>

      {/* The estimate, when one is waiting for an answer. */}
      {payload.status === "estimate-sent" && (
        <div className="rounded-2xl border border-muted-line/30 bg-white p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Estimate</h2>
          {payload.amount !== undefined && (
            <p className="mt-2 text-3xl font-bold text-ink">{money(payload.amount)}</p>
          )}
          <p className="mt-2 text-sm text-muted">
            Work starts once you approve. If the fault turns out to be different once the device is
            opened, the shop will tell you the revised figure before going ahead.
          </p>

          {answered ? (
            <p
              className={`mt-4 flex items-center gap-2 rounded-lg border p-3 text-sm font-semibold ${
                answered === "yes"
                  ? "border-green-300 bg-green-50 text-green-900"
                  : "border-red-200 bg-red-50 text-red-800"
              }`}
            >
              {answered === "yes" ? (
                <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
              ) : (
                <X className="h-4 w-4 shrink-0" aria-hidden="true" />
              )}
              {answered === "yes"
                ? "You approved this estimate. The shop will see it shortly and begin work."
                : "You declined this estimate. The shop will see it shortly and be in touch."}
            </p>
          ) : awaitingAnswer ? (
            <>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => void answer("yes")}
                  disabled={sending}
                  className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-indigo px-5 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-50"
                >
                  <Check className="h-5 w-5" aria-hidden="true" />
                  {sending ? "Sending…" : "Approve — go ahead"}
                </button>
                <button
                  type="button"
                  onClick={() => void answer("no")}
                  disabled={sending}
                  className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl border border-muted-line/40 bg-white px-5 text-sm font-bold text-ink transition hover:border-red-300 hover:text-red-700 disabled:opacity-50"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                  Decline
                </button>
              </div>
              <p className="mt-2 text-xs text-muted">
                The shop picks this up the next time they open their job card — usually within a few
                minutes. Ring them if it is urgent.
              </p>
            </>
          ) : (
            <p className="mt-4 text-sm text-muted">
              Please reply to the shop&apos;s message, or ring them, to approve this estimate.
            </p>
          )}

          {answerError && (
            <p className="mt-3 text-sm font-semibold text-red-600" role="alert">
              {answerError}
            </p>
          )}
        </div>
      )}

      {/* Progress. */}
      {currentStep >= 0 && (
        <ol className="rounded-2xl border border-muted-line/30 bg-white p-5">
          {CUSTOMER_STEPS.map((step, index) => {
            const done = index < currentStep;
            const current = index === currentStep;
            return (
              <li key={step.key} className="flex items-start gap-3 py-1.5">
                <span
                  aria-hidden="true"
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    done
                      ? "bg-green-600 text-white"
                      : current
                        ? "bg-indigo text-white"
                        : "bg-muted-line/30 text-muted"
                  }`}
                >
                  {done ? "✓" : index + 1}
                </span>
                <span
                  className={`text-sm ${
                    current ? "font-bold text-ink" : done ? "text-muted" : "text-muted/70"
                  }`}
                >
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {/* The details, in the order people ask for them. */}
      <dl className="grid gap-3 rounded-2xl border border-muted-line/30 bg-white p-5 text-sm">
        {payload.promisedDate && payload.status !== "delivered" && (
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Promised by</dt>
            <dd className="font-semibold text-ink">{formatDate(payload.promisedDate)}</dd>
          </div>
        )}
        {payload.amount !== undefined && payload.status !== "estimate-sent" && (
          <div className="flex justify-between gap-4">
            <dt className="text-muted">
              {payload.amountKind === "bill" ? "Amount" : "Estimate"}
            </dt>
            <dd className="font-semibold text-ink">{money(payload.amount)}</dd>
          </div>
        )}
        {payload.invoiceNo && (
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Invoice</dt>
            <dd className="font-semibold text-ink">{payload.invoiceNo}</dd>
          </div>
        )}
        {payload.warrantyEnd && (
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Under warranty until</dt>
            <dd className="font-semibold text-ink">{formatDate(payload.warrantyEnd)}</dd>
          </div>
        )}
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Received</dt>
          <dd className="font-semibold text-ink">
            {new Date(payload.receivedOn).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </dd>
        </div>
      </dl>

      {/* Paying, and reaching a human. */}
      {payload.status === "ready" && payload.upiId && (
        <div className="rounded-2xl border border-muted-line/30 bg-white p-5 text-center">
          <p className="text-sm text-muted">Pay by UPI</p>
          <p className="mt-1 font-mono text-base font-bold text-ink">{payload.upiId}</p>
        </div>
      )}

      {payload.shopPhone && (
        <a
          href={`tel:${payload.shopPhone}`}
          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-muted-line/40 bg-white text-sm font-bold text-ink transition hover:border-indigo/40 hover:text-indigo"
        >
          <Phone className="h-4 w-4" aria-hidden="true" />
          Ring {payload.shop}
        </a>
      )}

      <div className="flex items-center justify-between gap-3 text-xs text-muted">
        <span>
          Updated{" "}
          {new Date(payload.updatedAt).toLocaleString("en-IN", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1 font-semibold hover:text-indigo"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Refresh
        </button>
      </div>

      <p className="text-center text-xs text-muted">
        This page updates itself as the shop works — the link stays the same, so you can bookmark
        it.
      </p>
    </div>
  );
}
