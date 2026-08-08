"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChefHat, Lock, Maximize2, Minimize2, Unlock } from "lucide-react";
import { DineProvider, useDine } from "@/lib/dine/store";
import { KitchenScreen } from "./KitchenScreen";
import { KitchenUnlockDialog } from "./KitchenUnlockDialog";
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
function KitchenBody() {
  const { status, errorMessage, settings, updateSettings } = useDine();
  const [expanded, setExpanded] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);

  const locked = settings.kitchenLocked;
  const hasPin = Boolean(settings.pinHash);

  /**
   * Kiosk mode.
   *
   * A web page cannot actually trap someone in a tab, and pretending otherwise
   * would be worse than useless — so this does the three things a browser does
   * allow, and the Settings copy is honest about the rest:
   *   - every way out of the screen is removed from the UI
   *   - the back gesture is swallowed by re-pushing the history entry
   *   - closing or reloading raises the browser's own "leave site?" prompt
   * Anyone determined can still reach the address bar. For a locked-down
   * tablet, the operating system's kiosk mode is the real answer, and the
   * counter says so.
   */
  useEffect(() => {
    if (!locked) return;
    window.history.pushState(null, "", window.location.href);
    const onPopState = () => window.history.pushState(null, "", window.location.href);
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("popstate", onPopState);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [locked]);

  // Locking always fills the screen; a half-window kiosk is not a kiosk.
  useEffect(() => {
    if (locked) setExpanded(true);
  }, [locked]);

  const requestBrowserFullscreen = useCallback((on: boolean) => {
    try {
      if (on) {
        void document.documentElement.requestFullscreen?.()?.catch?.(() => {});
      } else if (document.fullscreenElement) {
        void document.exitFullscreen?.()?.catch?.(() => {});
      }
    } catch {
      // Full screen is best-effort; the overlay below works without it.
    }
  }, []);

  const toggleExpanded = () => {
    const next = !expanded;
    setExpanded(next);
    requestBrowserFullscreen(next);
  };

  // Leaving browser full screen (Esc) drops the overlay too — unless the
  // counter has locked the screen, in which case the overlay stays put.
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement && !locked) setExpanded(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [locked]);

  useEffect(() => {
    if (!expanded) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [expanded]);

  let content: React.ReactNode;
  if (status === "loading") {
    content = (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-muted">Opening the kitchen screen…</p>
      </div>
    );
  } else if (status === "error") {
    content = (
      <div className="mx-auto max-w-md py-20 text-center">
        <h1 className="text-lg font-bold text-ink">Couldn&apos;t open local storage</h1>
        <p className="mt-2 text-sm text-muted">
          {errorMessage ||
            "The kitchen screen reads the same browser storage as the counter. Private windows block it."}
        </p>
      </div>
    );
  } else if (status === "welcome" || status === "setup") {
    // A kitchen screen with no restaurant set up is a dead end, so point back
    // to the counter rather than offering to set one up from the pass.
    content = (
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
  } else {
    content = <KitchenScreen />;
  }

  return (
    <div
      className={
        expanded
          ? "fixed inset-0 z-[80] overflow-y-auto bg-cream-paper p-4 sm:p-6"
          : "min-h-screen bg-cream-paper p-4 sm:p-6"
      }
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          {locked ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-indigo/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-indigo">
              <Lock className="h-3.5 w-3.5" />
              Screen locked
            </span>
          ) : (
            <Link
              href="/products/free-restaurant-pos"
              className="inline-flex items-center gap-2 text-sm font-semibold text-muted transition hover:text-indigo"
            >
              <ArrowLeft className="h-4 w-4" />
              Counter
            </Link>
          )}

          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-muted sm:inline">Free Dine — kitchen screen</span>

            {locked ? (
              <button
                type="button"
                onClick={() => setUnlockOpen(true)}
                className="inline-flex h-9 items-center gap-2 rounded-full border border-muted-line/40 bg-white px-3 text-xs font-semibold text-muted transition hover:border-indigo/40 hover:text-indigo"
              >
                <Unlock className="h-4 w-4" />
                Unlock
              </button>
            ) : (
              <>
                {hasPin && status === "ready" && (
                  <button
                    type="button"
                    onClick={() => void updateSettings({ kitchenLocked: true })}
                    title="Lock this screen so nobody can leave it without the PIN"
                    className="inline-flex h-9 items-center gap-2 rounded-full border border-muted-line/40 bg-white px-3 text-xs font-semibold text-muted transition hover:border-indigo/40 hover:text-indigo"
                  >
                    <Lock className="h-4 w-4" />
                    Lock screen
                  </button>
                )}
                <button
                  type="button"
                  onClick={toggleExpanded}
                  aria-label={expanded ? "Exit full screen" : "Enter full screen"}
                  title={expanded ? "Exit full screen" : "Full screen"}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-muted-line/40 bg-white text-muted transition hover:border-indigo/40 hover:text-indigo"
                >
                  {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </button>
              </>
            )}
          </div>
        </div>

        {content}
      </div>

      <KitchenUnlockDialog
        open={unlockOpen}
        onClose={() => setUnlockOpen(false)}
        onUnlocked={() => {
          setUnlockOpen(false);
          void updateSettings({ kitchenLocked: false });
        }}
        pinHash={settings.pinHash}
        pinSalt={settings.pinSalt}
      />
    </div>
  );
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
      <KitchenBody />
    </DineProvider>
  );
}
