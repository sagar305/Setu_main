import { describe, expect, it } from "vitest";

import { respond, type AgentReply, type AssistantData } from "@/lib/pos/assistant/agent";
import { matchByName } from "@/lib/pos/assistant/text";
import { DEFAULT_SETTINGS, type Order, type OrderItem, type Product } from "@/lib/pos/types";

const NOW = new Date(2026, 9, 27, 15, 0); // Tue 27 Oct 2026, 3 pm local

function product(id: string, name: string, price: number, extra: Partial<Product> = {}): Product {
  return {
    id,
    name,
    sellingPrice: price,
    sku: "",
    barcode: "",
    categoryId: "",
    costPrice: null,
    taxRate: null,
    taxInclusive: false,
    trackStock: true,
    stock: 20,
    unit: "",
    imageDataUrl: "",
    description: "",
    createdAt: "",
    updatedAt: "",
    ...extra,
  };
}

function order(id: string, invoiceNumber: string, date: Date, total: number, extra: Partial<Order> = {}): Order {
  return {
    id,
    invoiceNumber,
    date: date.toISOString(),
    customerId: null,
    customerName: "",
    subtotal: total,
    discountType: "flat",
    discountValue: 0,
    discountAmount: 0,
    taxAmount: 0,
    includedTaxAmount: 0,
    total,
    paymentMethodId: "cash",
    paymentMethodName: "Cash",
    status: "completed",
    createdAt: date.toISOString(),
    ...extra,
  };
}

function item(orderId: string, productId: string, name: string, quantity: number, price: number): OrderItem {
  return {
    id: `${orderId}-${productId}`,
    orderId,
    productId,
    name,
    price,
    quantity,
    unit: "",
    taxRate: 0,
    taxInclusive: false,
    lineSubtotal: price * quantity,
  };
}

const today = new Date(2026, 9, 27, 10, 0);
const yesterday = new Date(2026, 9, 26, 18, 0);

const data: AssistantData = {
  business: {
    id: "main",
    name: "Sharma Kirana",
    phone: "",
    address: "",
    currency: "INR",
    email: "",
    taxNumber: "",
    logoDataUrl: "",
    createdAt: "",
  },
  settings: { ...DEFAULT_SETTINGS },
  products: [
    product("maggi", "Maggi Noodles 70g", 14, { costPrice: 11, stock: 3 }),
    product("coke", "Coke 500ml", 40, { costPrice: 30 }),
    product("parle", "Parle-G Biscuit 100g", 10, { stock: 0 }),
    product("amul-butter", "Amul Butter 100g", 58),
    product("amul-milk", "Amul Milk 500ml", 32),
    product("pen", "Reynolds Pen", 10, { trackStock: false, stock: 0, sku: "PEN01" }),
  ],
  customers: [
    { id: "ramesh", name: "Ramesh Kumar", phone: "9876543210", email: "", address: "", notes: "", createdAt: "" },
    { id: "sita", name: "Sita Devi", phone: "9123456780", email: "", address: "", notes: "", createdAt: "" },
  ],
  orders: [
    order("o1", "INV-00001", yesterday, 68),
    order("o2", "INV-00002", today, 80, { paymentMethodId: "upi", paymentMethodName: "UPI", customerId: "ramesh", customerName: "Ramesh Kumar" }),
    order("o3", "INV-00003", today, 28),
    order("o4", "INV-00004", today, 500, { status: "cancelled" }),
  ],
  orderItems: [
    item("o1", "maggi", "Maggi Noodles 70g", 2, 14),
    item("o1", "coke", "Coke 500ml", 1, 40),
    item("o2", "coke", "Coke 500ml", 2, 40),
    item("o3", "maggi", "Maggi Noodles 70g", 2, 14),
    item("o4", "coke", "Coke 500ml", 12, 40),
  ],
  payments: [
    { id: "cash", name: "Cash", isDefault: true, createdAt: "" },
    { id: "upi", name: "UPI", isDefault: true, createdAt: "" },
    { id: "card", name: "Card", isDefault: true, createdAt: "" },
  ],
};

const ask = (text: string): AgentReply => respond(text, data, NOW);

