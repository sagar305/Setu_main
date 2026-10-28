import { describe, expect, it } from "vitest";

import { respond, type AgentReply, type AssistantData } from "@/lib/pos/assistant/agent";
import { continueFlow } from "@/lib/pos/assistant/flows";
import { lapsedRegulars } from "@/lib/pos/assistant/insights";
import { DEFAULT_SETTINGS, type Order } from "@/lib/pos/types";
import { NOW, data } from "./fixtures";

const shop: AssistantData = {
  ...data,
  categories: [
    { id: "snacks", name: "Snacks", createdAt: "" },
    { id: "drinks", name: "Drinks", createdAt: "" },
  ],
};
const taxShop: AssistantData = { ...shop, settings: { ...DEFAULT_SETTINGS, taxEnabled: true, defaultTaxRate: 18 } };

const ask = (text: string, d: AssistantData = shop) => respond(text, d, NOW);

/** Answer each question in turn, starting from a reply that opened a flow. */
function answer(start: AgentReply, answers: string[], d: AssistantData = shop): AgentReply {
  let reply = start;
  for (const a of answers) {
    expect(reply.flow, `no question open before answering “${a}”`).toBeDefined();
    reply = continueFlow(reply.flow!, a, d, NOW);
  }
  return reply;
}

describe("add product: where?", () => {
  it("asks whether a new product or one for the bill", () => {
    const reply = ask("add product");
    expect(reply.text).toMatch(/new product, or add a product to the current bill/);
    expect(reply.suggestions).toEqual(["Create a new product", "Add to the bill"]);
  });

  it("asks bill or stock for a bare “add 2 maggi”", () => {
    const reply = ask("add 2 maggi");
    expect(reply.proposal).toBeUndefined();
    expect(reply.suggestions).toEqual(["add 2 maggi noodles 70g to bill", "add 2 stock to maggi noodles 70g"]);
    expect(ask(reply.suggestions![1]).proposal?.action).toMatchObject({ kind: "stock", mode: "add", quantity: 2 });
  });

  it("puts items in the bill without a confirmation", () => {
    const reply = ask("add 2 maggi and 1 coke to the bill");
    expect(reply.cart).toEqual([
      { productId: "maggi", quantity: 2 },
      { productId: "coke", quantity: 1 },
    ]);
    expect(reply.navigate).toEqual({ screen: "sell" });
    expect(reply.proposal).toBeUndefined();
  });

  it("asks which items when told only “add to the bill”", () => {
    const reply = answer(ask("Add to the bill"), ["3 parle g"]);
    expect(reply.cart).toEqual([{ productId: "parle", quantity: 3 }]);
  });

  it("asks how many for “add stock to maggi”", () => {
    const reply = answer(ask("add stock to maggi"), ["12"]);
    expect(reply.proposal?.action).toEqual({ kind: "stock", productId: "maggi", mode: "add", quantity: 12 });
  });

  it("offers the choices when the product already exists", () => {
    expect(ask("add product maggi noodles 70g").suggestions).toContain("add 1 maggi noodles 70g to bill");
  });
});

