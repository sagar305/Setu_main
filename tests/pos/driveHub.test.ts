import { describe, expect, it } from "vitest";
import { captureOps } from "@/lib/pos/drive/capture";
import {
  baseFromLocal,
  baseFromPublished,
  buildBooksFile,
  buildShopFile,
  memberStores,
  mergeInto,
  mergedStores,
  planApply,
  type LocalSnapshot,
  type TeamMember,
} from "@/lib/pos/drive/hub";
import type { SyncRecord } from "@/lib/pos/drive/ops";
import { syncedStores } from "@/lib/pos/drive/scope";
import { DEFAULT_SETTINGS, type InventoryLog, type Order, type OrderItem, type Product } from "@/lib/pos/types";

const members: TeamMember[] = [
  { email: "owner@x", role: "owner", code: "O", addedAt: "", fileId: "" },
  { email: "ramesh@x", role: "cashier", code: "C1", addedAt: "", fileId: "f-c1" },
];
const synced = syncedStores(["customer-ledger"]);
const rec = <T,>(rows: T[]) => rows as unknown as SyncRecord[];

const product = (over: Partial<Product> = {}): Product =>
  ({ id: "parle", name: "Parle-G", sellingPrice: 10, costPrice: 8, trackStock: true, stock: 10, imageDataUrl: "img", ...over }) as Product;

const hubLocal = (): LocalSnapshot => ({
  business: [{ id: "main", name: "Sharma Kirana" }],
  settings: rec([{ ...DEFAULT_SETTINGS, taxEnabled: true, pinHash: "owner-pin", nextInvoiceNumber: 7 }]),
  categories: [],
  payments: [{ id: "cash", name: "Cash" }],
  products: rec([product()]),
  customers: [{ id: "cust", name: "Asha" }],
  orders: rec([{ id: "old", invoiceNumber: "INV-00006", status: "completed", paymentMethodId: "cash", total: 10 } as Order]),
  order_items: [],
  inventory: [],
  ledger: [],
});

/** What a cashier's checkout writes, turned into ops. */
function cashierSale(id: string, qty: number) {
  const order = {
    id,
    invoiceNumber: `INV-C1-0000${id.length}`,
    status: "completed",
    subtotal: 10 * qty,
    discountAmount: 0,
    paymentMethodId: "cash",
    total: 10 * qty,
    date: "2026-11-19T10:00:00Z",
    createdAt: "2026-11-19T10:00:00Z",
  } as Order;
  return captureOps(
    {
      writes: {
        orders: [order],
        order_items: [{ id: `${id}-i`, orderId: id, productId: "parle", quantity: qty } as OrderItem],
        products: [product({ stock: 10 - qty })],
        inventory: [
          { id: `${id}-log`, productId: "parle", productName: "Parle-G", type: "sale", change: -qty, stockAfter: 0, note: "", createdAt: "" } as InventoryLog,
        ],
      },
      deletes: {},
    },
    { role: "cashier", synced, newId: () => `C1-${id}-${Math.random()}`, now: "2026-11-19T10:00:00Z" },
  );
}

describe("shop.json and books.json", () => {
  it("never puts cost prices or photos in shop.json, which cashiers can read", () => {
    const shop = buildShopFile(hubLocal(), "Sharma Kirana", "O", members, {}, "now");
    expect(shop.catalog.products[0]).toMatchObject({ costPrice: null, imageDataUrl: "", stock: 10 });
    expect(shop.catalog.settings).not.toHaveProperty("pinHash");
    expect(shop.catalog.settings).toMatchObject({ taxEnabled: true });
  });

  it("keeps cost prices and sales in books.json for owners", () => {
    const books = buildBooksFile(hubLocal(), synced, { old: "O" }, "now");
    expect(books.productCosts).toEqual({ parle: 8 });
    expect(books.records.orders).toHaveLength(1);
    expect(books.records).toHaveProperty("ledger");
  });
});

describe("hub merges a cashier's sale into its own data", () => {
  it("adds the sale, reduces stock and keeps the hub's history and photo", () => {
    const local = hubLocal();
    const base = baseFromLocal(local, members, synced, { old: "O" });
    const merged = mergeInto(base, [{ memberCode: "C1", ops: cashierSale("s1", 2) }]);
    const stores = Array.from(new Set(["business", "settings", "categories", "payments", "products", "customers", "orders", "order_items", "inventory", ...synced]));
    const plan = planApply(local, mergedStores(merged), stores);

    expect(merged.rejected).toEqual([]);
    expect(plan.writes.products).toMatchObject([{ id: "parle", stock: 8, imageDataUrl: "img" }]);
    expect(plan.writes.orders?.map((o) => o.id)).toEqual(["s1"]);
    expect(plan.deletes.orders).toBeUndefined(); // the old sale stays
    expect(plan.writes.settings).toBeUndefined(); // nothing changed there
    expect(merged.orderAuthors).toMatchObject({ old: "O", s1: "C1" });
  });
});

describe("cashier rebuilds from what the hub published", () => {
  it("shows published stock minus their own not-yet-merged sales", () => {
    const shop = buildShopFile(hubLocal(), "Sharma Kirana", "O", members, { C1: 0 }, "now");
    const pending = cashierSale("s1", 3);
    const merged = mergeInto(baseFromPublished(shop, null), [{ memberCode: "C1", ops: pending }]);
    expect(merged.products[0].stock).toBe(7);
    expect(merged.products[0].costPrice).toBeNull();
  });

  it("doesn't count a sale twice once the hub has merged it", () => {
    // Hub merged s1 (stock 10 → 7) and published consumed C1 = 2 ops.
    const hub = hubLocal();
    hub.products = rec([product({ stock: 7 })]);
    const shop = buildShopFile(hub, "Sharma Kirana", "O", members, { C1: 2 }, "now");
    const all = cashierSale("s1", 3);
    const pending = all.slice(shop.consumed.C1);
    const merged = mergeInto(baseFromPublished(shop, null), [{ memberCode: "C1", ops: pending }]);
    expect(merged.products[0].stock).toBe(7);
  });

  it("a cashier device only replaces the catalog, never its own sales", () => {
    expect(memberStores("cashier", synced)).not.toContain("orders");
    expect(memberStores("owner", synced)).toEqual(expect.arrayContaining(["orders", "inventory", "ledger"]));
  });

  it("keeps this device's PIN and invoice counter when applying shop settings", () => {
    const shop = buildShopFile(hubLocal(), "Sharma Kirana", "O", members, {}, "now");
    const merged = mergeInto(baseFromPublished(shop, null), []);
    const local: LocalSnapshot = {
      settings: rec([{ ...DEFAULT_SETTINGS, pinHash: "cashier-pin", nextInvoiceNumber: 3, taxEnabled: false }]),
    };
    const plan = planApply(local, mergedStores(merged), ["settings"]);
    expect(plan.writes.settings?.[0]).toMatchObject({ pinHash: "cashier-pin", nextInvoiceNumber: 3, taxEnabled: true });
    expect(plan.writes.settings?.[0].batchTracking).toBeFalsy();
  });
});
