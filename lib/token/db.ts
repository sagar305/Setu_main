// IndexedDB wrapper for the Free Token System.
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

const DB_NAME = "TOKEN_DATABASE";
const DB_VERSION = 1;

export const TOKEN_STORES = [
  "services",
  "counters",
  "tokens",
  "settings",
] as const;

export type TokenStoreName = (typeof TOKEN_STORES)[number];

/**
 * Secondary indexes. Every screen but Reports asks "what is happening today",
 * so `date` carries almost all of the reads; `status` narrows the waiting list
 * on a day that has run long.
 */
const INDEXES: Partial<Record<TokenStoreName, [name: string, keyPath: string][]>> = {
  tokens: [
    ["date", "date"],
    ["status", "status"],
    ["serviceId", "serviceId"],
  ],
};

let dbPromise: Promise<IDBDatabase> | null = null;

export function openTokenDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this browser."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      for (const store of TOKEN_STORES) {
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

export async function tokenGetAll<T>(store: TokenStoreName): Promise<T[]> {
  const db = await openTokenDb();
  const tx = db.transaction(store, "readonly");
  return requestToPromise(tx.objectStore(store).getAll() as IDBRequest<T[]>);
}

/** Read one business day's tokens without pulling ninety days into memory. */
export async function tokenGetByDate<T>(store: TokenStoreName, date: string): Promise<T[]> {
  const db = await openTokenDb();
  const tx = db.transaction(store, "readonly");
  const index = tx.objectStore(store).index("date");
  return requestToPromise(index.getAll(IDBKeyRange.only(date)) as IDBRequest<T[]>);
}

export async function tokenPut<T>(store: TokenStoreName, value: T): Promise<void> {
  const db = await openTokenDb();
  const tx = db.transaction(store, "readwrite");
  tx.objectStore(store).put(value);
  await txDone(tx);
}

export async function tokenDelete(store: TokenStoreName, id: string): Promise<void> {
  const db = await openTokenDb();
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
export async function tokenBatch(
  writes: Partial<Record<TokenStoreName, unknown[]>>,
  deletes: Partial<Record<TokenStoreName, string[]>> = {}
): Promise<void> {
  const stores = Array.from(
    new Set([...Object.keys(writes), ...Object.keys(deletes)])
  ) as TokenStoreName[];
  if (stores.length === 0) return;

  const db = await openTokenDb();
  const tx = db.transaction(stores, "readwrite");
  for (const store of stores) {
    const objectStore = tx.objectStore(store);
    for (const value of writes[store] ?? []) objectStore.put(value);
    for (const id of deletes[store] ?? []) objectStore.delete(id);
  }
  await txDone(tx);
}

export async function tokenClearStores(stores: TokenStoreName[]): Promise<void> {
  if (stores.length === 0) return;
  const db = await openTokenDb();
  const tx = db.transaction(stores, "readwrite");
  for (const store of stores) tx.objectStore(store).clear();
  await txDone(tx);
}

export async function tokenClearAll(): Promise<void> {
  await tokenClearStores([...TOKEN_STORES]);
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
export async function allocateToken<T extends { id: string; number: number }>(
  date: string,
  serviceId: string,
  /** Ignore tokens issued before this ISO time — a manual reset restarts at 1. */
  since: string | null,
  build: (nextNumber: number) => T
): Promise<T> {
  const db = await openTokenDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction("tokens", "readwrite");
    const store = tx.objectStore("tokens");
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
