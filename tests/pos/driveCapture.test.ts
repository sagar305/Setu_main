import { describe, expect, it } from "vitest";
import { captureOps, type CaptureContext, type WriteBatch } from "@/lib/pos/drive/capture";
import { mergeShop } from "@/lib/pos/drive/merge";
import type { Member, Op, Role } from "@/lib/pos/drive/ops";
import { creditLedgerId, creditReversalLedgerId, sharedSettings, syncedStores, withSharedSettings } from "@/lib/pos/drive/scope";
import { DEFAULT_SETTINGS, type InventoryLog, type Order, type OrderItem, type Product } from "@/lib/pos/types";

let counter = 0;
const ctx = (role: Role, tools: string[] = ["customer-ledger"]): CaptureContext => ({
  role,
  synced: syncedStores(tools),
  newId: () => `dev-${++counter}`,
  now: "2026-11-18T10:00:00Z",
});

const order: Order = {
  id: "o1",
  invoiceNumber: "INV-C1-00001",
  date: "2026-11-18T10:00:00Z",
  customerId: "cust",
  customerName: "Asha",
  subtotal: 20,
  discountType: "flat",
  discountValue: 0,
  discountAmount: 0,
  taxAmount: 0,
  includedTaxAmount: 0,
  total: 20,
  paymentMethodId: "credit",
  paymentMethodName: "Customer Credit",
  status: "completed",
  createdAt: "2026-11-18T10:00:00Z",
};
const item = { id: "i1", orderId: "o1", productId: "parle", name: "Parle-G", quantity: 2 } as OrderItem;
const log = (over: Partial<InventoryLog> = {}): InventoryLog => ({
  id: "log1",
  productId: "parle",
  productName: "Parle-G",
  type: "sale",
  change: -2,
  stockAfter: 8,
  note: "Sale INV-C1-00001",
  createdAt: "2026-11-18T10:00:00Z",
  ...over,
});
const product = { id: "parle", name: "Parle-G", trackStock: true, stock: 8, imageDataUrl: "x" } as Product;

/** What the POS checkout writes in one batch. */
const checkoutBatch: WriteBatch = {
  writes: {
    orders: [order],
    order_items: [item],
    products: [product],
    inventory: [log()],
    settings: [{ ...DEFAULT_SETTINGS, nextInvoiceNumber: 2 }],
    ledger: [{ id: creditLedgerId("o1"), customerId: "cust", amount: 20 }],
    stock_batches: [],
  },
  deletes: {},
};

const types = (ops: Op[]) => ops.map((op) => op.type);

describe("captureOps for a cashier's checkout", () => {
  const ops = captureOps(checkoutBatch, ctx("cashier"));

  it("records only the sale and its stock move", () => {
    expect(types(ops)).toEqual(["order.create", "stock.move"]);
  });

  it("links the stock move to the sale and uses the log's id", () => {
    const move = ops[1];
    expect(move).toMatchObject({ id: "inv-log1", move: { change: -2, orderId: "o1", logType: "sale" } });
  });

  it("keeps the items with their order", () => {
    expect(ops[0]).toMatchObject({ type: "order.create", items: [{ id: "i1" }] });
  });

  it("is accepted by the merge, which rebuilds the udhaar entry", () => {
    const members: Member[] = [
      { email: "o@x", role: "owner", code: "O", addedAt: "" },
      { email: "c@x", role: "cashier", code: "C1", addedAt: "" },
    ];
    const merged = mergeShop(
      { members, products: [{ ...product, stock: 10 }], customers: [], cutoff: null },
      [{ memberCode: "C1", ops }],
    );
    expect(merged.rejected).toEqual([]);
    expect(merged.products[0].stock).toBe(8);
    expect(merged.records.ledger).toMatchObject([
      { id: creditLedgerId("o1"), customerId: "cust", type: "credit", amount: 20 },
    ]);
  });
});