describe("new product, field by field", () => {
  it("asks every field and builds the full product", () => {
    const done = answer(
      ask("Create a new product", taxShop),
      ["Parle-G Gold", "25", "Snacks", "pack", "20", "5", "Included in price", "Yes", "40", "10", "PG-GOLD", "8901234567890", "Premium biscuit"],
      taxShop
    );
    expect(done.flow).toBeUndefined();
    expect(done.proposal?.action).toEqual({
      kind: "add-product",
      newCategoryName: null,
      input: {
        name: "Parle-G Gold",
        sellingPrice: 25,
        categoryId: "snacks",
        unit: "pack",
        costPrice: 20,
        taxRate: 5,
        taxInclusive: true,
        trackStock: true,
        stock: 40,
        lowStockThreshold: 10,
        sku: "PG-GOLD",
        barcode: "8901234567890",
        description: "Premium biscuit",
        imageDataUrl: "",
      },
    });
  });

  it("skips tax questions when tax is off, and stock questions when not tracking", () => {
    const steps: string[] = [];
    let reply = ask("new product");
    for (const a of ["Chai", "10", "Skip", "Skip", "Skip", "No", "Skip", "Skip", "Skip"]) {
      steps.push((reply.flow as { step: string }).step);
      reply = continueFlow(reply.flow!, a, shop, NOW);
    }
    expect(steps).toEqual(["name", "price", "category", "unit", "cost", "trackStock", "sku", "barcode", "description"]);
    expect(reply.proposal?.action).toMatchObject({ kind: "add-product", input: { name: "Chai", trackStock: false, taxRate: null } });
  });

  it("creates a new category from a new name", () => {
    const reply = answer(ask("new product"), ["Rose Soap", "35", "Bath care", "Save now"]);
    expect(reply.proposal?.action).toMatchObject({ newCategoryName: "Bath care", input: { categoryId: "" } });
  });

  it("re-asks on a bad answer, goes back, and refuses a duplicate name", () => {
    const flow = ask("new product");
    const dup = continueFlow(flow.flow!, "Maggi Noodles 70g", shop, NOW);
    expect(dup.text).toMatch(/already exists/);
    expect(dup.flow).toMatchObject({ step: "name" });

    const priced = answer(flow, ["Samosa", "free"]);
    expect(priced.text).toMatch(/Selling price must be zero or more/);
    expect(priced.flow).toMatchObject({ step: "price" });

    const back = answer(flow, ["Samosa", "15", "Back"]);
    expect(back.flow).toMatchObject({ step: "price" });
  });

  it("can save early once name and price are known, and cancel any time", () => {
    expect(answer(ask("new product"), ["Samosa", "15", "Save now"]).proposal?.action).toMatchObject({
      input: { name: "Samosa", sellingPrice: 15 },
    });
    const cancelled = answer(ask("new product"), ["Samosa", "cancel"]);
    expect(cancelled.flow).toBeUndefined();
    expect(cancelled.text).toMatch(/cancelled/);
  });

  it("reads a number for “track stock?” as yes, with that opening stock", () => {
    const reply = answer(ask("new product"), ["Samosa", "15", "Skip", "Skip", "Skip", "30"]);
    expect(reply.flow).toMatchObject({ step: "lowStock", draft: { trackStock: true, stock: 30 } });
  });
});

describe("settings by chat", () => {
  it.each([
    ["enable tax", { taxEnabled: true }],
    ["turn on gst", { taxEnabled: true }],
    ["set default tax rate to 18", { defaultTaxRate: 18 }],
    ["tax rate 12", { defaultTaxRate: 12 }],
    ["change invoice prefix to SK-", { invoicePrefix: "SK-" }],
    ["set receipt footer to Visit Again!", { receiptFooter: "Visit Again!" }],
    ["paper size 58mm", { receiptPaperSize: "58mm" }],
    ["hide business info on receipt", { showBusinessInfoOnReceipt: false }],
    ["set next invoice number to 100", { nextInvoiceNumber: 100 }],
  ])("%s", (text, updates) => {
    expect(ask(text).proposal?.action).toMatchObject({ kind: "settings", updates });
  });

  it("turns tax off in Hinglish", () => {
    expect(ask("gst band karo", taxShop).proposal?.action).toMatchObject({ kind: "settings", updates: { taxEnabled: false } });
  });

  it("changes business details, keeping capitals", () => {
    expect(ask("change shop name to Sharma General Store").proposal?.action).toEqual({
      kind: "business",
      updates: { name: "Sharma General Store" },
      label: "Business name",
    });
    expect(ask("set gstin to 27ABCDE1234F1Z5").proposal?.action).toMatchObject({ updates: { taxNumber: "27ABCDE1234F1Z5" } });
    expect(ask("set upi id to sharma@okhdfcbank").proposal?.action).toMatchObject({ updates: { upiId: "sharma@okhdfcbank" } });
  });

  it("checks values like the Settings screen does", () => {
    expect(ask("set default tax rate to 150").text).toBe("Tax percentage must be between 0 and 100.");
    expect(ask("set next invoice number to 0").text).toMatch(/1 or more/);
    expect(ask("set email to not-an-email").text).toMatch(/email address/);
    expect(ask("set auto lock to 5").text).toMatch(/needs a counter PIN/);
  });

  it("says when nothing would change", () => {
    expect(ask("disable tax").text).toBe("Tax (GST) is already Off.");
  });

  it("asks for a value when none is given", () => {
    const reply = ask("change receipt footer");
    expect(reply.text).toMatch(/bottom of every receipt/);
    expect(continueFlow(reply.flow!, "Dhanyavaad!", shop, NOW).proposal?.action).toMatchObject({
      updates: { receiptFooter: "Dhanyavaad!" },
    });
  });

  it("offers a menu for “change settings”", () => {
    const reply = ask("change settings");
    expect(reply.suggestions).toContain("Turn on tax");
    expect(reply.suggestions).toContain("Change invoice prefix");
    expect(ask("Change invoice prefix").flow).toMatchObject({ kind: "ask" });
  });

  it("reports current values", () => {
    expect(ask("what is my tax rate", taxShop).text).toBe("Default tax rate: 18%.");
    expect(ask("is gst on", taxShop).text).toBe("Tax (GST) is On.");
  });

  it("switches connected tools", () => {
    expect(ask("turn on expense tracker").proposal?.action).toMatchObject({
      kind: "settings",
      updates: { connectedTools: ["customer-ledger", "expense-tracker"] },
    });
    expect(ask("disable udhaar").proposal?.action).toMatchObject({ updates: { connectedTools: [] } });
  });

  it("adds and removes payment methods", () => {
    expect(ask("add payment method PhonePe").proposal?.action).toEqual({ kind: "payment-add", name: "PhonePe" });
    expect(ask("remove card payment").proposal?.action).toEqual({ kind: "payment-remove", id: "card" });
    expect(ask("add payment method").flow).toMatchObject({ kind: "ask" });
  });

  it("keeps the PIN on the Settings screen", () => {
    const reply = ask("change my pin to 1234");
    expect(reply.proposal).toBeUndefined();
    expect(reply.link?.screen).toBe("settings");
  });

  it("does not mistake stock and price commands for settings", () => {
    expect(ask("set maggi stock to 10").proposal?.action).toMatchObject({ kind: "stock" });
    expect(ask("change price of coke to 45").proposal?.action).toMatchObject({ kind: "price" });
    expect(ask("remove 2 maggi from stock").proposal?.action).toMatchObject({ kind: "stock", mode: "reduce" });
  });
});

