"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChefHat, CircleAlert, Clock, Flame, Utensils } from "lucide-react";
import { useDine } from "@/lib/dine/store";
import { canSyncTabs } from "@/lib/dine/sync";
import {
  KOT_STATUS_LABELS,
  ORDER_TYPE_LABELS,
  kotStatusOf,
  type DineKot,
  type KotStatus,
} from "@/lib/dine/types";
import { EmptyState, primaryBtnClass, secondaryBtnClass, tapTargetClass } from "./ui";
import { timeOnly } from "./printing";

/**
 * The kitchen screen.
 *
 * Meant to be left open in a second tab — on the pass, on the same device —
 * while the counter takes orders in the first. Both tabs read the one
 * IndexedDB database, and lib/dine/sync tells this one when a round has been
 * fired, so a ticket appears here the moment Send is tapped rather than
 * whenever somebody remembers to refresh.
 *
 * It shows no prices, for the same reason the printed KOT doesn't: a cook
 * needs to know what to make and what is unusual about it.
 */

/** How long a round has been waiting, and how alarmed to look about it. */
function ageOf(iso: string, now: number): { label: string; minutes: number } {
  const started = new Date(iso).getTime();
  if (Number.isNaN(started)) return { label: "", minutes: 0 };
  const minutes = Math.max(Math.floor((now - started) / 60000), 0);
  if (minutes < 60) return { label: `${minutes}m`, minutes };
  return { label: `${Math.floor(minutes / 60)}h ${minutes % 60}m`, minutes };
}

const NEXT_STATUS: Partial<Record<KotStatus, { next: KotStatus; label: string }>> = {
  new: { next: "preparing", label: "Start cooking" },
  preparing: { next: "ready", label: "Mark ready" },
  ready: { next: "served", label: "Picked up" },
};

