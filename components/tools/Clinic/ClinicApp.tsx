"use client";

import { useEffect, useRef, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  LayoutDashboard,
  Lock,
  Maximize2,
  Minimize2,
  Settings,
  Stethoscope,
  Users,
  Wallet,
  WifiOff,
} from "lucide-react";
import { ClinicProvider, useClinic } from "@/lib/clinic/store";
import { FIRST_RUN_DISCLAIMER } from "@/lib/clinic/types";
import { previewStyleSheet } from "@/lib/clinic/print";
import { LockScreen } from "@/components/tools/FreePos/LockScreen";
import { primaryBtnClass } from "@/components/tools/FreePos/ui";
import type { NavigateFn, ScreenId } from "./nav";
import { WelcomeScreen } from "./WelcomeScreen";
import { SetupScreen } from "./SetupScreen";
import { TodayScreen } from "./TodayScreen";
import { PatientsScreen } from "./PatientsScreen";
import { AppointmentsScreen } from "./AppointmentsScreen";
import { ConsultScreen } from "./ConsultScreen";
import { BillingScreen } from "./BillingScreen";
import { ReportsScreen } from "./ReportsScreen";
import { SettingsScreen } from "./SettingsScreen";

const NAV_ITEMS: { id: ScreenId; label: string; icon: typeof Users }[] = [
  { id: "today", label: "Today", icon: LayoutDashboard },
  { id: "patients", label: "Patients", icon: Users },
  { id: "appointments", label: "Appointments", icon: CalendarDays },
  { id: "consult", label: "Consult", icon: Stethoscope },
  { id: "billing", label: "Billing", icon: Wallet },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
];

type QueryRequest = { screen: ScreenId; value: string; nonce: number };

/**
 * Shown once, before anyone types a patient's name in. It states what the app
 * does not do — it does not check doses, interactions or allergies — because
 * a prescription pad that looks clinical invites the assumption that it is
 * checking something.
 */
function DisclaimerGate({ onAccept }: { onAccept: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/60 p-0 sm:items-center sm:p-6">
      <div className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:max-w-lg sm:rounded-2xl">
        <div className="border-b border-muted-line/20 px-5 py-4">
          <h3 className="text-base font-bold text-ink">Before you start</h3>
        </div>
        <div className="overflow-y-auto px-5 py-4">
          <p className="text-sm leading-relaxed text-muted">{FIRST_RUN_DISCLAIMER}</p>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            You can edit the disclaimer that prints on your prescriptions in Settings →
            Prescription.
          </p>
          <button type="button" onClick={onAccept} className={`${primaryBtnClass} mt-5 w-full`}>
            I understand
          </button>
        </div>
      </div>
    </div>
  );
}

function ClinicShell({
  fullscreen,
  onToggleFullscreen,
}: {
  fullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  const { business, settings, acceptDisclaimer } = useClinic();
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
      {/* One stylesheet for every live prescription preview on the page, so
          what the doctor sees matches what the printer is handed. */}
      <style dangerouslySetInnerHTML={{ __html: previewStyleSheet() }} />

      <div className="flex flex-col gap-3 border-b border-muted-line/20 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-ink">{business?.name}</h2>
          {offline && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-saffron/15 px-2.5 py-1 text-xs font-semibold text-ink">
              <WifiOff className="h-3.5 w-3.5 text-saffron" />
              Offline — consultations still work
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

      {/* Screens stay mounted so a half-typed prescription survives a tab switch. */}
      <div className="mt-6">
        <div className={screen === "today" ? "" : "hidden"}>
          <TodayScreen onNavigate={navigate} />
        </div>
        <div className={screen === "patients" ? "" : "hidden"}>
          <PatientsScreen onNavigate={navigate} externalQuery={queryFor("patients")} />
        </div>
        <div className={screen === "appointments" ? "" : "hidden"}>
          <AppointmentsScreen onNavigate={navigate} />
        </div>
        <div className={screen === "consult" ? "" : "hidden"}>
          <ConsultScreen onNavigate={navigate} visitRequest={queryFor("consult")} />
        </div>
        <div className={screen === "billing" ? "" : "hidden"}>
          <BillingScreen onNavigate={navigate} externalQuery={queryFor("billing")} />
        </div>
        <div className={screen === "reports" ? "" : "hidden"}>
          <ReportsScreen onNavigate={navigate} />
        </div>
        <div className={screen === "settings" ? "" : "hidden"}>
          <SettingsScreen onLockNow={lockNow} />
        </div>
      </div>

      {!settings.disclaimerAcceptedAt && <DisclaimerGate onAccept={acceptDisclaimer} />}

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

function ClinicRouter({
  fullscreen,
  onToggleFullscreen,
}: {
  fullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  const { status, errorMessage } = useClinic();

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm text-muted">Opening your clinic…</p>
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
  return <ClinicShell fullscreen={fullscreen} onToggleFullscreen={onToggleFullscreen} />;
}

export function ClinicApp() {
  const [fullscreen, setFullscreen] = useState(false);

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
    <ClinicProvider>
      <div
        className={
          fullscreen
            ? "pos-fullscreen fixed inset-0 z-[60] overflow-y-auto bg-cream-paper p-4 sm:p-6"
            : "rounded-3xl border border-muted-line/30 bg-cream-paper p-4 shadow-sm sm:p-6"
        }
      >
        <ClinicRouter fullscreen={fullscreen} onToggleFullscreen={toggleFullscreen} />
      </div>
    </ClinicProvider>
  );
}
