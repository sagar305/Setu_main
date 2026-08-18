// A small IndexedDB store, for this tool only.
// ---------------------------------------------------------------------------
// Decision 5: transactions can run to thousands of rows across several
// statements, which is more than localStorage should hold — so they live in
// IndexedDB. This is deliberately NOT the shared POS_DATABASE workspace and NOT
// a global Dexie layer: it is one small database owned by one tool, written by
// hand so the repo gains no new dependency.
//
// Everything else (statements, rules, categories, settings, audit) is small and
// stays in namespaced localStorage — see ./store.ts.

const DATABASE_NAME = "setu_bank_statement_analyzer";
const DATABASE_VERSION = 2;
const TRANSACTION_STORE = "transactions";

/**
 * What the categoriser has learned, and the category embeddings it computed.
 *
 * In IndexedDB rather than localStorage because neither has a natural bound:
 * corrections accumulate for as long as the CA keeps working, and one set of
 * category embeddings is ~35 × 384 floats. Keeping them out of localStorage is
 * what lets the correction history stop being capped at an arbitrary number.
 */
const AI_STORE = "aiMemory";

export type StoredTransactionBatch = {
  /** Statement id — one record holds that statement's whole transaction list. */
  statementId: string;
  transactions: unknown[];
  updatedAt: string;
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this browser."));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(TRANSACTION_STORE)) {
        database.createObjectStore(TRANSACTION_STORE, { keyPath: "statementId" });
      }
      if (!database.objectStoreNames.contains(AI_STORE)) {
        database.createObjectStore(AI_STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withNamedStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest
): Promise<T> {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(storeName, mode);
      const request = run(transaction.objectStore(storeName));
      request.onsuccess = () => resolve(request.result as T);
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
}

function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest
): Promise<T> {
  return withNamedStore<T>(TRANSACTION_STORE, mode, run);
}

// --- AI memory -------------------------------------------------------------

/** Read one AI memory record. Returns the fallback when there is none. */
export async function loadAiRecord<T>(key: string, fallback: T): Promise<T> {
  const record = await withNamedStore<{ key: string; value: T } | undefined>(
    AI_STORE,
    "readonly",
    (store) => store.get(key)
  );
  return record ? record.value : fallback;
}

export async function saveAiRecord<T>(key: string, value: T): Promise<void> {
  await withNamedStore<IDBValidKey>(AI_STORE, "readwrite", (store) =>
    store.put({ key, value, updatedAt: new Date().toISOString() })
  );
}

export async function deleteAiRecord(key: string): Promise<void> {
  await withNamedStore<undefined>(AI_STORE, "readwrite", (store) => store.delete(key));
}

export async function saveTransactions(
  statementId: string,
  transactions: unknown[]
): Promise<void> {
  await withStore<IDBValidKey>("readwrite", (store) =>
    store.put({ statementId, transactions, updatedAt: new Date().toISOString() })
  );
}

export async function loadTransactions<T>(statementId: string): Promise<T[]> {
  const record = await withStore<StoredTransactionBatch | undefined>("readonly", (store) =>
    store.get(statementId)
  );
  return (record?.transactions as T[]) ?? [];
}

export async function deleteTransactions(statementId: string): Promise<void> {
  await withStore<undefined>("readwrite", (store) => store.delete(statementId));
}

export async function listStatementIds(): Promise<string[]> {
  const keys = await withStore<IDBValidKey[]>("readonly", (store) => store.getAllKeys());
  return keys.map((key) => String(key));
}

/** Wipe the tool's IndexedDB entirely — used by "Clear all local data" (§19). */
export async function clearAll(): Promise<void> {
  await withStore<undefined>("readwrite", (store) => store.clear());
  await withNamedStore<undefined>(AI_STORE, "readwrite", (store) => store.clear());
}
