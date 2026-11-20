import { describe, expect, it } from "vitest";
import { compactBase, mergeShop } from "@/lib/pos/drive/merge";
import type { ChangesFile, Member, Op, ShopBase } from "@/lib/pos/drive/ops";
import { memberInvoicePrefix } from "@/lib/pos/drive/ops";
import { canSeeOrder, canSeeScreen, checkSale, roleAllows } from "@/lib/pos/drive/roles";
import type { Customer, Order, Product } from "@/lib/pos/types";

const members: Member[] = [
  { email: "owner@example.com", role: "owner", code: "O", addedAt: "2026-11-01T00:00:00Z" },
  { email: "ramesh@example.com", role: "cashier", code: "C1", addedAt: "2026-11-01T00:00:00Z" },
  { email: "suresh@example.com", role: "cashier", code: "C2", addedAt: "2026-11-01T00:00:00Z" },
];

const product = (over: Partial<Product> = {}): Product =>
  ({
    id: "parle",
    name: "Parle-G",
    sellingPrice: 10,
    costPrice: 8,
    trackStock: true,
    stock: 10,
    ...over,
  }) as Product;

const base = (over: Partial<ShopBase> = {}): ShopBase => ({
  members,
  products: [product()],
  customers: [],
  cutoff: null,
  ...over,
});

const order = (id: string, invoiceNumber: string): Order =>
  ({ id, invoiceNumber, status: "completed", total: 10 }) as Order;

/** A sale: the order plus its stock move, as a device would record them. */
function sale(id: string, at: string, invoice: string, qty: number, productId = "parle"): Op[] {
  return [
    { id: `${id}-o`, at, type: "order.create", order: order(id, invoice), items: [] },
    {
      id: `${id}-m`,
      at,
      type: "stock.move",
      move: { productId, change: -qty, logType: "sale", orderId: id },
    },
  ];
}

const stockOf = (files: ChangesFile[], b: ShopBase = base()) =>
  mergeShop(b, files).products.find((p) => p.id === "parle")!.stock;

describe("mergeShop stock", () => {
  it("counts sales from two counters made at the same moment", () => {
    const files: ChangesFile[] = [
      { memberCode: "C1", ops: sale("s1", "2026-11-18T10:00:00Z", "INV-C1-0001", 2) },
      { memberCode: "C2", ops: sale("s2", "2026-11-18T10:00:00Z", "INV-C2-0001", 3) },
    ];
    expect(stockOf(files)).toBe(5);
  });

  it("adds the owner's restock on top of sales", () => {
    const files: ChangesFile[] = [
      {
        memberCode: "O",
        ops: [
          {
            id: "r1",
            at: "2026-11-18T09:00:00Z",
            type: "stock.move",
            move: { productId: "parle", change: 20, logType: "restock" },
          },
        ],
      },
      { memberCode: "C1", ops: sale("s1", "2026-11-18T10:00:00Z", "INV-C1-0001", 2) },
    ];
    expect(stockOf(files)).toBe(28);
  });

  it("gives the same result whatever order the files arrive in", () => {
    const a: ChangesFile = { memberCode: "C1", ops: sale("s1", "2026-11-18T10:00:01Z", "A-1", 1) };
    const b: ChangesFile = { memberCode: "C2", ops: sale("s2", "2026-11-18T10:00:00Z", "B-1", 4) };
    expect(mergeShop(base(), [a, b])).toEqual(mergeShop(base(), [b, a]));
  });

  it("never counts a re-downloaded operation twice", () => {
    const ops = sale("s1", "2026-11-18T10:00:00Z", "INV-C1-0001", 2);
    const files: ChangesFile[] = [
      { memberCode: "C1", ops },
      { memberCode: "C1", ops },
    ];
    expect(stockOf(files)).toBe(8);
    expect(mergeShop(base(), files).orders).toHaveLength(1);
  });

  it("flags stock sold beyond what was available (last-item race)", () => {
    const merged = mergeShop(base({ products: [product({ stock: 1 })] }), [
      { memberCode: "C1", ops: sale("s1", "2026-11-18T10:00:00Z", "A-1", 1) },
      { memberCode: "C2", ops: sale("s2", "2026-11-18T10:00:05Z", "B-1", 1) },
    ]);
    expect(merged.products[0].stock).toBe(-1);
    expect(merged.oversold).toEqual(["parle"]);
  });

  it("keeps stock when the owner edits product details", () => {
    const files: ChangesFile[] = [
      { memberCode: "C1", ops: sale("s1", "2026-11-18T10:00:00Z", "A-1", 3) },
      {
        memberCode: "O",
        ops: [
          {
            id: "p1",
            at: "2026-11-18T11:00:00Z",
            type: "product.upsert",
            product: product({ sellingPrice: 12, stock: 999 }),
          },
        ],
      },
    ];
    const merged = mergeShop(base(), files);
    expect(merged.products[0].stock).toBe(7);
    expect(merged.products[0].sellingPrice).toBe(12);
  });

  it("writes an inventory log entry with the running stock", () => {
    const merged = mergeShop(base(), [
      { memberCode: "C1", ops: sale("s1", "2026-11-18T10:00:00Z", "A-1", 2) },
    ]);
    expect(merged.inventoryLog).toMatchObject([
      { productId: "parle", type: "sale", change: -2, stockAfter: 8 },
    ]);
  });
});

