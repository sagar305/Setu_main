// Backup / restore for the rental book.
//
// The file covers the rental database only. The business profile is included
// because a restore onto a fresh device should bring the name that appears on
// the challan and the quotation with it — but restoring never touches the same
// browser's POS, invoices or patient records.
//
// Same shape as the queue, clinic and dine backups, so a user who has met one
// of these files already knows what this one is.

import {
  rentalBatch,
  rentalClearStores,
  rentalGetAll,
  RENTAL_STORES,
  type RentalStoreName,
} from "./db";
import { dbBatch, dbGetAll } from "@/lib/pos/db";
import type { Business } from "@/lib/pos/types";

export const BACKUP_APP_MARKER = "setu-rental";
export const BACKUP_VERSION = 1;

export const RENTAL_BACKUP_STORES: RentalStoreName[] = [...RENTAL_STORES];

export type RentalBackup = {
  app: string;
  version: number;
  exportedAt: string;
  /** The shared business profile, carried along but stored outside this DB. */
  business: Business | null;
  data: Partial<Record<RentalStoreName, unknown[]>>;
};

export async function createBackup(): Promise<RentalBackup> {
  const data: Partial<Record<RentalStoreName, unknown[]>> = {};
  for (const store of RENTAL_BACKUP_STORES) {
    data[store] = await rentalGetAll(store);
  }
  const business = (await dbGetAll<Business>("business")).find((row) => row.id === "main") ?? null;
  return {
    app: BACKUP_APP_MARKER,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    business,
    data,
  };
}

export function downloadBackupFile(backup: RentalBackup): void {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `setu-rental-backup-${backup.exportedAt.slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export type BackupValidation =
  | { ok: true; backup: RentalBackup }
  | { ok: false; error: string };

export function validateBackup(raw: unknown): BackupValidation {
  if (!raw || typeof raw !== "object") return { ok: false, error: "That file is not a backup." };
  const candidate = raw as Partial<RentalBackup>;
  if (candidate.app !== BACKUP_APP_MARKER) {
    return {
      ok: false,
      error: "That backup belongs to a different Setu app. Restore it from that app instead.",
    };
  }
  if (typeof candidate.version !== "number" || candidate.version > BACKUP_VERSION) {
    return {
      ok: false,
      error: "That backup was made by a newer version of the rental book than this one.",
    };
  }
  if (!candidate.data || typeof candidate.data !== "object") {
    return { ok: false, error: "That backup file has no data in it." };
  }
  return { ok: true, backup: candidate as RentalBackup };
}

export function parseBackupFile(text: string): BackupValidation {
  try {
    return validateBackup(JSON.parse(text));
  } catch {
    return { ok: false, error: "That file could not be read as a backup." };
  }
}

export function backupSummary(backup: RentalBackup): { label: string; count: number }[] {
  const labels: Record<RentalStoreName, string> = {
    itemCategories: "Categories",
    items: "Items",
    itemUnits: "Units",
    customers: "Customers",
    bookings: "Bookings",
    maintenanceLogs: "Maintenance logs",
    rentalSettings: "Settings",
  };
  return RENTAL_BACKUP_STORES.map((store) => ({
    label: labels[store],
    count: (backup.data[store] ?? []).length,
  }));
}

/**
 * Replace the rental book with the contents of a backup.
 *
 * Stores present in the file are cleared and rewritten; stores absent from it
 * are left exactly as they are, so an older backup missing a store cannot
 * silently wipe one. The business profile is only written when the device does
 * not already have one — a restore should not rename a business that is already
 * using the POS under a different name.
 */
export async function restoreBackup(backup: RentalBackup): Promise<void> {
  const present = RENTAL_BACKUP_STORES.filter((store) => Array.isArray(backup.data[store]));
  await rentalClearStores(present);

  const writes: Partial<Record<RentalStoreName, unknown[]>> = {};
  for (const store of present) writes[store] = backup.data[store] ?? [];
  await rentalBatch(writes);

  if (backup.business) {
    const existing = (await dbGetAll<Business>("business")).find((row) => row.id === "main");
    if (!existing) await dbBatch({ business: [backup.business] });
  }
}
