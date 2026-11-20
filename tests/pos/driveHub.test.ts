import { describe, expect, it } from "vitest";
import { captureOps } from "@/lib/pos/drive/capture";
import {
  MAX_TEAM_SIZE,
  ORDER_CHUNK,
  STOCK_LOG_CHUNK,
  activeMembers,
  baseFromLocal,
  baseFromPublished,
  buildBooksAndArchive,
  buildCatalog,
  buildStock,
  consumedKey,
  deviceSections,
  freshOps,
  memberStores,
  mergeInto,
  mergedStores,
  pendingOps,
  planApply,
  publicMembers,
  splitHistory,
  withDeviceSection,
  type LiveFile,
  type LocalSnapshot,
  type TeamMember,
} from "@/lib/pos/drive/hub";
import { deviceTag } from "@/lib/pos/drive/engine";
import type { Op, SyncRecord } from "@/lib/pos/drive/ops";
import { syncedStores } from "@/lib/pos/drive/scope";
import { DEFAULT_SETTINGS, type InventoryLog, type Order, type OrderItem, type Product } from "@/lib/pos/types";

const members: TeamMember[] = [
  { email: "owner@x", role: "owner", code: "O", addedAt: "", fileId: "f-o" },
  { email: "ramesh@x", role: "cashier", code: "C1", addedAt: "", fileId: "f-c1", phone: "919876543210" },
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
  customers: [{ id: "cust", name: "Asha", phone: "99999", address: "12 MG Road", notes: "VIP", createdAt: "t" }],
  orders: rec([{ id: "old", invoiceNumber: "INV-00006", status: "completed", paymentMethodId: "cash", total: 10, createdAt: "2026-11-01" } as Order]),
  order_items: [],
  inventory: [],
  ledger: [],
});

/** The hub's published files, as a member device would read them after decrypting. */
function published(local: LocalSnapshot, consumed: Record<string, number> = {}) {
  const { books, archive } = buildBooksAndArchive(local, synced, { old: "O" }, members);
  const live: LiveFile = {
    version: 2,
    shopName: "Sharma Kirana",
    updatedAt: "now",
    primaryCode: "O",
    primaryEmail: "owner@x",
    hubDeviceId: "hub",
    members: publicMembers(members),
    consumed,
    stock: buildStock(local),
    files: { live: "l", catalog: "c", books: "b", archive: "a" },
    revs: { catalog: "1", books: "1", archive: "1" },
  };
  return { live, catalog: buildCatalog(local), books, archive };
}

