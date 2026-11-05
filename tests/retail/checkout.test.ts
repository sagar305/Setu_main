import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
// Resend is replaced so the routes' "email the key" step is observable.
const sent: { to: string; subject: string; html: string; idempotencyKey?: string; attachments?: unknown[] }[] = [];
vi.mock("resend", () => ({
  Resend: class {
    emails = {
      send: async (msg: { to: string; subject: string; html: string; attachments?: unknown[] }, opts?: { idempotencyKey?: string }) => {
        sent.push({ ...msg, idempotencyKey: opts?.idempotencyKey });
        return { error: null };
      },
    };
  },
}));

import { NextRequest } from "next/server";
import { issueLicenseKey, readLicenseKey } from "@/lib/retailLicense";
import { issueLicenseKey as issueQrMenuKey } from "@/lib/qrMenuLicense";
import { planFromProductTag, retailAmounts, retailProductTag, retailRedeemUrl, RETAIL_PLANS } from "@/lib/retailCheckout";
import { licenseForRetailOrder, retailEmailHtml } from "@/lib/retailOrders";
import { licenseForOrder } from "@/lib/qrMenuOrders";
import { newOrderId, isOrderId, qrMenuOrderFromCashfree, type CashfreeOrder } from "@/lib/cashfree";
import { decodeCustomId, encodeCustomId } from "@/lib/paypal";
import { buildInvoicePdf, invoiceNumber } from "@/lib/qrMenuInvoice";

const SECRET = "setu-retail-vector-secret";

/**
 * Also asserted in setu-retail-be/test/licenseKey.test.ts. If this changes,
 * keys this site sells stop redeeming in Setu Retail until both change together.
 */
const VECTOR = "SETU-R-456JWV-EW33LS-QS56ZP-7PAGP6-IK2VLU-OO3B53-IB2T5V-TXWE2Z-XDAMNH-KRVT6S-HIX63F-YQ";

describe("Setu Retail keys", () => {
  it("match the vector shared with setu-retail-be", () => {
    expect(issueLicenseKey("vector-order-0001", "gold", 365, SECRET)).toBe(VECTOR);
    expect(readLicenseKey(VECTOR, SECRET)).toMatchObject({ plan: "gold", days: 365 });
  });

  it("can't be read as QR Menu keys or the other way round", () => {
    expect(readLicenseKey(issueQrMenuKey("x", 30, SECRET), SECRET)).toBeNull();
  });
});

describe("Setu Retail prices and tags", () => {
  it("sells the published prices (GST included)", () => {
    expect(RETAIL_PLANS.map((p) => retailAmounts(p, "IN"))).toEqual([
      { monthly: 249, yearly: 2499 },
      { monthly: 499, yearly: 4999 },
      { monthly: 999, yearly: 9999 },
    ]);
    expect(RETAIL_PLANS.map((p) => retailAmounts(p, "INTL"))).toEqual([
      { monthly: 4.99, yearly: 49.99 },
      { monthly: 9.99, yearly: 99.99 },
      { monthly: 19.99, yearly: 199.99 },
    ]);
  });

  it("tags orders with product and plan, and reads them back", () => {
    expect(retailProductTag("platinum")).toBe("setu-retail.platinum");
    expect(planFromProductTag("setu-retail.gold")).toBe("gold");
    expect(planFromProductTag("setu-qr-menu")).toBeNull();
    expect(planFromProductTag("setu-retail.diamond")).toBeNull();
    // PayPal's custom_id keeps the plan (and the email when it fits in 127 chars).
    const id = encodeCustomId({ product: retailProductTag("platinum"), billing: "yearly", region: "INTL", email: "owner@shop.example" });
    expect(id.length).toBeLessThanOrEqual(127);
    expect(decodeCustomId(id)).toEqual({ product: "setu-retail.platinum", billing: "yearly", region: "INTL", email: "owner@shop.example" });
  });

  it("makes Cashfree order ids per product", () => {
    expect(newOrderId("rtl")).toMatch(/^rtl_/);
    expect(isOrderId(newOrderId("rtl"))).toBe(true);
    expect(newOrderId()).toMatch(/^qrm_/);
  });

  it("puts the key after # in the redeem link, so it never reaches a server", () => {
    expect(retailRedeemUrl("SETU-R-AB")).toBe("https://app.retail-pos.setutechnology.com/settings/plan#key=SETU-R-AB");
  });
});

const cashfreeOrder = (over: Partial<CashfreeOrder> = {}): CashfreeOrder => ({
  order_id: "rtl_test_1",
  order_amount: 4999,
  order_currency: "INR",
  order_status: "PAID",
  order_tags: { product: "setu-retail.gold", billing: "yearly", region: "IN" },
  created_at: "2026-11-05T10:00:00+05:30",
  customer_details: { customer_email: "anil@example.com", customer_phone: "9876543210" },
  ...over,
});

