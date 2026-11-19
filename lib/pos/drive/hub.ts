// The files a shop keeps in the owner's Google Drive, and how a device turns
// them into its local data. Pure — engine.ts does the network and IndexedDB.
//
// Why a hub: with the light `drive.file` permission an invited person can only
// open the files they picked, not a whole folder. So the owner's main device
// (the one that turned sync on) is the hub. It reads every member's changes
// file, merges them into its own data and publishes:
//   shop.json   — members, products and stock, customers, settings (everyone)
//   books.json  — sales, stock history, cost prices, tool data (owners only)
// Each member writes only their own changes-<code>.json.

import type { Order, PosSettings, Product } from "../types";
import { mergeShop, type MergedState, type RejectedOp } from "./merge";
import type { ChangesFile, Member, Op, ShopBase, SyncRecord } from "./ops";
import { sharedSettings, withSharedSettings, type SharedSettings } from "./scope";

export const TEAM_APP = "setu-pos-team";
export const TEAM_FILE_VERSION = 1;

export type TeamMember = Member & {
  /** Drive id of this member's changes file. */
  fileId: string;
  /** Display name the owner typed, optional. */
  name?: string;
  /**
   * Mobile number (country code + digits) for WhatsApp invites. Private to
   * owners: never written to shop.json, which cashiers can read.
   */
  phone?: string;
};

export type Catalog = {
  business: SyncRecord | null;
  settings: Partial<SharedSettings>;
  categories: SyncRecord[];
  payments: SyncRecord[];
  /** Cost prices removed: cashiers can open this file. */
  products: Product[];
  customers: SyncRecord[];
};

export type ShopFile = {
  app: typeof TEAM_APP;
  version: number;
  shopName: string;
  updatedAt: string;
  /** Code of the owner whose device is the hub. */
  primaryCode: string;
  /** Google account that owns the shop's files (only it can run the hub). */
  primaryEmail?: string;
  /** The device currently acting as the hub ("main device"). */
  hubDeviceId?: string;
  members: TeamMember[];
  /**
   * How many operations the hub has applied, per member device:
   * key `${memberCode}/${deviceId}` (see consumedKey).
   */
  consumed: Record<string, number>;
  catalog: Catalog;
};

export type BooksFile = {
  app: typeof TEAM_APP;
  version: number;
  updatedAt: string;
  productCosts: Record<string, number | null>;
  orderAuthors: Record<string, string>;
  /** Staff mobile numbers by member code (owners only, like this file). */
  memberPhones?: Record<string, string>;
  /** orders, order_items, inventory and every synced tool store. */
  records: Record<string, SyncRecord[]>;
};

/**
 * A member's changes file. Each of their devices writes only its own section,
 * so one person can bill on a phone and a tablet without overwriting each
 * other. `ops` is the single-list layout of the first version.
 */
export type ChangesFileBody = {
  app: typeof TEAM_APP;
  memberCode: string;
  devices?: Record<string, Op[]>;
  ops?: Op[];
};

const LEGACY_DEVICE = "legacy";

/** Key for the hub's per-device progress. */
export function consumedKey(memberCode: string, deviceId: string): string {
  return `${memberCode}/${deviceId}`;
}

/** Every device section of a changes file (old single-list files included). */
export function deviceSections(body: ChangesFileBody | null | undefined): Record<string, Op[]> {
  const sections: Record<string, Op[]> = { ...(body?.devices ?? {}) };
  if (body?.ops?.length) sections[LEGACY_DEVICE] = [...(sections[LEGACY_DEVICE] ?? []), ...body.ops];
  return sections;
}

/**
 * This device's section written into the file, keeping every other device's.
 * Used for read-modify-write uploads; if two devices write at the same time
 * and one is lost, that device re-uploads on its next sync.
 */
export function withDeviceSection(
  body: ChangesFileBody | null | undefined,
  memberCode: string,
  deviceId: string,
  ops: Op[],
): ChangesFileBody {
  return { app: TEAM_APP, memberCode, devices: { ...deviceSections(body), [deviceId]: ops } };
}

