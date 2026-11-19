// Rebuilds the shared POS state from the owner's base snapshot plus every
// member's changes file. Pure and deterministic: any device given the same
// files gets the same result, regardless of download order or duplicates.
//
// Stock is never copied between devices. It is always
//   opening stock (base) + Σ stock moves
// so two counters selling the same item at once both count.

import type { Customer, InventoryLog, Order, OrderItem, Product } from "../types";
import { compareOps, type ChangesFile, type Member, type Op, type ShopBase, type SyncRecord } from "./ops";
import { creditLedgerId, creditReversalLedgerId } from "./scope";
import { checkSale, roleAllows } from "./roles";

export type RejectReason =
  | "unknown-member"
  | "member-removed"
  | "not-allowed-for-role"
  | "duplicate-invoice-number"
  | "discount-over-limit"
  | "credit-not-allowed"
  | "unknown-order";

export type RejectedOp = { memberCode: string; op: Op; reason: RejectReason };

export type MergedState = {
  products: Product[];
  customers: Customer[];
  orders: Order[];
  orderItems: OrderItem[];
  /** Which member made each sale (order id → member code), for "own sales only". */
  orderAuthors: Record<string, string>;
  /** Every other synced store after merging, keyed by store name. */
  records: Record<string, SyncRecord[]>;
  inventoryLog: InventoryLog[];
  /** Tracked products whose stock went below zero (sold more than available). */
  oversold: string[];
  /** Operations ignored, so the owner can be told about them. */
  rejected: RejectedOp[];
  /** Latest operation time applied; useful for "last synced" display. */
  lastOpAt: string | null;
};

type Tagged = { memberCode: string; op: Op };

/** Operation types compaction folds into the base snapshot. */
const FOLDED = new Set<Op["type"]>([
  "customer.create",
  "customer.update",
  "product.upsert",
  "product.delete",
  "stock.move",
  "record.put",
  "record.delete",
]);

/** Stores with their own operation types; record ops must not touch them. */
const SPECIAL_STORES = new Set(["products", "orders", "order_items", "inventory"]);

function activeAt(member: Member, at: string): boolean {
  return !member.removedAt || at < member.removedAt;
}

