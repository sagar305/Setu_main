"use client";

// Repair UI atoms. The general primitives — buttons, Field, Modal, EmptyState —
// are the same ones the POS, the clinic, the pharmacy and the hire book use, so
// every product on the site looks like one system.

import type { ReactNode } from "react";
import { AlertTriangle, Clock, Flame } from "lucide-react";
import {
  JOB_STATUS_LABELS,
  PRIORITY_LABELS,
  type Job,
  type JobStatus,
} from "@/lib/repair/types";
import type { AgingLevel } from "@/lib/repair/calc";

export {
  inputClass,
  primaryBtnClass,
  secondaryBtnClass,
  dangerBtnClass,
  Field,
  Modal,
  ConfirmDialog,
  SearchInput,
  EmptyState,
  StatCard,
} from "@/components/tools/FreePos/ui";

export const chipBtnClass =
  "inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg border border-muted-line/40 bg-white px-3 text-sm font-semibold text-ink transition hover:border-indigo/50 hover:text-indigo disabled:cursor-not-allowed disabled:opacity-40";

/** A toggle chip — the intake wizard is mostly these. */
export function ToggleChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border px-3 text-sm font-semibold transition ${
        active
          ? "border-indigo bg-indigo text-white"
          : "border-muted-line/40 bg-white text-ink hover:border-indigo/50 hover:text-indigo"
      }`}
    >
      {children}
    </button>
  );
}

const STATUS_STYLES: Record<JobStatus, string> = {
  received: "bg-white text-muted border-muted-line/40",
  diagnosing: "bg-blue-50 text-blue-800 border-blue-300",
  "estimate-sent": "bg-violet-50 text-violet-800 border-violet-300",
  approved: "bg-indigo/10 text-indigo border-indigo/40",
  "in-repair": "bg-saffron/15 text-ink border-saffron/60",
  "awaiting-parts": "bg-amber-50 text-amber-800 border-amber-300",
  ready: "bg-green-50 text-green-800 border-green-300",
  delivered: "bg-cream text-muted border-muted-line/40",
  "returned-unrepaired": "bg-red-50 text-red-700 border-red-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
};

/**
 * Status in words, never colour alone. A phone held up at a counter in daylight
 * washes the fills out, and roughly one man in twelve cannot tell the amber from
 * the green.
 */
export function StatusChip({ status }: { status: JobStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[status]}`}
    >
      {JOB_STATUS_LABELS[status]}
    </span>
  );
}

/**
 * How long this device has been here, and how alarmed to look about it.
 *
 * The number is always shown, because "9 days" is what an owner acts on and a
 * red border alone only says "something". A shop full of red cards is a shop
 * with a problem, visible from the doorway — that is the whole point of putting
 * a colour on a card at all.
 */
export function AgingBadge({ days, level }: { days: number; level: AgingLevel }) {
  const styles: Record<AgingLevel, string> = {
    fresh: "border-muted-line/40 bg-white text-muted",
    amber: "border-amber-300 bg-amber-50 text-amber-800",
    red: "border-red-300 bg-red-50 text-red-700",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${styles[level]}`}
    >
      <Clock className="h-3 w-3" aria-hidden="true" />
      {days === 0 ? "Today" : `${days}d in shop`}
    </span>
  );
}

/** Card and row borders follow the same three bands as the badge. */
export const AGING_BORDER: Record<AgingLevel, string> = {
  fresh: "border-muted-line/30",
  amber: "border-amber-300",
  red: "border-red-300",
};

export function PriorityFlag({ priority }: { priority: Job["priority"] }) {
  if (priority !== "urgent") return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700">
      <Flame className="h-3 w-3" aria-hidden="true" />
      {PRIORITY_LABELS.urgent}
    </span>
  );
}

export function Pill({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "warn" | "danger" | "good" | "indigo";
}) {
  const styles = {
    muted: "border-muted-line/40 bg-white text-muted",
    warn: "border-saffron/60 bg-saffron/15 text-ink",
    danger: "border-red-200 bg-red-50 text-red-700",
    good: "border-green-300 bg-green-50 text-green-800",
    indigo: "border-indigo/40 bg-indigo/10 text-indigo",
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${styles[tone]}`}
    >
      {children}
    </span>
  );
}

export function SectionCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-muted-line/30 bg-white p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold uppercase tracking-wide text-muted">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/**
 * The warning that sits above the unlock-code field.
 *
 * Plain words, not a padlock icon and a shrug. The shop is being asked to keep
 * the one thing that opens a customer's whole phone, on a device that lives on a
 * counter, and they should read that sentence before typing rather than after
 * losing the tablet.
 */
export function SensitiveNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}
