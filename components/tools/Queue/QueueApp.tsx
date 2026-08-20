"use client";

import { useEffect, useRef, useState } from "react";
import {
  BarChart3,
  ClipboardList,
  Lock,
  Maximize2,
  Minimize2,
  Monitor,
  PhoneCall,
  Settings,
  Ticket,
  WifiOff,
} from "lucide-react";
import { QueueProvider, useQueue } from "@/lib/queue/store";
import { LockScreen } from "@/components/tools/FreePos/LockScreen";
import { primaryBtnClass } from "@/components/tools/FreePos/ui";
import type { ScreenId } from "./nav";
import { WelcomeScreen } from "./WelcomeScreen";
import { SetupScreen } from "./SetupScreen";
import { CounterScreen } from "./CounterScreen";
import { IssueScreen } from "./IssueScreen";
import { HistoryScreen } from "./HistoryScreen";
import { ReportsScreen } from "./ReportsScreen";
import { SettingsScreen } from "./SettingsScreen";

const NAV_ITEMS: { id: ScreenId; label: string; icon: typeof Ticket }[] = [
  { id: "counter", label: "Counter", icon: PhoneCall },
  { id: "issue", label: "Issue", icon: Ticket },
  { id: "history", label: "History", icon: ClipboardList },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
];

function QueueShell({
  fullscreen,
  onToggleFullscreen,
}: {
  fullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  const { business, settings, todayTokens } = useQueue();
  const [screen, setScreen] = useState<ScreenId>("counter");
  const [offline, setOffline] = useState(false);

  const hasPin = Boolean(settings.pinHash && settings.pinSalt);
  const [locked, setLocked] = useState(false);
  const unlockedOnceRef = useRef(false);

  // Lock as soon as we learn a PIN exists — settings arrive asynchronously,
  // so the first render always has none.
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
        businessName={business?.name ?? "Queue"}
        pinHash={settings.pinHash ?? ""}
        pinSalt={settings.pinSalt ?? ""}
        onUnlock={() => {
          unlockedOnceRef.current = true;
          setLocked(false);
        }}
      />
    );
  }

  const waiting = todayTokens.filter((token) => token.status === "waiting").length;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-ink">{business?.name || "Queue"}</h2>
          {waiting > 0 && (
            <span className="rounded-full bg-indigo/10 px-2.5 py-0.5 text-xs font-bold text-indigo">
              {waiting} waiting
            </span>
          )}
          {offline && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted">
              <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
              Offline — the queue still works
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/products/free-queue-system/display"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-muted-line/40 bg-white px-3 py-1.5 text-sm font-semibold text-ink transition hover:border-indigo/40 hover:text-indigo"
          >
            <Monitor className="h-4 w-4" aria-hidden="true" />
            Display
          </a>
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

      <nav className="-mx-1 flex gap-1 overflow-x-auto pb-1" aria-label="Queue sections">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setScreen(item.id)}
            aria-current={screen === item.id ? "page" : undefined}
            className={`inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition ${
              screen === item.id
                ? "bg-indigo text-white"
                : "bg-white text-muted hover:text-indigo"
            }`}
          >
            <item.icon className="h-4 w-4" aria-hidden="true" />
            {item.label}
          </button>
        ))}
      </nav>

      {screen === "counter" && <CounterScreen />}
      {screen === "issue" && <IssueScreen />}
      {screen === "history" && <HistoryScreen />}
      {screen === "reports" && <ReportsScreen />}
      {screen === "settings" && <SettingsScreen />}
    </div>
  );
}

function QueueBody() {
  const { status, errorMessage } = useQueue();
  const [fullscreen, setFullscreen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = () => {
    setFullscreen((value) => {
      const next = !value;
      try {
        if (next && rootRef.current && !document.fullscreenElement) {
          void rootRef.current.requestFullscreen?.();
        } else if (!next && document.fullscreenElement) {
          void document.exitFullscreen?.();
        }
      } catch {
        // Browser fullscreen is a nicety; the in-page expansion still applies.
      }
      return next;
    });
  };

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
        <p className="py-16 text-center text-sm text-muted">Opening your queue…</p>
      )}

      {status === "error" && (
        <div className="py-16 text-center">
          <p className="text-sm font-semibold text-red-600">{errorMessage}</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
            The queue needs IndexedDB. Private browsing on some phones blocks it — try a normal
            window.
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
        <QueueShell fullscreen={fullscreen} onToggleFullscreen={toggleFullscreen} />
      )}
    </div>
  );
}

export function QueueApp() {
  return (
    <QueueProvider>
      <QueueBody />
    </QueueProvider>
  );
}
