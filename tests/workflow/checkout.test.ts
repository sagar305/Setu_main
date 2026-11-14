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
import { issueLicenseKey, readLicenseKey } from "@/lib/workflowLicense";
import { issueLicenseKey as issueQrMenuKey, readLicenseKey as readQrMenuKey } from "@/lib/qrMenuLicense";
import { WORKFLOW_PRODUCT_TAG, workflowAmounts, workflowRedeemUrl } from "@/lib/workflowCheckout";
import { licenseForWorkflowOrder, workflowEmailHtml } from "@/lib/workflowOrders";
import { licenseForOrder } from "@/lib/qrMenuOrders";
import { newOrderId, isOrderId, qrMenuOrderFromCashfree, type CashfreeOrder } from "@/lib/cashfree";
import { decodeCustomId, encodeCustomId } from "@/lib/paypal";
import { invoiceNumber } from "@/lib/qrMenuInvoice";

const SECRET = "test-secret";

/**
 * Also asserted in Setu-workflow/tests/license-key.test.ts. If this changes,
 * keys this site sells stop redeeming in Setu Workflow until both change together.
 */
const VECTOR = "SETUWF-QXEURZ-JBMNTL-BGJVW6-JFJIQB-4MRVRI-UN57XD-CIMDFM-O7RV6I-ANQSYN-TDH33Q-Y7YTTK-ZXW";

describe("Setu Workflow keys", () => {
  it("match the vector shared with the Setu Workflow app", () => {
    expect(issueLicenseKey("order-123", 30, 3, SECRET)).toBe(VECTOR);
    expect(readLicenseKey(VECTOR, SECRET)).toEqual({ keyId: "15af4b7ddf472734e009", days: 30, seats: 3 });
  });

  it("can't be read as QR Menu keys or the other way round", () => {
    expect(readLicenseKey(issueQrMenuKey("x", 30, SECRET), SECRET)).toBeNull();
    expect(readQrMenuKey(VECTOR, SECRET)).toBeNull();
  });
});

describe("Setu Workflow prices and tags", () => {
  it("sells the published prices (GST included) for 10 users", () => {
    expect(workflowAmounts("IN")).toEqual({ monthly: 999, yearly: 9999 });
    expect(workflowAmounts("INTL")).toEqual({ monthly: 9.99, yearly: 99.99 });
  });

  it("tags PayPal orders within 127 characters", () => {
    const id = encodeCustomId({ product: WORKFLOW_PRODUCT_TAG, billing: "yearly", region: "INTL", email: "partner@firm.example" });
    expect(id.length).toBeLessThanOrEqual(127);
    expect(decodeCustomId(id)).toEqual({ product: "setu-workflow", billing: "yearly", region: "INTL", email: "partner@firm.example" });
  });

  it("makes Cashfree order ids per product", () => {
    expect(newOrderId("swf")).toMatch(/^swf_/);
    expect(isOrderId(newOrderId("swf"))).toBe(true);
    expect(newOrderId()).toMatch(/^qrm_/);
  });

  it("puts the key after # in the redeem link, so it never reaches a server", () => {
    expect(workflowRedeemUrl("SETUWF-AB")).toBe("https://workflow.setutechnology.com/admin/subscription#key=SETUWF-AB");
  });
});

const cashfreeOrder = (over: Partial<CashfreeOrder> = {}): CashfreeOrder => ({
  order_id: "swf_test_1",
  order_amount: 9999,
  order_currency: "INR",
  order_status: "PAID",
  order_tags: { product: "setu-workflow", billing: "yearly", region: "IN" },
  created_at: "2026-11-07T10:00:00+05:30",
  customer_details: { customer_email: "partner@firm.example", customer_phone: "9876543210" },
  ...over,
});

describe("paid orders", () => {
  it("a paid Workflow order earns a 10-user key for its period; nothing else does", () => {
    const order = qrMenuOrderFromCashfree(cashfreeOrder());
    const license = licenseForWorkflowOrder(order, SECRET)!;
    expect(license).toMatchObject({ days: 365, billing: "yearly", seats: 10 });
    expect(readLicenseKey(license.key, SECRET)).toMatchObject({ days: 365, seats: 10 });
    expect(licenseForWorkflowOrder(order, SECRET)!.key).toBe(license.key);
    expect(licenseForWorkflowOrder(qrMenuOrderFromCashfree(cashfreeOrder({ order_status: "ACTIVE" })), SECRET)).toBeNull();
    // A QR Menu order never mints a Workflow key, and a Workflow order never a QR Menu one.
    expect(licenseForWorkflowOrder(qrMenuOrderFromCashfree(cashfreeOrder({ order_tags: { product: "setu-qr-menu", billing: "yearly" } })), SECRET)).toBeNull();
    expect(licenseForOrder(order, SECRET)).toBeNull();
  });

  it("emails the key with the redeem link and invoices as Setu Workflow", () => {
    const order = qrMenuOrderFromCashfree(cashfreeOrder());
    const license = licenseForWorkflowOrder(order, SECRET)!;
    const html = workflowEmailHtml({ license, invoiceNo: "SWF-20261107-TEST0001", amount: "INR 9999.00", orderId: order.orderId });
    expect(html).toContain(license.key);
    expect(html).toContain(`admin/subscription#key=${encodeURIComponent(license.key)}`);
    expect(html).toContain("up to 10 users");
    expect(invoiceNumber("swf_test_1", new Date("2026-11-07T00:00:00Z"), "SWF")).toBe("SWF-20261107-SWFTEST1");
  });
});

