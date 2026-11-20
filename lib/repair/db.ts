// IndexedDB wrapper for the Free Repair Job Card.
//
// Its own database, like the hire book's and the pharmacy's, rather than more
// stores inside the shared workspace: "jobs", "parts" and "customers" are far
// too generic to claim in a database every tool shares, and this app writes
// something no other one does — a job carrying four photos, which is a value
// measured in hundreds of kilobytes rather than hundreds of bytes. A write that
// size should not be able to take the shared workspace down with it.
//
// The business profile still comes from the shared workspace: same origin,
// different database, read through lib/pos/db.

const DB_NAME = "REPAIR_DATABASE";
// v2 adds "vendors" (outside repair) and the three Google Drive team sync
// stores (drive_ops, drive_state, drive_cache — see lib/repair/team). The
// upgrade only creates missing stores, so older databases migrate in place.
const DB_VERSION = 2;

export const REPAIR_STORES = [
  "customers",
  "jobs",
  "parts",
  "technicians",
  "bills",
  "repairSettings",
  "vendors",
  "drive_ops",
  "drive_state",
  "drive_cache",
] as const;

export type RepairStoreName = (typeof REPAIR_STORES)[number];

/** Team sync's own bookkeeping: never backed up, never synced. */
export const TEAM_INTERNAL_STORES: readonly RepairStoreName[] = ["drive_ops", "drive_state", "drive_cache"];

/** The shop's data proper — what a backup holds and what team sync shares. */
export const REPAIR_DATA_STORES: RepairStoreName[] = REPAIR_STORES.filter(
  (store) => !TEAM_INTERNAL_STORES.includes(store)
);

// ---------------------------------------------------------------------------
// Change capture for Google Drive team sync.
//
// While this device is in a team, lib/repair/team/engine registers a sink.
// Every write through repairPut / repairDelete / repairBatch / allocateNumber
// is offered to it together with the rows as they were before, and the
// operations it returns are saved to drive_ops in the SAME transaction as the
// write, so a change and its sync record can never be separated. Writes that
// apply data received from the team use repairBatchRaw and are not captured.
//
// Unlike the POS sink this one is async: a job's photos are shrunk before
// they are queued, and that needs the browser to decode them.
// ---------------------------------------------------------------------------

export type CapturedWrite = {
  writes: Partial<Record<string, unknown[]>>;
  deletes: Partial<Record<string, string[]>>;
  /** The rows being overwritten or deleted, as they were (store → id → row). */
  before: Partial<Record<string, Record<string, unknown>>>;
};

/** Returns rows to add to drive_ops (each with a string id), or none. */
export type CaptureSink = (write: CapturedWrite) => Promise<{ id: string }[]>;

let captureSink: CaptureSink | null = null;
const writeListeners = new Set<() => void>();

export function setRepairCaptureSink(sink: CaptureSink | null): void {
  captureSink = sink;
}

export function hasRepairCaptureSink(): boolean {
  return captureSink !== null;
}

/** Called after every captured write commits (used to schedule an upload). */
export function onRepairCapturedWrite(listener: () => void): () => void {
  writeListeners.add(listener);
  return () => writeListeners.delete(listener);
}

/**
 * Secondary indexes, as the spec names them.
 *
 * `jobs.status` is what the board reads a column from; `jobs.jobNo` and
 * `customers.phone` are the two lookups a shop does out loud with a customer on
 * the phone. There is deliberately no index on `serialNo` — an IMEI is typed in
 * whole or not at all, and a customer reading one out gets the last four digits
 * right more often than all fifteen, so that search has to be a substring scan
 * over jobs rather than an exact-match index.
 */
const INDEXES: Partial<Record<RepairStoreName, [name: string, keyPath: string][]>> = {
  jobs: [
    ["status", "status"],
    ["jobNo", "jobNo"],
    ["customerId", "customerId"],
  ],
  customers: [["phone", "phone"]],
  bills: [["jobId", "jobId"]],
};