describe("mergeShop roles and membership", () => {
  it("rejects a cashier trying to change a price", () => {
    const merged = mergeShop(base(), [
      {
        memberCode: "C1",
        ops: [
          {
            id: "x",
            at: "2026-11-18T10:00:00Z",
            type: "product.upsert",
            product: product({ sellingPrice: 1 }),
          },
        ],
      },
    ]);
    expect(merged.products[0].sellingPrice).toBe(10);
    expect(merged.rejected).toMatchObject([{ memberCode: "C1", reason: "not-allowed-for-role" }]);
  });

  it("rejects a cashier restocking or adding stock", () => {
    const merged = mergeShop(base(), [
      {
        memberCode: "C1",
        ops: [
          {
            id: "x",
            at: "2026-11-18T10:00:00Z",
            type: "stock.move",
            move: { productId: "parle", change: 50, logType: "restock" },
          },
        ],
      },
    ]);
    expect(merged.products[0].stock).toBe(10);
    expect(merged.rejected[0].reason).toBe("not-allowed-for-role");
  });

  it("rejects a cashier moving stock against another cashier's sale", () => {
    const merged = mergeShop(base(), [
      { memberCode: "C1", ops: sale("s1", "2026-11-18T10:00:00Z", "A-1", 1) },
      {
        memberCode: "C2",
        ops: [
          {
            id: "x",
            at: "2026-11-18T10:01:00Z",
            type: "stock.move",
            move: { productId: "parle", change: -5, logType: "sale", orderId: "s1" },
          },
        ],
      },
    ]);
    expect(merged.products[0].stock).toBe(9);
    expect(merged.rejected[0]).toMatchObject({ memberCode: "C2", reason: "not-allowed-for-role" });
  });

  it("trusts the file's member, not an author written inside an op", () => {
    const merged = mergeShop(base(), [
      { memberCode: "stranger", ops: sale("s1", "2026-11-18T10:00:00Z", "A-1", 1) },
    ]);
    expect(merged.orders).toHaveLength(0);
    expect(merged.rejected.every((r) => r.reason === "unknown-member")).toBe(true);
  });

  it("ignores a removed member's operations after removal, keeps earlier ones", () => {
    const removed = members.map((m) =>
      m.code === "C1" ? { ...m, removedAt: "2026-11-18T12:00:00Z" } : m,
    );
    const merged = mergeShop(base({ members: removed }), [
      {
        memberCode: "C1",
        ops: [
          ...sale("s1", "2026-11-18T11:00:00Z", "A-1", 1),
          ...sale("s2", "2026-11-18T13:00:00Z", "A-2", 1),
        ],
      },
    ]);
    expect(merged.orders.map((o) => o.id)).toEqual(["s1"]);
    expect(merged.products[0].stock).toBe(9);
    expect(merged.rejected.map((r) => r.reason)).toContain("member-removed");
  });

  it("keeps the first sale when two orders share an invoice number", () => {
    const merged = mergeShop(base(), [
      { memberCode: "C1", ops: sale("s1", "2026-11-18T10:00:00Z", "INV-0042", 1) },
      { memberCode: "C2", ops: sale("s2", "2026-11-18T10:00:01Z", "INV-0042", 1) },
    ]);
    expect(merged.orders.map((o) => o.id)).toEqual(["s1"]);
    // The duplicate's stock move has no accepted order, so it is not counted.
    expect(merged.products[0].stock).toBe(9);
    expect(merged.rejected.map((r) => r.reason)).toContain("duplicate-invoice-number");
  });

  it("lets only the owner cancel an order", () => {
    const cancel = (id: string): Op => ({
      id,
      at: "2026-11-18T11:00:00Z",
      type: "order.cancel",
      orderId: "s1",
    });
    const byCashier = mergeShop(base(), [
      { memberCode: "C1", ops: [...sale("s1", "2026-11-18T10:00:00Z", "A-1", 1), cancel("c")] },
    ]);
    expect(byCashier.orders[0].status).toBe("completed");

    const byOwner = mergeShop(base(), [
      { memberCode: "C1", ops: sale("s1", "2026-11-18T10:00:00Z", "A-1", 1) },
      { memberCode: "O", ops: [cancel("c")] },
    ]);
    expect(byOwner.orders[0].status).toBe("cancelled");
  });

  it("keeps the first copy of a customer two counters both created", () => {
    const customer = (name: string): Customer => ({ id: "cust", name }) as Customer;
    const merged = mergeShop(base(), [
      {
        memberCode: "C1",
        ops: [{ id: "a", at: "2026-11-18T10:00:00Z", type: "customer.create", customer: customer("Asha") }],
      },
      {
        memberCode: "C2",
        ops: [{ id: "b", at: "2026-11-18T10:00:09Z", type: "customer.create", customer: customer("Asha K") }],
      },
    ]);
    expect(merged.customers).toEqual([{ id: "cust", name: "Asha" }]);
  });
});

