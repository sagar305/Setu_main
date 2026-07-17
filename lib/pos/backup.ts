import { STORES, dbClearAll, dbBatch, dbGetAll, type StoreName } from "./db";

export const BACKUP_APP_MARKER = "setu-free-pos";
export const BACKUP_VERSION = 1;

export type PosBackup = {
  app: string;
  version: number;
  exportedAt: string;
  data: Record<StoreName, unknown[]>;
};

/** Read every store and produce the POS_BACKUP.json payload. */
export async function createBackup(): Promise<PosBackup> {
  const data = {} as Record<StoreName, unknown[]>;
  for (const store of STORES) {
    data[store] = await dbGetAll(store);
  }
  return {
    app: BACKUP_APP_MARKER,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
}

export function downloadBackupFile(backup: PosBackup): void {
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "POS_BACKUP.json";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export type BackupValidation =
  | { ok: true; backup: PosBackup }
  | { ok: false; error: string };

/** Validate a parsed JSON payload before restoring. Handles corrupted files gracefully. */
export function validateBackup(raw: unknown): BackupValidation {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "This file is not a valid POS backup." };
  }
  const candidate = raw as Partial<PosBackup>;
  if (candidate.app !== BACKUP_APP_MARKER) {
    return { ok: false, error: "This file was not exported from this POS." };
  }
  if (typeof candidate.version !== "number" || candidate.version > BACKUP_VERSION) {
    return { ok: false, error: "This backup was created by a newer version of the POS." };
  }
  if (typeof candidate.data !== "object" || candidate.data === null) {
    return { ok: false, error: "The backup file is missing its data section." };
  }
  const data = candidate.data as Record<string, unknown>;
  for (const store of STORES) {
    if (data[store] !== undefined && !Array.isArray(data[store])) {
      return { ok: false, error: `The backup section "${store}" is corrupted.` };
    }
  }
  const records = data as Record<StoreName, unknown[] | undefined>;
  for (const record of records.business ?? []) {
    const business = record as { name?: unknown };
    if (typeof business?.name !== "string") {
      return { ok: false, error: "The business profile in this backup is corrupted." };
    }
  }
  for (const record of records.products ?? []) {
    const product = record as { id?: unknown; name?: unknown };
    if (typeof product?.id !== "string" || typeof product?.name !== "string") {
      return { ok: false, error: "A product record in this backup is corrupted." };
    }
  }
  return {
    ok: true,
    backup: {
      app: BACKUP_APP_MARKER,
      version: candidate.version,
      exportedAt: typeof candidate.exportedAt === "string" ? candidate.exportedAt : "",
      data: STORES.reduce((acc, store) => {
        acc[store] = (records[store] ?? []) as unknown[];
        return acc;
      }, {} as Record<StoreName, unknown[]>),
    },
  };
}

export function parseBackupFile(text: string): BackupValidation {
  try {
    return validateBackup(JSON.parse(text));
  } catch {
    return { ok: false, error: "Could not read this file — it is not valid JSON." };
  }
}

/** Replace the entire database with the backup contents. */
export async function restoreBackup(backup: PosBackup): Promise<void> {
  await dbClearAll();
  await dbBatch(backup.data);
}