let dbPromise: Promise<IDBDatabase> | null = null;

export function openRepairDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this browser."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      for (const store of REPAIR_STORES) {
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
      reject(request.error ?? new Error("Could not open the repair database."));
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

export async function repairGetAll<T>(store: RepairStoreName): Promise<T[]> {
  const db = await openRepairDb();
  const tx = db.transaction(store, "readonly");
  return requestToPromise(tx.objectStore(store).getAll() as IDBRequest<T[]>);
}

export async function repairPut<T>(store: RepairStoreName, value: T): Promise<void> {
  await repairBatch({ [store]: [value] });
}

export async function repairDelete(store: RepairStoreName, id: string): Promise<void> {
  await repairBatch({}, { [store]: [id] });
}

export async function repairGet<T>(store: RepairStoreName, id: string): Promise<T | undefined> {
  const db = await openRepairDb();
  const tx = db.transaction(store, "readonly");
  return requestToPromise(tx.objectStore(store).get(id) as IDBRequest<T | undefined>);
}

/** The current rows a write is about to replace or delete, for change capture. */
async function rowsBefore(
  writes: Partial<Record<string, unknown[]>>,
  deletes: Partial<Record<string, string[]>>
): Promise<CapturedWrite["before"]> {
  const before: CapturedWrite["before"] = {};
  const stores = new Set([...Object.keys(writes), ...Object.keys(deletes)]);
  for (const store of stores) {
    if (TEAM_INTERNAL_STORES.includes(store as RepairStoreName)) continue;
    const ids = [
      ...((writes[store] ?? []) as { id?: string }[]).map((row) => row?.id).filter(Boolean),
      ...(deletes[store] ?? []),
    ] as string[];
    if (ids.length === 0) continue;
    const rows: Record<string, unknown> = {};
    for (const id of ids) {
      const row = await repairGet(store as RepairStoreName, id);
      if (row !== undefined) rows[id] = row;
    }
    before[store] = rows;
  }
  return before;
}

/**
 * Several writes across stores in one atomic transaction.
 *
 * Billing a job writes the bill, the job that now points at it, and the part
 * rows whose stock the repair consumed. Half of that landing is worse than none
 * of it: a part decremented against a bill that was never saved is stock the
 * shop believes it does not have.
 */
export async function repairBatch(
  writes: Partial<Record<RepairStoreName, unknown[]>>,
  deletes: Partial<Record<RepairStoreName, string[]>> = {}
): Promise<void> {
  const sink = captureSink;
  if (!sink) {
    await repairBatchRaw(writes, deletes);
    return;
  }
  const captured = await sink({ writes, deletes, before: await rowsBefore(writes, deletes) });
  if (captured.length === 0) {
    await repairBatchRaw(writes, deletes);
    return;
  }
  await repairBatchRaw({ ...writes, drive_ops: [...(writes.drive_ops ?? []), ...captured] }, deletes);
  writeListeners.forEach((listener) => listener());
}

/** repairBatch without change capture: for applying data received from the team. */
export async function repairBatchRaw(
  writes: Partial<Record<RepairStoreName, unknown[]>>,
  deletes: Partial<Record<RepairStoreName, string[]>> = {}
): Promise<void> {
  const stores = Array.from(
    new Set([...Object.keys(writes), ...Object.keys(deletes)])
  ) as RepairStoreName[];
  if (stores.length === 0) return;

  const db = await openRepairDb();
  const tx = db.transaction(stores, "readwrite");
  for (const store of stores) {
    const objectStore = tx.objectStore(store);
    for (const value of writes[store] ?? []) objectStore.put(value);
    for (const id of deletes[store] ?? []) objectStore.delete(id);
  }
  await txDone(tx);
}

export async function repairClearStores(stores: RepairStoreName[]): Promise<void> {
  if (stores.length === 0) return;
  const db = await openRepairDb();
  const tx = db.transaction(stores, "readwrite");
  for (const store of stores) tx.objectStore(store).clear();
  await txDone(tx);
}

