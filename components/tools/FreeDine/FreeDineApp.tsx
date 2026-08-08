"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BarChart3,
  LayoutGrid,
  Lock,
  Maximize2,
  Minimize2,
  Receipt,
  Settings,
  UtensilsCrossed,
  Grid3x3,
  ChefHat,
} from "lucide-react";
import { DineProvider, useDine } from "@/lib/dine/store";
import { LockScreen } from "@/components/tools/FreePos/LockScreen";
import type { NavigateFn, ScreenId } from "./nav";
import { WelcomeScreen } from "./WelcomeScreen";
import { SetupScreen } from "./SetupScreen";
import { FloorScreen } from "./FloorScreen";
import { TicketScreen } from "./TicketScreen";
import { MenuScreen } from "./MenuScreen";
import { TablesScreen } from "./TablesScreen";
import { BillsScreen } from "./BillsScreen";
import { ReportsScreen } from "./ReportsScreen";
import { SettingsScreen } from "./SettingsScreen";
import { previewStyleSheet } from "./printing";

const NAV_ITEMS: { id: ScreenId; label: string; icon: typeof Receipt }[] = [
  { id: "floor", label: "Floor", icon: LayoutGrid },
  { id: "menu", label: "Menu", icon: UtensilsCrossed },
  { id: "tables", label: "Tables", icon: Grid3x3 },
  { id: "bills", label: "Bills", icon: Receipt },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
];

function DineShell({
  fullscreen,
  onToggleFullscreen,
}: {
  fullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  const { business, settings, openTickets } = useDine();
  const [screen, setScreen] = useState<ScreenId>("floor");
  const [query, setQuery] = useState<{ screen: ScreenId; value: string } | null>(null);
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);

  const hasPin = Boolean(settings.pinHash);
  const [locked, setLocked] = useState(hasPin);
  const unlockedOnceRef = useRef(false);

  const navigate = useCallback<NavigateFn>((next, value) => {
    setOpenTicketId(null);
    setScreen(next);
    setQuery(value ? { screen: next, value } : null);
  }, []);

  const lockNow = useCallback(() => setLocked(true), []);

  // Lock on first load when a PIN is set, and again after the idle timeout.
  useEffect(() => {
    if (hasPin && !unlockedOnceRef.current) setLocked(true);
  }, [hasPin]);

  useEffect(() => {
    const minutes = settings.autoLockMinutes ?? 0;
    if (!hasPin || minutes <= 0 || locked) return;
    let timer = window.setTimeout(() => setLocked(true), minutes * 60000);
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setLocked(true), minutes * 60000);
    };
    const events = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
    for (const event of events) window.addEventListener(event, reset, { passive: true });
    return () => {
      window.clearTimeout(timer);
      for (const event of events) window.removeEventListener(event, reset);
    };
  }, [hasPin, locked, settings.autoLockMinutes]);

  const runningCount = openTickets.length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo text-white">
            <UtensilsCrossed className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-bold text-ink">{business?.name ?? "Free Dine"}</p>
            <p className="text-xs text-muted">
              {runningCount === 0
                ? "Nothing running"
                : `${runningCount} ticket${runningCount === 1 ? "" : "s"} open`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Opens in a second tab so the pass can keep it up while the
              counter carries on here. Both tabs read the same database and
              tell each other what changed. */}
          <a
            href="/products/free-restaurant-pos/kitchen"
            target="_blank"
            rel="noopener noreferrer"
            title="Open the kitchen screen in a new tab"
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-muted-line/40 bg-white px-3 text-xs font-semibold text-muted transition hover:border-indigo/40 hover:text-indigo"
          >
            <ChefHat className="h-4 w-4" />
            <span className="hidden sm:inline">Kitchen screen</span>
          </a>
          {hasPin && (
            <button
              type="button"
              onClick={lockNow}
              aria-label="Lock the counter"
              title="Lock the counter"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-muted-line/40 bg-white text-muted transition hover:border-indigo/40 hover:text-indigo"
            >
              <Lock className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onToggleFullscreen}
            aria-label={fullscreen ? "Exit full screen" : "Enter full screen"}
            title={fullscreen ? "Exit full screen" : "Full screen"}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-muted-line/40 bg-white text-muted transition hover:border-indigo/40 hover:text-indigo"
          >
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {openTicketId === null && (
        <nav className="-mx-1 mt-4 flex gap-1 overflow-x-auto pb-1" aria-label="Sections">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => navigate(item.id)}
              aria-current={screen === item.id ? "page" : undefined}
              className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                screen === item.id
                  ? "bg-indigo text-white"
                  : "text-muted hover:bg-white hover:text-indigo"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </nav>
      )}

      <div className="mt-6">
        {openTicketId !== null ? (
          <TicketScreen ticketId={openTicketId} onBack={() => setOpenTicketId(null)} />
        ) : (
          <>
            <div className={screen === "floor" ? "" : "hidden"}>
              <FloorScreen onOpenTicket={setOpenTicketId} onNavigate={navigate} />
            </div>
            <div className={screen === "menu" ? "" : "hidden"}>
              <MenuScreen externalQuery={query?.screen === "menu" ? query.value : undefined} />
            </div>
            <div className={screen === "tables" ? "" : "hidden"}>
              <TablesScreen />
            </div>
            <div className={screen === "bills" ? "" : "hidden"}>
              <BillsScreen externalQuery={query?.screen === "bills" ? query.value : undefined} />
            </div>
            <div className={screen === "reports" ? "" : "hidden"}>
              <ReportsScreen />
            </div>
            <div className={screen === "settings" ? "" : "hidden"}>
              <SettingsScreen onLockNow={lockNow} />
            </div>
          </>
        )}
      </div>

      {locked && (
        <LockScreen
          businessName={business?.name ?? ""}
          pinHash={settings.pinHash}
          pinSalt={settings.pinSalt}
          onUnlock={() => {
            unlockedOnceRef.current = true;
            setLocked(false);
          }}
        />
      )}
    </div>
  );
}

