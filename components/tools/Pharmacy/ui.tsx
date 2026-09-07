"use client";

// Pharmacy UI atoms. The general primitives — buttons, Field, Modal,
// EmptyState — are the same ones the POS, the clinic, the rental book and the
// queue use, so every product on the site looks like one system.

import type { ReactNode } from "react";
import {
  SCHEDULE_LABELS,
  daysToExpiry,
  formatExpiry,
  isExpired,
  type ScheduleClass,
} from "@/lib/pharmacy/types";

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

/**
 * How close a batch is to being worthless, as a colour AND a word.
 *
 * Never colour alone: a counter phone in daylight washes the fills out, and
 * roughly one man in twelve cannot tell the amber from the green. The bands are
 * deliberately coarse — a chemist acts the same way on 40 days as on 50, and
 * differently on 10.
 */
export function expiryTone(expiry: string, today?: string) {
  if (isExpired(expiry, today)) {
    return { label: "Expired", className: "border-red-300 bg-red-50 text-red-700" };
  }
  const days = daysToExpiry(expiry, today);
  if (days <= 30) {
    return { label: `${days}d left`, className: "border-red-200 bg-red-50 text-red-700" };
  }
  if (days <= 90) {
    return { label: `${days}d left`, className: "border-saffron/60 bg-saffron/15 text-ink" };
  }
  return { label: formatExpiry(expiry), className: "border-green-300 bg-green-50 text-green-800" };
}

export function ExpiryChip({ expiry, today }: { expiry: string; today?: string }) {
  const tone = expiryTone(expiry, today);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${tone.className}`}
      title={`Sellable through ${formatExpiry(expiry)}`}
    >
      {tone.label}
    </span>
  );
}

/**
 * A drug schedule, shown only when there is one.
 *
 * Most of the shelf is unscheduled, and a chip on every row would train the
 * counter to stop seeing the chip — which defeats the one job it has, which is
 * to make an H1 line impossible to miss.
 */
export function ScheduleChip({ schedule }: { schedule: ScheduleClass }) {
  if (!schedule || schedule === "OTC") return null;
  const strong = schedule === "H1" || schedule === "X";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-bold ${
        strong
          ? "border-red-300 bg-red-50 text-red-700"
          : "border-indigo/40 bg-indigo/10 text-indigo"
      }`}
    >
      {SCHEDULE_LABELS[schedule]}
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

export function Pill({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "warn" | "danger" | "good" | "info";
}) {
  const styles = {
    muted: "border-muted-line/40 bg-white text-muted",
    info: "border-indigo/40 bg-indigo/10 text-indigo",
    warn: "border-saffron/60 bg-saffron/15 text-ink",
    danger: "border-red-200 bg-red-50 text-red-700",
    good: "border-green-300 bg-green-50 text-green-800",
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${styles[tone]}`}
    >
      {children}
    </span>
  );
}

/** Stock as a number and a word, so "12" is never read as plenty. */
export function StockPill({ available, lowAt }: { available: number; lowAt: number }) {
  if (available <= 0) return <Pill tone="danger">Out of stock</Pill>;
  if (available <= lowAt) return <Pill tone="warn">{available} left — low</Pill>;
  return <Pill tone="good">{available} in stock</Pill>;
}
