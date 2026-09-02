"use client";

// Rental UI atoms. The general primitives — buttons, Field, Modal, EmptyState —
// are the same ones the POS, the clinic and the queue use, so every product on
// the site looks like one system.

import type { ReactNode } from "react";
import { BOOKING_STATUS_LABELS, formatDateShort, type BookingStatus } from "@/lib/rental/types";
import type { DayLoad } from "@/lib/rental/availability";

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

const STATUS_STYLES: Record<BookingStatus, string> = {
  enquiry: "bg-white text-muted border-muted-line/40",
  confirmed: "bg-indigo/10 text-indigo border-indigo/40",
  dispatched: "bg-saffron/15 text-ink border-saffron/60",
  returned: "bg-blue-50 text-blue-800 border-blue-300",
  closed: "bg-green-50 text-green-800 border-green-300",
  cancelled: "bg-red-50 text-red-700 border-red-200",
};

/**
 * Status in words, never colour alone. A phone in daylight on a loading bay
 * washes the fills out, and roughly one man in twelve cannot tell the amber
 * from the green.
 */
export function StatusChip({ status }: { status: BookingStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[status]}`}
    >
      {BOOKING_STATUS_LABELS[status]}
    </span>
  );
}

/**
 * How tight an item is, as a colour and a number.
 *
 * Three bands rather than a gradient: there is nothing useful between "plenty"
 * and "nearly gone" that an owner acts on differently, and a gradient at chip
 * size is unreadable anyway. Over-committed is its own band because it is not a
 * shortage, it is a mistake.
 */
export function availabilityTone(free: number, total: number): {
  label: string;
  className: string;
} {
  if (free < 0) return { label: "Over-committed", className: "bg-red-50 text-red-700 border-red-300" };
  if (free === 0) return { label: "Fully booked", className: "bg-amber-50 text-amber-800 border-amber-300" };
  if (total > 0 && free / total <= 0.2) {
    return { label: "Running tight", className: "bg-saffron/15 text-ink border-saffron/60" };
  }
  return { label: "Available", className: "bg-green-50 text-green-800 border-green-300" };
}

export function AvailabilityPill({ free, total }: { free: number; total: number }) {
  const tone = availabilityTone(free, total);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${tone.className}`}
    >
      <strong>{free}</strong>
      <span className="font-normal opacity-70">of {total} free</span>
    </span>
  );
}

/**
 * Sixty days of commitment as a row of cells.
 *
 * The point of it is the shape, not the numbers — an owner scanning the strip
 * is looking for where the run of dark cells starts, which is the weekend they
 * cannot take another booking on. Each cell carries a title so the exact figures
 * are one hover (or one long-press) away, and the strip scrolls sideways rather
 * than shrinking cells below the point of being visible.
 */
export function CalendarStrip({
  days,
  total,
  onPickDate,
}: {
  days: DayLoad[];
  total: number;
  onPickDate?: (date: string) => void;
}) {
  return (
    <div className="-mx-1 flex gap-[2px] overflow-x-auto px-1 pb-1">
      {days.map((day) => {
        const used = day.committed + day.maintenance;
        const share = total > 0 ? used / total : 0;
        const className =
          used > total
            ? "bg-red-500"
            : share >= 1
              ? "bg-amber-500"
              : share >= 0.7
                ? "bg-saffron"
                : share > 0
                  ? "bg-indigo/40"
                  : "bg-muted-line/25";
        const label = `${formatDateShort(day.date)} — ${Math.max(0, total - used)} of ${total} free`;
        return (
          <button
            key={day.date}
            type="button"
            onClick={onPickDate ? () => onPickDate(day.date) : undefined}
            title={label}
            aria-label={label}
            className={`h-8 w-2.5 shrink-0 rounded-sm ${className} ${
              onPickDate ? "cursor-pointer" : "cursor-default"
            }`}
          />
        );
      })}
    </div>
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

export function Pill({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "warn" | "danger" | "good" }) {
  const styles = {
    muted: "border-muted-line/40 bg-white text-muted",
    warn: "border-saffron/60 bg-saffron/15 text-ink",
    danger: "border-red-200 bg-red-50 text-red-700",
    good: "border-green-300 bg-green-50 text-green-800",
  } as const;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${styles[tone]}`}>
      {children}
    </span>
  );
}
