// Backup / restore for the repair job card.
//
// Same shape as the queue, clinic, dine and rental backups, so a user who has
// met one of these files already knows what this one is. The file covers the
// repair database only; the business profile rides along because a restore onto
// a fresh device should bring the name that prints on the job slip with it.
//
// The photos are what make this backup different from every other one on the
// site. Four intake photos per job at ~120 KB each is roughly half a megabyte a
// job, so a shop with 500 jobs on the books has a 250 MB backup — a file that
// browsers will write but that people struggle to email or keep in a folder
// they can find. So the export asks.

import {
  repairBatch,
  repairClearStores,
  repairGetAll,
  REPAIR_STORES,
  type RepairStoreName,
} from "./db";
import { dbBatch, dbGetAll } from "@/lib/pos/db";
import type { Business } from "@/lib/pos/types";
import type { Job } from "./types";

export const BACKUP_APP_MARKER = "setu-repair";
export const BACKUP_VERSION = 1;

export const REPAIR_BACKUP_STORES: RepairStoreName[] = [...REPAIR_STORES];

export type RepairBackup = {
  app: string;
  version: number;
  exportedAt: string;
  /** False when intake photos were left out to keep the file small. */
  includesPhotos: boolean;
  /** The shared business profile, carried along but stored outside this DB. */
  business: Business | null;
  data: Partial<Record<RepairStoreName, unknown[]>>;
};

/**
 * Photos default in.
 *
 * A backup of an evidence record that quietly drops the evidence is not a
 * backup of it — a shop restoring after a lost phone would find every job intact
 * and every photo gone, which is the one thing they cannot re-create. The
 * smaller file is offered as a deliberate choice with its consequence spelled
 * out, not taken on their behalf.
 *
 * OPEN QUESTION (spec §9.4): confirm photos-in is the right default given the
 * file sizes above, or whether the default should flip once a shop passes some
 * number of jobs.
 */
export async function createBackup(options: { includePhotos?: boolean } = {}): Promise<RepairBackup> {
  const includePhotos = options.includePhotos !== false;
  const data: Partial<Record<RepairStoreName, unknown[]>> = {};

  for (const store of REPAIR_BACKUP_STORES) {
    const rows = await repairGetAll(store);
    data[store] =
      store === "jobs" && !includePhotos
        ? (rows as Job[]).map((job) => ({ ...job, intakePhotos: [] }))
        : rows;
  }

  const business = (await dbGetAll<Business>("business")).find((row) => row.id === "main") ?? null;
  return {
    app: BACKUP_APP_MARKER,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    includesPhotos: includePhotos,
    business,
    data,
  };
}

export function downloadBackupFile(backup: RepairBackup): void {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `setu-repair-backup-${backup.exportedAt.slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export type BackupValidation =
  | { ok: true; backup: RepairBackup }
  | { ok: false; error: string };

export function validateBackup(raw: unknown): BackupValidation {
  if (!raw || typeof raw !== "object") return { ok: false, error: "That file is not a backup." };
  const candidate = raw as Partial<RepairBackup>;
  if (candidate.app !== BACKUP_APP_MARKER) {
    return {
      ok: false,
      error: "That backup belongs to a different Setu app. Restore it from that app instead.",
    };
  }
  if (typeof candidate.version !== "number" || candidate.version > BACKUP_VERSION) {
    return {
      ok: false,
      error: "That backup was made by a newer version of the job card than this one.",
    };
  }
  if (!candidate.data || typeof candidate.data !== "object") {
    return { ok: false, error: "That backup file has no data in it." };
  }
  return { ok: true, backup: candidate as RepairBackup };
}

export function parseBackupFile(text: string): BackupValidation {
  try {
    return validateBackup(JSON.parse(text));
  } catch {
    return { ok: false, error: "That file could not be read as a backup." };
  }
}

export function backupSummary(backup: RepairBackup): { label: string; count: number }[] {
  const labels: Record<RepairStoreName, string> = {
    customers: "Customers",
    jobs: "Jobs",
    parts: "Parts",
    technicians: "Technicians",
    bills: "Bills",
    repairSettings: "Settings",
  };
  return REPAIR_BACKUP_STORES.map((store) => ({
    label: labels[store],
    count: (backup.data[store] ?? []).length,
  }));
}

/**
 * Replace the job card with the contents of a backup.
 *
 * Stores present in the file are cleared and rewritten; stores absent from it
 * are left exactly as they are, so an older backup missing a store cannot
 * silently wipe one. The business profile is only written when the device does
 * not already have one — a restore should not rename a business that is already
 * using the POS under a different name.
 */
export async function restoreBackup(backup: RepairBackup): Promise<void> {
  const present = REPAIR_BACKUP_STORES.filter((store) => Array.isArray(backup.data[store]));
  await repairClearStores(present);

  const writes: Partial<Record<RepairStoreName, unknown[]>> = {};
  for (const store of present) writes[store] = backup.data[store] ?? [];
  await repairBatch(writes);

  if (backup.business) {
    const existing = (await dbGetAll<Business>("business")).find((row) => row.id === "main");
    if (!existing) await dbBatch({ business: [backup.business] });
  }
}