describe("compactBase", () => {
  it("folds stock into the new opening stock and keeps sales history", () => {
    const files: ChangesFile[] = [
      { memberCode: "C1", ops: sale("s1", "2026-11-10T10:00:00Z", "A-1", 2) },
      { memberCode: "C2", ops: sale("s2", "2026-12-02T10:00:00Z", "B-1", 1) },
    ];
    const compacted = compactBase(base(), files, "2026-11-30T23:59:59Z");
    expect(compacted.products[0].stock).toBe(8);
    expect(compacted.cutoff).toBe("2026-11-30T23:59:59Z");

    // Replaying the same files over the compacted base must not double-count.
    const merged = mergeShop(compacted, files);
    expect(merged.products[0].stock).toBe(7);
    expect(merged.orders.map((o) => o.id).sort()).toEqual(["s1", "s2"]);
  });
});

describe("roles", () => {
  it("limits cashiers to billing, customers, their own orders and settings", () => {
    expect(canSeeScreen("cashier", "billing")).toBe(true);
    expect(canSeeScreen("cashier", "customers")).toBe(true);
    expect(canSeeScreen("cashier", "reports")).toBe(false);
    expect(canSeeScreen("cashier", "products")).toBe(false);
    expect(canSeeScreen("cashier", "dashboard")).toBe(false);
    expect(canSeeScreen("cashier", "orders")).toBe(true);
    expect(canSeeScreen("owner", "team")).toBe(true);
  });

  it("only lets a cashier move stock out for a sale", () => {
    const move = (change: number, orderId?: string): Op => ({
      id: "m",
      at: "t",
      type: "stock.move",
      move: { productId: "p", change, logType: "sale", orderId },
    });
    expect(roleAllows("cashier", move(-1, "o1"))).toBe(true);
    expect(roleAllows("cashier", move(-1))).toBe(false);
    expect(roleAllows("cashier", move(1, "o1"))).toBe(false);
  });

  it("builds a per-member invoice series", () => {
    expect(memberInvoicePrefix("INV-", "C1")).toBe("INV-C1-");
  });
});