describe("paid orders", () => {
  it("a paid Retail order earns a key for its plan and period; nothing else does", () => {
    const order = qrMenuOrderFromCashfree(cashfreeOrder());
    const license = licenseForRetailOrder(order, SECRET)!;
    expect(license).toMatchObject({ plan: "gold", days: 365, billing: "yearly", branches: 10 });
    expect(readLicenseKey(license.key, SECRET)).toMatchObject({ plan: "gold", days: 365 });
    // Same order, same key.
    expect(licenseForRetailOrder(order, SECRET)!.key).toBe(license.key);
    expect(licenseForRetailOrder(qrMenuOrderFromCashfree(cashfreeOrder({ order_status: "ACTIVE" })), SECRET)).toBeNull();
    // A QR Menu order never mints a Retail key, and a Retail order never a QR Menu one.
    expect(licenseForRetailOrder(qrMenuOrderFromCashfree(cashfreeOrder({ order_tags: { product: "setu-qr-menu", billing: "yearly" } })), SECRET)).toBeNull();
    expect(licenseForOrder(order, SECRET)).toBeNull();
  });

  it("emails a branded key with the redeem link, and invoices as Setu Retail", () => {
    const order = qrMenuOrderFromCashfree(cashfreeOrder());
    const license = licenseForRetailOrder(order, SECRET)!;
    const html = retailEmailHtml({ license, invoiceNo: "SRT-20261105-TEST0001", amount: "INR 4999.00", orderId: order.orderId });
    expect(html).toContain(license.key);
    expect(html).toContain(`settings/plan#key=${encodeURIComponent(license.key)}`);
    expect(html).toContain("Setu Retail <strong>Gold</strong>");
    expect(invoiceNumber("rtl_test_1", new Date("2026-11-05T00:00:00Z"), "SRT")).toBe("SRT-20261105-RTLTEST1");
    const pdf = buildInvoicePdf({ orderId: "rtl_test_1", issuedAt: new Date("2026-11-05T00:00:00Z"), billing: "yearly", days: 365, amount: 4999, currency: "INR", customerEmail: "anil@example.com", paidVia: "Cashfree", product: { name: "Setu Retail", line: "Setu Retail Gold, yearly", invoicePrefix: "SRT" } });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  });
});

describe("routes", () => {
  const env = { ...process.env };
  beforeEach(() => {
    sent.length = 0;
    Object.assign(process.env, { RETAIL_PAYMENTS_ENABLED: "true", RETAIL_LICENSE_SECRET: SECRET, CASHFREE_APP_ID: "app", CASHFREE_SECRET_KEY: "sk", RESEND_API_KEY: "re_test" });
  });
  afterEach(() => {
    process.env = { ...env };
    vi.restoreAllMocks();
  });

  it("are switched off (404) until RETAIL_PAYMENTS_ENABLED is true", async () => {
    process.env.RETAIL_PAYMENTS_ENABLED = "";
    const { GET } = await import("@/app/api/retail/region/route");
    expect(GET(new NextRequest("https://setutechnology.com/api/retail/region")).status).toBe(404);
  });

  it("checkout charges the plan's price from pricing.json, tagged with plan and period", async () => {
    let sentBody: { order_amount?: number; order_tags?: Record<string, string>; order_id?: string; order_meta?: { return_url?: string; notify_url?: string } } = {};
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      expect(String(url)).toContain("/orders");
      sentBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ ...sentBody, order_status: "ACTIVE", payment_session_id: "session_x" }), { status: 200 });
    });
    const { POST } = await import("@/app/api/retail/checkout/route");
    const bad = await POST(new NextRequest("https://setutechnology.com/api/retail/checkout", { method: "POST", body: JSON.stringify({ plan: "diamond", billing: "yearly", email: "a@b.co", phone: "9876543210" }), headers: { "x-vercel-ip-country": "IN" } }));
    expect(bad.status).toBe(400);
    const r = await POST(new NextRequest("https://setutechnology.com/api/retail/checkout", { method: "POST", body: JSON.stringify({ plan: "platinum", billing: "monthly", email: "Owner@Shop.example", phone: "+91 98765 43210", amount: 1 }), headers: { "x-vercel-ip-country": "IN" } }));
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ provider: "cashfree", paymentSessionId: "session_x" });
    expect(sentBody.order_amount).toBe(999);
    expect(sentBody.order_tags).toMatchObject({ product: "setu-retail.platinum", billing: "monthly", region: "IN" });
    expect(sentBody.order_id).toMatch(/^rtl_/);
    expect(sentBody.order_meta?.return_url).toContain("/products/retail/payment?order_id=");
    expect(sentBody.order_meta?.notify_url).toBe("https://setutechnology.com/api/retail/webhook");
  });

  it("the order check returns the key once paid and emails it once per order", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(cashfreeOrder()), { status: 200 }));
    const { GET } = await import("@/app/api/retail/orders/[orderId]/route");
    const r = await GET(new NextRequest("https://setutechnology.com/api/retail/orders/rtl_test_1"), { params: Promise.resolve({ orderId: "rtl_test_1" }) });
    const body = await r.json();
    expect(body).toMatchObject({ status: "paid", plan: "gold", days: 365, branches: 10 });
    expect(readLicenseKey(body.key, SECRET)).toMatchObject({ plan: "gold", days: 365 });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: "anil@example.com", idempotencyKey: "setu-retail-license/rtl_test_1" });
    expect(sent[0]!.subject).toContain("Setu Retail Gold key (1 year)");
    expect(sent[0]!.attachments).toHaveLength(1);
  });

  it("a paid QR Menu order isn't found here", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(cashfreeOrder({ order_id: "qrm_1", order_tags: { product: "setu-qr-menu", billing: "yearly" } })), { status: 200 }));
    const { GET } = await import("@/app/api/retail/orders/[orderId]/route");
    const r = await GET(new NextRequest("https://setutechnology.com/api/retail/orders/qrm_1"), { params: Promise.resolve({ orderId: "qrm_1" }) });
    expect(r.status).toBe(404);
    expect(sent).toHaveLength(0);
  });
});
