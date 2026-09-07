// ---------------------------------------------------------------------------
// The durable queue's storage.
//
// A database of its own — not a store inside POS_DATABASE or the workspace —
// for the same reason the token system has one: analytics writes are constant,
// its failure modes are its own, and nothing here should ever be able to reach
// a database holding a visitor's actual work.
//
// Every function resolves rather than rejects on a storage failure. A browser
// with IndexedDB blocked, a private window, a quota that is full: none of these
// are conditions the site should notice. Analytics degrades to knowing less.
// ---------------------------------------------------------------------------

import type { AnalyticsEvent } from "./types";

const DB_NAME = "SETU_ANALYTICS";
const DB_VERSION = 1;
const QUEUE_STORE = "queue";
const META_STORE = "meta";

/** Key in the meta store holding events lost to the cap since the last flush. */
const DROPPED_KEY = "droppedCount";

let dbPromise: Promise<IDBDatabase | null> | null = null;

export function openAnalyticsDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }

    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      // Firefox throws outright rather than failing the request when storage
      // is blocked entirely.
      resolve(null);
      return;
    }

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        // `seq` is the key, so the store is naturally in happened-order and a
        // re-queued event overwrites rather than duplicating itself.
        db.createObjectStore(QUEUE_STORE, { keyPath: "seq" });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE);
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      // Another tab upgrading or clearing the database invalidates our handle.
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };

    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });

  return dbPromise;
}

function done(transaction: IDBTransaction): Promise<boolean> {
  return new Promise((resolve) => {
    transaction.oncomplete = () => resolve(true);
    transaction.onerror = () => resolve(false);
    transaction.onabort = () => resolve(false);
  });
}

/** Append events. Returns false if they could not be stored. */
export async function putEvents(events: AnalyticsEvent[]): Promise<boolean> {
  if (events.length === 0) return true;
  const db = await openAnalyticsDb();
  if (!db) return false;
  try {
    const transaction = db.transaction(QUEUE_STORE, "readwrite");
    const store = transaction.objectStore(QUEUE_STORE);
    for (const event of events) store.put(event);
    return await done(transaction);
  } catch {
    return false;
  }
}

/** Everything waiting, oldest first. */
export async function readQueue(): Promise<AnalyticsEvent[]> {
  const db = await openAnalyticsDb();
  if (!db) return [];
  try {
    const transaction = db.transaction(QUEUE_STORE, "readonly");
    const request = transaction.objectStore(QUEUE_STORE).getAll();
    return await new Promise((resolve) => {
      request.onsuccess = () => resolve((request.result as AnalyticsEvent[]) ?? []);
      request.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

/**
 * Delete events by their `seq` key.
 *
 * Called only with ids the collector acknowledged, which is what keeps an
 * unacknowledged event queued for the next attempt.
 */
export async function deleteEvents(keys: number[]): Promise<boolean> {
  if (keys.length === 0) return true;
  const db = await openAnalyticsDb();
  if (!db) return false;
  try {
    const transaction = db.transaction(QUEUE_STORE, "readwrite");
    const store = transaction.objectStore(QUEUE_STORE);
    for (const key of keys) store.delete(key);
    return await done(transaction);
  } catch {
    return false;
  }
}

export async function countQueued(): Promise<number> {
  const db = await openAnalyticsDb();
  if (!db) return 0;
  try {
    const transaction = db.transaction(QUEUE_STORE, "readonly");
    const request = transaction.objectStore(QUEUE_STORE).count();
    return await new Promise((resolve) => {
      request.onsuccess = () => resolve(request.result ?? 0);
      request.onerror = () => resolve(0);
    });
  } catch {
    return 0;
  }
}

async function readMeta<T>(key: string, fallback: T): Promise<T> {
  const db = await openAnalyticsDb();
  if (!db) return fallback;
  try {
    const transaction = db.transaction(META_STORE, "readonly");
    const request = transaction.objectStore(META_STORE).get(key);
    return await new Promise((resolve) => {
      request.onsuccess = () => resolve((request.result as T) ?? fallback);
      request.onerror = () => resolve(fallback);
    });
  } catch {
    return fallback;
  }
}

async function writeMeta(key: string, value: unknown): Promise<void> {
  const db = await openAnalyticsDb();
  if (!db) return;
  try {
    const transaction = db.transaction(META_STORE, "readwrite");
    transaction.objectStore(META_STORE).put(value, key);
    await done(transaction);
  } catch {
    // Best effort.
  }
}

export function readDroppedCount(): Promise<number> {
  return readMeta(DROPPED_KEY, 0);
}

/** Bank events lost to the cap, so the next flush can report the loss. */
export async function addDroppedCount(extra: number): Promise<void> {
  if (extra <= 0) return;
  await writeMeta(DROPPED_KEY, (await readDroppedCount()) + extra);
}

/** Clear the drop counter once it has been reported. */
export function clearDroppedCount(): Promise<void> {
  return writeMeta(DROPPED_KEY, 0);
}

/** Throw away everything. Used when a visitor opts out. */
export async function clearAll(): Promise<void> {
  const db = await openAnalyticsDb();
  if (!db) return;
  try {
    const transaction = db.transaction([QUEUE_STORE, META_STORE], "readwrite");
    transaction.objectStore(QUEUE_STORE).clear();
    transaction.objectStore(META_STORE).clear();
    await done(transaction);
  } catch {
    // Best effort.
  }
}
