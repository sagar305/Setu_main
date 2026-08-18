// Backup and restore for Free Dine.
//
// A browser-only product has exactly one failure mode that loses a
// restaurant's year: someone clears site data. Backup is the mitigation, so
// the file is plain JSON, restores into a fresh browser with no account, and
// carries its own marker so a Browser Based POS backup can never be restored
// over a Dine database by mistake.

import { DINE_STORES, dineBatch, dineClearStores, dineGetAll, type DineStoreName } from "./db";

export const DINE_BACKUP_MARKER = "setu-free-dine";
export const DINE_BACKUP_VERSION = 1;

export type DineBackup = {
  app: string;
  version: number;
  exportedAt: string;
  /**
   * Only the stores this backup actually carries. Restore leaves any store
   * absent here untouched, so a partial payload (e.g. a Google Sheet pull that
   * predates a new store) never wipes data it simply doesn't know about.
   */
  data: Partial<Record<DineStoreName, unknown[]>>;
};

export async function createDineBackup(): Promise<DineBackup> {
  const data = {} as Record<DineStoreName, unknown[]>;
  for (const store of DINE_STORES) {
    data[store] = await dineGetAll(store);
  }
  return {
    app: DINE_BACKUP_MARKER,
    version: DINE_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
}

export function downloadDineBackup(backup: DineBackup): void {
  const stamp = backup.exportedAt.slice(0, 10);
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `DINE_BACKUP_${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export type DineBackupValidation =
  | { ok: true; backup: DineBackup }
  | { ok: false; error: string };

export function validateDineBackup(raw: unknown): DineBackupValidation {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "This file is not a valid Free Dine backup." };
  }
  const candidate = raw as Partial<DineBackup>;
  if (candidate.app !== DINE_BACKUP_MARKER) {
    return {
      ok: false,
      error:
        candidate.app === "setu-free-pos"
          ? "This is a Browser Based POS backup. Free Dine keeps its own separate data and cannot restore it."
          : "This file was not exported from Free Dine.",
    };
  }
  if (typeof candidate.version !== "number" || candidate.version > DINE_BACKUP_VERSION) {
    return { ok: false, error: "This backup was created by a newer version of Free Dine." };
  }
  if (typeof candidate.data !== "object" || candidate.data === null) {
    return { ok: false, error: "The backup file is missing its data section." };
  }

  const data = candidate.data as Record<string, unknown>;
  for (const store of DINE_STORES) {
    if (data[store] !== undefined && !Array.isArray(data[store])) {
      return { ok: false, error: `The backup section "${store}" is corrupted.` };
    }
  }

  const records = data as Record<DineStoreName, unknown[] | undefined>;
  for (const record of records.dine_business ?? []) {
    if (typeof (record as { name?: unknown })?.name !== "string") {
      return { ok: false, error: "The restaurant profile in this backup is corrupted." };
    }
  }
  for (const record of records.dine_menu_items ?? []) {
    const item = record as { id?: unknown; name?: unknown };
    if (typeof item?.id !== "string" || typeof item?.name !== "string") {
      return { ok: false, error: "A menu item in this backup is corrupted." };
    }
  }

  return {
    ok: true,
    backup: {
      app: DINE_BACKUP_MARKER,
      version: candidate.version,
      exportedAt: typeof candidate.exportedAt === "string" ? candidate.exportedAt : "",
      data: DINE_STORES.reduce((acc, store) => {
        if (records[store] !== undefined) acc[store] = records[store] as unknown[];
        return acc;
      }, {} as Partial<Record<DineStoreName, unknown[]>>),
    },
  };
}

export function parseDineBackupFile(text: string): DineBackupValidation {
  try {
    return validateDineBackup(JSON.parse(text));
  } catch {
    return { ok: false, error: "Could not read this file — it is not valid JSON." };
  }
}

export async function restoreDineBackup(backup: DineBackup): Promise<void> {
  await dineClearStores(Object.keys(backup.data) as DineStoreName[]);
  await dineBatch(backup.data);
}

/** Days since the last backup, or null if there has never been one. */
export function daysSinceBackup(lastBackupAt: string | null): number | null {
  if (!lastBackupAt) return null;
  const then = new Date(lastBackupAt).getTime();
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / (24 * 60 * 60 * 1000));
}

/** FR-10.3: nag gently once a week, never on the first day of use. */
export function shouldPromptBackup(lastBackupAt: string | null, hasSales: boolean): boolean {
  if (!hasSales) return false;
  const days = daysSinceBackup(lastBackupAt);
  return days === null || days >= 7;
}
