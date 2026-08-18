// Backup / restore for the Tuition Class Manager.
//
// The file covers only the tuition slices of the shared workspace (plus the
// business profile, which every tool reads). Restoring it therefore never
// touches a teacher's POS, invoices or expenses in the same browser.

import { dbBatch, dbClearStores, dbGetAll, type StoreName } from "@/lib/pos/db";

export const BACKUP_APP_MARKER = "setu-tuition";
export const BACKUP_VERSION = 1;

/** Stores this backup owns. `business` is shared but included so a restore
 *  onto a fresh device brings the teacher's own details along. */
export const TUITION_STORES: StoreName[] = [
  "business",
  "students",
  "batches",
  "attendance",
  "fee_dues",
  "fee_payments",
  "tests",
  "marks",
  "student_notes",
  "enquiries",
  "holidays",
  "tuition_settings",
];

export type TuitionBackup = {
  app: string;
  version: number;
  exportedAt: string;
  /** Only the stores the file actually contains — restore leaves the rest alone. */
  data: Partial<Record<StoreName, unknown[]>>;
};

export async function createBackup(): Promise<TuitionBackup> {
  const data: Partial<Record<StoreName, unknown[]>> = {};
  for (const store of TUITION_STORES) {
    data[store] = await dbGetAll(store);
  }
  return {
    app: BACKUP_APP_MARKER,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
}

export function downloadBackupFile(backup: TuitionBackup): void {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "TUITION_BACKUP.json";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export type BackupValidation =
  | { ok: true; backup: TuitionBackup }
  | { ok: false; error: string };

export function validateBackup(raw: unknown): BackupValidation {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "This file is not a valid backup." };
  }
  const candidate = raw as Partial<TuitionBackup>;
  if (candidate.app !== BACKUP_APP_MARKER) {
    return { ok: false, error: "This file was not exported from the Tuition Class Manager." };
  }
  if (typeof candidate.version !== "number" || candidate.version > BACKUP_VERSION) {
    return { ok: false, error: "This backup was created by a newer version of the app." };
  }
  if (typeof candidate.data !== "object" || candidate.data === null) {
    return { ok: false, error: "This backup file is missing its data." };
  }
  return { ok: true, backup: candidate as TuitionBackup };
}

/** Parse and validate the text of an uploaded backup file. */
export function parseBackupFile(text: string): BackupValidation {
  try {
    return validateBackup(JSON.parse(text));
  } catch {
    return { ok: false, error: "This file is not readable JSON." };
  }
}

/** Replace every store the file carries; stores it omits are left untouched. */
export async function restoreBackup(backup: TuitionBackup): Promise<void> {
  const present = TUITION_STORES.filter((store) => Array.isArray(backup.data[store]));
  await dbClearStores(present);
  const writes: Partial<Record<StoreName, unknown[]>> = {};
  for (const store of present) {
    writes[store] = backup.data[store] ?? [];
  }
  await dbBatch(writes);
}
