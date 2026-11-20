// The files a shop keeps in the owner's Google Drive (format v2), and how a
// device turns them into its local data. Pure — engine.ts does the network,
// encryption (crypto.ts) and IndexedDB.
//
// Why a hub: with the light `drive.file` permission an invited person can only
// open files they picked once, so the set of files is fixed when they join.
// The owner's main device (the hub) reads every member's changes file, merges
// them into its own data and publishes. Every file is encrypted:
//
//   live.json     shop key   stock, team list, merge progress  — small, every sync
//   catalog.json  shop key   products (no cost/stock), customers' name + phone,
//                            business and shared settings      — when it changes
//   books.json    books key  current orders (< 500), cost prices, full customer
//                            details, tool data, staff phones  — owners only
//   archive.json  books key  older orders and stock history    — rewritten about
//                                                                once per 500 orders
//   changes-<code>.json  shop key  each member device's section of changes,
//                                  trimmed once the hub has merged them
//
// Cashiers open live, catalog and their own changes file; owners also books
// and archive.

import type { Customer, InventoryLog, Order, OrderItem, PosSettings, Product } from "../types";
import { mergeShop, type MergedState, type RejectedOp } from "./merge";
import type { ChangesFile, Member, Op, ShopBase, SyncRecord } from "./ops";
import { sharedSettings, withSharedSettings, type SharedSettings } from "./scope";

export const TEAM_APP = "setu-pos-team";
export const TEAM_FILE_VERSION = 2;

/** People in one shop's team, the owner included. */
export const MAX_TEAM_SIZE = 5;

/** Current orders stay in books.json until this many, then move to the archive. */
export const ORDER_CHUNK = 500;
/** Same for stock-history entries. */
export const STOCK_LOG_CHUNK = 1500;

/** Encryption labels, binding each file's content to its role. */
export const FILE_LABEL = {
  live: "live",
  catalog: "catalog",
  books: "books",
  archive: "archive",
  changes: (code: string) => `changes:${code}`,
} as const;

export type TeamMember = Member & {
  /** Drive id of this member's changes file. */
  fileId: string;
  /** Display name the owner typed, optional. */
  name?: string;
  /** Mobile number for WhatsApp invites. Owners only: kept in books.json. */
  phone?: string;
};

export type ShopFileIds = {
  live: string;
  catalog: string;
  books: string;
  archive: string;
};

/** Small, changes every sync. Everyone can open it. */
export type LiveFile = {
  version: typeof TEAM_FILE_VERSION;
  shopName: string;
  updatedAt: string;
  primaryCode: string;
  primaryEmail: string;
  hubDeviceId: string;
  members: TeamMember[];
  /** Operations applied per member device: key `${code}/${deviceId}`. */
  consumed: Record<string, number>;
  /** Stock on hand by product id. */
  stock: Record<string, number>;
  files: ShopFileIds;
  /** Fingerprints of the other files, so devices download only what changed. */
  revs: { catalog: string; books: string; archive: string };
};

export type CustomerSummary = Pick<Customer, "id" | "name" | "phone" | "createdAt">;

/** Changes when the catalog does. Everyone can open it. */
export type CatalogFile = {
  version: typeof TEAM_FILE_VERSION;
  business: SyncRecord | null;
  settings: Partial<SharedSettings>;
  categories: SyncRecord[];
  payments: SyncRecord[];
  /** Without cost price, photo or stock (stock is in live.json). */
  products: Product[];
  /** Only what billing needs: name and phone. Full details are in books.json. */
  customers: CustomerSummary[];
};

export type HistoryPart = {
  orders: Order[];
  order_items: OrderItem[];
  inventory: InventoryLog[];
  /** Who made each of these orders (order id → member code). */
  orderAuthors: Record<string, string>;
};

/** Owners only. */
export type BooksFile = {
  version: typeof TEAM_FILE_VERSION;
  productCosts: Record<string, number | null>;
  memberPhones: Record<string, string>;
  /** Full customer records. */
  customers: SyncRecord[];
  /** Data of tools switched on from the POS (ledger, cash book, ...). */
  records: Record<string, SyncRecord[]>;
  /** The newest orders and stock history (the rest is in archive.json). */
  open: HistoryPart;
};

/** Owners only; rewritten about once per ORDER_CHUNK orders. */
export type ArchiveFile = { version: typeof TEAM_FILE_VERSION } & HistoryPart;

