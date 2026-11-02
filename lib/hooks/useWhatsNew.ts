"use client";

// Per-device memory for the in-app What's new markers (see lib/whatsNew.ts).
//
// Two lists in localStorage, nothing else: updates whose home-screen card was
// dismissed, and updates whose nav dot was cleared by visiting the screen.
// Whether a feature has actually been taken up (a tool switched on, the QR
// menu connected) is read from the app's own settings, so it is never stored
// twice and can never disagree with what the owner sees.
//
// A module-level store rather than component state, because the nav dot, the
// home card and the settings pills are separate components that must change
// together the moment one of them is acted on.

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { updatesFor, type AppUpdate, type WhatsNewApp } from "@/lib/whatsNew";

const KEY = "setu.whatsNew.v1";

type Memory = { dismissed: string[]; visited: string[] };

const EMPTY: Memory = { dismissed: [], visited: [] };

let cache: Memory | null = null;
const listeners = new Set<() => void>();

function read(): Memory {
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<Memory>) : {};
    cache = {
      dismissed: Array.isArray(parsed.dismissed) ? parsed.dismissed : [],
      visited: Array.isArray(parsed.visited) ? parsed.visited : [],
    };
  } catch {
    cache = EMPTY;
  }
  return cache;
}

function write(next: Memory) {
  cache = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Blocked or full storage: the markers still clear for this session.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== KEY) return;
    cache = null;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function add(list: "dismissed" | "visited", ids: string[]) {
  const current = read();
  const missing = ids.filter((id) => !current[list].includes(id));
  if (missing.length === 0) return;
  write({ ...current, [list]: [...current[list], ...missing] });
}

export type WhatsNew = {
  /** Updates still worth a home-screen card. */
  cards: AppUpdate[];
  /** Whether the nav tab for `screen` should carry a dot. */
  hasDot: (screen: string) => boolean;
  /** Updates still pending on `screen`, for a section's "n new" count. */
  pendingOn: (screen: string) => AppUpdate[];
  /** Whether a POS connected-tool slug should carry a "New" pill. */
  isNewFeature: (slug: string) => boolean;
  /** Whether `id` (an update id, or any hint id built from one) was dismissed. */
  isDismissed: (id: string) => boolean;
  dismiss: (id: string) => void;
  /** Clears the nav dot for every update living on `screen`. */
  visit: (screen: string) => void;
};

/**
 * @param businessCreatedAt when this business was set up on the device; only
 *   updates released after it are shown.
 * @param isTakenUp whether the owner already uses the update (or one feature
 *   of it), read from the app's own settings. A taken-up update shows nothing.
 */
export function useWhatsNew(
  app: WhatsNewApp,
  businessCreatedAt: string | undefined,
  isTakenUp: (update: AppUpdate, feature?: string) => boolean
): WhatsNew {
  const memory = useSyncExternalStore(subscribe, read, () => EMPTY);

  const pending = useMemo(
    () => updatesFor(app, businessCreatedAt).filter((update) => !isTakenUp(update)),
    [app, businessCreatedAt, isTakenUp]
  );

  const dismiss = useCallback((id: string) => add("dismissed", [id]), []);
  const visit = useCallback(
    (screen: string) =>
      add(
        "visited",
        pending.filter((update) => update.target.screen === screen).map((update) => update.id)
      ),
    [pending]
  );

  return useMemo<WhatsNew>(
    () => ({
      cards: pending.filter((update) => !memory.dismissed.includes(update.id)),
      hasDot: (screen) =>
        pending.some((update) => update.target.screen === screen && !memory.visited.includes(update.id)),
      pendingOn: (screen) => pending.filter((update) => update.target.screen === screen),
      isNewFeature: (slug) =>
        pending.some((update) => update.features?.includes(slug) && !isTakenUp(update, slug)),
      isDismissed: (id) => memory.dismissed.includes(id),
      dismiss,
      visit,
    }),
    [pending, memory, isTakenUp, dismiss, visit]
  );
}

/** Scrolls the feature into view once its screen has been shown. */
export function scrollToFeature(anchor: string) {
  window.setTimeout(() => {
    const element = document.getElementById(anchor);
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "start" });
    element.classList.add("ring-2", "ring-saffron", "ring-offset-2");
    window.setTimeout(() => element.classList.remove("ring-2", "ring-saffron", "ring-offset-2"), 2400);
  }, 60);
}
