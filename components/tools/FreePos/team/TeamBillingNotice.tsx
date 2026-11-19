"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import type { CartLine, Product } from "@/lib/pos/types";
import { timeAgo, useTeam } from "./TeamSyncContext";

const LOW_STOCK = 3;
const STALE_MS = 2 * 60_000;

/**
 * Billing-screen note while in a team: how fresh the stock numbers are, and a
 * warning when the cart holds an item that is nearly out and the last sync is
 * old — another counter may have sold the last units.
 */
export function TeamBillingNotice({ lines, products }: { lines: CartLine[]; products: Product[] }) {
  const { team, syncing, sync } = useTeam();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);
  if (!team || team.removed) return null;

  const stale = !team.lastSyncAt || now - new Date(team.lastSyncAt).getTime() > STALE_MS;
  const risky = lines
    .map((line) => products.find((p) => p.id === line.productId))
    .filter((p): p is Product => Boolean(p && p.trackStock && p.stock <= LOW_STOCK));

  return (
    <div className="mt-3 space-y-2">
      <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <span className={`h-2 w-2 rounded-full ${stale ? "bg-saffron" : "bg-emerald-500"}`} />
        Stock last synced {timeAgo(team.lastSyncAt, now)}
        {team.needsSignIn && <span className="font-semibold text-ink">· reconnect Google in Settings</span>}
      </p>
      {stale && risky.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-saffron/50 bg-saffron/10 px-3 py-2 text-sm text-ink">
          <AlertTriangle className="h-4 w-4 shrink-0 text-saffron" />
          <span className="min-w-0 flex-1">
            Low stock: <strong>{risky.map((p) => p.name).join(", ")}</strong>. Sync first — another counter may have
            sold the last units.
          </span>
          {!team.needsSignIn && (
            <button
              type="button"
              disabled={syncing}
              onClick={() => void sync()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-muted-line/40 bg-white px-3 py-1.5 text-xs font-semibold text-ink"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
              Sync now
            </button>
          )}
        </div>
      )}
    </div>
  );
}
