// Backup / restore for the Free Clinic Manager.
//
// The file covers only the clinic slices of the shared workspace (plus the
// business profile, which every tool reads). Restoring it therefore never
// touches the same browser's POS, invoices or tuition records.
//
// Backups matter more here than in any other Setu tool: this file is the only
// copy of a clinic's patient history, and it lives in one browser on one
// device. Settings nags for one.

import { dbBatch, dbClearStores, dbGetAll, type StoreName } from "@/lib/pos/db";

export const BACKUP_APP_MARKER = "setu-clinic";
export const BACKUP_VERSION = 1;

/**
 * Stores this backup owns. `business` is shared but included so a restore onto
 * a fresh device brings the clinic's own details along.
 */
export const CLINIC_BACKUP_STORES: StoreName[] = [
  "business",
  "clinic_doctors",
  "clinic_patients",
  "clinic_appointments",
  "clinic_visits",
  "clinic_medicines",
  "clinic_protocols",
  "clinic_charges",
  "clinic_bills",
  "clinic_settings",
];

export type ClinicBackup = {
  app: string;
  version: number;
  exportedAt: string;
  /** Only the stores the file actually contains — restore leaves the rest alone. */
  data: Partial<Record<StoreName, unknown[]>>;
};

export async function createBackup(): Promise<ClinicBackup> {
  const data: Partial<Record<StoreName, unknown[]>> = {};
  for (const store of CLINIC_BACKUP_STORES) {
    data[store] = await dbGetAll(store);
  }
  return {
    app: BACKUP_APP_MARKER,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
}

export function downloadBackupFile(backup: ClinicBackup): void {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `CLINIC_BACKUP_${backup.exportedAt.slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export type BackupValidation =
  | { ok: true; backup: ClinicBackup }
  | { ok: false; error: string };

export function validateBackup(raw: unknown): BackupValidation {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "This file is not a valid backup." };
  }
  const candidate = raw as Partial<ClinicBackup>;
  if (candidate.app !== BACKUP_APP_MARKER) {
    return { ok: false, error: "This file was not exported from the Clinic Manager." };
  }
  if (typeof candidate.version !== "number" || candidate.version > BACKUP_VERSION) {
    return { ok: false, error: "This backup was created by a newer version of the app." };
  }
  if (typeof candidate.data !== "object" || candidate.data === null) {
    return { ok: false, error: "This backup file is missing its data." };
  }
  return { ok: true, backup: candidate as ClinicBackup };
}

/** Parse and validate the text of an uploaded backup file. */
export function parseBackupFile(text: string): BackupValidation {
  try {
    return validateBackup(JSON.parse(text));
  } catch {
    return { ok: false, error: "This file is not readable JSON." };
  }
}

/** Count the records a backup holds, so restore can show what it will replace. */
export function backupSummary(backup: ClinicBackup): { label: string; count: number }[] {
  const labels: Partial<Record<StoreName, string>> = {
    clinic_patients: "Patients",
    clinic_visits: "Consultations",
    clinic_appointments: "Appointments",
    clinic_bills: "Bills",
    clinic_medicines: "Medicines",
    clinic_protocols: "Protocols",
    clinic_doctors: "Doctors",
  };
  return (Object.keys(labels) as StoreName[])
    .map((store) => ({
      label: labels[store] as string,
      count: Array.isArray(backup.data[store]) ? (backup.data[store] as unknown[]).length : 0,
    }))
    .filter((row) => row.count > 0);
}

/** Replace every store the file carries; stores it omits are left untouched. */
export async function restoreBackup(backup: ClinicBackup): Promise<void> {
  const present = CLINIC_BACKUP_STORES.filter((store) => Array.isArray(backup.data[store]));
  await dbClearStores(present);
  const writes: Partial<Record<StoreName, unknown[]>> = {};
  for (const store of present) {
    writes[store] = backup.data[store] ?? [];
  }
  await dbBatch(writes);
}
