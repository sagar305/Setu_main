// Operation log for Google Drive team sync (Browser Based POS).
//
// Devices never upload "stock is now 4" — they upload what they did ("sold 1").
// Every device rebuilds the same state by merging every member's operations
// over the owner's base snapshot (see merge.ts). Nothing here touches the
// network or IndexedDB, so it runs in Node tests as-is.

import type { Customer, InventoryLogType, Order, OrderItem, Product } from "../types";

export type Role = "owner" | "cashier";

/** Limits the owner sets per cashier (ignored for the owner). */
export type MemberPermissions = {
  /** Largest bill discount allowed, as % of the subtotal. 0 = no discounts. */
  maxDiscountPercent: number;
  /** May sell on credit (udhaar). */
  allowCredit: boolean;
};

export const DEFAULT_CASHIER_PERMISSIONS: MemberPermissions = {
  maxDiscountPercent: 0,
  allowCredit: true,
};

export type Member = {
  email: string;
  role: Role;
  /** Cashier limits; absent = DEFAULT_CASHIER_PERMISSIONS. */
  permissions?: MemberPermissions;
  /** Short code used in file names and the member's invoice series, e.g. "O", "C1". */
  code: string;
  addedAt: string;
  /** Set when the owner removes the member; their later operations are ignored. */
  removedAt?: string | null;
};

type OpBase = {
  /** Globally unique (device id + counter or random); de-duplicates re-downloads. */
  id: string;
  /** ISO time the device recorded the operation. */
  at: string;
};

export type StockMove = {
  productId: string;
  /** Positive = stock in, negative = stock out. */
  change: number;
  logType: InventoryLogType;
  /** The sale this move belongs to, when logType is "sale". */
  orderId?: string;
  note?: string;
};

export type Op = OpBase &
  (
    | { type: "order.create"; order: Order; items: OrderItem[] }
    | { type: "order.cancel"; orderId: string }
    | { type: "customer.create"; customer: Customer }
    | { type: "customer.update"; customer: Customer }
    | { type: "product.upsert"; product: Product }
    | { type: "product.delete"; productId: string }
    | { type: "stock.move"; move: StockMove }
    // Any other synced store (categories, payments, settings, ledger, cash
    // book, expenses, suppliers, ...): last write wins per record. Owner only.
    | { type: "record.put"; store: string; record: SyncRecord }
    | { type: "record.delete"; store: string; recordId: string }
  );

/** Every workspace record has a string id (the IndexedDB keyPath). */
export type SyncRecord = { id: string } & Record<string, unknown>;

export type OpType = Op["type"];

/** One member's changes file, as downloaded from Drive. */
export type ChangesFile = {
  /**
   * Member code from the file's own record, not from the operations inside.
   * Drive only lets that member write the file, so this is the trusted author.
   */
  memberCode: string;
  ops: Op[];
};

/** What the owner keeps in shop.json (shared read-only with every member). */
export type ShopBase = {
  members: Member[];
  /** Products as of `cutoff`; `stock` is the opening stock at that moment. */
  products: Product[];
  customers: Customer[];
  /**
   * Other synced stores as of `cutoff`, keyed by store name. May include
   * "orders", "order_items" and "inventory" when the base carries sales
   * history (the hub's own data).
   */
  records?: Record<string, SyncRecord[]>;
  /** Who made each order already in the base (order id → member code). */
  orderAuthors?: Record<string, string>;
  /** Operations at or before this time are already folded into the base. */
  cutoff: string | null;
};

/** Invoice prefix for a member's own series, e.g. "INV-" + "C1" → "INV-C1-". */
export function memberInvoicePrefix(basePrefix: string, code: string): string {
  return `${basePrefix}${code}-`;
}

/** Stable ordering so every device applies operations identically. */
export function compareOps(a: Op, b: Op): number {
  if (a.at !== b.at) return a.at < b.at ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
