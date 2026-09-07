"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  Lock,
  Maximize2,
  Minimize2,
  Pill,
  RotateCcw,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  WifiOff,
} from "lucide-react";
import { PharmacyProvider, usePharmacy } from "@/lib/pharmacy/store";
import { LockScreen } from "@/components/tools/FreePos/LockScreen";
import { primaryBtnClass } from "@/components/tools/FreePos/ui";
import { expiryBuckets } from "@/lib/pharmacy/calc";
import { formatMoney } from "@/lib/pos/types";
import type { ScreenId } from "./nav";
import { WelcomeScreen } from "./WelcomeScreen";
import { SetupScreen } from "./SetupScreen";
import { SellScreen } from "./SellScreen";
import { MedicinesScreen } from "./MedicinesScreen";
import { PurchasesScreen } from "./PurchasesScreen";
import { ExpiryScreen } from "./ExpiryScreen";
import { ReturnsScreen } from "./ReturnsScreen";
import { CustomersScreen } from "./CustomersScreen";
import { ReportsScreen } from "./ReportsScreen";
import { SettingsScreen } from "./SettingsScreen";

const NAV_ITEMS: { id: ScreenId; label: string; icon: typeof Pill }[] = [
  { id: "sell", label: "Sell", icon: ShoppingCart },
  { id: "medicines", label: "Medicines", icon: Pill },
  { id: "purchases", label: "Purchases", icon: Truck },
  { id: "expiry", label: "Expiry", icon: CalendarClock },
  { id: "returns", label: "Returns", icon: RotateCcw },
  { id: "customers", label: "Customers", icon: Users },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
];

function PharmacyShell({
  fullscreen,
  onToggleFullscreen,
}: {
  fullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  const { batches, business, settings, today } = usePharmacy();
  const [screen, setScreen] = useState<ScreenId>("sell");
  const [offline, setOffline] = useState(false);

  const hasPin = Boolean(settings.pinHash && settings.pinSalt);
  const [locked, setLocked] = useState(false);
  const unlockedOnceRef = useRef(false);

  // Lock as soon as we learn a PIN exists — settings arrive asynchronously, so
  // the first render always has none.
  useEffect(() => {
    if (hasPin && !unlockedOnceRef.current) setLocked(true);
    if (!hasPin) setLocked(false);
  }, [hasPin]);

  const autoLockMinutes = settings.autoLockMinutes ?? 0;
  useEffect(() => {
    if (!hasPin || locked || autoLockMinutes <= 0) return;
    let timer = window.setTimeout(() => setLocked(true), autoLockMinutes * 60_000);
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setLocked(true), autoLockMinutes * 60_000);
    };
    const events: (keyof DocumentEventMap)[] = ["pointerdown", "keydown", "wheel", "touchstart"];
    events.forEach((event) => document.addEventListener(event, reset, { passive: true }));
    return () => {
      window.clearTimeout(timer);
      events.forEach((event) => document.removeEventListener(event, reset));
    };
  }, [hasPin, locked, autoLockMinutes]);

  useEffect(() => {
    setOffline(!navigator.onLine);
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  /**
   * The one number that belongs in the header.
   *
   * Money about to expire, not a batch count — a chemist decides whether to
   * chase a distributor based on what it is worth, and "₹18,400" moves someone
   * off the counter in a way "23 batches" never does.
   */
  const atRisk = useMemo(() => {
    const buckets = expiryBuckets(batches, settings.expiryBuckets, today);
    const expired = buckets.find((bucket) => bucket.days === -1);
    const soon = buckets.filter((bucket) => bucket.days > 0);
    return {
      expiredValue: expired?.valueAtCost ?? 0,
      soonValue: soon.reduce((sum, bucket) => sum + bucket.valueAtCost, 0),
    };
  }, [batches, settings.expiryBuckets, today]);

  const currency = business?.currency ?? "INR";

  if (locked) {
    return (
      <LockScreen
        businessName={business?.name ?? "Pharmacy"}
        pinHash={settings.pinHash ?? ""}
        pinSalt={settings.pinSalt ?? ""}
        onUnlock={() => {
          unlockedOnceRef.current = true;
          setLocked(false);
        }}
      />
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-bold text-ink">{business?.name || "Pharmacy"}</h2>
          {atRisk.expiredValue > 0 && (
            <button
              type="button"
              onClick={() => setScreen("expiry")}
              className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-bold text-red-700"
            >
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
              {formatMoney(atRisk.expiredValue, currency)} expired
            </button>
          )}
          {atRisk.soonValue > 0 && (
            <button
              type="button"
              onClick={() => setScreen("expiry")}
              className="rounded-full bg-saffron/20 px-2.5 py-0.5 text-xs font-bold text-ink"
            >
              {formatMoney(atRisk.soonValue, currency)} expiring soon
            </button>
          )}
          {offline && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted">
              <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
              Offline — the counter still works
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasPin && (
            <button
              type="button"
              onClick={() => setLocked(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-muted-line/40 bg-white px-3 py-1.5 text-sm font-semibold text-ink transition hover:border-indigo/40"
            >
              <Lock className="h-4 w-4" aria-hidden="true" />
              Lock
            </button>
          )}
          {/*
            A counter machine runs this app all day, and the marketing page
            above it is dead weight once the shop is open. Full screen gets the
            browser chrome out of the way too where the browser allows it.
          */}
          <button
            type="button"
            onClick={onToggleFullscreen}
            className="inline-flex items-center gap-1.5 rounded-lg border border-muted-line/40 bg-white px-3 py-1.5 text-sm font-semibold text-ink transition hover:border-indigo/40"
          >
            {fullscreen ? (
              <Minimize2 className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Maximize2 className="h-4 w-4" aria-hidden="true" />
            )}
            <span className="sr-only">{fullscreen ? "Exit full screen" : "Full screen"}</span>
          </button>
        </div>
      </div>

      <nav className="-mx-1 flex gap-1 overflow-x-auto pb-1" aria-label="Pharmacy sections">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setScreen(item.id)}
            aria-current={screen === item.id ? "page" : undefined}
            className={`inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition ${
              screen === item.id ? "bg-indigo text-white" : "bg-white text-muted hover:text-indigo"
            }`}
          >
            <item.icon className="h-4 w-4" aria-hidden="true" />
            {item.label}
          </button>
        ))}
      </nav>

      {screen === "sell" && <SellScreen />}
      {screen === "medicines" && <MedicinesScreen />}
      {screen === "purchases" && <PurchasesScreen />}
      {screen === "expiry" && <ExpiryScreen />}
      {screen === "returns" && <ReturnsScreen />}
      {screen === "customers" && <CustomersScreen />}
      {screen === "reports" && <ReportsScreen />}
      {screen === "settings" && <SettingsScreen />}
    </div>
  );
}

