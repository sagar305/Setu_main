// What Google Drive team sync shares between a shop's devices.
//
// The POS's own data always syncs. Toolkit data syncs for each tool the owner
// has switched on in POS → Tools, since those tools write into the same
// workspace database. Device-only data (held carts, PIN, Sheet sync URL,
// batches) never leaves the device.

import type { PosSettings } from "../types";

/** POS stores that always sync. */
export const CORE_STORES = [
  "business",
  "products",
  "categories",
  "customers",
  "orders",
  "order_items",
  "payments",
  "inventory",
  "settings",
] as const;

/** Extra stores each POS-connected tool (lib/pos/posTools) brings into sync. */
export const TOOL_STORES: Record<string, readonly string[]> = {
  "customer-ledger": ["ledger"],
  "cash-book": ["cashbook"],
  "expense-tracker": ["expenses"],
  "purchase-register": ["purchases", "purchase_returns"],
  "supplier-book": ["suppliers"],
  "supplier-ledger": ["supplier_ledger", "suppliers"],
  "receipt-designer": ["receipt_templates"],
};

/** Never synced, whatever is enabled. */
export const DEVICE_ONLY_STORES = ["held_carts", "sync_queue", "stock_batches"] as const;

/** Stores synced for a shop with these tools switched on. */
export function syncedStores(connectedTools: readonly string[] | undefined): Set<string> {
  const stores = new Set<string>(CORE_STORES);
  for (const slug of connectedTools ?? []) {
    for (const store of TOOL_STORES[slug] ?? []) stores.add(store);
  }
  return stores;
}

/**
 * Settings that belong to one device, not the shop: its own invoice counter
 * (each member has a series), PIN, idle lock, backups, Sheet sync, the
 * printer's paper size, and batch tracking (off while team sync is on).
 */
export const DEVICE_SETTINGS = [
  "nextInvoiceNumber",
  "lastBackupAt",
  "sheetSyncUrl",
  "pinHash",
  "pinSalt",
  "autoLockMinutes",
  "batchTracking",
  "receiptPaperSize",
  "toolTabs",
] as const satisfies readonly (keyof PosSettings)[];

type DeviceSettingKey = (typeof DEVICE_SETTINGS)[number];

export type SharedSettings = Omit<PosSettings, DeviceSettingKey>;

/** The part of settings that syncs to the rest of the shop. */
export function sharedSettings(settings: PosSettings): SharedSettings {
  const copy: Partial<PosSettings> = { ...settings };
  for (const key of DEVICE_SETTINGS) delete copy[key];
  return copy as SharedSettings;
}

/** Apply the shop's shared settings on this device, keeping its own ones. */
export function withSharedSettings(local: PosSettings, shared: Partial<SharedSettings>): PosSettings {
  const next: PosSettings = { ...local, ...shared, id: "main" };
  for (const key of DEVICE_SETTINGS) {
    (next as Record<string, unknown>)[key] = local[key];
  }
  next.batchTracking = false;
  return next;
}

/** Ledger entry id for a POS credit sale, the same on every device. */
export function creditLedgerId(orderId: string): string {
  return `pos-credit-${orderId}`;
}