/** What a cashier's checkout writes, turned into ops. */
function cashierSale(id: string, qty: number) {
  const order = {
    id,
    invoiceNumber: `INV-C1-X-${id}`,
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

describe("what each file holds", () => {
  it("catalog (cashiers can open it): no cost prices, photos or stock, customers' name and phone only", () => {
    const catalog = buildCatalog(hubLocal());
    expect(catalog.products[0]).toMatchObject({ costPrice: null, imageDataUrl: "", stock: 0 });
    expect(catalog.customers).toEqual([{ id: "cust", name: "Asha", phone: "99999", createdAt: "t" }]);
    expect(JSON.stringify(catalog)).not.toContain("MG Road");
    expect(catalog.settings).not.toHaveProperty("pinHash");
  });

  it("stock lives in its own small map", () => {
    expect(buildStock(hubLocal())).toEqual({ parle: 10 });
  });

  it("books (owners only) keep costs, full customers, tool data and staff phones", () => {
    const { books } = buildBooksAndArchive(hubLocal(), synced, { old: "O" }, members);
    expect(books.productCosts).toEqual({ parle: 8 });
    expect(books.customers[0]).toMatchObject({ address: "12 MG Road" });
    expect(books.memberPhones).toEqual({ C1: "919876543210" });
    expect(books.records).toHaveProperty("ledger");
    expect(books.open.orders.map((o) => o.id)).toEqual(["old"]);
  });

  it("the team list everyone sees has no phone numbers", () => {
    expect(JSON.stringify(publicMembers(members))).not.toContain("9876543210");
  });
});

describe("history: current orders vs archive", () => {
  const orders = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      id: `o${String(i).padStart(5, "0")}`,
      createdAt: `2026-01-01T${String(Math.floor(i / 3600)).padStart(2, "0")}:${String(Math.floor(i / 60) % 60).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}Z`,
    })) as unknown as Order[];

  it("keeps fewer than one block open and archives whole blocks", () => {
    const all = orders(ORDER_CHUNK * 2 + 37);
    const items = all.map((o) => ({ id: `${o.id}-i`, orderId: o.id }) as OrderItem);
    const { open, archive } = splitHistory(all, items, [], {});
    expect(archive.orders).toHaveLength(ORDER_CHUNK * 2);
    expect(open.orders).toHaveLength(37);
    expect(open.order_items).toHaveLength(37);
    // The oldest are archived.
    expect(archive.orders[0].id).toBe("o00000");
  });

  it("the archive doesn't change while the open block fills up", () => {
    const base = orders(ORDER_CHUNK + 10);
    const more = orders(ORDER_CHUNK + 60);
    const a = splitHistory(base, [], [], {}).archive;
    const b = splitHistory(more, [], [], {}).archive;
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("archives stock history in its own blocks", () => {
    const logs = Array.from({ length: STOCK_LOG_CHUNK + 5 }, (_, i) => ({ id: `l${i}`, createdAt: String(i).padStart(6, "0") })) as unknown as InventoryLog[];
    const { open, archive } = splitHistory([], [], logs, {});
    expect(archive.inventory).toHaveLength(STOCK_LOG_CHUNK);
    expect(open.inventory).toHaveLength(5);
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
    expect(plan.deletes.orders).toBeUndefined();
    expect(merged.orderAuthors).toMatchObject({ old: "O", s1: "C1" });
  });
});

describe("member devices rebuild from what the hub published", () => {
  it("a cashier sees published stock minus their own not-yet-merged sales, and no costs", () => {
    const p = published(hubLocal());
    const merged = mergeInto(baseFromPublished(p.live, p.catalog, null, null), [{ memberCode: "C1", ops: cashierSale("s1", 3) }]);
    expect(merged.products[0].stock).toBe(7);
    expect(merged.products[0].costPrice).toBeNull();
    expect(merged.customers[0]).not.toHaveProperty("address");
  });

  it("an owner's other device gets everything: costs, full customers and all orders", () => {
    const p = published(hubLocal());
    const merged = mergeInto(baseFromPublished(p.live, p.catalog, p.books, p.archive), []);
    expect(merged.products[0]).toMatchObject({ stock: 10, costPrice: 8 });
    expect(merged.customers[0]).toMatchObject({ address: "12 MG Road" });
    expect(merged.orders.map((o) => o.id)).toEqual(["old"]);
  });

  it("doesn't count a sale twice once the hub has merged it", () => {
    const hub = hubLocal();
    hub.products = rec([product({ stock: 7 })]);
    const p = published(hub, { [consumedKey("C1", "phone")]: 2 });
    const all = cashierSale("s1", 3);
    const pending = pendingOps(all, 0, p.live.consumed[consumedKey("C1", "phone")]);
    const merged = mergeInto(baseFromPublished(p.live, p.catalog, null, null), [{ memberCode: "C1", ops: pending }]);
    expect(merged.products[0].stock).toBe(7);
  });

  it("a cashier device only replaces the catalog, never its own sales", () => {
    expect(memberStores("cashier", synced)).not.toContain("orders");
    expect(memberStores("owner", synced)).toEqual(expect.arrayContaining(["orders", "inventory", "ledger"]));
  });

  it("keeps this device's PIN and invoice counter when applying shop settings", () => {
    const p = published(hubLocal());
    const merged = mergeInto(baseFromPublished(p.live, p.catalog, null, null), []);
    const local: LocalSnapshot = {
      settings: rec([{ ...DEFAULT_SETTINGS, pinHash: "cashier-pin", nextInvoiceNumber: 3, taxEnabled: false }]),
    };
    const plan = planApply(local, mergedStores(merged), ["settings"]);
    expect(plan.writes.settings?.[0]).toMatchObject({ pinHash: "cashier-pin", nextInvoiceNumber: 3, taxEnabled: true });
  });
});

describe("changes files: per device, trimmed after merging", () => {
  const op = (id: string): Op => ({ id, at: "2026-11-19T10:00:00Z", type: "customer.create", customer: { id } }) as unknown as Op;

  it("each device writes only its own section and keeps the others", () => {
    let file = withDeviceSection(null, "C1", "phone", { base: 0, ops: [op("p1")] });
    file = withDeviceSection(file, "C1", "tablet", { base: 0, ops: [op("t1"), op("t2")] });
    file = withDeviceSection(file, "C1", "phone", { base: 0, ops: [op("p1"), op("p2")] });
    expect(Object.keys(deviceSections(file))).toEqual(["phone", "tablet"]);
    expect(deviceSections(file).phone.ops.map((o) => o.id)).toEqual(["p1", "p2"]);
  });

  it("the hub takes only new operations, counted per device", () => {
    const file = { memberCode: "C1", devices: { phone: { base: 0, ops: [op("p1"), op("p2")] }, tablet: { base: 0, ops: [op("t1")] } } };
    const first = freshOps("C1", file, {});
    expect(first.ops.map((o) => o.id)).toEqual(["p1", "p2", "t1"]);
    expect(first.consumed).toEqual({ [consumedKey("C1", "phone")]: 2, [consumedKey("C1", "tablet")]: 1 });
    const later = { ...file, devices: { ...file.devices, phone: { base: 0, ops: [op("p1"), op("p2"), op("p3")] } } };
    expect(freshOps("C1", later, first.consumed).ops.map((o) => o.id)).toEqual(["p3"]);
  });

  it("after a device trims what the hub merged, nothing is skipped or repeated", () => {
    // The hub had applied 2; the phone trimmed those and kept the rest.
    const trimmed = { memberCode: "C1", devices: { phone: { base: 2, ops: [op("p3"), op("p4")] } } };
    const result = freshOps("C1", trimmed, { [consumedKey("C1", "phone")]: 3 });
    expect(result.ops.map((o) => o.id)).toEqual(["p4"]);
    expect(result.consumed[consumedKey("C1", "phone")]).toBe(4);
  });

  it("a device's pending list counts from its own trimmed base", () => {
    const local = [op("p3"), op("p4"), op("p5")]; // base 2 trimmed already
    expect(pendingOps(local, 2, 4).map((o) => o.id)).toEqual(["p5"]);
    expect(pendingOps(local, 2, 0).map((o) => o.id)).toEqual(["p3", "p4", "p5"]);
  });
});

describe("team size", () => {
  it("allows up to five people, removed ones not counted", () => {
    expect(MAX_TEAM_SIZE).toBe(5);
    const team = [...members, { ...members[1], code: "C2", removedAt: "t" }];
    expect(activeMembers(team)).toHaveLength(2);
  });

  it("gives every device its own invoice tag", () => {
    expect(deviceTag("dk7q2x9ab")).toBe("9AB");
  });
});
