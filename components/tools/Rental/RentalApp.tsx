"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Boxes,
  CalendarRange,
  ClipboardList,
  Lock,
  Settings,
  Sun,
  Users,
  WifiOff,
} from "lucide-react";
import { RentalProvider, useRental } from "@/lib/rental/store";
import { LockScreen } from "@/components/tools/FreePos/LockScreen";
import { primaryBtnClass } from "@/components/tools/FreePos/ui";
import { findConflicts } from "@/lib/rental/availability";
import type { ScreenId } from "./nav";
import { WelcomeScreen } from "./WelcomeScreen";
import { SetupScreen } from "./SetupScreen";
import { TodayScreen } from "./TodayScreen";
import { AvailabilityScreen } from "./AvailabilityScreen";
import { BookingsScreen } from "./BookingsScreen";
import { ItemsScreen } from "./ItemsScreen";
import { CustomersScreen } from "./CustomersScreen";
import { ReportsScreen } from "./ReportsScreen";
import { SettingsScreen } from "./SettingsScreen";

const NAV_ITEMS: { id: ScreenId; label: string; icon: typeof Sun }[] = [
  { id: "today", label: "Today", icon: Sun },
  { id: "availability", label: "Availability", icon: CalendarRange },
  { id: "bookings", label: "Bookings", icon: ClipboardList },
  { id: "items", label: "Items", icon: Boxes },
  { id: "customers", label: "Customers", icon: Users },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
];

function RentalShell() {
  const { bookings, business, items, maintenanceLogs, settings, today } = useRental();
  const [screen, setScreen] = useState<ScreenId>("today");
  const [focusBooking, setFocusBooking] = useState<string | null>(null);
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

  if (locked) {
    return (
      <LockScreen
        businessName={business?.name ?? "Hire book"}
        pinHash={settings.pinHash ?? ""}
        pinSalt={settings.pinSalt ?? ""}
        onUnlock={() => {
          unlockedOnceRef.current = true;
          setLocked(false);
        }}
      />
    );
  }

  const overdue = bookings.filter(
    (booking) => booking.status === "dispatched" && booking.toDate < today
  ).length;
  const conflicts = findConflicts(bookings, items, maintenanceLogs, settings.bufferDays, today);

  const openBooking = (id: string) => {
    setFocusBooking(id);
    setScreen("bookings");
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-bold text-ink">{business?.name || "Hire book"}</h2>
          {overdue > 0 && (
            <button
              type="button"
              onClick={() => setScreen("today")}
              className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-bold text-red-700"
            >
              {overdue} overdue
            </button>
          )}
          {conflicts.length > 0 && (
            <button
              type="button"
              onClick={() => setScreen("availability")}
              className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-800"
            >
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
              {conflicts.length} over-committed
            </button>
          )}
          {offline && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted">
              <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
              Offline — the book still works
            </span>
          )}
        </div>
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
      </div>

      <nav className="-mx-1 flex gap-1 overflow-x-auto pb-1" aria-label="Hire book sections">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setScreen(item.id);
              if (item.id !== "bookings") setFocusBooking(null);
            }}
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

      {screen === "today" && <TodayScreen onOpenBooking={openBooking} />}
      {screen === "availability" && <AvailabilityScreen onOpenBooking={openBooking} />}
      {screen === "bookings" && <BookingsScreen initialBookingId={focusBooking} />}
      {screen === "items" && <ItemsScreen />}
      {screen === "customers" && <CustomersScreen />}
      {screen === "reports" && <ReportsScreen />}
      {screen === "settings" && <SettingsScreen />}
    </div>
  );
}

function RentalBody() {
  const { status, errorMessage } = useRental();

  return (
    <div className="rounded-3xl border border-muted-line/30 bg-cream-paper p-4 sm:p-6">
      {status === "loading" && (
        <p className="py-16 text-center text-sm text-muted">Opening your hire book…</p>
      )}

      {status === "error" && (
        <div className="py-16 text-center">
          <p className="text-sm font-semibold text-red-600">{errorMessage}</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
            The hire book needs IndexedDB. Private browsing on some phones blocks it — try a
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
      {status === "ready" && <RentalShell />}
    </div>
  );
}

export function RentalApp() {
  return (
    <RentalProvider>
      <RentalBody />
    </RentalProvider>
  );
}
