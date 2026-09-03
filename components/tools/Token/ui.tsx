"use client";

// Token-system UI atoms. The general primitives — buttons, Field, Modal,
// EmptyState — are the same ones the POS and the clinic use, so all four
// products look like one system.

import type { ReactNode } from "react";
import { Star } from "lucide-react";
import { TOKEN_STATUS_LABELS, type Service, type Token, type TokenStatus } from "@/lib/token/types";

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

/**
 * The counter's buttons are pressed standing up, often one-handed, sometimes
 * by someone who is also talking to a customer. Everything actionable is at
 * least 44px tall, which is the smallest target a thumb hits reliably.
 */
export const bigBtnClass =
  "inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-indigo px-5 text-base font-bold text-white transition hover:bg-ink disabled:cursor-not-allowed disabled:opacity-40";

export const chipBtnClass =
  "inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-muted-line/40 bg-white px-3 text-sm font-semibold text-ink transition hover:border-indigo/50 hover:text-indigo disabled:cursor-not-allowed disabled:opacity-40";

const STATUS_STYLES: Record<TokenStatus, string> = {
  waiting: "bg-white text-muted border-muted-line/40",
  called: "bg-saffron/15 text-ink border-saffron/60",
  serving: "bg-indigo/10 text-indigo border-indigo/40",
  served: "bg-green-50 text-green-800 border-green-300",
  skipped: "bg-amber-50 text-amber-800 border-amber-300",
  cancelled: "bg-red-50 text-red-700 border-red-200",
};

/**
 * Status is always in words, never colour alone. A cheap counter monitor in
 * daylight washes the fills out, and roughly one man in twelve cannot tell
 * the amber from the green.
 */
export function StatusChip({ status }: { status: TokenStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[status]}`}
    >
      {TOKEN_STATUS_LABELS[status]}
    </span>
  );
}

/** The token number itself, at whatever size the surrounding screen needs. */
export function TokenBadge({
  token,
  service,
  size = "md",
}: {
  token: Token;
  service: Service | undefined;
  size?: "sm" | "md" | "lg";
}) {
  const prefix = service?.prefix?.trim() ?? "";
  const label = prefix ? `${prefix}-${token.number}` : String(token.number);
  const sizes = {
    sm: "text-base",
    md: "text-2xl",
    lg: "text-5xl sm:text-6xl",
  } as const;
  return (
    <span className={`font-extrabold leading-none tracking-tight text-ink ${sizes[size]}`}>
      {label}
    </span>
  );
}

export function PriorityFlag({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-saffron/60 bg-saffron/15 px-2 py-0.5 text-xs font-bold text-ink ${className}`}
    >
      <Star className="h-3 w-3" aria-hidden="true" />
      Priority
    </span>
  );
}

/** A coloured dot for a service, always paired with its name. */
export function ServiceDot({ colour }: { colour: string }) {
  return (
    <span
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: colour }}
      aria-hidden="true"
    />
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
    <section className="rounded-2xl border border-muted-line/30 bg-white p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold uppercase tracking-wide text-muted">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}