/** One device's not-yet-trimmed changes; `base` = how many earlier ones were trimmed. */
export type DeviceSection = { base: number; ops: Op[] };

export type ChangesFileBody = {
  memberCode: string;
  devices: Record<string, DeviceSection>;
};

// ---------------------------------------------------------------------------
// Changes files and merge progress
// ---------------------------------------------------------------------------

/** Key for the hub's per-device progress. */
export function consumedKey(memberCode: string, deviceId: string): string {
  return `${memberCode}/${deviceId}`;
}

export function deviceSections(body: ChangesFileBody | null | undefined): Record<string, DeviceSection> {
  return { ...(body?.devices ?? {}) };
}

/**
 * This device's section written into the file, keeping every other device's.
 * If two devices of one person write at the same time and one is lost, that
 * device re-uploads on its next sync.
 */
export function withDeviceSection(
  body: ChangesFileBody | null | undefined,
  memberCode: string,
  deviceId: string,
  section: DeviceSection,
): ChangesFileBody {
  return { memberCode, devices: { ...deviceSections(body), [deviceId]: section } };
}

/**
 * Operations the hub hasn't applied yet, per device, and the new progress.
 * Progress counts every operation the device ever made, including ones it has
 * since trimmed (`base`).
 */
export function freshOps(
  memberCode: string,
  body: ChangesFileBody,
  consumed: Record<string, number>,
): { ops: Op[]; consumed: Record<string, number> } {
  const next = { ...consumed };
  const ops: Op[] = [];
  for (const [deviceId, section] of Object.entries(deviceSections(body))) {
    const key = consumedKey(memberCode, deviceId);
    const done = next[key] ?? 0;
    const start = Math.max(0, done - section.base);
    ops.push(...section.ops.slice(start));
    next[key] = Math.max(done, section.base + section.ops.length);
  }
  return { ops, consumed: next };
}

/** A device's operations not yet applied by the hub, from its local list. */
export function pendingOps(ops: Op[], localBase: number, consumed: number): Op[] {
  return ops.slice(Math.max(0, consumed - localBase));
}

// ---------------------------------------------------------------------------
// Splitting history: open (books.json) vs archive (archive.json)
// ---------------------------------------------------------------------------

const byTime = <T extends { id: string }>(time: (row: T) => string) => (a: T, b: T) => {
  const ta = time(a);
  const tb = time(b);
  return ta !== tb ? (ta < tb ? -1 : 1) : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
};

/**
 * Oldest whole blocks of ORDER_CHUNK orders (and STOCK_LOG_CHUNK stock
 * entries) go to the archive; the rest stay open. The archive changes only
 * when a block fills up, or an archived order is changed (e.g. cancelled).
 */
export function splitHistory(
  orders: Order[],
  items: OrderItem[],
  inventory: InventoryLog[],
  orderAuthors: Record<string, string>,
): { open: HistoryPart; archive: HistoryPart } {
  const sortedOrders = [...orders].sort(byTime<Order>((o) => o.createdAt || o.date || ""));
  const cut = Math.floor(sortedOrders.length / ORDER_CHUNK) * ORDER_CHUNK;
  const archivedIds = new Set(sortedOrders.slice(0, cut).map((o) => o.id));

  const sortedLogs = [...inventory].sort(byTime<InventoryLog>((l) => l.createdAt || ""));
  const logCut = Math.floor(sortedLogs.length / STOCK_LOG_CHUNK) * STOCK_LOG_CHUNK;

  const part = (keep: (orderId: string) => boolean, logs: InventoryLog[]): HistoryPart => {
    const partOrders = sortedOrders.filter((o) => keep(o.id));
    const authors: Record<string, string> = {};
    for (const o of partOrders) if (orderAuthors[o.id]) authors[o.id] = orderAuthors[o.id];
    return {
      orders: partOrders,
      order_items: items.filter((i) => keep(i.orderId)),
      inventory: logs,
      orderAuthors: authors,
    };
  };
  return {
    archive: part((id) => archivedIds.has(id), sortedLogs.slice(0, logCut)),
    open: part((id) => !archivedIds.has(id), sortedLogs.slice(logCut)),
  };
}

// ---------------------------------------------------------------------------
// Building the files on the hub
// ---------------------------------------------------------------------------

/** Every store a device reads to build or apply a snapshot. */
export type LocalSnapshot = Record<string, SyncRecord[]>;

const CATALOG_STORES = ["business", "settings", "categories", "payments", "products", "customers"];
const BOOK_STORES = ["orders", "order_items", "inventory"];

