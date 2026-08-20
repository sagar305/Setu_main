// Live cross-tab sync for the queue.
//
// The counter and the display are two tabs over one database, and IndexedDB
// does not tell a tab when another one writes. So the counter calls a token
// and the waiting-room TV, looking at the very same rows, would sit there
// showing the last one until somebody reloaded it.
//
// Three mechanisms, deliberately overlapping, because the display is the one
// screen in the building nobody is watching for faults:
//
//   1. BroadcastChannel — instant, and what actually fires in normal use.
//   2. A `storage` write — the fallback for browsers without it, which is
//      most smart TV browsers and older iOS Safari.
//   3. A 2s poll floor and a 10s unconditional re-read — the guarantee. Even
//      with both channels dead the display is never more than a few seconds
//      stale, and every ten seconds it re-reads the database regardless of
//      what it thinks it knows.
//
// Only the names of the changed stores travel, never the data, so the two tabs
// cannot disagree about the contents: the database stays the only truth.

import type { QueueStoreName } from "./db";

const CHANNEL_NAME = "setu-queue";
/** Fallback key for browsers without BroadcastChannel; the value is a nonce. */
const STORAGE_KEY = "setu-queue-change";

/** How often a display checks for work it might have missed. */
export const QUEUE_POLL_MS = 2000;
/** How long without any signal before it re-reads everything regardless. */
export const QUEUE_STALE_MS = 10_000;

export type QueueChangeMessage = {
  /** Random per-tab id, so a tab ignores the echo of its own write. */
  sender: string;
  stores: QueueStoreName[];
  at: number;
};

export type QueueBroadcast = {
  post: (stores: QueueStoreName[]) => void;
  subscribe: (handler: (stores: QueueStoreName[]) => void) => () => void;
  close: () => void;
};

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** A no-op channel for server rendering and for browsers with neither transport. */
function inertBroadcast(): QueueBroadcast {
  return { post: () => {}, subscribe: () => () => {}, close: () => {} };
}

export function createQueueBroadcast(): QueueBroadcast {
  if (typeof window === "undefined") return inertBroadcast();

  const sender = randomId();
  const handlers = new Set<(stores: QueueStoreName[]) => void>();

  const deliver = (message: QueueChangeMessage | null) => {
    if (!message || message.sender === sender) return;
    if (!Array.isArray(message.stores) || message.stores.length === 0) return;
    for (const handler of handlers) handler(message.stores);
  };

  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event) => deliver(event.data as QueueChangeMessage);
    return {
      post: (stores) => {
        if (stores.length === 0) return;
        channel.postMessage({ sender, stores, at: Date.now() } satisfies QueueChangeMessage);
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

  // A storage write fires a `storage` event in every *other* tab, which is
  // exactly the semantics we want.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      deliver(JSON.parse(event.newValue) as QueueChangeMessage);
    } catch {
      // A malformed payload costs one missed refresh; the poll picks it up.
    }
  };
  window.addEventListener("storage", onStorage);

  return {
    post: (stores) => {
      if (stores.length === 0) return;
      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ sender, stores, at: Date.now() } satisfies QueueChangeMessage)
        );
      } catch {
        // Private mode can block localStorage; the poll still carries it.
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

/** Whether this browser can sync tabs instantly, for the UI to say so. */
export function canSyncTabs(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof BroadcastChannel !== "undefined") return true;
  try {
    return typeof window.localStorage !== "undefined";
  } catch {
    return false;
  }
}