describe("captureOps for the owner", () => {
  it("syncs product details without the photo", () => {
    const ops = captureOps({ writes: { products: [product] }, deletes: {} }, ctx("owner"));
    expect(ops).toMatchObject([{ type: "product.upsert", product: { id: "parle", imageDataUrl: "" } }]);
  });

  it("shares settings without this device's own fields", () => {
    const settings = { ...DEFAULT_SETTINGS, pinHash: "secret", sheetSyncUrl: "https://x", taxEnabled: true };
    const ops = captureOps({ writes: { settings: [settings] }, deletes: {} }, ctx("owner"));
    const record = (ops[0] as Extract<Op, { type: "record.put" }>).record;
    expect(record.taxEnabled).toBe(true);
    expect(record).not.toHaveProperty("pinHash");
    expect(record).not.toHaveProperty("sheetSyncUrl");
    expect(record).not.toHaveProperty("nextInvoiceNumber");
  });

  it("does not send the credit-sale ledger entry (the merge rebuilds it)", () => {
    const ops = captureOps(checkoutBatch, ctx("owner"));
    expect(ops.some((op) => op.type === "record.put" && op.store === "ledger")).toBe(false);
  });

  it("syncs data of enabled tools and skips disabled ones", () => {
    const batch: WriteBatch = { writes: { expenses: [{ id: "e1", amount: 50 }] }, deletes: { expenses: ["e0"] } };
    expect(types(captureOps(batch, ctx("owner", ["expense-tracker"])))).toEqual(["record.put", "record.delete"]);
    expect(captureOps(batch, ctx("owner", []))).toEqual([]);
  });

  it("never syncs device-only data", () => {
    const batch: WriteBatch = {
      writes: { held_carts: [{ id: "h" }], sync_queue: [{ id: "q" }], stock_batches: [{ id: "b" }] },
      deletes: {},
    };
    expect(captureOps(batch, ctx("owner", Object.keys({ "customer-ledger": 1 })))).toEqual([]);
  });

  it("records a cancellation and its stock return", () => {
    const batch: WriteBatch = {
      writes: {
        orders: [{ ...order, status: "cancelled" }],
        inventory: [log({ id: "log2", type: "add", change: 2, note: "Cancelled INV-C1-00001" })],
      },
      deletes: {},
    };
    expect(types(captureOps(batch, ctx("owner")))).toEqual(["order.cancel", "stock.move"]);
  });
});

describe("captureOps ignores what a cashier may not change", () => {
  it("drops product edits, restocks, settings and tool data", () => {
    const batch: WriteBatch = {
      writes: {
        products: [product],
        inventory: [log({ type: "restock", change: 5, note: "" })],
        settings: [DEFAULT_SETTINGS],
        expenses: [{ id: "e1" }],
      },
      deletes: { products: ["parle"] },
    };
    expect(captureOps(batch, ctx("cashier", ["expense-tracker"]))).toEqual([]);
  });

  it("turns a new customer into customer.create", () => {
    const ops = captureOps({ writes: { customers: [{ id: "c9", name: "Ravi" }] }, deletes: {} }, ctx("cashier"));
    expect(types(ops)).toEqual(["customer.create"]);
  });
});

describe("shared settings on another device", () => {
  it("applies the shop's settings but keeps this device's PIN, counter and paper size", () => {
    const local = { ...DEFAULT_SETTINGS, pinHash: "mine", nextInvoiceNumber: 40, receiptPaperSize: "58mm" as const, batchTracking: true };
    const fromOwner = sharedSettings({ ...DEFAULT_SETTINGS, taxEnabled: true, defaultTaxRate: 12, pinHash: "theirs" });
    const next = withSharedSettings(local, fromOwner);
    expect(next.taxEnabled).toBe(true);
    expect(next.defaultTaxRate).toBe(12);
    expect(next.pinHash).toBe("mine");
    expect(next.nextInvoiceNumber).toBe(40);
    expect(next.receiptPaperSize).toBe("58mm");
    expect(next.batchTracking).toBe(false);
  });
});

describe("cancelled credit sale", () => {
  it("adds a reversing ledger entry on every device, once", () => {
    const members: Member[] = [
      { email: "o@x", role: "owner", code: "O", addedAt: "" },
      { email: "c@x", role: "cashier", code: "C1", addedAt: "" },
    ];
    const saleOps = captureOps(checkoutBatch, ctx("cashier"));
    const cancelOps = captureOps(
      {
        writes: {
          orders: [{ ...order, status: "cancelled" }],
          ledger: [{ id: creditReversalLedgerId("o1"), type: "payment", amount: 20 }],
        },
        deletes: {},
      },
      { ...ctx("owner"), now: "2026-11-19T09:00:00Z" },
    );
    // The owner's reversal entry is rebuilt by the merge, not sent as-is.
    expect(cancelOps.map((op) => op.type)).toEqual(["order.cancel"]);
    const merged = mergeShop(
      { members, products: [{ ...product, stock: 10 }], customers: [], cutoff: null },
      [
        { memberCode: "C1", ops: saleOps },
        { memberCode: "O", ops: cancelOps },
      ],
    );
    const ledger = merged.records.ledger;
    expect(ledger).toHaveLength(2);
    expect(ledger.find((e) => e.id === creditReversalLedgerId("o1"))).toMatchObject({
      type: "payment",
      amount: 20,
      customerId: "cust",
      date: "2026-11-19",
    });
  });
});
