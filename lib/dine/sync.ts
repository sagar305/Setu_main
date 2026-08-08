// Live cross-tab sync for Free Dine.
//
// IndexedDB is shared by every tab on the origin, but it does not tell a tab
// when another one writes. So the counter can fire a round and the kitchen tab,
// looking at the very same database, would sit there showing nothing until
// somebody reloaded it.
//
// This is the missing notification. After a write, a tab broadcasts which
// stores it touched; the others re-read exactly those and re-render. The data
// itself never travels — only the names of what changed — so there is no way
// for the two tabs to disagree about the contents, and the database stays the
// single source of truth.

import type { DineStoreName } from "./db";

const CHANNEL_NAME = "setu-free-dine";
/** Fallback key for browsers without BroadcastChannel; the value is a nonce. */
const STORAGE_KEY = "setu-free-dine-change";

export type DineChangeMessage = {
  /** Random per-tab id, so a tab ignores the echo of its own write. */
  sender: string;
  stores: DineStoreName[];
  at: number;
};

export type DineBroadcast = {
  post: (stores: DineStoreName[]) => void;
  subscribe: (handler: (stores: DineStoreName[]) => void) => () => void;
  close: () => void;
};

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** A no-op channel for server rendering and for browsers with neither transport. */
function inertBroadcast(): DineBroadcast {
  return { post: () => {}, subscribe: () => () => {}, close: () => {} };
}

export function createDineBroadcast(): DineBroadcast {
  if (typeof window === "undefined") return inertBroadcast();

  const sender = randomId();
  const handlers = new Set<(stores: DineStoreName[]) => void>();

  const deliver = (message: DineChangeMessage | null) => {
    if (!message || message.sender === sender) return;
    if (!Array.isArray(message.stores) || message.stores.length === 0) return;
    for (const handler of handlers) handler(message.stores);
  };

  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event) => deliver(event.data as DineChangeMessage);
    return {
      post: (stores) => {
        if (stores.length === 0) return;
        channel.postMessage({ sender, stores, at: Date.now() } satisfies DineChangeMessage);
      },
      subscribe: (handler) => {
        handlers.add(handler);
        return () => handlers.delete(handler);
      },
      close: () => {
        handlers.clear();
        channel.close();
      },
    };
  }

  // Fallback: a storage write fires a `storage` event in every *other* tab,
  // which is exactly the semantics we want. Older iOS Safari needs this.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      deliver(JSON.parse(event.newValue) as DineChangeMessage);
    } catch {
      // A malformed payload just means one missed refresh, not a broken tab.
    }
  };
  window.addEventListener("storage", onStorage);

  return {
    post: (stores) => {
      if (stores.length === 0) return;
      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ sender, stores, at: Date.now() } satisfies DineChangeMessage)
        );
      } catch {
        // Private mode can block localStorage; sync degrades, nothing breaks.
      }
    },
    subscribe: (handler) => {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    close: () => {
      handlers.clear();
      window.removeEventListener("storage", onStorage);
    },
  };
}

/** Whether this browser can sync tabs live at all, for the UI to say so. */
export function canSyncTabs(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof BroadcastChannel !== "undefined") return true;
  try {
    return typeof window.localStorage !== "undefined";
  } catch {
    return false;
  }
}