describe("customer insights", () => {
  // Ramesh came every 3 days for a month, then stopped 40 days ago.
  // Sita comes every week and came 2 days ago.
  const day = (daysAgo: number, hour = 11) => new Date(NOW.getTime() - daysAgo * 86_400_000 + (hour - 15) * 3_600_000);
  const bill = (id: string, customerId: string | null, daysAgo: number, total: number): Order => ({
    id,
    invoiceNumber: id,
    date: day(daysAgo).toISOString(),
    customerId,
    customerName: customerId ?? "",
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
    createdAt: "",
  });
  const history: AssistantData = {
    ...shop,
    orders: [
      ...[70, 67, 64, 61, 58, 55, 52, 49, 46, 43, 40].map((d, i) => bill(`r${i}`, "ramesh", d, 500)),
      ...[30, 23, 16, 9, 2].map((d, i) => bill(`s${i}`, "sita", d, 300)),
      bill("w1", null, 1, 1000),
    ],
    orderItems: [],
  };
  const q = (text: string) => respond(text, history, NOW);

  it("finds regulars who stopped coming", () => {
    const lapsed = lapsedRegulars(history, NOW);
    expect(lapsed.map((s) => s.customer.id)).toEqual(["ramesh"]);
    const reply = q("which regular customers have not come for a long time");
    expect(reply.text).toBe("1 regular has stopped coming — worth a call:");
    expect(reply.bullets?.[0]).toBe("Ramesh Kumar (9876543210) — last came 40 days ago, usually about every 3 days; 11 visits, ₹5,500.00");
    expect(q("kaun se grahak nahi aaye").text).toMatch(/stopped coming/);
  });

  it("ranks customers by revenue, with the walk-in share", () => {
    const reply = q("which customer gave the most revenue");
    expect(reply.bullets?.slice(0, 2)).toEqual([
      "1. Ramesh Kumar — ₹5,500.00 from 11 visits",
      "2. Sita Devi — ₹1,500.00 from 5 visits",
    ]);
    expect(reply.bullets).toContain("Walk-in (unsaved) customers: 13% of sales");
    expect(q("top customers this month").bullets?.[0]).toBe("1. Sita Devi — ₹1,200.00 from 4 visits");
  });

  it("lists the most frequent customers and a customer overview", () => {
    expect(q("most regular customers").bullets?.[0]).toMatch(/^Ramesh Kumar — 11 visits, about every 3 days/);
    expect(q("customer insights").bullets).toContain("2 regulars (3+ visits); 1 have stopped coming");
  });

  it("finds new customers in a period", () => {
    expect(q("new customers this month").text).toBe("No new customers this month.");
  });

  it("finds slow-moving stock and the busiest day", () => {
    expect(respond("slow moving products", data, NOW).text).toMatch(/haven't sold in 30 days/);
    expect(q("busiest day").text).toMatch(/^Busiest day: \w+day\. Busiest hour: 11 am–12 pm\.$/);
  });
});
