"use client";

import { useEffect, useRef, useState } from "react";
import {
  BarChart3,
  CalendarCheck,
  ClipboardList,
  LayoutDashboard,
  Lock,
  Maximize2,
  Minimize2,
  NotebookPen,
  Settings,
  UserPlus,
  Users,
  Wallet,
  WifiOff,
} from "lucide-react";
import { TuitionProvider, useTuition } from "@/lib/tuition/store";
import { LockScreen } from "@/components/tools/FreePos/LockScreen";
import type { NavigateFn, ScreenId } from "./nav";
import { WelcomeScreen } from "./WelcomeScreen";
import { SetupScreen } from "./SetupScreen";
import { TodayScreen } from "./TodayScreen";
import { StudentsScreen } from "./StudentsScreen";
import { AttendanceScreen } from "./AttendanceScreen";
import { FeesScreen } from "./FeesScreen";
import { TestsScreen } from "./TestsScreen";
import { DiaryScreen } from "./DiaryScreen";
import { EnquiriesScreen } from "./EnquiriesScreen";
import { ReportsScreen } from "./ReportsScreen";
import { SettingsScreen } from "./SettingsScreen";

const NAV_ITEMS: { id: ScreenId; label: string; icon: typeof Users }[] = [
  { id: "today", label: "Today", icon: LayoutDashboard },
  { id: "attendance", label: "Attendance", icon: CalendarCheck },
  { id: "students", label: "Students", icon: Users },
  { id: "fees", label: "Fees", icon: Wallet },
  { id: "tests", label: "Tests", icon: ClipboardList },
  { id: "diary", label: "Diary", icon: NotebookPen },
  { id: "enquiries", label: "Enquiries", icon: UserPlus },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
];

type QueryRequest = { screen: ScreenId; value: string; nonce: number };

function TuitionShell({
  fullscreen,
  onToggleFullscreen,
}: {
  fullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  const { business, settings } = useTuition();
  const [screen, setScreen] = useState<ScreenId>("today");
  const [queryRequest, setQueryRequest] = useState<QueryRequest | null>(null);
  const [offline, setOffline] = useState(false);

  const hasPin = Boolean(settings.pinHash && settings.pinSalt);
  const [locked, setLocked] = useState(false);
  const unlockedOnceRef = useRef(false);

  // Lock as soon as we learn a PIN exists (settings arrive async on load).
  useEffect(() => {
    if (hasPin && !unlockedOnceRef.current) setLocked(true);
    if (!hasPin) setLocked(false);
  }, [hasPin]);

  const lockNow = () => {
    if (hasPin) setLocked(true);
  };

  // Idle auto-lock. Any real interaction resets the timer.
  const autoLockMinutes = settings.autoLockMinutes ?? 0;
  useEffect(() => {
    if (!hasPin || locked || autoLockMinutes <= 0) return;
    let timer = window.setTimeout(() => setLocked(true), autoLockMinutes * 60_000);
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setLocked(true), autoLockMinutes * 60_000);
    };
    const events: (keyof DocumentEventMap)[] = ["pointerdown", "keydown", "wheel", "touchstart"];
    events.forEach((e) => document.addEventListener(e, reset, { passive: true }));
    return () => {
      window.clearTimeout(timer);
      events.forEach((e) => document.removeEventListener(e, reset));
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

  const navigate: NavigateFn = (target, query) => {
    setScreen(target);
    if (query !== undefined) {
      setQueryRequest((prev) => ({ screen: target, value: query, nonce: (prev?.nonce ?? 0) + 1 }));
    }
  };

  const queryFor = (target: ScreenId) =>
    queryRequest && queryRequest.screen === target ? queryRequest : null;

  return (
    <div>
      <div className="flex flex-col gap-3 border-b border-muted-line/20 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-ink">{business?.name}</h2>
          {offline && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-saffron/15 px-2.5 py-1 text-xs font-semibold text-ink">
              <WifiOff className="h-3.5 w-3.5 text-saffron" />
              Offline — attendance still works
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasPin && (
            <button
              type="button"
              onClick={lockNow}
              aria-label="Lock the app"
              title="Lock the app"
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

      <nav className="-mx-1 mt-4 flex gap-1 overflow-x-auto pb-1" aria-label="Sections">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => navigate(item.id)}
            aria-current={screen === item.id ? "page" : undefined}
            className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
              screen === item.id ? "bg-indigo text-white" : "text-muted hover:bg-white hover:text-indigo"
            }`}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </button>
        ))}
      </nav>

      {/* Screens stay mounted so half-marked attendance survives a tab switch. */}
      <div className="mt-6">
        <div className={screen === "today" ? "" : "hidden"}>
          <TodayScreen onNavigate={navigate} />
        </div>
        <div className={screen === "attendance" ? "" : "hidden"}>
          <AttendanceScreen batchRequest={queryFor("attendance")} />
        </div>
        <div className={screen === "students" ? "" : "hidden"}>
          <StudentsScreen externalQuery={queryFor("students")} />
        </div>
        <div className={screen === "fees" ? "" : "hidden"}>
          <FeesScreen />
        </div>
        <div className={screen === "tests" ? "" : "hidden"}>
          <TestsScreen />
        </div>
        <div className={screen === "diary" ? "" : "hidden"}>
          <DiaryScreen />
        </div>
        <div className={screen === "enquiries" ? "" : "hidden"}>
          <EnquiriesScreen />
        </div>
        <div className={screen === "reports" ? "" : "hidden"}>
          <ReportsScreen />
        </div>
        <div className={screen === "settings" ? "" : "hidden"}>
          <SettingsScreen onLockNow={lockNow} />
        </div>
      </div>

      {locked && (
        <LockScreen
          businessName={business?.name ?? ""}
          pinHash={settings.pinHash ?? ""}
          pinSalt={settings.pinSalt ?? ""}
          onUnlock={() => {
            unlockedOnceRef.current = true;
            setLocked(false);
          }}
        />
      )}
    </div>
  );
}

function TuitionRouter({
  fullscreen,
  onToggleFullscreen,
}: {
  fullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  const { status, errorMessage } = useTuition();

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm text-muted">Opening your class…</p>
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h2 className="text-lg font-bold text-ink">Couldn&apos;t open local storage</h2>
        <p className="mt-2 text-sm text-muted">
          {errorMessage ||
            "This app stores data in your browser (IndexedDB). Private/incognito windows and some very old browsers block it."}
        </p>
      </div>
    );
  }
  if (status === "welcome") return <WelcomeScreen />;
  if (status === "setup") return <SetupScreen />;
  return <TuitionShell fullscreen={fullscreen} onToggleFullscreen={onToggleFullscreen} />;
}

export function TuitionApp() {
  const [fullscreen, setFullscreen] = useState(false);

  // Cache the page for offline use once the browser is idle.
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/tuition-sw.js").catch(() => {
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
    <TuitionProvider>
      <div
        className={
          fullscreen
            ? "pos-fullscreen fixed inset-0 z-[60] overflow-y-auto bg-cream-paper p-4 sm:p-6"
            : "rounded-3xl border border-muted-line/30 bg-cream-paper p-4 shadow-sm sm:p-6"
        }
      >
        <TuitionRouter fullscreen={fullscreen} onToggleFullscreen={toggleFullscreen} />
      </div>
    </TuitionProvider>
  );
}