describe("product matching", () => {
  it("finds a product from a loose, partial name", () => {
    const found = matchByName("parle g", data.products, (p) => [p.name]);
    expect(found.kind === "found" && found.item.id).toBe("parle");
    const typo = matchByName("magi", data.products, (p) => [p.name]);
    expect(typo.kind === "found" && typo.item.id).toBe("maggi");
  });

  it("asks rather than guesses between two close names", () => {
    expect(matchByName("amul", data.products, (p) => [p.name]).kind).toBe("ambiguous");
  });

  it("does not match unrelated words", () => {
    expect(matchByName("shampoo", data.products, (p) => [p.name]).kind).toBe("none");
  });
});

describe("help questions", () => {
  it("answers a how-to instead of doing it", () => {
    const reply = ask("how do I add stock?");
    expect(reply.proposal).toBeUndefined();
    expect(reply.text).toMatch(/stock/i);
    expect(reply.link?.screen).toBe("products");
  });

  it.each([
    ["how to print receipt", "Print or share a receipt"],
    ["gst kaise lagaye", "Set up GST / tax"],
    ["does it work without internet", "Working offline"],
    ["where is my data stored", "Where is my data?"],
    ["how can i give udhaar", "Credit / Udhaar sales"],
    ["how do i use a barcode scanner", "Use a barcode scanner"],
    ["how do I move to a new computer", "Backup and restore"],
  ])("%s → %s", (question, title) => {
    expect(ask(question).text).toBe(title);
  });
});

describe("questions about the shop's data", () => {
  it("reports today's sales, leaving out cancelled bills", () => {
    const reply = ask("today's sales");
    expect(reply.text).toBe("Today: ₹108.00 from 2 bills.");
    expect(reply.bullets).toContain("UPI: ₹80.00");
  });

  it("understands Hinglish periods", () => {
    expect(ask("kal ki sale").text).toBe("Yesterday: ₹68.00 from 1 bill.");
    expect(ask("how much did I sell this month").text).toMatch(/^This month: ₹176\.00 from 3 bills/);
  });

  it("answers Hinglish data questions", () => {
    expect(ask("aaj kitna kamaya").text).toBe("Today: ₹108.00 from 2 bills.");
    expect(ask("kitna stock hai maggi").text).toBe("Maggi Noodles 70g: 3 in stock — running low.");
    expect(ask("customers kitne hai").text).toBe("You have 2 saved customers.");
  });

  it("lists low and out-of-stock products", () => {
    const reply = ask("what is low on stock?");
    expect(reply.bullets).toEqual(["Parle-G Biscuit 100g — out of stock", "Maggi Noodles 70g — 3 left"]);
  });

  it("tells the stock and price of a product", () => {
    expect(ask("stock of maggi").text).toBe("Maggi Noodles 70g: 3 in stock — running low.");
    expect(ask("how many coke left").text).toBe("Coke 500ml: 20 in stock.");
    expect(ask("price of coke").text).toBe("Coke 500ml sells at ₹40.00.");
    expect(ask("maggi ka rate").text).toBe("Maggi Noodles 70g sells at ₹14.00.");
  });

  it("ranks top sellers", () => {
    const reply = ask("top selling products this week");
    expect(reply.bullets?.[0]).toMatch(/^1\. (Maggi|Coca Cola)/);
    expect(reply.bullets).toHaveLength(2);
  });

  it("estimates profit from cost prices", () => {
    const reply = ask("profit today");
    // Coke 2×(40−30) + Maggi 2×(14−11) = 26 on 108 of item sales.
    expect(reply.text).toBe("Gross profit today: about ₹26.00 (24% margin).");
  });

  it("counts a product sold", () => {
    expect(ask("how many maggi sold today").text).toBe("2 Maggi Noodles 70g sold today, worth ₹28.00.");
  });

  it("looks up a bill by number", () => {
    const reply = ask("show INV-00002");
    expect(reply.text).toBe("INV-00002 — ₹80.00");
    expect(reply.bullets).toContain("2 × Coke 500ml — ₹80.00");
  });

  it("looks up a customer", () => {
    const reply = ask("phone of ramesh");
    expect(reply.text).toBe("Ramesh Kumar");
    expect(reply.bullets?.[0]).toBe("Phone: 9876543210");
  });
});

