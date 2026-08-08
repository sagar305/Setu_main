"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, ChefHat } from "lucide-react";
import { DineProvider, useDine } from "@/lib/dine/store";
import { KitchenScreen } from "./KitchenScreen";
import { primaryBtnClass } from "./ui";

/**
 * The kitchen screen on its own route, so it can live in a second tab on the
 * pass with none of the counter's chrome around it.
 *
 * It mounts the same provider against the same database, which is what makes
 * the two tabs one system: the counter writes, lib/dine/sync says what moved,
 * and this tab re-reads it. Nothing is duplicated and there is no server in
 * between.
 */
function KitchenRouter() {
  const { status, errorMessage } = useDine();

  if (status === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-muted">Opening the kitchen screen…</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <h1 className="text-lg font-bold text-ink">Couldn&apos;t open local storage</h1>
        <p className="mt-2 text-sm text-muted">
          {errorMessage ||
            "The kitchen screen reads the same browser storage as the counter. Private windows block it."}
        </p>
      </div>
    );
  }

  // A kitchen screen with no restaurant set up yet is a dead end, so send them
  // to the counter rather than offering to set one up from the pass.
  if (status === "welcome" || status === "setup") {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo text-white">
          <ChefHat className="h-6 w-6" />
        </span>
        <h1 className="mt-4 text-lg font-bold text-ink">No restaurant on this device yet</h1>
        <p className="mt-2 text-sm text-muted">
          Set the restaurant up on the counter first. This screen then shows every round the moment
          it is sent.
        </p>
        <Link href="/products/free-restaurant-pos" className={`${primaryBtnClass} mt-6`}>
          <ArrowLeft className="h-4 w-4" />
          Go to the counter
        </Link>
      </div>
    );
  }

  return <KitchenScreen />;
}

export function KitchenApp() {
  // Same worker as the counter, so the pass keeps working through an outage.
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/dine-sw.js").catch(() => {
      // Offline caching is best-effort.
    });
  }, []);

  return (
    <DineProvider>
      <div className="min-h-screen bg-cream-paper p-4 sm:p-6">
        <div className="mx-auto max-w-7xl">
          <div className="mb-4 flex items-center justify-between gap-3">
            <Link
              href="/products/free-restaurant-pos"
              className="inline-flex items-center gap-2 text-sm font-semibold text-muted transition hover:text-indigo"
            >
              <ArrowLeft className="h-4 w-4" />
              Counter
            </Link>
            <span className="text-xs text-muted">
              Free Dine — kitchen screen
            </span>
          </div>
          <KitchenRouter />
        </div>
      </div>
    </DineProvider>
  );
}