function DineRouter({
  fullscreen,
  onToggleFullscreen,
}: {
  fullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  const { status, errorMessage } = useDine();

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm text-muted">Opening your restaurant…</p>
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h2 className="text-lg font-bold text-ink">Couldn&apos;t open local storage</h2>
        <p className="mt-2 text-sm text-muted">
          {errorMessage ||
            "Free Dine stores everything in your browser (IndexedDB). Private windows and some very old browsers block it."}
        </p>
      </div>
    );
  }
  if (status === "welcome") return <WelcomeScreen />;
  if (status === "setup") return <SetupScreen />;
  return <DineShell fullscreen={fullscreen} onToggleFullscreen={onToggleFullscreen} />;
}

export function FreeDineApp() {
  const [fullscreen, setFullscreen] = useState(false);

  // Cache the page so the restaurant keeps billing through an outage.
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/dine-sw.js").catch(() => {
      // Offline caching is best-effort; the app still works without it.
    });
  }, []);

  const toggleFullscreen = () => {
    const next = !fullscreen;
    setFullscreen(next);
    try {
      if (next) {
        document.documentElement.requestFullscreen?.()?.catch?.(() => {});
      } else if (document.fullscreenElement) {
        document.exitFullscreen?.()?.catch?.(() => {});
      }
    } catch {
      // Full screen is best-effort.
    }
  };

  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setFullscreen(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    if (!fullscreen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [fullscreen]);

  return (
    <DineProvider>
      {/* One copy of the receipt rules for every on-screen preview, so what
          the kitchen reads on the screen matches what the printer produces. */}
      <style dangerouslySetInnerHTML={{ __html: previewStyleSheet() }} />
      <div
        className={
          fullscreen
            ? "fixed inset-0 z-[60] overflow-y-auto bg-cream-paper p-4 sm:p-6"
            : "rounded-3xl border border-muted-line/30 bg-cream-paper p-4 shadow-sm sm:p-6"
        }
      >
        <DineRouter fullscreen={fullscreen} onToggleFullscreen={toggleFullscreen} />
      </div>
    </DineProvider>
  );
}
