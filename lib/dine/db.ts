// IndexedDB wrapper for Free Dine.
//
// Deliberately a separate database from the Browser Based POS's POS_DATABASE.
// The two products serve different rooms — a retail counter and a dining room —
// and keeping them apart means a reset, a restore or a botched migration in one
// can never touch the other's data. It also means Free Dine ships without
// needing a migration of the retail POS at all.

const DB_NAME = "DINE_DATABASE";
const DB_VERSION = 1;

export const DINE_STORES = [
  "dine_business",
  "dine_settings",
  "dine_categories",
  "dine_areas",
  "dine_tables",
  "dine_menu_items",
  "dine_variations",
  "dine_modifier_groups",
  "dine_modifiers",
  "dine_tickets",
  "dine_ticket_items",
  "dine_kots",
  "dine_bills",
  "dine_bill_items",
  "dine_bill_payments",
  "dine_payment_methods",
  "dine_customers",
] as const;

export type DineStoreName = (typeof DINE_STORES)[number];

/** Secondary indexes, keyed by store. Everything else is fetched by id. */
const INDEXES: Partial<Record<DineStoreName, [name: string, keyPath: string][]>> = {
  dine_tables: [["areaId", "areaId"]],
  dine_variations: [["menuItemId", "menuItemId"]],
  dine_modifier_groups: [["menuItemId", "menuItemId"]],
  dine_modifiers: [["groupId", "groupId"]],
  dine_ticket_items: [["ticketId", "ticketId"]],
  dine_kots: [["ticketId", "ticketId"]],
  dine_bills: [
    ["ticketId", "ticketId"],
    ["businessDate", "businessDate"],
  ],
  dine_bill_items: [["billId", "billId"]],
  dine_bill_payments: [["billId", "billId"]],
};

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDineDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this browser."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      for (const store of DINE_STORES) {
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
      reject(request.error ?? new Error("Could not open the Free Dine database."));
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

export async function dineGetAll<T>(store: DineStoreName): Promise<T[]> {
  const db = await openDineDb();
  const tx = db.transaction(store, "readonly");
  return requestToPromise(tx.objectStore(store).getAll() as IDBRequest<T[]>);
}

export async function dineGet<T>(store: DineStoreName, id: string): Promise<T | undefined> {
  const db = await openDineDb();
  const tx = db.transaction(store, "readonly");
  return requestToPromise(tx.objectStore(store).get(id) as IDBRequest<T | undefined>);
}

export async function dinePut<T>(store: DineStoreName, value: T): Promise<void> {
  const db = await openDineDb();
  const tx = db.transaction(store, "readwrite");
  tx.objectStore(store).put(value);
  await txDone(tx);
}

export async function dineDelete(store: DineStoreName, id: string): Promise<void> {
  const db = await openDineDb();
  const tx = db.transaction(store, "readwrite");
  tx.objectStore(store).delete(id);
  await txDone(tx);
}

/**
 * Run several writes and deletes across stores in one atomic transaction.
 *
 * Every multi-store mutation in Free Dine goes through here. Firing a round
 * writes the KOT and stamps its items; settling writes the bill, its items, its
 * payments and the ticket. A half-applied version of either would leave the
 * floor showing a table that owes money nobody can collect, so these must land
 * together or not at all.
 */
export async function dineBatch(
  writes: Partial<Record<DineStoreName, unknown[]>>,
  deletes: Partial<Record<DineStoreName, string[]>> = {}
): Promise<void> {
  const stores = Array.from(
    new Set([...Object.keys(writes), ...Object.keys(deletes)])
  ) as DineStoreName[];
  if (stores.length === 0) return;

  const db = await openDineDb();
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

/**
 * Read a record, decide what to write from it, and write — all inside one
 * transaction.
 *
 * This exists for the numbering counters. Free Dine can be open in several
 * tabs at once (the counter and the kitchen screen, at least), and each tab
 * holds its own copy of the settings in memory. Allocating a KOT or bill
 * number from that copy means two tabs firing at the same moment both read
 * "next is 7" and both write 7 — two different rounds carrying one ticket
 * number, which is the sort of thing nobody notices until a guest disputes a
 * bill.
 *
 * IndexedDB serialises overlapping readwrite transactions on the same store,
 * so reading the counter *inside* the transaction that bumps it makes the
 * allocation atomic across tabs.
 */
export async function dineAllocate<TRecord, TResult>(
  keyStore: DineStoreName,
  keyId: string,
  alsoWrite: DineStoreName[],
  plan: (current: TRecord | undefined) => {
    writes: Partial<Record<DineStoreName, unknown[]>>;
    result: TResult;
  }
): Promise<TResult> {
  const db = await openDineDb();
  const stores = Array.from(new Set<DineStoreName>([keyStore, ...alsoWrite]));
  const tx = db.transaction(stores, "readwrite");

  const current = await requestToPromise(
    tx.objectStore(keyStore).get(keyId) as IDBRequest<TRecord | undefined>
  );
  const { writes, result } = plan(current);

  for (const store of Object.keys(writes) as DineStoreName[]) {
    const objectStore = tx.objectStore(store);
    for (const value of writes[store] ?? []) {
      objectStore.put(value);
    }
  }

  await txDone(tx);
  return result;
}

/** Wipe every Dine store. Never touches the Browser Based POS database. */
export async function dineClearAll(): Promise<void> {
  const db = await openDineDb();
  const tx = db.transaction([...DINE_STORES], "readwrite");
  for (const store of DINE_STORES) {
    tx.objectStore(store).clear();
  }
  await txDone(tx);
}

/** Wipe only the given stores, used by restore-from-backup. */
export async function dineClearStores(stores: DineStoreName[]): Promise<void> {
  if (stores.length === 0) return;
  const db = await openDineDb();
  const tx = db.transaction(stores, "readwrite");
  for (const store of stores) {
    tx.objectStore(store).clear();
  }
  await txDone(tx);
}