export function summarizeCustomer(c: SyncRecord): CustomerSummary {
  const customer = c as unknown as Customer;
  return { id: customer.id, name: customer.name ?? "", phone: customer.phone ?? "", createdAt: customer.createdAt ?? "" };
}

export function buildCatalog(local: LocalSnapshot): CatalogFile {
  const settings = (local.settings ?? []).find((s) => s.id === "main") as unknown as PosSettings | undefined;
  return {
    version: TEAM_FILE_VERSION,
    business: (local.business ?? []).find((b) => b.id === "main") ?? null,
    settings: settings ? sharedSettings(settings) : {},
    categories: local.categories ?? [],
    payments: local.payments ?? [],
    products: ((local.products ?? []) as unknown as Product[]).map((p) => ({
      ...p,
      costPrice: null,
      imageDataUrl: "",
      stock: 0,
    })),
    customers: (local.customers ?? []).map(summarizeCustomer),
  };
}

export function buildStock(local: LocalSnapshot): Record<string, number> {
  const stock: Record<string, number> = {};
  for (const p of (local.products ?? []) as unknown as Product[]) stock[p.id] = p.stock ?? 0;
  return stock;
}

export function buildBooksAndArchive(
  local: LocalSnapshot,
  synced: ReadonlySet<string>,
  orderAuthors: Record<string, string>,
  members: TeamMember[],
): { books: BooksFile; archive: ArchiveFile } {
  const records: Record<string, SyncRecord[]> = {};
  for (const store of synced) {
    if (CATALOG_STORES.includes(store) || BOOK_STORES.includes(store)) continue;
    records[store] = local[store] ?? [];
  }
  const productCosts: Record<string, number | null> = {};
  for (const p of (local.products ?? []) as unknown as Product[]) productCosts[p.id] = p.costPrice ?? null;
  const memberPhones: Record<string, string> = {};
  for (const m of members) if (m.phone) memberPhones[m.code] = m.phone;
  const { open, archive } = splitHistory(
    (local.orders ?? []) as unknown as Order[],
    (local.order_items ?? []) as unknown as OrderItem[],
    (local.inventory ?? []) as unknown as InventoryLog[],
    orderAuthors,
  );
  return {
    books: {
      version: TEAM_FILE_VERSION,
      productCosts,
      memberPhones,
      customers: local.customers ?? [],
      records,
      open,
    },
    archive: { version: TEAM_FILE_VERSION, ...archive },
  };
}

/** The team list as everyone may see it: no phone numbers. */
export function publicMembers(members: TeamMember[]): TeamMember[] {
  return members.map(({ phone: _phone, ...member }) => member);
}

/** People in the team now (removed ones don't count towards the limit). */
export function activeMembers(members: TeamMember[]): TeamMember[] {
  return members.filter((m) => !m.removedAt);
}

// ---------------------------------------------------------------------------
// Merging and applying
// ---------------------------------------------------------------------------

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

/**
 * A member's merge base from what the hub published. Cashiers pass only live
 * and catalog; owners also books and archive.
 */
export function baseFromPublished(
  live: LiveFile,
  catalog: CatalogFile,
  books: BooksFile | null,
  archive: ArchiveFile | null,
): ShopBase {
  const products = catalog.products.map((p) => ({
    ...p,
    stock: live.stock[p.id] ?? 0,
    costPrice: books ? books.productCosts[p.id] ?? null : null,
  }));
  const records: Record<string, SyncRecord[]> = {
    business: catalog.business ? [catalog.business] : [],
    settings: [{ ...catalog.settings, id: "main" } as SyncRecord],
    categories: catalog.categories,
    payments: catalog.payments,
  };
  let orderAuthors: Record<string, string> = {};
  if (books) {
    Object.assign(records, books.records);
    const parts = [archive, books.open].filter((p): p is HistoryPart => Boolean(p));
    records.orders = parts.flatMap((p) => p.orders) as unknown as SyncRecord[];
    records.order_items = parts.flatMap((p) => p.order_items) as unknown as SyncRecord[];
    records.inventory = parts.flatMap((p) => p.inventory) as unknown as SyncRecord[];
    orderAuthors = Object.assign({}, ...parts.map((p) => p.orderAuthors));
  }
  return {
    members: live.members,
    products,
    customers: (books ? books.customers : catalog.customers) as never,
    records,
    orderAuthors,
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