describe("cashier limits set by the owner", () => {
  const withLimits = (maxDiscountPercent: number, allowCredit: boolean): Member[] =>
    members.map((m) =>
      m.code === "C1" ? { ...m, permissions: { maxDiscountPercent, allowCredit } } : m,
    );
  const billed = (over: Partial<Order>): Op[] => {
    const [create, move] = sale("s1", "2026-11-18T10:00:00Z", "A-1", 1);
    if (create.type !== "order.create") throw new Error("unreachable");
    return [{ ...create, order: { ...create.order, subtotal: 100, discountAmount: 0, ...over } }, move];
  };

  it("blocks discounts by default and allows them up to the owner's limit", () => {
    const cashier = members[1];
    expect(checkSale(cashier, { subtotal: 100, discountAmount: 5, paymentMethodId: "cash" })).toEqual({
      ok: false,
      reason: "discount-over-limit",
    });
    const allowed = { ...cashier, permissions: { maxDiscountPercent: 10, allowCredit: true } };
    expect(checkSale(allowed, { subtotal: 100, discountAmount: 10, paymentMethodId: "cash" }).ok).toBe(true);
    expect(checkSale(allowed, { subtotal: 100, discountAmount: 11, paymentMethodId: "cash" }).ok).toBe(false);
  });

  it("puts no limits on the owner", () => {
    expect(checkSale(members[0], { subtotal: 100, discountAmount: 90, paymentMethodId: "credit" }).ok).toBe(true);
  });

  it("rejects an over-limit bill in the merge, so an edited file can't bypass it", () => {
    const merged = mergeShop(base({ members: withLimits(5, true) }), [
      { memberCode: "C1", ops: billed({ discountAmount: 20 }) },
    ]);
    expect(merged.orders).toHaveLength(0);
    expect(merged.products[0].stock).toBe(10);
    expect(merged.rejected.map((r) => r.reason)).toContain("discount-over-limit");
  });

  it("allows credit by default and rejects it once the owner turns it off", () => {
    const credit = billed({ paymentMethodId: "credit" });
    expect(mergeShop(base(), [{ memberCode: "C1", ops: credit }]).orders).toHaveLength(1);
    const revoked = mergeShop(base({ members: withLimits(0, false) }), [{ memberCode: "C1", ops: credit }]);
    expect(revoked.orders).toHaveLength(0);
    expect(revoked.rejected.map((r) => r.reason)).toContain("credit-not-allowed");
  });

  it("records who made each sale so cashiers see only their own", () => {
    const merged = mergeShop(base(), [
      { memberCode: "C1", ops: sale("s1", "2026-11-18T10:00:00Z", "A-1", 1) },
      { memberCode: "C2", ops: sale("s2", "2026-11-18T10:00:00Z", "B-1", 1) },
    ]);
    expect(merged.orderAuthors).toEqual({ s1: "C1", s2: "C2" });
    const visibleTo = (m: Member) =>
      merged.orders.filter((o) => canSeeOrder(m, merged.orderAuthors[o.id])).map((o) => o.id);
    expect(visibleTo(members[1])).toEqual(["s1"]);
    expect(visibleTo(members[0]).sort()).toEqual(["s1", "s2"]);
  });
});
