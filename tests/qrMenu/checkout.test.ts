import { createHmac } from "node:crypto";
import { writeFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

// lib/cashfree.ts is server-only; the marker throws outside a server bundle.
vi.mock("server-only", () => ({}));

import { issueLicenseKey, readLicenseKey, MAX_LICENSE_DAYS } from "@/lib/qrMenuLicense";
import {
  BILLING_DAYS,
  normaliseCheckoutPhone,
  pricingRegion,
  qrMenuAmounts,
  regionFor,
} from "@/lib/qrMenuCheckout";
import { isOrderId, newOrderId, verifyWebhookSignature, type CashfreeOrder } from "@/lib/cashfree";
import { licenseEmailHtml, licenseForOrder, ORDER_PRODUCT_TAG } from "@/lib/qrMenuOrders";
import { buildInvoicePdf, invoiceNumber, splitInclusiveGst } from "@/lib/qrMenuInvoice";

const SECRET = "shared-test-vector-secret";

/**
 * Also asserted in menu-qr-generator-be/scripts/unit.test.ts. If this changes,
 * keys this site sells stop redeeming until the backend changes with it.
 */
const VECTOR = {
  orderId: "qrm_test_vector_order",
  days: 365,
  key: "SETU-B43Y7W-EBWODU-4LM2N4-KSEFS7-SEU7ZO-723ODO-NF3LW3-EWNINW-4X7DHY-W5FI5Q-D4IUGY",
};

describe("license keys", () => {
  it("matches the vector shared with the backend", () => {
    expect(issueLicenseKey(VECTOR.orderId, VECTOR.days, SECRET)).toBe(VECTOR.key);
    expect(readLicenseKey(VECTOR.key, SECRET)?.days).toBe(365);
  });

  it("gives the same key for the same order and a different one per order", () => {
    const a = issueLicenseKey("order_a", 30, SECRET);
    expect(issueLicenseKey("order_a", 30, SECRET)).toBe(a);
    const b = issueLicenseKey("order_b", 30, SECRET);
    expect(b).not.toBe(a);
    expect(readLicenseKey(a, SECRET)?.keyId).not.toBe(readLicenseKey(b, SECRET)?.keyId);
  });

  it("tolerates case, spacing, a missing prefix and look-alike digits", () => {
    const key = issueLicenseKey("order_c", 30, SECRET);
    const body = key.replace(/^SETU-/, "").replace(/-/g, "");
    expect(readLicenseKey(key.toLowerCase(), SECRET)?.days).toBe(30);
    expect(readLicenseKey(`  ${key.replace(/-/g, " ")} `, SECRET)?.days).toBe(30);
    expect(readLicenseKey(body, SECRET)?.days).toBe(30);
    expect(readLicenseKey(body.replace(/O/g, "0").replace(/I/g, "1"), SECRET)?.days).toBe(30);
  });

  it("rejects a wrong secret, an edited key and junk", () => {
    const key = issueLicenseKey("order_d", 365, SECRET);
    expect(readLicenseKey(key, "another-secret")).toBeNull();
    const last = key.at(-1) === "A" ? "B" : "A";
    expect(readLicenseKey(key.slice(0, -1) + last, SECRET)).toBeNull();
    expect(readLicenseKey("SETU-NOT-A-KEY", SECRET)).toBeNull();
    expect(readLicenseKey("", SECRET)).toBeNull();
  });

  it("refuses to issue out-of-range days", () => {
    expect(() => issueLicenseKey("o", 0, SECRET)).toThrow();
    expect(() => issueLicenseKey("o", MAX_LICENSE_DAYS + 1, SECRET)).toThrow();
    expect(() => issueLicenseKey("o", 1.5, SECRET)).toThrow();
  });
});

describe("checkout", () => {
  it("sells 30 and 365 days at the published prices", () => {
    expect(BILLING_DAYS).toEqual({ monthly: 30, yearly: 365 });
    expect(qrMenuAmounts("IN")).toEqual({ monthly: 49, yearly: 499 });
    expect(qrMenuAmounts("INTL")).toEqual({ monthly: 0.99, yearly: 9.99 });
  });

  it("picks the region from the country, then the timezone", () => {
    expect(regionFor("IN", null)).toBe("IN");
    expect(regionFor("in", "America/New_York")).toBe("IN");
    expect(regionFor("US", "Asia/Kolkata")).toBe("INTL");
    expect(regionFor(null, "Asia/Kolkata")).toBe("IN");
    expect(regionFor("XX", "Asia/Calcutta")).toBe("IN");
    expect(regionFor(null, "Europe/London")).toBe("INTL");
    expect(regionFor(null, null)).toBe("INTL");
  });

  it("normalises phone numbers for Cashfree", () => {
    expect(normaliseCheckoutPhone("+91 98765 43210", "IN")).toBe("9876543210");
    expect(normaliseCheckoutPhone("09876543210", "IN")).toBe("9876543210");
    expect(normaliseCheckoutPhone("12345", "IN")).toBeNull();
    expect(normaliseCheckoutPhone("5876543210", "IN")).toBeNull();
    expect(normaliseCheckoutPhone("+1 (555) 123-4567", "INTL")).toBe("15551234567");
    expect(normaliseCheckoutPhone("123", "INTL")).toBeNull();
  });

  it("makes order ids Cashfree accepts", () => {
    const id = newOrderId();
    expect(isOrderId(id)).toBe(true);
    expect(newOrderId()).not.toBe(id);
    expect(isOrderId("../etc")).toBe(false);
  });

  it("verifies webhook signatures over timestamp + raw body", () => {
    const body = '{"type":"PAYMENT_SUCCESS_WEBHOOK"}';
    const signature = createHmac("sha256", "sk").update(`1700000000${body}`).digest("base64");
    expect(verifyWebhookSignature("sk", "1700000000", body, signature)).toBe(true);
    expect(verifyWebhookSignature("sk", "1700000001", body, signature)).toBe(false);
    expect(verifyWebhookSignature("other", "1700000000", body, signature)).toBe(false);
    expect(verifyWebhookSignature("sk", null, body, signature)).toBe(false);
  });
});

describe("paid orders", () => {
  const order = (overrides: Partial<CashfreeOrder> = {}): CashfreeOrder => ({
    order_id: "qrm_paid",
    order_amount: 499,
    order_currency: "INR",
    order_status: "PAID",
    order_tags: { product: ORDER_PRODUCT_TAG, billing: "yearly", region: "IN" },
    ...overrides,
  });

  it("turns a paid order into a key for its billing period", () => {
    const license = licenseForOrder(order(), SECRET);
    expect(license?.days).toBe(365);
    expect(readLicenseKey(license!.key, SECRET)?.days).toBe(365);
    const monthly = licenseForOrder(order({ order_tags: { product: ORDER_PRODUCT_TAG, billing: "monthly" } }), SECRET);
    expect(monthly?.days).toBe(30);
  });

  it("gives nothing for unpaid or foreign orders", () => {
    expect(licenseForOrder(order({ order_status: "ACTIVE" }), SECRET)).toBeNull();
    expect(licenseForOrder(order({ order_tags: { product: "other", billing: "yearly" } }), SECRET)).toBeNull();
    expect(licenseForOrder(order({ order_tags: null }), SECRET)).toBeNull();
  });
});

describe("invoice", () => {
  it("numbers invoices stably per order", () => {
    const date = new Date("2026-10-13T10:00:00Z");
    expect(invoiceNumber("qrm_abc_0123456789abcdef", date)).toBe("SQM-20261013-89ABCDEF");
    expect(invoiceNumber("qrm_abc_0123456789abcdef", date)).toBe(
      invoiceNumber("qrm_abc_0123456789abcdef", date)
    );
  });

  it("splits a GST-inclusive price without changing the total", () => {
    for (const amount of [49, 499, 1]) {
      const { taxable, cgst, sgst } = splitInclusiveGst(amount);
      expect(Math.round((taxable + cgst + sgst) * 100) / 100).toBe(amount);
    }
    expect(splitInclusiveGst(499)).toEqual({ taxable: 422.88, cgst: 38.06, sgst: 38.06 });
  });

  it("builds a PDF", () => {
    const pdf = buildInvoicePdf({
      orderId: "qrm_mg8x2k1a_0123456789abcdef01234567",
      issuedAt: new Date("2026-10-13T10:00:00Z"),
      billing: "yearly",
      days: 365,
      amount: 499,
      currency: "INR",
      customerEmail: "owner@example.com",
      customerPhone: "9876543210",
    });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    if (process.env.INVOICE_SAMPLE_PATH) {
      writeFileSync(process.env.INVOICE_SAMPLE_PATH, pdf);
    }
  });
});

describe("license email", () => {
  it("shows the key, amount and invoice, escaping anything it is handed", () => {
    const html = licenseEmailHtml({
      license: { key: VECTOR.key, days: 365, billing: "yearly" },
      settingsUrl: "https://app.qr-menu.setutechnology.com/app/settings",
      invoiceNo: "SQM-20261013-01234567",
      amount: "INR 499.00",
      orderId: "qrm_<x>",
    });
    expect(html).toContain(VECTOR.key);
    expect(html).toContain("INR 499.00");
    expect(html).toContain("SQM-20261013-01234567");
    expect(html).toContain("qrm_&#60;x&#62;");
    if (process.env.EMAIL_SAMPLE_PATH) writeFileSync(process.env.EMAIL_SAMPLE_PATH, html);
  });
});

describe("pricing region", () => {
  it("charges buyers abroad in rupees until USD is switched on", () => {
    expect(pricingRegion("IN", false)).toBe("IN");
    expect(pricingRegion("INTL", false)).toBe("IN");
    expect(pricingRegion("INTL", true)).toBe("INTL");
    expect(pricingRegion("IN", true)).toBe("IN");
  });
});