describe("actions are proposed, never performed", () => {
  it("builds a sale from a natural sentence", () => {
    const reply = ask("sell 2 maggi and 1 coke by upi");
    expect(reply.proposal?.action).toMatchObject({
      kind: "sale",
      paymentMethodId: "upi",
      creditSale: false,
      customerId: null,
      lines: [
        { productId: "maggi", quantity: 2, price: 14 },
        { productId: "coke", quantity: 1, price: 40 },
      ],
    });
    expect(reply.proposal?.confirmLabel).toBe("Charge ₹68.00");
  });

  it("defaults to cash, reads Hinglish counts, and finds the customer", () => {
    const reply = ask("becho do maggi to ramesh");
    expect(reply.proposal?.action).toMatchObject({
      kind: "sale",
      paymentMethodId: "cash",
      customerId: "ramesh",
      lines: [{ productId: "maggi", quantity: 2 }],
    });
  });

  it("splits items on commas and reads trailing counts", () => {
    expect(ask("sell 3 parle g, maggi x2 via upi").proposal?.action).toMatchObject({
      paymentMethodId: "upi",
      lines: [
        { productId: "parle", quantity: 3 },
        { productId: "maggi", quantity: 2 },
      ],
    });
  });

  it("warns when a sale exceeds stock", () => {
    expect(ask("sell 5 maggi").proposal?.details).toContain("Only 3 Maggi Noodles 70g in stock.");
  });

  it("needs a saved customer for credit", () => {
    expect(ask("sell 1 coke on credit").proposal).toBeUndefined();
    expect(ask("sell 1 coke on credit to sita").proposal?.action).toMatchObject({ creditSale: true, customerId: "sita" });
  });

  it("asks which product when a name is ambiguous", () => {
    const reply = ask("sell 1 amul");
    expect(reply.proposal).toBeUndefined();
    expect(reply.suggestions).toEqual(expect.arrayContaining(["sell 1 amul butter 100g", "sell 1 amul milk 500ml"]));
  });

  it("refuses to sell a product that doesn't exist", () => {
    const reply = ask("sell 2 shampoo");
    expect(reply.proposal).toBeUndefined();
    expect(reply.text).toMatch(/couldn't find “shampoo”/);
  });

  it.each([
    ["add 24 stock to maggi", "add", 24],
    ["received 12 coke", "add", 12],
    ["restock parle g 30", "add", 30],
    ["reduce maggi by 2", "reduce", 2],
    ["3 coke damaged", "reduce", 3],
    ["set maggi stock to 10", "adjust", 10],
    ["maggi 10 add karo", "add", 10],
  ])("%s", (text, mode, quantity) => {
    expect(ask(text).proposal?.action).toMatchObject({ kind: "stock", mode, quantity });
  });

  it("changes a price", () => {
    expect(ask("change price of coke to 45").proposal?.action).toEqual({ kind: "price", productId: "coke", price: 45 });
    expect(ask("set maggi price to 15").proposal?.action).toEqual({ kind: "price", productId: "maggi", price: 15 });
  });

  it("adds a product, and asks for the price when it is missing", () => {
    expect(ask("add product Good Day Biscuit at 30 with 24 stock").proposal?.action).toEqual({
      kind: "add-product",
      name: "Good Day Biscuit",
      price: 30,
      stock: 24,
    });
    const missing = ask("add product Lays");
    expect(missing.proposal).toBeUndefined();
    expect(missing.text).toMatch(/selling price of Lays/);
  });

  it("adds a customer but not a duplicate", () => {
    expect(ask("add customer Mohan Lal 98765 43211").proposal?.action).toEqual({
      kind: "add-customer",
      name: "Mohan Lal",
      phone: "9876543211",
    });
    expect(ask("add customer ramesh kumar").proposal).toBeUndefined();
  });

  it("cancels a bill by number and the last bill", () => {
    expect(ask("cancel INV-00003").proposal?.action).toEqual({ kind: "cancel-order", orderId: "o3" });
    expect(ask("cancel bill 2").proposal?.action).toEqual({ kind: "cancel-order", orderId: "o2" });
    expect(ask("cancel last bill").proposal?.action).toEqual({ kind: "cancel-order", orderId: "o2" });
    expect(ask("cancel INV-00004").proposal).toBeUndefined();
  });

  it("takes a backup", () => {
    expect(ask("please take a backup").proposal?.action).toEqual({ kind: "backup" });
  });
});

describe("conversation", () => {
  it("greets and navigates", () => {
    expect(ask("hello").suggestions?.length).toBeGreaterThan(0);
    expect(ask("open reports").navigate).toEqual({ screen: "reports" });
    expect(ask("show me products").navigate).toEqual({ screen: "products" });
    expect(ask("i want to add a new product").text).toBe("Add a product");
  });

  it("admits when it does not understand", () => {
    expect(ask("purple elephant dance").text).toMatch(/didn't get that/);
  });
});
