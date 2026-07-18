// Minimal promise-based IndexedDB wrapper for the Offline Browser POS.
// Database: POS_DATABASE with one object store per logical table.

// This database doubles as the shared Business Workspace for the toolkit
// ecosystem — other tools should access it through lib/workspace, never by
// importing POS internals. The name is kept for existing users' data.
const DB_NAME = "POS_DATABASE";
// v2 adds held_carts (hold/recall sales); v3 adds sync_queue (Google Sheet
// sync dirty-flags); v4 adds the Business Toolkit stores (suppliers, expenses,
// cashbook, appointments, ledger, receipt_templates, purchases, quotations,
// assets). The upgrade handler creates any missing stores, so bumping the
// version migrates older databases in place.
const DB_VERSION = 4;

export const STORES = [
  "business",
  "products",
  "categories",
  "customers",
  "orders",
  "order_items",
  "payments",
  "inventory",
  "settings",
  "held_carts",
  "sync_queue",
  "suppliers",
  "expenses",
  "cashbook",
  "appointments",
  "ledger",
  "receipt_templates",
  "purchases",
  "quotations",
  "assets",
] as const;

export type StoreName = (typeof STORES)[number];

let dbPromise: Promise<IDBDatabase> | null = null;

export function openPosDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this browser."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      for (const store of STORES) {
        if (!db.objectStoreNames.contains(store)) {
          const objectStore = db.createObjectStore(store, { keyPath: "id" });
          if (store === "order_items") {
            objectStore.createIndex("orderId", "orderId", { unique: false });
          }
          if (store === "inventory") {
            objectStore.createIndex("productId", "productId", { unique: false });
          }
          if (store === "ledger") {
            objectStore.createIndex("customerId", "customerId", { unique: false });
          }
          if (store === "purchases") {
            objectStore.createIndex("supplierId", "supplierId", { unique: false });
          }
        }
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      // If another tab upgrades/deletes the DB, release our handle.
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };

    request.onerror = () => {
      dbPromise = null;
      reject(request.error ?? new Error("Failed to open POS database."));
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

export async function dbGetAll<T>(store: StoreName): Promise<T[]> {
  const db = await openPosDb();
  const tx = db.transaction(store, "readonly");
  return requestToPromise(tx.objectStore(store).getAll() as IDBRequest<T[]>);
}

export async function dbGet<T>(store: StoreName, id: string): Promise<T | undefined> {
  const db = await openPosDb();
  const tx = db.transaction(store, "readonly");
  return requestToPromise(tx.objectStore(store).get(id) as IDBRequest<T | undefined>);
}

export async function dbPut<T>(store: StoreName, value: T): Promise<void> {
  const db = await openPosDb();
  const tx = db.transaction(store, "readwrite");
  tx.objectStore(store).put(value);
  await txDone(tx);
}

export async function dbDelete(store: StoreName, id: string): Promise<void> {
  const db = await openPosDb();
  const tx = db.transaction(store, "readwrite");
  tx.objectStore(store).delete(id);
  await txDone(tx);
}

/**
 * Run several writes across stores in one atomic transaction.
 * `writes` maps store name -> records to put; `deletes` maps store name -> ids to remove.
 */
export async function dbBatch(
  writes: Partial<Record<StoreName, unknown[]>>,
  deletes: Partial<Record<StoreName, string[]>> = {}
): Promise<void> {
  const stores = Array.from(
    new Set([...Object.keys(writes), ...Object.keys(deletes)])
  ) as StoreName[];
  if (stores.length === 0) return;

  const db = await openPosDb();
  const tx = db.transaction(stores, "readwrite");
  for (const store of stores) {
    const objectStore = tx.objectStore(store);
    for (const value of writes[store] ?? []) {
      objectStore.put(value);
    }
    for (const id of deletes[store] ?? []) {
      objectStore.delete(id);
    }
  }
  await txDone(tx);
}

/** Wipe every store (used by full reset). */
export async function dbClearAll(): Promise<void> {
  const db = await openPosDb();
  const tx = db.transaction([...STORES], "readwrite");
  for (const store of STORES) {
    tx.objectStore(store).clear();
  }
  await txDone(tx);
}

/** Wipe only the given stores (used by selective restore-from-backup). */
export async function dbClearStores(stores: StoreName[]): Promise<void> {
  if (stores.length === 0) return;
  const db = await openPosDb();
  const tx = db.transaction(stores, "readwrite");
  for (const store of stores) {
    tx.objectStore(store).clear();
  }
  await txDone(tx);
}
