// Setu Business Toolkit — Offline Storage Standards (Chapter 9)
// ---------------------------------------------------------------------------
// Two-tier storage model. Get this right and everything else follows:
//
//   1. SHARED WORKSPACE DATA (business, products, customers, orders, …) lives
//      in IndexedDB, reached only through lib/workspace. It is canonical,
//      cross-tool, and backed up as one unit. Never duplicate it into a tool.
//
//   2. TOOL-LOCAL UI DRAFTS (an unsaved form, a "last used template" toggle)
//      may use localStorage — but with a namespaced key, never a random one.
//      These are throwaway; they are NOT part of the workspace or the backup.
//
// Hard rule: the whole ecosystem is single-origin. IndexedDB and localStorage
// are origin-scoped, so every tool MUST be served from the same origin
// (setutechnology.com/...). A tool on a subdomain silently loses the shared
// workspace. This is architectural, not a preference.

export const STORAGE_RULES = {
  singleOrigin: true,
  sharedDataStore: "indexeddb", // via lib/workspace / lib/pos/db (POS_DATABASE)
  toolLocalStore: "localstorage",
} as const;

const KEY_PREFIX = "setu";

/**
 * Build a namespaced localStorage key for a tool's LOCAL, throwaway state so we
 * never collide across tools or leak random keys (the problem this whole spec
 * exists to prevent). e.g. localKey("invoice-generator", "draft")
 *   -> "setu:invoice-generator:draft"
 *
 * Do NOT use this for shared entities — those belong in the workspace.
 */
export function localKey(tool: string, key: string): string {
  return `${KEY_PREFIX}:${tool}:${key}`;
}

/** Read a tool-local JSON value; returns fallback if missing or unparseable. */
export function readLocal<T>(tool: string, key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(localKey(tool, key));
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Write a tool-local JSON value. Silently no-ops when storage is unavailable. */
export function writeLocal<T>(tool: string, key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(localKey(tool, key), JSON.stringify(value));
  } catch {
    // Quota exceeded or storage disabled — tool-local drafts are best-effort.
  }
}
