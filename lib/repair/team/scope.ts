// What team sync shares between a repair shop's devices, and what stays on
// each device.

/**
 * Settings that belong to one device, not the shop: its own job and invoice
 * counters (each device has a number series), its PIN and idle lock, its
 * backups and Sheet sync, and its printer's paper.
 */
export const DEVICE_SETTINGS = [
  "nextJobNumber",
  "nextInvoiceNumber",
  "lastBackupAt",
  "sheetSyncUrl",
  "pinHash",
  "pinSalt",
  "autoLockMinutes",
  "receiptPaperSize",
  "slipPaperSize",
  "slipA4Layout",
] as const;

/** The shop-wide part of a settings row. */
export function sharedSettings<T extends Record<string, unknown>>(settings: T): Record<string, unknown> {
  const out: Record<string, unknown> = { ...settings };
  delete out.id;
  for (const key of DEVICE_SETTINGS) delete out[key];
  return out;
}

/** A settings row from the team, with this device's own fields kept. */
export function withSharedSettings(
  mine: Record<string, unknown> | undefined,
  shared: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(mine ?? {}), ...sharedSettings(shared), id: "main" };
  if (mine) for (const key of DEVICE_SETTINGS) if (key in mine) out[key] = mine[key];
  return out;
}

/** Job fields that carry pictures: big, so they travel shrunk and separately. */
export const MEDIA_FIELDS = ["intakePhotos", "intakeSignatureDataUrl", "deliverySignatureDataUrl"] as const;
