"use client";

// Dine-specific UI atoms. The general primitives (Modal, Field, buttons,
// EmptyState) are shared with the Browser Based POS so both products look like
// one system — only the pieces that exist because this is a restaurant live
// here.

import type { ReactNode } from "react";
import type { TableState } from "@/lib/dine/store";
import { FOOD_TYPE_LABELS, type FoodType, type OrderType } from "@/lib/dine/types";

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
 * The veg/non-veg mark Indian menus are legally required to carry — a coloured
 * dot inside a square outline. The label is exposed to screen readers because
 * the shape alone means nothing to them.
 */
export function FoodDot({ type, className = "" }: { type: FoodType; className?: string }) {
  const colour =
    type === "veg" ? "bg-green-600" : type === "egg" ? "bg-amber-500" : "bg-red-600";
  const border =
    type === "veg" ? "border-green-600" : type === "egg" ? "border-amber-500" : "border-red-600";
  return (
    <span
      className={`inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center border ${border} ${className}`}
      title={FOOD_TYPE_LABELS[type]}
    >
      <span className="sr-only">{FOOD_TYPE_LABELS[type]}</span>
      <span className={`h-1.5 w-1.5 rounded-full ${colour}`} aria-hidden="true" />
    </span>
  );
}

const TABLE_STATE_STYLES: Record<TableState, { label: string; chip: string; card: string }> = {
  free: {
    label: "Free",
    chip: "bg-white text-muted border-muted-line/40",
    card: "border-muted-line/30 bg-white hover:border-indigo/50",
  },
  occupied: {
    label: "Running",
    chip: "bg-saffron/15 text-ink border-saffron/50",
    card: "border-saffron/60 bg-saffron/10 hover:border-saffron",
  },
  billed: {
    label: "Bill printed",
    chip: "bg-indigo/10 text-indigo border-indigo/40",
    card: "border-indigo/60 bg-indigo/5 hover:border-indigo",
  },
};

/**
 * FR-3.3: colour is never the only signal. Every table carries its state in
 * words as well, because a cheap screen in daylight washes the fills out and
 * because roughly one man in twelve cannot tell the amber from the green.
 */
export function TableStateBadge({ state }: { state: TableState }) {
  const style = TABLE_STATE_STYLES[state];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${style.chip}`}
    >
      {style.label}
    </span>
  );
}

export function tableCardClass(state: TableState): string {
  return TABLE_STATE_STYLES[state].card;
}

export function tableStateLabel(state: TableState): string {
  return TABLE_STATE_STYLES[state].label;
}

const ORDER_TYPE_STYLES: Record<OrderType, string> = {
  "dine-in": "bg-indigo/10 text-indigo",
  takeaway: "bg-saffron/20 text-ink",
  delivery: "bg-green-600/10 text-green-800",
};

export function OrderTypeChip({ type }: { type: OrderType }) {
  const labels: Record<OrderType, string> = {
    "dine-in": "Dine-in",
    takeaway: "Takeaway",
    delivery: "Delivery",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${ORDER_TYPE_STYLES[type]}`}
    >
      {labels[type]}
    </span>
  );
}

/** How long a ticket has been open, in the shorthand a floor manager reads. */
export function elapsedLabel(openedAt: string | null, now: number): string {
  if (!openedAt) return "";
  const started = new Date(openedAt).getTime();
  if (Number.isNaN(started)) return "";
  const minutes = Math.max(Math.floor((now - started) / 60000), 0);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export function SectionHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-bold text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/**
 * A tap target that stays 44px tall whatever it contains (NFR-3). Used for
 * every control on the order screen, which is operated one-handed, standing,
 * during a rush.
 */
export const tapTargetClass = "min-h-[44px] min-w-[44px]";