export function mergeShop(base: ShopBase, files: ChangesFile[]): MergedState {
  const members = new Map(base.members.map((m) => [m.code, m]));
  const rejected: RejectedOp[] = [];

  // 1. Collect, de-duplicate by op id, drop what the base already contains.
  const seen = new Set<string>();
  const all: Tagged[] = [];
  for (const file of files) {
    for (const op of file.ops) {
      if (seen.has(op.id)) continue;
      seen.add(op.id);
      // Products, customers and stock up to the cutoff are already in the
      // base. Orders are not folded, so sales history stays complete.
      if (base.cutoff && op.at <= base.cutoff && FOLDED.has(op.type)) continue;
      all.push({ memberCode: file.memberCode, op });
    }
  }
  all.sort((a, b) => compareOps(a.op, b.op));

  // 2. Membership + role filter. The author comes from the file, never the op.
  const allowed: Tagged[] = [];
  for (const entry of all) {
    const member = members.get(entry.memberCode);
    if (!member) {
      rejected.push({ ...entry, reason: "unknown-member" });
    } else if (!activeAt(member, entry.op.at)) {
      rejected.push({ ...entry, reason: "member-removed" });
    } else if (!roleAllows(member.role, entry.op)) {
      rejected.push({ ...entry, reason: "not-allowed-for-role" });
    } else {
      allowed.push(entry);
    }
  }

  // 3. Orders first, so stock moves can be checked against the sale they claim.
  const orders = new Map<string, Order>();
  const orderAuthor = new Map<string, string>();
  const items: OrderItem[] = [];
  const usedInvoices = new Set<string>();
  for (const entry of allowed) {
    const { op } = entry;
    if (op.type !== "order.create" || orders.has(op.order.id)) continue;
    const sale = checkSale(members.get(entry.memberCode)!, op.order);
    if (!sale.ok) {
      rejected.push({ ...entry, reason: sale.reason });
      continue;
    }
    if (usedInvoices.has(op.order.invoiceNumber)) {
      rejected.push({ ...entry, reason: "duplicate-invoice-number" });
      continue;
    }
    usedInvoices.add(op.order.invoiceNumber);
    orders.set(op.order.id, { ...op.order });
    orderAuthor.set(op.order.id, entry.memberCode);
    items.push(...op.items.map((item) => ({ ...item, orderId: op.order.id })));
  }

  // 4. Everything else, in time order.
  const products = new Map(base.products.map((p) => [p.id, { ...p }]));
  const customers = new Map(base.customers.map((c) => [c.id, { ...c }]));
  const records = new Map<string, Map<string, SyncRecord>>();
  const storeMap = (store: string) => {
    let map = records.get(store);
    if (!map) {
      map = new Map();
      records.set(store, map);
    }
    return map;
  };
  for (const [store, rows] of Object.entries(base.records ?? {})) {
    const map = storeMap(store);
    for (const row of rows) map.set(row.id, { ...row });
  }
  const inventoryLog: InventoryLog[] = [];
  const cancelledAt = new Map<string, string>();
  let lastOpAt: string | null = null;

  for (const entry of allowed) {
    const { op, memberCode } = entry;
    lastOpAt = op.at;
    switch (op.type) {
      case "order.create":
        break; // handled above
      case "order.cancel": {
        const order = orders.get(op.orderId);
        if (!order) rejected.push({ ...entry, reason: "unknown-order" });
        else {
          order.status = "cancelled";
          if (!cancelledAt.has(order.id)) cancelledAt.set(order.id, op.at);
        }
        break;
      }
      case "customer.create":
        if (!customers.has(op.customer.id)) customers.set(op.customer.id, { ...op.customer });
        break;
      case "customer.update":
        customers.set(op.customer.id, { ...op.customer });
        break;
      case "product.upsert": {
        const existing = products.get(op.product.id);
        // Stock only ever changes through stock moves; editing a product's
        // details must not reset what other counters have sold.
        products.set(op.product.id, {
          ...op.product,
          stock: existing ? existing.stock : 0,
        });
        break;
      }
      case "product.delete":
        products.delete(op.productId);
        break;
      case "record.put":
      case "record.delete": {
        if (SPECIAL_STORES.has(op.store)) {
          rejected.push({ ...entry, reason: "not-allowed-for-role" });
          break;
        }
        if (op.store === "customers") {
          if (op.type === "record.put") customers.set(op.record.id, { ...(op.record as unknown as Customer) });
          else customers.delete(op.recordId);
          break;
        }
        if (op.type === "record.put") storeMap(op.store).set(op.record.id, { ...op.record });
        else storeMap(op.store).delete(op.recordId);
        break;
      }
      case "stock.move": {
        const { move } = op;
        if (move.orderId !== undefined && orderAuthor.get(move.orderId) === undefined) {
          rejected.push({ ...entry, reason: "unknown-order" });
          break;
        }
        // A cashier may only move stock for their own sale.
        const member = members.get(memberCode)!;
        if (member.role !== "owner" && orderAuthor.get(move.orderId!) !== memberCode) {
          rejected.push({ ...entry, reason: "not-allowed-for-role" });
          break;
        }
        const product = products.get(move.productId);
        if (!product) break; // product deleted since; nothing to count against
        if (product.trackStock) product.stock += move.change;
        inventoryLog.push({
          id: op.id,
          productId: product.id,
          productName: product.name,
          type: move.logType,
          change: move.change,
          stockAfter: product.stock,
          note: move.note ?? "",
          createdAt: op.at,
        });
        break;
      }
    }
  }

  // A credit sale's udhaar entry, made the same way on every device, so a
  // cashier's credit sale reaches the owner's Customer Ledger.
  const ledger = storeMap("ledger");
  for (const order of orders.values()) {
    if (order.paymentMethodId !== "credit" || !order.customerId) continue;
    if (order.status === "cancelled") {
      const reversalId = creditReversalLedgerId(order.id);
      if (!ledger.has(reversalId)) {
        ledger.set(reversalId, {
          id: reversalId,
          customerId: order.customerId,
          customerName: order.customerName,
          type: "payment",
          amount: order.total,
          note: `Sale ${order.invoiceNumber} cancelled`,
          date: (cancelledAt.get(order.id) ?? order.date).slice(0, 10),
          createdByTool: "browser-pos",
          createdAt: cancelledAt.get(order.id) ?? order.createdAt,
        });
      }
    }
    const id = creditLedgerId(order.id);
    if (ledger.has(id)) continue;
    ledger.set(id, {
      id,
      customerId: order.customerId,
      customerName: order.customerName,
      type: "credit",
      amount: order.total,
      note: `POS sale ${order.invoiceNumber}`,
      date: order.date.slice(0, 10),
      createdByTool: "browser-pos",
      createdAt: order.createdAt,
    });
  }

  const productList = Array.from(products.values());
  return {
    products: productList,
    customers: Array.from(customers.values()),
    orders: Array.from(orders.values()),
    orderItems: items,
    orderAuthors: Object.fromEntries(orderAuthor),
    records: Object.fromEntries(
      Array.from(records.entries()).map(([store, map]) => [store, Array.from(map.values())]),
    ),
    inventoryLog,
    oversold: productList.filter((p) => p.trackStock && p.stock < 0).map((p) => p.id),
    rejected,
    lastOpAt,
  };
}

/**
 * Month-end compaction: fold products, customers and stock up to `cutoff`
 * into a new base, so stock is no longer replayed from old moves. Orders stay
 * in the changes files (and each device's local cache) for sales history.
 */
export function compactBase(base: ShopBase, files: ChangesFile[], cutoff: string): ShopBase {
  const upToCutoff = files.map((f) => ({
    ...f,
    ops: f.ops.filter((op) => op.at <= cutoff),
  }));
  const merged = mergeShop(base, upToCutoff);
  return {
    members: base.members,
    products: merged.products,
    customers: merged.customers,
    // Ledger entries derived from credit sales are folded too; they're
    // re-derived identically, so keeping them is harmless.
    records: merged.records,
    cutoff,
  };
}
