// IndexedDB wrapper for the Free Rental & Hire Book.
//
// A database of its own, like the queue's and Free Dine's, rather than more
// stores inside POS_DATABASE. "items", "customers" and "bookings" are far too
// generic to claim in a database every tool shares, and a rental book's writes
// — a whole booking rewritten at dispatch and again at settlement — should not
// be able to take the shared workspace down with them.
//
// The business profile still comes from the shared workspace: same origin,
// different database, read through lib/workspace.

const DB_NAME = "RENTAL_DATABASE";
const DB_VERSION = 1;

export const RENTAL_STORES = [
  "itemCategories",
  "items",
  "itemUnits",
  "customers",
  "bookings",
  "maintenanceLogs",
  "rentalSettings",
] as const;

export type RentalStoreName = (typeof RENTAL_STORES)[number];

/**
 * Secondary indexes.
 *
 * Availability reads bookings by window, so both ends of the window are
 * indexed; the Today screen and the status tabs read by `status`; a customer's
 * history reads by `customerId`. `itemUnits.itemId` is what the serialised
 * allocation picker walks.
 */
const INDEXES: Partial<Record<RentalStoreName, [name: string, keyPath: string][]>> = {
  bookings: [
    ["fromDate", "fromDate"],
    ["toDate", "toDate"],
    ["status", "status"],
    ["customerId", "customerId"],
  ],
  itemUnits: [["itemId", "itemId"]],
  maintenanceLogs: [["itemId", "itemId"]],
};

let dbPromise: Promise<IDBDatabase> | null = null;

export function openRentalDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this browser."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      for (const store of RENTAL_STORES) {
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
      reject(request.error ?? new Error("Could not open the rental database."));
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

export async function rentalGetAll<T>(store: RentalStoreName): Promise<T[]> {
  const db = await openRentalDb();
  const tx = db.transaction(store, "readonly");
  return requestToPromise(tx.objectStore(store).getAll() as IDBRequest<T[]>);
}

export async function rentalPut<T>(store: RentalStoreName, value: T): Promise<void> {
  const db = await openRentalDb();
  const tx = db.transaction(store, "readwrite");
  tx.objectStore(store).put(value);
  await txDone(tx);
}

export async function rentalDelete(store: RentalStoreName, id: string): Promise<void> {
  const db = await openRentalDb();
  const tx = db.transaction(store, "readwrite");
  tx.objectStore(store).delete(id);
  await txDone(tx);
}

/**
 * Several writes across stores in one atomic transaction.
 *
 * Settling a booking writes the booking, the item rows whose totals a loss
 * reduced, the units whose condition changed and the settings row that issued
 * the invoice number. Half of that landing is worse than none of it.
 */
export async function rentalBatch(
  writes: Partial<Record<RentalStoreName, unknown[]>>,
  deletes: Partial<Record<RentalStoreName, string[]>> = {}
): Promise<void> {
  const stores = Array.from(
    new Set([...Object.keys(writes), ...Object.keys(deletes)])
  ) as RentalStoreName[];
  if (stores.length === 0) return;

  const db = await openRentalDb();
  const tx = db.transaction(stores, "readwrite");
  for (const store of stores) {
    const objectStore = tx.objectStore(store);
    for (const value of writes[store] ?? []) objectStore.put(value);
    for (const id of deletes[store] ?? []) objectStore.delete(id);
  }
  await txDone(tx);
}

export async function rentalClearStores(stores: RentalStoreName[]): Promise<void> {
  if (stores.length === 0) return;
  const db = await openRentalDb();
  const tx = db.transaction(stores, "readwrite");
  for (const store of stores) tx.objectStore(store).clear();
  await txDone(tx);
}

export async function rentalClearAll(): Promise<void> {
  await rentalClearStores([...RENTAL_STORES]);
}

/**
 * Take the next booking (or invoice) number and write the row that uses it, in
 * one transaction.
 *
 * The counter cannot be read in React and written back afterwards. The owner's
 * phone and the counter laptop can both save a booking in the same second, read
 * the same "next is 231", and both write BK-0231 — two different weddings under
 * one number, which is the kind of mistake that is only found at dispatch.
 * Reading the settings row inside the same readwrite transaction that writes
 * the booking is what makes that impossible.
 */
export async function allocateNumber<T extends { id: string }>(
  field: "nextBookingNumber" | "nextInvoiceNumber",
  targetStore: RentalStoreName,
  build: (next: number) => T
): Promise<T> {
  const db = await openRentalDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(["rentalSettings", targetStore], "readwrite");
    const settingsStore = tx.objectStore("rentalSettings");
    const request = settingsStore.get("main") as IDBRequest<Record<string, unknown> | undefined>;
    let created: T | null = null;

    request.onsuccess = () => {
      const settings = request.result;
      const current = typeof settings?.[field] === "number" ? (settings[field] as number) : 1;
      created = build(current);
      tx.objectStore(targetStore).put(created);
      // The row may not exist yet on a database whose settings were never
      // saved; put a minimal one rather than dropping the increment.
      settingsStore.put({ ...(settings ?? { id: "main" }), id: "main", [field]: current + 1 });
    };

    tx.oncomplete = () => {
      if (created) resolve(created);
      else reject(new Error("Could not allocate a number."));
    };
    tx.onerror = () => reject(tx.error ?? new Error("Could not save the booking."));
    tx.onabort = () => reject(tx.error ?? new Error("Saving the booking was aborted."));
  });
}