/** Every store, team bookkeeping included: a device leaving a team with a wipe. */
export async function repairClearAll(): Promise<void> {
  await repairClearStores([...REPAIR_STORES]);
}

/**
 * Take the next job (or invoice) number and write the row that uses it, in one
 * transaction, along with anything else that has to land with it.
 *
 * The counter cannot be read in React and written back afterwards. The owner's
 * phone and the counter laptop can both take in a device in the same second,
 * read the same "next is 412", and both write JC-0412 — two customers' devices
 * under one number, which is exactly the confusion the job number exists to
 * prevent. Reading the settings row inside the same readwrite transaction that
 * writes the job is what makes that impossible.
 *
 * §4 also says a job number is never reused, so the counter advances on the
 * write and nothing ever hands it back — a cancelled job keeps its number and
 * leaves a gap, which is the correct outcome for a numbered register.
 */
export async function allocateNumber<T extends { id: string }>(
  field: "nextJobNumber" | "nextInvoiceNumber",
  targetStore: RepairStoreName,
  build: (next: number) => T,
  extra: Partial<Record<RepairStoreName, unknown[]>> = {}
): Promise<T> {
  const db = await openRepairDb();

  // In a team the new row's sync record must land in the same transaction.
  // The capture is async (photos are shrunk) and an IndexedDB transaction
  // cannot wait for it, so the record is built from a draft with a placeholder
  // number first, and the real number is written into it inside the
  // transaction once it is known.
  let draftOps: { id: string; op?: { type?: string; recordId?: string; fields?: Record<string, unknown> } }[] = [];
  let draft: T | null = null;
  if (captureSink) {
    draft = build(0);
    draftOps = (await captureSink({
      writes: { [targetStore]: [draft], ...extra },
      deletes: {},
      before: await rowsBefore(extra, {}),
    })) as typeof draftOps;
  }

  const stores = Array.from(
    new Set([
      "repairSettings",
      targetStore,
      ...Object.keys(extra),
      ...(draftOps.length ? ["drive_ops"] : []),
    ])
  ) as RepairStoreName[];

  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(stores, "readwrite");
    const settingsStore = tx.objectStore("repairSettings");
    const request = settingsStore.get("main") as IDBRequest<Record<string, unknown> | undefined>;
    let created: T | null = null;

    request.onsuccess = () => {
      const settings = request.result;
      const current = typeof settings?.[field] === "number" ? (settings[field] as number) : 1;
      created = build(current);
      tx.objectStore(targetStore).put(created);
      for (const [store, values] of Object.entries(extra)) {
        const objectStore = tx.objectStore(store as RepairStoreName);
        for (const value of values ?? []) objectStore.put(value);
      }
      // The row may not exist yet on a database whose settings were never
      // saved; put a minimal one rather than dropping the increment.
      settingsStore.put({ ...(settings ?? { id: "main" }), id: "main", [field]: current + 1 });

      if (draftOps.length && draft) {
        const real = created as unknown as Record<string, unknown>;
        const placeholder = draft as unknown as Record<string, unknown>;
        // Fields the number changed (jobNo, invoiceNo): copy them into the op.
        const numbered = Object.keys(real).filter(
          (key) => JSON.stringify(real[key]) !== JSON.stringify(placeholder[key])
        );
        const opsStore = tx.objectStore("drive_ops");
        for (const row of draftOps) {
          const op = row.op;
          if (op?.type === "put" && op.recordId === real.id && op.fields) {
            for (const key of numbered) op.fields[key] = real[key];
          }
          opsStore.put(row);
        }
      }
    };

    tx.oncomplete = () => {
      if (draftOps.length) writeListeners.forEach((listener) => listener());
      if (created) resolve(created);
      else reject(new Error("Could not allocate a number."));
    };
    tx.onerror = () => reject(tx.error ?? new Error("Could not save the job."));
    tx.onabort = () => reject(tx.error ?? new Error("Saving the job was aborted."));
  });
}
