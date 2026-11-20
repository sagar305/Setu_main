// Turns a write to the workspace database into team-sync operations.
//
// Every tool writes through lib/pos/db (dbPut / dbDelete / dbBatch), so this
// one translator covers the POS and every connected tool without changing
// them. Pure: it sees only the batch being written, never the database.

import type { InventoryLog, Order, OrderItem, PosSettings, Product } from "../types";
import type { Op, Role, SyncRecord } from "./ops";
import { creditLedgerId, sharedSettings } from "./scope";

export type WriteBatch = {
  writes: Partial<Record<string, unknown[]>>;
  deletes: Partial<Record<string, string[]>>;
};

export type CaptureContext = {
  role: Role;
  /** Stores this shop syncs (scope.syncedStores). */
  synced: ReadonlySet<string>;
  /** Unique id for a new operation (device-prefixed). */
  newId: () => string;
  /** ISO time stamped on every operation in this batch. */
  now: string;
};

const isCreditLedgerEntry = (record: SyncRecord) => record.id.startsWith(creditLedgerId(""));

export function captureOps(batch: WriteBatch, ctx: CaptureContext): Op[] {
  const ops: Op[] = [];
  const owner = ctx.role === "owner";
  const at = ctx.now;
  const writes = (store: string) => (ctx.synced.has(store) ? batch.writes[store] ?? [] : []);
  const deletes = (store: string) => (ctx.synced.has(store) ? batch.deletes[store] ?? [] : []);

  // Sales and cancellations. Items travel with their order.
  const orders = writes("orders") as Order[];
  const items = writes("order_items") as OrderItem[];
  for (const order of orders) {
    if (order.status === "cancelled") {
      if (owner) ops.push({ id: ctx.newId(), at, type: "order.cancel", orderId: order.id });
    } else {
      ops.push({
        id: ctx.newId(),
        at,
        type: "order.create",
        order,
        items: items.filter((item) => item.orderId === order.id),
      });
    }
  }

  // Stock only ever moves through inventory log entries, as deltas.
  for (const log of writes("inventory") as InventoryLog[]) {
    let orderId: string | undefined;
    if (log.type === "sale") {
      orderId =
        orders.length === 1
          ? orders[0].id
          : orders.find((o) => log.note.includes(o.invoiceNumber))?.id;
    }
    // A cashier only records the stock out for their own sale.
    if (!owner && (log.type !== "sale" || !orderId)) continue;
    ops.push({
      // The log's own id: stable, so a retried write is never counted twice.
      id: `inv-${log.id}`,
      at,
      type: "stock.move",
      move: {
        productId: log.productId,
        change: log.change,
        logType: log.type,
        ...(orderId ? { orderId } : {}),
        note: log.note,
      },
    });
  }

  if (owner) {
    // Product details; stock inside the record is ignored by the merge.
    for (const product of writes("products") as Product[]) {
      ops.push({ id: ctx.newId(), at, type: "product.upsert", product: { ...product, imageDataUrl: "" } });
    }
    for (const id of deletes("products")) {
      ops.push({ id: ctx.newId(), at, type: "product.delete", productId: id });
    }
  }

  // Customers: a cashier can only add; the owner can change and remove.
  for (const customer of writes("customers") as SyncRecord[]) {
    ops.push(
      owner
        ? { id: ctx.newId(), at, type: "record.put", store: "customers", record: customer }
        : { id: ctx.newId(), at, type: "customer.create", customer: customer as never },
    );
  }
  if (owner) {
    for (const id of deletes("customers")) {
      ops.push({ id: ctx.newId(), at, type: "record.delete", store: "customers", recordId: id });
    }
  }

  if (!owner) return ops; // cashiers' other writes stay on their device

  for (const store of ctx.synced) {
    if (["orders", "order_items", "inventory", "products", "customers"].includes(store)) continue;
    for (const raw of writes(store) as SyncRecord[]) {
      let record = raw;
      if (store === "settings") record = sharedSettings(raw as unknown as PosSettings) as unknown as SyncRecord;
      // Credit-sale ledger entries are rebuilt from the sale by the merge.
      if (store === "ledger" && isCreditLedgerEntry(record)) continue;
      ops.push({ id: ctx.newId(), at, type: "record.put", store, record });
    }
    for (const id of deletes(store)) {
      ops.push({ id: ctx.newId(), at, type: "record.delete", store, recordId: id });
    }
  }
  return ops;
}
