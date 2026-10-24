"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Check, Download, MoreVertical, Share, SquarePlus, X } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import type { PwaApp } from "@/lib/pwa/apps";

/** What the bar needs; passed from the server so the app list stays server-side. */
export type InstallableApp = Pick<PwaApp, "id" | "name" | "shortName" | "path">;

// Chrome/Edge/Samsung Internet fire this when the page can be installed.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
  interface Window {
    /** Captured by the inline script in PwaAppLayout before React hydrates. */
    __setuInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

/** Workers from before app-sw.js. They sat at the site root and replaced each other. */
const LEGACY_WORKERS = ["/pos-sw.js", "/dine-sw.js", "/tuition-sw.js"];
const LEGACY_CACHES = ["setu-free-pos-v2", "setu-free-dine-v1", "setu-tuition-v1"];

async function registerAppWorker(scope: string) {
  if (!("serviceWorker" in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  for (const registration of registrations) {
    const worker = registration.active ?? registration.waiting ?? registration.installing;
    const script = worker?.scriptURL ?? "";
    if (LEGACY_WORKERS.some((path) => script.endsWith(path))) await registration.unregister();
  }
  if ("caches" in window) {
    await Promise.all(LEGACY_CACHES.map((name) => caches.delete(name)));
  }
  await navigator.serviceWorker.register("/app-sw.js", { scope });
}

type Platform = "ios" | "android" | "mac-safari" | "firefox-desktop" | "desktop";

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac; touch support gives it away.
  const isIos = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (isIos) return "ios";
  if (/Android/.test(ua)) return "android";
  if (/Firefox\//.test(ua)) return "firefox-desktop";
  if (/Safari\//.test(ua) && !/Chrome\/|Chromium\/|Edg\//.test(ua)) return "mac-safari";
  return "desktop";
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

const DISMISS_KEY = "setu-install-bar-dismissed";
/** Set inside the installed app the first time it opens (iOS install signal). */
const FIRST_OPEN_KEY = "setu-pwa-first-open";

// Analytics (PostHog, via lib/analytics): each event carries the visitor id as
// distinct_id, so "how many people installed X" is a unique-users count of
// pwa_installed filtered on app_id.
function trackPwa(
  name: "pwa_install_clicked" | "pwa_install_prompt_result" | "pwa_installed",
  app: InstallableApp,
  platform: Platform,
  extra: Record<string, string | boolean> = {}
) {
  trackEvent(name, { app_id: app.id, app_name: app.name, platform, ...extra });
}

export function InstallAppBar({ app }: { app: InstallableApp }) {
  const appId = app.id;
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [compact, setCompact] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    const detected = detectPlatform();
    const runningInstalled = isStandalone();
    setPlatform(detected);
    setStandalone(runningInstalled);
    setPromptEvent(window.__setuInstallPrompt ?? null);
    try {
      setCompact(window.localStorage.getItem(`${DISMISS_KEY}:${appId}`) === "1");
    } catch {
      // Storage blocked: just show the full bar.
    }
    setReady(true);

    // Safari never fires appinstalled, so on iOS an install is counted the
    // first time the app opens from its home-screen icon. The installed app
    // has its own storage, so this flag is per installation.
    if (runningInstalled && detected === "ios") {
      try {
        const key = `${FIRST_OPEN_KEY}:${appId}`;
        if (!window.localStorage.getItem(key)) {
          window.localStorage.setItem(key, "1");
          trackPwa("pwa_installed", app, detected, { method: "ios_first_open" });
        }
      } catch {
        // Storage blocked: skip rather than count every launch.
      }
    }

    const onPrompt = (event: Event) => {
      event.preventDefault();
      window.__setuInstallPrompt = event as BeforeInstallPromptEvent;
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      // Chromium fires this for our button and the browser's own menu alike.
      trackPwa("pwa_installed", app, detected, { method: "browser" });
      window.__setuInstallPrompt = null;
      setPromptEvent(null);
      setInstalled(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    if (process.env.NODE_ENV === "production") {
      registerAppWorker(app.path).catch(() => {
        // Offline caching is best-effort; the app still works without it.
      });
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  // app is a fresh object per render of the server layout but never changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.path, appId]);

  // Already running as the installed app: nothing to offer. Sub-screens (the
  // kitchen display, a customer's token view) keep the worker but not the bar.
  if (!ready || standalone || pathname.replace(/\/$/, "") !== app.path) return null;

  const install = async () => {
    trackPwa("pwa_install_clicked", app, platform, { prompt_available: Boolean(promptEvent) });
    if (!promptEvent) {
      setHelpOpen(true);
      return;
    }
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    trackPwa("pwa_install_prompt_result", app, platform, { outcome });
    // A prompt can only be used once.
    window.__setuInstallPrompt = null;
    setPromptEvent(null);
    if (outcome === "accepted") setInstalled(true);
  };

  const dismiss = () => {
    setCompact(true);
    try {
      window.localStorage.setItem(`${DISMISS_KEY}:${appId}`, "1");
    } catch {
      // Not remembered across visits; fine.
    }
  };

  const isMobile = platform === "ios" || platform === "android";
  const button = (
    <button
      type="button"
      onClick={() => void install()}
      disabled={installed}
      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-indigo px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink disabled:cursor-default disabled:bg-emerald-700"
    >
      {installed ? <Check className="h-4 w-4" /> : <Download className="h-4 w-4" />}
      {installed ? "Installed" : isMobile ? "Add to Home Screen" : "Install app"}
    </button>
  );

  return (
    <>
      <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6">
        {compact ? (
          <div className="flex justify-end">{button}</div>
        ) : (
          <div className="flex flex-col gap-3 rounded-2xl border border-indigo/15 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- tiny local icon */}
              <img
                src={`/pwa/${app.id}-192.png`}
                alt=""
                width={44}
                height={44}
                className="h-11 w-11 shrink-0 rounded-xl"
              />
              <div className="min-w-0">
                <p className="text-sm font-bold text-ink">
                  {installed ? `${app.shortName} is installed` : `Get ${app.shortName} on your ${isMobile ? "home screen" : "computer"}`}
                </p>
                <p className="text-xs text-muted">
                  {installed
                    ? "Open it from your app icons. Your data stays on this device."
                    : "One tap to open, full screen, works offline. Free, no download from a store."}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {button}
              <button
                type="button"
                onClick={dismiss}
                aria-label="Hide install banner"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-cream hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {helpOpen && (
        <InstallHelp appName={app.shortName} platform={platform} onClose={() => setHelpOpen(false)} />
      )}
    </>
  );
}

function InstallHelp({
  appName,
  platform,
  onClose,
}: {
  appName: string;
  platform: Platform;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const steps: { icon?: ReactNode; text: ReactNode }[] =
    platform === "ios"
      ? [
          { icon: <Share className="h-4 w-4" />, text: <>Tap the <strong>Share</strong> button in Safari&apos;s toolbar.</> },
          { icon: <SquarePlus className="h-4 w-4" />, text: <>Scroll down and tap <strong>Add to Home Screen</strong>.</> },
          { text: <>Tap <strong>Add</strong>. The {appName} icon appears on your home screen.</> },
        ]
      : platform === "android"
        ? [
            { icon: <MoreVertical className="h-4 w-4" />, text: <>Open the browser menu <strong>(⋮)</strong>.</> },
            { icon: <SquarePlus className="h-4 w-4" />, text: <>Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.</> },
            { text: <>Confirm. The {appName} icon appears on your home screen.</> },
          ]
        : platform === "mac-safari"
          ? [
              { icon: <Share className="h-4 w-4" />, text: <>In Safari, open the <strong>File</strong> menu (or the Share button).</> },
              { icon: <SquarePlus className="h-4 w-4" />, text: <>Choose <strong>Add to Dock</strong>.</> },
              { text: <>{appName} opens from your Dock and Launchpad like any app.</> },
            ]
          : platform === "firefox-desktop"
            ? [
                { text: <>Firefox on computers can&apos;t install apps yet.</> },
                { text: <>Open this page in <strong>Chrome</strong> or <strong>Edge</strong> and click <strong>Install app</strong>.</> },
                { text: <>Or bookmark this page (Ctrl/Cmd + D). Your data is saved either way.</> },
              ]
            : [
                { icon: <Download className="h-4 w-4" />, text: <>Click the <strong>install icon</strong> at the right end of the address bar.</> },
                { icon: <MoreVertical className="h-4 w-4" />, text: <>Or open the browser menu <strong>(⋮)</strong> → <strong>Cast, save and share</strong> → <strong>Install page as app</strong>.</> },
                { text: <>{appName} gets its own window and desktop shortcut. Already installed? Look in your apps.</> },
              ];

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/50 sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Install ${appName}`}
    >
      <div className="w-full rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-md sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-ink">Install {appName}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition hover:bg-cream hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <ol className="mt-4 space-y-3">
          {steps.map((step, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-ink">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo/10 text-xs font-bold text-indigo">
                {i + 1}
              </span>
              <span className="pt-0.5">
                {step.text}
                {step.icon ? <span className="ml-1.5 inline-flex align-middle text-indigo">{step.icon}</span> : null}
              </span>
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-lg bg-indigo px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-ink"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