/**
 * New operations per device the hub hasn't applied yet, and the updated
 * progress. Returns one ChangesFile per member (merge only needs the member).
 */
export function freshOps(
  memberCode: string,
  body: ChangesFileBody,
  consumed: Record<string, number>,
): { ops: Op[]; consumed: Record<string, number> } {
  const next = { ...consumed };
  const ops: Op[] = [];
  for (const [deviceId, list] of Object.entries(deviceSections(body))) {
    const key = consumedKey(memberCode, deviceId);
    // First-version progress was kept per member, not per device.
    const done = next[key] ?? (deviceId === LEGACY_DEVICE ? consumed[memberCode] ?? 0 : 0);
    ops.push(...list.slice(done));
    next[key] = list.length;
  }
  return { ops, consumed: next };
}

/** Every store a device reads to build or apply a snapshot. */
export type LocalSnapshot = Record<string, SyncRecord[]>;

const CATALOG_STORES = ["business", "settings", "categories", "payments", "products", "customers"];
const BOOK_STORES = ["orders", "order_items", "inventory"];

export function isShopFile(value: unknown): value is ShopFile {
  const v = value as Partial<ShopFile> | null;
  return !!v && v.app === TEAM_APP && Array.isArray(v.members) && !!v.catalog;
}

/** The hub's local data as a merge base. */
export function baseFromLocal(
  local: LocalSnapshot,
  members: Member[],
  synced: ReadonlySet<string>,
  orderAuthors: Record<string, string>,
): ShopBase {
  const records: Record<string, SyncRecord[]> = {};
  for (const store of synced) {
    if (store === "products" || store === "customers") continue;
    records[store] = local[store] ?? [];
  }
  return {
    members,
    products: (local.products ?? []) as unknown as Product[],
    customers: (local.customers ?? []) as never,
    records,
    orderAuthors,
    cutoff: null,
  };
}

/** A member's merge base, from what the hub last published. */
export function baseFromPublished(shop: ShopFile, books: BooksFile | null): ShopBase {
  const products = shop.catalog.products.map((p) => ({
    ...p,
    costPrice: books ? books.productCosts[p.id] ?? null : null,
  }));
  const records: Record<string, SyncRecord[]> = {
    business: shop.catalog.business ? [shop.catalog.business] : [],
    settings: [{ ...shop.catalog.settings, id: "main" } as SyncRecord],
    categories: shop.catalog.categories,
    payments: shop.catalog.payments,
    ...(books?.records ?? {}),
  };
  return {
    members: shop.members,
    products,
    customers: shop.catalog.customers as never,
    records,
    orderAuthors: books?.orderAuthors ?? {},
    cutoff: null,
  };
}

/** Merge new operations into a base; author codes come from file ownership. */
export function mergeInto(base: ShopBase, files: ChangesFile[]): MergedState {
  return mergeShop(base, files);
}

/** Merged state as store → rows, ready to compare with the device. */
export function mergedStores(merged: MergedState): LocalSnapshot {
  return {
    ...merged.records,
    products: merged.products as unknown as SyncRecord[],
    customers: merged.customers as unknown as SyncRecord[],
    orders: merged.orders as unknown as SyncRecord[],
    order_items: merged.orderItems as unknown as SyncRecord[],
    inventory: merged.inventoryLog as unknown as SyncRecord[],
  };
}

export type ApplyPlan = {
  writes: Record<string, SyncRecord[]>;
  deletes: Record<string, string[]>;
};

/**
 * What to write so the device's `stores` match `target`. Unchanged rows are
 * skipped. Settings keep this device's own fields; products keep the photo
 * this device has (photos don't sync).
 */