function PharmacyBody() {
  const { status, errorMessage } = usePharmacy();
  const [fullscreen, setFullscreen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  /**
   * Two things at once, deliberately.
   *
   * The in-page expansion is what actually matters — it fills the tab and drops
   * the marketing page below. The browser's own fullscreen is asked for on top
   * of that where it is allowed, and its failure is swallowed: iOS Safari does
   * not grant it to a div at all, and the counter should not get an error for
   * a nicety.
   */
  const toggleFullscreen = () => {
    setFullscreen((value) => {
      const next = !value;
      // requestFullscreen rejects rather than throws when the browser refuses
      // — iOS Safari never grants it to a div, and a permissions policy can
      // block it — so the rejection is caught as well as the throw. Without the
      // catch it surfaces as an unhandled rejection in the shop's console for a
      // feature that has already degraded gracefully.
      try {
        if (next && rootRef.current && !document.fullscreenElement) {
          void rootRef.current.requestFullscreen?.().catch(() => {});
        } else if (!next && document.fullscreenElement) {
          void document.exitFullscreen?.().catch(() => {});
        }
      } catch {
        // Browser fullscreen is a nicety; the in-page expansion still applies.
      }
      return next;
    });
  };

  // Escape and the browser's own exit control both leave fullscreen without
  // telling React, so the button would otherwise be stuck saying "Exit".
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setFullscreen(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  return (
    <div
      ref={rootRef}
      className={`rounded-3xl border border-muted-line/30 bg-cream-paper p-4 sm:p-6 ${
        fullscreen ? "fixed inset-0 z-[60] overflow-y-auto rounded-none" : ""
      }`}
    >
      {status === "loading" && (
        <p className="py-16 text-center text-sm text-muted">Opening your shop…</p>
      )}

      {status === "error" && (
        <div className="py-16 text-center">
          <p className="text-sm font-semibold text-red-600">{errorMessage}</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
            The pharmacy needs IndexedDB. Private browsing on some phones blocks it — try a
            normal window.
          </p>
          <button
            type="button"
            className={`${primaryBtnClass} mt-4`}
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
        </div>
      )}

      {status === "welcome" && <WelcomeScreen />}
      {status === "setup" && <SetupScreen />}
      {status === "ready" && (
        <PharmacyShell fullscreen={fullscreen} onToggleFullscreen={toggleFullscreen} />
      )}
    </div>
  );
}

export function PharmacyApp() {
  return (
    <PharmacyProvider>
      <PharmacyBody />
    </PharmacyProvider>
  );
}
