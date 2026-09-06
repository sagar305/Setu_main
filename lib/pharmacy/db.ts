// IndexedDB wrapper for the Free Pharmacy POS.
//
// A database of its own, like the rental book's and the queue's, rather than
// more stores inside POS_DATABASE. "medicines" and "batches" would be too
// generic to claim in a database every tool shares, and the clinic already owns
// a `clinic_medicines` store with a completely different shape. Keeping the
// chemist's stock in its own database also means a bad purchase-entry write
// cannot take the shared workspace down with it.
//
// The business profile still comes from the shared workspace: same origin,
// different database, read through lib/workspace.

const DB_NAME = "PHARMACY_DATABASE";
const DB_VERSION = 1;

export const PHARMACY_STORES = [
  "medicines",
  "batches",
  "suppliers",
  "purchases",
  "sales",
  "saleReturns",
  "purchaseReturns",
  "stockLogs",
  "refillReminders",
  "customers",
  "heldCarts",
  "pharmacySettings",
] as const;

export type PharmacyStoreName = (typeof PHARMACY_STORES)[number];

/**
 * Secondary indexes.
 *
 * `batches.medicineId` is what FEFO walks on every add-to-cart, and
 * `batches.expiry` is what the expiry dashboard sorts the whole shop by — those
 * two are the reason this app is not the POS. The three on `medicines` back the
 * counter's search, which matches brand, salt and barcode at once.
 */
const INDEXES: Partial<Record<PharmacyStoreName, [name: string, keyPath: string][]>> = {
  batches: [
    ["medicineId", "medicineId"],
    ["expiry", "expiry"],
    ["supplierId", "supplierId"],
  ],
  medicines: [
    ["name", "name"],
    ["composition", "composition"],
    ["barcode", "barcode"],
  ],
  sales: [
    ["date", "date"],
    ["customerId", "customerId"],
  ],
  purchases: [["supplierId", "supplierId"]],
  saleReturns: [["saleId", "saleId"]],
  purchaseReturns: [["supplierId", "supplierId"]],
  stockLogs: [
    ["batchId", "batchId"],
    ["medicineId", "medicineId"],
  ],
  refillReminders: [
    ["customerId", "customerId"],
    ["nextDueOn", "nextDueOn"],
  ],
};

let dbPromise: Promise<IDBDatabase> | null = null;

export function openPharmacyDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this browser."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      for (const store of PHARMACY_STORES) {
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
      reject(request.error ?? new Error("Could not open the pharmacy database."));
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

export async function pharmacyGetAll<T>(store: PharmacyStoreName): Promise<T[]> {
  const db = await openPharmacyDb();
  const tx = db.transaction(store, "readonly");
  return requestToPromise(tx.objectStore(store).getAll() as IDBRequest<T[]>);
}

export async function pharmacyPut<T>(store: PharmacyStoreName, value: T): Promise<void> {
  const db = await openPharmacyDb();
  const tx = db.transaction(store, "readwrite");
  tx.objectStore(store).put(value);
  await txDone(tx);
}

export async function pharmacyDelete(store: PharmacyStoreName, id: string): Promise<void> {
  const db = await openPharmacyDb();
  const tx = db.transaction(store, "readwrite");
  tx.objectStore(store).delete(id);
  await txDone(tx);
}

/**
 * Several writes across stores in one atomic transaction.
 *
 * A bill is the reason this exists. Completing one writes the sale, every batch
 * it drew stock from, a movement log row per batch, possibly a refill reminder,
 * and the settings row that issued the invoice number. Half of that landing —
 * stock gone but no sale, or a sale with no stock movement — is a shop that
 * cannot be reconciled, which is worse than the write failing outright.
 */
export async function pharmacyBatch(
  writes: Partial<Record<PharmacyStoreName, unknown[]>>,
  deletes: Partial<Record<PharmacyStoreName, string[]>> = {}
): Promise<void> {
  const stores = Array.from(
    new Set([...Object.keys(writes), ...Object.keys(deletes)])
  ) as PharmacyStoreName[];
  if (stores.length === 0) return;

  const db = await openPharmacyDb();
  const tx = db.transaction(stores, "readwrite");
  for (const store of stores) {
    const objectStore = tx.objectStore(store);
    for (const value of writes[store] ?? []) objectStore.put(value);
    for (const id of deletes[store] ?? []) objectStore.delete(id);
  }
  await txDone(tx);
}

export async function pharmacyClearStores(stores: PharmacyStoreName[]): Promise<void> {
  if (stores.length === 0) return;
  const db = await openPharmacyDb();
  const tx = db.transaction(stores, "readwrite");
  for (const store of stores) tx.objectStore(store).clear();
  await txDone(tx);
}

export async function pharmacyClearAll(): Promise<void> {
  await pharmacyClearStores([...PHARMACY_STORES]);
}

/**
 * Take the next invoice (or return-note) number and write everything that uses
 * it, in one transaction.
 *
 * The counter cannot read the counter in React and write it back afterwards. A
 * shop with two counters — which is most of them — has both machines finishing a
 * bill in the same second, both reading "next is 412", and both printing
 * PH-00412. Two different customers under one invoice number is the kind of
 * mistake that is only found at the end of the month, in the GST return.
 * Reading the settings row inside the same readwrite transaction that writes the
 * sale is what makes that impossible.
 */
export async function allocateNumber(
  field: "nextInvoiceNumber" | "nextReturnNoteNumber",
  extraStores: PharmacyStoreName[],
  build: (next: number) => {
    writes: Partial<Record<PharmacyStoreName, unknown[]>>;
  }
): Promise<number> {
  const db = await openPharmacyDb();
  const stores = Array.from(new Set<PharmacyStoreName>(["pharmacySettings", ...extraStores]));

  return new Promise<number>((resolve, reject) => {
    const tx = db.transaction(stores, "readwrite");
    const settingsStore = tx.objectStore("pharmacySettings");
    const request = settingsStore.get("main") as IDBRequest<Record<string, unknown> | undefined>;
    let allocated: number | null = null;

    request.onsuccess = () => {
      const settings = request.result;
      const current = typeof settings?.[field] === "number" ? (settings[field] as number) : 1;
      allocated = current;
      const { writes } = build(current);
      for (const store of Object.keys(writes) as PharmacyStoreName[]) {
        const objectStore = tx.objectStore(store);
        for (const value of writes[store] ?? []) objectStore.put(value);
      }
      // The row may not exist yet on a database whose settings were never
      // saved; put a minimal one rather than dropping the increment.
      settingsStore.put({ ...(settings ?? { id: "main" }), id: "main", [field]: current + 1 });
    };

    tx.oncomplete = () => {
      if (allocated !== null) resolve(allocated);
      else reject(new Error("Could not allocate a number."));
    };
    tx.onerror = () => reject(tx.error ?? new Error("Could not save the bill."));
    tx.onabort = () => reject(tx.error ?? new Error("Saving the bill was aborted."));
  });
}