export function planApply(local: LocalSnapshot, target: LocalSnapshot, stores: readonly string[]): ApplyPlan {
  const writes: Record<string, SyncRecord[]> = {};
  const deletes: Record<string, string[]> = {};
  for (const store of stores) {
    if (!(store in target)) continue;
    const current = new Map((local[store] ?? []).map((r) => [r.id, r]));
    const wanted = new Map(target[store].map((r) => [r.id, r]));
    const put: SyncRecord[] = [];
    for (const [id, row] of wanted) {
      let next = row;
      const mine = current.get(id);
      if (store === "settings" && mine) {
        next = withSharedSettings(mine as unknown as PosSettings, row as never) as unknown as SyncRecord;
      }
      if (store === "products" && mine && typeof mine.imageDataUrl === "string") {
        next = { ...row, imageDataUrl: mine.imageDataUrl };
      }
      if (!mine || JSON.stringify(mine) !== JSON.stringify(next)) put.push(next);
    }
    const gone = Array.from(current.keys()).filter((id) => !wanted.has(id));
    if (put.length) writes[store] = put;
    // Never delete this device's own settings or business profile.
    if (gone.length && store !== "settings" && store !== "business") deletes[store] = gone;
  }
  return { writes, deletes };
}

/** shop.json from the hub's data. */
export function buildShopFile(
  local: LocalSnapshot,
  shopName: string,
  primaryCode: string,
  members: TeamMember[],
  consumed: Record<string, number>,
  now: string,
  hub?: { deviceId: string; primaryEmail: string },
): ShopFile {
  const settings = (local.settings ?? []).find((s) => s.id === "main") as unknown as PosSettings | undefined;
  return {
    app: TEAM_APP,
    version: TEAM_FILE_VERSION,
    shopName,
    updatedAt: now,
    primaryCode,
    ...(hub ? { hubDeviceId: hub.deviceId, primaryEmail: hub.primaryEmail } : {}),
    // Cashiers can read this file: keep staff phone numbers out of it.
    members: members.map(({ phone: _phone, ...member }) => member),
    consumed,
    catalog: {
      business: (local.business ?? []).find((b) => b.id === "main") ?? null,
      settings: settings ? sharedSettings(settings) : {},
      categories: local.categories ?? [],
      payments: local.payments ?? [],
      products: ((local.products ?? []) as unknown as Product[]).map((p) => ({
        ...p,
        costPrice: null,
        imageDataUrl: "",
      })),
      customers: local.customers ?? [],
    },
  };
}

/** books.json from the hub's data (owners only). */
export function buildBooksFile(
  local: LocalSnapshot,
  synced: ReadonlySet<string>,
  orderAuthors: Record<string, string>,
  now: string,
  members: TeamMember[] = [],
): BooksFile {
  const records: Record<string, SyncRecord[]> = {};
  for (const store of synced) {
    if (CATALOG_STORES.includes(store)) continue;
    records[store] = local[store] ?? [];
  }
  for (const store of BOOK_STORES) records[store] = local[store] ?? [];
  const productCosts: Record<string, number | null> = {};
  for (const p of (local.products ?? []) as unknown as Product[]) productCosts[p.id] = p.costPrice ?? null;
  const memberPhones: Record<string, string> = {};
  for (const m of members) if (m.phone) memberPhones[m.code] = m.phone;
  return { app: TEAM_APP, version: TEAM_FILE_VERSION, updatedAt: now, productCosts, orderAuthors, memberPhones, records };
}

/** Which stores a member device replaces from the published files. */
export function memberStores(role: Member["role"], synced: ReadonlySet<string>): string[] {
  if (role !== "owner") return [...CATALOG_STORES];
  return Array.from(new Set([...CATALOG_STORES, ...BOOK_STORES, ...synced]));
}

/** Order authors for orders already on the hub before sync was turned on. */
export function authorsForExisting(orders: Order[], code: string, known: Record<string, string>) {
  const out = { ...known };
  for (const o of orders) if (!out[o.id]) out[o.id] = code;
  return out;
}

export type { RejectedOp };