describe("routes", () => {
  const env = { ...process.env };
  beforeEach(() => {
    sent.length = 0;
    Object.assign(process.env, { WORKFLOW_PAYMENTS_ENABLED: "true", WORKFLOW_LICENSE_SECRET: SECRET, CASHFREE_APP_ID: "app", CASHFREE_SECRET_KEY: "sk", RESEND_API_KEY: "re_test" });
  });
  afterEach(() => {
    process.env = { ...env };
    vi.restoreAllMocks();
  });

  it("are switched off (404) until WORKFLOW_PAYMENTS_ENABLED is true", async () => {
    process.env.WORKFLOW_PAYMENTS_ENABLED = "";
    const { GET } = await import("@/app/api/workflow/region/route");
    expect(GET(new NextRequest("https://setutechnology.com/api/workflow/region")).status).toBe(404);
  });

  it("checkout charges the price from pricing.json, tagged as Setu Workflow", async () => {
    let sentBody: { order_amount?: number; order_tags?: Record<string, string>; order_id?: string; order_meta?: { return_url?: string; notify_url?: string } } = {};
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      expect(String(url)).toContain("/orders");
      sentBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ ...sentBody, order_status: "ACTIVE", payment_session_id: "session_x" }), { status: 200 });
    });
    const { POST } = await import("@/app/api/workflow/checkout/route");
    const bad = await POST(new NextRequest("https://setutechnology.com/api/workflow/checkout", { method: "POST", body: JSON.stringify({ billing: "weekly", email: "a@b.co", phone: "9876543210" }), headers: { "x-vercel-ip-country": "IN" } }));
    expect(bad.status).toBe(400);
    const r = await POST(new NextRequest("https://setutechnology.com/api/workflow/checkout", { method: "POST", body: JSON.stringify({ billing: "monthly", email: "Partner@Firm.example", phone: "+91 98765 43210", amount: 1, seats: 50 }), headers: { "x-vercel-ip-country": "IN" } }));
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ provider: "cashfree", paymentSessionId: "session_x" });
    expect(sentBody.order_amount).toBe(999);
    expect(sentBody.order_tags).toMatchObject({ product: "setu-workflow", billing: "monthly", region: "IN" });
    expect(sentBody.order_id).toMatch(/^swf_/);
    expect(sentBody.order_meta?.return_url).toContain("/products/workflow/payment?order_id=");
    expect(sentBody.order_meta?.notify_url).toBe("https://setutechnology.com/api/workflow/webhook");
  });

  it("the order check returns the key once paid and emails it once per order", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(cashfreeOrder()), { status: 200 }));
    const { GET } = await import("@/app/api/workflow/orders/[orderId]/route");
    const r = await GET(new NextRequest("https://setutechnology.com/api/workflow/orders/swf_test_1"), { params: Promise.resolve({ orderId: "swf_test_1" }) });
    const body = await r.json();
    expect(body).toMatchObject({ status: "paid", days: 365, seats: 10 });
    expect(readLicenseKey(body.key, SECRET)).toMatchObject({ days: 365, seats: 10 });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: "partner@firm.example", idempotencyKey: "setu-workflow-license/swf_test_1" });
    expect(sent[0]!.subject).toContain("Setu Workflow license key (1 year)");
    expect(sent[0]!.attachments).toHaveLength(1);
  });

  it("a paid QR Menu order isn't found here", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(cashfreeOrder({ order_id: "qrm_1", order_tags: { product: "setu-qr-menu", billing: "yearly" } })), { status: 200 }));
    const { GET } = await import("@/app/api/workflow/orders/[orderId]/route");
    const r = await GET(new NextRequest("https://setutechnology.com/api/workflow/orders/qrm_1"), { params: Promise.resolve({ orderId: "qrm_1" }) });
    expect(r.status).toBe(404);
    expect(sent).toHaveLength(0);
  });
});