export function KitchenScreen() {
  const { kots, tickets, tables, areas, ticketItems, setKotStatus, business } = useDine();
  const [now, setNow] = useState(() => Date.now());
  const [showServed, setShowServed] = useState(false);

  // The age badges are the whole point of this screen, so keep them honest.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, []);

  const [syncLive, setSyncLive] = useState(true);
  useEffect(() => setSyncLive(canSyncTabs()), []);

  const visible = useMemo(() => {
    return kots
      .filter((kot) => {
        const status = kotStatusOf(kot);
        if (status === "served") return showServed;
        // A round on a settled or voided ticket is no longer the kitchen's
        // problem, however it was left.
        const ticket = tickets.find((row) => row.id === kot.ticketId);
        if (!ticket) return false;
        return ticket.status === "open" || ticket.status === "billed";
      })
      .sort((a, b) => a.printedAt.localeCompare(b.printedAt));
  }, [kots, showServed, tickets]);

  const waiting = visible.filter((kot) => kotStatusOf(kot) !== "served").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
            <ChefHat className="h-5 w-5 text-indigo" />
            Kitchen
          </h2>
          <p className="text-xs text-muted">
            {business?.name ? `${business.name} · ` : ""}
            {waiting === 0 ? "Nothing waiting" : `${waiting} round${waiting === 1 ? "" : "s"} on`}
            {syncLive ? " · updates live" : " · live updates unavailable in this browser"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowServed((previous) => !previous)}
          className={`${secondaryBtnClass} ${tapTargetClass}`}
        >
          {showServed ? "Hide picked up" : "Show picked up"}
        </button>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<Utensils className="h-6 w-6" />}
          title="Nothing on"
          message="Rounds appear here the moment the counter sends them. Leave this tab open on the pass."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((kot) => {
            const ticket = tickets.find((row) => row.id === kot.ticketId) ?? null;
            const table = ticket?.tableId
              ? tables.find((row) => row.id === ticket.tableId) ?? null
              : null;
            return (
              <KotCard
                key={kot.id}
                kot={kot}
                now={now}
                table={table}
                areaName={areas.find((area) => area.id === table?.areaId)?.name ?? ""}
                orderTypeLabel={ORDER_TYPE_LABELS[ticket?.orderType ?? "takeaway"]}
                customerName={ticket?.customerName ?? ""}
                items={ticketItems.filter(
                  (item) =>
                    item.ticketId === kot.ticketId &&
                    item.roundNumber === kot.roundNumber &&
                    (kot.isCancellation ? item.cancelledAt !== null : true)
                )}
                onAdvance={(status) => void setKotStatus(kot.id, status)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function KotCard({
  kot,
  now,
  table,
  areaName,
  orderTypeLabel,
  customerName,
  items,
  onAdvance,
}: {
  kot: DineKot;
  now: number;
  table: { name: string } | null;
  areaName: string;
  orderTypeLabel: string;
  customerName: string;
  items: {
    id: string;
    name: string;
    variationName: string;
    quantity: number;
    modifiers: { id: string; name: string }[];
    note: string;
    cancelledAt: string | null;
  }[];
  onAdvance: (status: KotStatus) => void;
}) {
  const status = kotStatusOf(kot);
  const age = ageOf(kot.printedAt, now);
  const advance = NEXT_STATUS[status];

  // A round that has been sitting a while should be visible from across the
  // kitchen, so the escalation is in the border weight as well as the colour.
  const overdue = status !== "served" && age.minutes >= 20;
  const warming = status !== "served" && age.minutes >= 10 && age.minutes < 20;

  const tone = kot.isCancellation
    ? "border-red-500 bg-red-50"
    : overdue
      ? "border-red-500 bg-white ring-2 ring-red-500/20"
      : warming
        ? "border-saffron bg-white"
        : status === "ready"
          ? "border-green-600 bg-green-50/60"
          : "border-muted-line/40 bg-white";

  return (
    <article className={`flex flex-col rounded-2xl border-2 p-3 shadow-sm ${tone}`}>
      <header className="flex items-start justify-between gap-2">
        <div>
          <p className="text-base font-bold text-ink">
            {table ? table.name : orderTypeLabel}
            {areaName && <span className="ml-1.5 text-xs font-normal text-muted">{areaName}</span>}
          </p>
          <p className="text-xs text-muted">
            {kot.kotLabel} · Round {kot.roundNumber}
            {table ? ` · ${orderTypeLabel}` : ""}
            {customerName ? ` · ${customerName}` : ""}
          </p>
        </div>
        <div className="text-right">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${
              overdue ? "bg-red-100 text-red-700" : "bg-cream text-ink"
            }`}
          >
            <Clock className="h-3 w-3" aria-hidden="true" />
            {age.label}
          </span>
          <p className="mt-1 text-[10px] uppercase tracking-wide text-muted">
            {KOT_STATUS_LABELS[status]}
          </p>
        </div>
      </header>

      {kot.isCancellation && (
        <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-red-100 px-2 py-1 text-xs font-bold uppercase tracking-wide text-red-700">
          <CircleAlert className="h-3.5 w-3.5" aria-hidden="true" />
          Cancelled — stop cooking
        </p>
      )}

      <ul className="mt-3 flex-1 space-y-2">
        {items.map((item) => (
          <li key={item.id} className="flex gap-2">
            <span className="min-w-[1.5rem] text-lg font-bold leading-tight text-ink">
              {item.quantity}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold leading-snug text-ink">
                {item.name}
                {item.variationName && (
                  <span className="font-normal text-muted"> ({item.variationName})</span>
                )}
              </span>
              {item.modifiers.length > 0 && (
                <span className="block text-xs text-muted">
                  + {item.modifiers.map((modifier) => modifier.name).join(", ")}
                </span>
              )}
              {item.note && (
                <span className="mt-0.5 block rounded bg-saffron/20 px-1.5 py-0.5 text-xs font-bold text-ink">
                  {item.note}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>

      <footer className="mt-3 flex items-center gap-2">
        {advance ? (
          <button
            type="button"
            onClick={() => onAdvance(advance.next)}
            className={`${status === "preparing" ? primaryBtnClass : secondaryBtnClass} ${tapTargetClass} flex-1`}
          >
            {status === "new" ? (
              <Flame className="h-4 w-4" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {advance.label}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onAdvance("new")}
            className={`${secondaryBtnClass} ${tapTargetClass} flex-1`}
          >
            Put back on
          </button>
        )}
        <span className="text-[10px] text-muted">{timeOnly(kot.printedAt)}</span>
      </footer>
    </article>
  );
}
