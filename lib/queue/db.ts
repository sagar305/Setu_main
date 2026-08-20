// IndexedDB wrapper for the Free Token & Queue System.
//
// A database of its own, like Free Dine's, rather than more stores inside
// POS_DATABASE. Two reasons. The queue is the only app here that runs two
// tabs against the same rows all day, so its writes are constant and its
// failure modes are its own — a botched migration or a factory reset should
// not be able to reach the shared workspace. And the natural names for these
// stores ("services", "tokens", "counters") are far too generic to claim in a
// database every tool shares.
//
// The business profile still comes from the shared workspace: same origin,
// different database, read through lib/workspace.

const DB_NAME = "QUEUE_DATABASE";
const DB_VERSION = 1;

export const QUEUE_STORES = [
  "queue_services",
  "queue_counters",
  "queue_tokens",
  "queue_settings",
] as const;

export type QueueStoreName = (typeof QUEUE_STORES)[number];

/**
 * Secondary indexes. Every screen but Reports asks "what is happening today",
 * so `date` carries almost all of the reads; `status` narrows the waiting list
 * on a day that has run long.
 */
const INDEXES: Partial<Record<QueueStoreName, [name: string, keyPath: string][]>> = {
  queue_tokens: [
    ["date", "date"],
    ["status", "status"],
    ["serviceId", "serviceId"],
  ],
};

let dbPromise: Promise<IDBDatabase> | null = null;

export function openQueueDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this browser."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      for (const store of QUEUE_STORES) {
        const objectStore = db.objectStoreNames.contains(store)
          ? request.transaction!.objectStore(store)
          : db.createObjectStore(store, { keyPath: "id" });
        for (const [name, keyPath] of INDEXES[store] ?? []) {
          if (!objectStore.indexNames.contains(name)) {
            objectStore.createIndex(name, keyPath, { unique: false });
          }
        }
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      // If another tab upgrades or deletes the database, drop our handle.
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };

    request.onerror = () => {
      dbPromise = null;
      reject(request.error ?? new Error("Could not open the queue database."));
    };
  });

  return dbPromise;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed."));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted."));
  });
}

export async function queueGetAll<T>(store: QueueStoreName): Promise<T[]> {
  const db = await openQueueDb();
  const tx = db.transaction(store, "readonly");
  return requestToPromise(tx.objectStore(store).getAll() as IDBRequest<T[]>);
}

/** Read one business day's tokens without pulling ninety days into memory. */
export async function queueGetByDate<T>(store: QueueStoreName, date: string): Promise<T[]> {
  const db = await openQueueDb();
  const tx = db.transaction(store, "readonly");
  const index = tx.objectStore(store).index("date");
  return requestToPromise(index.getAll(IDBKeyRange.only(date)) as IDBRequest<T[]>);
}

export async function queuePut<T>(store: QueueStoreName, value: T): Promise<void> {
  const db = await openQueueDb();
  const tx = db.transaction(store, "readwrite");
  tx.objectStore(store).put(value);
  await txDone(tx);
}

export async function queueDelete(store: QueueStoreName, id: string): Promise<void> {
  const db = await openQueueDb();
  const tx = db.transaction(store, "readwrite");
  tx.objectStore(store).delete(id);
  await txDone(tx);
}

/**
 * Several writes across stores in one atomic transaction.
 *
 * Issuing a token bumps a counter and writes a row; calling one closes the
 * last and opens the next. Neither may half-happen, or two people end up
 * holding A-42.
 */
export async function queueBatch(
  writes: Partial<Record<QueueStoreName, unknown[]>>,
  deletes: Partial<Record<QueueStoreName, string[]>> = {}
): Promise<void> {
  const stores = Array.from(
    new Set([...Object.keys(writes), ...Object.keys(deletes)])
  ) as QueueStoreName[];
  if (stores.length === 0) return;

  const db = await openQueueDb();
  const tx = db.transaction(stores, "readwrite");
  for (const store of stores) {
    const objectStore = tx.objectStore(store);
    for (const value of writes[store] ?? []) objectStore.put(value);
    for (const id of deletes[store] ?? []) objectStore.delete(id);
  }
  await txDone(tx);
}

export async function queueClearStores(stores: QueueStoreName[]): Promise<void> {
  if (stores.length === 0) return;
  const db = await openQueueDb();
  const tx = db.transaction(stores, "readwrite");
  for (const store of stores) tx.objectStore(store).clear();
  await txDone(tx);
}

export async function queueClearAll(): Promise<void> {
  await queueClearStores([...QUEUE_STORES]);
}

/**
 * Allocate the next token number for a service and write the row, in one
 * transaction.
 *
 * The number cannot be computed in React state and written afterwards. Two
 * tabs — a receptionist's tablet and the counter's PC — can tap Issue in the
 * same second, read the same "highest is 41", and both write A-42. Reading the
 * day's rows inside the same readwrite transaction that writes the new one is
 * what makes that impossible: IndexedDB serialises overlapping transactions on
 * a store, so the second reader sees the first writer's row.
 */
export async function queueAllocateToken<T extends { id: string; number: number }>(
  date: string,
  serviceId: string,
  /** Ignore tokens issued before this ISO time — a manual reset restarts at 1. */
  since: string | null,
  build: (nextNumber: number) => T
): Promise<T> {
  const db = await openQueueDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction("queue_tokens", "readwrite");
    const store = tx.objectStore("queue_tokens");
    const request = store.index("date").getAll(IDBKeyRange.only(date));
    let created: T | null = null;

    request.onsuccess = () => {
      const sameDay = (request.result ?? []) as {
        serviceId: string;
        number: number;
        issuedAt: string;
      }[];
      let highest = 0;
      for (const row of sameDay) {
        if (row.serviceId !== serviceId) continue;
        if (since && row.issuedAt < since) continue;
        if (row.number > highest) highest = row.number;
      }
      created = build(highest + 1);
      store.put(created);
    };

    tx.oncomplete = () => {
      if (created) resolve(created);
      else reject(new Error("Could not allocate a token number."));
    };
    tx.onerror = () => reject(tx.error ?? new Error("Could not issue the token."));
    tx.onabort = () => reject(tx.error ?? new Error("Issuing the token was aborted."));
  });
}
