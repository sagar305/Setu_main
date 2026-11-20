import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildEstimateHtml,
  buildInvoiceHtml,
  buildJobSlipHtml,
  isTwoCopy,
  slipPaperOf,
  slipTermsOf,
  trackingUrlFor,
  wrapDocument,
  type PrintContext,
} from "@/lib/repair/print";
import { DEFAULT_SETTINGS, type Bill, type Job, type RepairSettings } from "@/lib/repair/types";

function job(overrides: Partial<Job> = {}): Job {
  const createdAt = new Date(2026, 10, 18, 11, 30).toISOString();
  return {
    id: "job-1",
    jobNo: "JC-0412",
    customerId: "cust-1",
    deviceKind: "laptop",
    brand: "Dell",
    model: "Inspiron 15 3511",
    serialNo: "8HJK2M3",
    colour: "Silver",
    reportedProblems: ["Not switching on", "Battery not charging"],
    problemNote: "Fell from table last week.",
    conditionIn: [
      { id: "c1", label: "Body dented / scratched", present: true, note: "left corner" },
      { id: "c2", label: "Screen scratched / cracked", present: false, note: "" },
      { id: "c3", label: "Hinge loose", present: false, note: "" },
      { id: "c4", label: "Keys missing", present: false, note: "" },
    ],
    intakePhotos: [],
    accessories: ["Charger / adapter", "Bag"],
    unlockCode: "4471",
    estimateAmount: 2500,
    estimateApprovedOn: null,
    promisedDate: "2026-11-22",
    status: "received",
    technicianId: "tech-1",
    priority: "urgent",
    intakeSignatureDataUrl: "",
    customerNotes: "Customer wants data backed up.",
    internalNotes: "Check motherboard short near charging IC.",
    partsUsed: [],
    labourCharge: 0,
    diagnosis: "",
    workDone: "",
    warrantyDays: 90,
    deliveredOn: null,
    deliverySignatureDataUrl: "",
    warrantyClaimOfJobId: null,
    billId: null,
    statusHistory: [],
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

function context(settings: Partial<RepairSettings> = {}, jobOverrides: Partial<Job> = {}): PrintContext {
  return {
    business: {
      id: "main",
      name: "Sharma Laptop Care",
      phone: "98100 12345",
      address: "Shop 14, Nehru Place\nNew Delhi 110019",
      currency: "INR",
      email: "care@example.com",
      taxNumber: "07ABCDE1234F1Z5",
      logoDataUrl: "",
      createdAt: "",
    },
    job: job(jobOverrides),
    customer: {
      id: "cust-1",
      name: "Rohit Verma",
      phone: "98765 43210",
      altPhone: "",
      address: "B-12, Kalkaji",
      companyName: "",
      gstin: "",
      createdAt: "",
      updatedAt: "",
    },
    technician: { id: "tech-1", name: "Amit", phone: "", speciality: "", active: true, createdAt: "" },
    settings: { ...DEFAULT_SETTINGS, ...settings },
  };
}

describe("job card settings", () => {
  it("defaults older records to A5, and A4 to two copies", () => {
    const legacy = { ...DEFAULT_SETTINGS, slipPaperSize: undefined, slipA4Layout: undefined };
    expect(slipPaperOf(legacy)).toBe("a5");
    expect(isTwoCopy(legacy)).toBe(false);
    expect(isTwoCopy({ ...legacy, slipPaperSize: "a4" })).toBe(true);
    expect(isTwoCopy({ ...legacy, slipPaperSize: "a4", slipA4Layout: "single" })).toBe(false);
  });

  it("uses the shop's own terms, one per line, or the defaults when blank", () => {
    expect(slipTermsOf({ ...DEFAULT_SETTINGS, slipTerms: "  " }).length).toBe(4);
    expect(slipTermsOf({ ...DEFAULT_SETTINGS, slipTerms: "No warranty on water damage\n\nPay in cash" })).toEqual([
      "No warranty on water damage",
      "Pay in cash",
    ]);
  });

  it("only offers a tracking QR when tracking is on and a link exists", () => {
    const tracked = job({
      tracking: { code: "x", editToken: "y", url: "https://setu.example/t/x", publishedAt: "", expiresAt: "" },
    });
    expect(trackingUrlFor(tracked, { ...DEFAULT_SETTINGS, trackingEnabled: false })).toBe("");
    expect(trackingUrlFor(tracked, { ...DEFAULT_SETTINGS, trackingEnabled: true })).toBe("https://setu.example/t/x");
    expect(trackingUrlFor(job(), { ...DEFAULT_SETTINGS, trackingEnabled: true })).toBe("");
  });
});

describe("job card content", () => {
  it("never puts the password or internal notes on the customer copy", () => {
    const html = buildJobSlipHtml(context(), "customer");
    expect(html).not.toContain("4471");
    expect(html).not.toContain("motherboard short");
    expect(html).toContain("Customer copy");
    expect(html).toContain("JC-0412");
    expect(html).toContain("Rohit Verma");
  });

  it("puts the password, internal notes and hand-over line on the shop copy", () => {
    const html = buildJobSlipHtml(context(), "shop");
    expect(html).toContain("4471");
    expect(html).toContain("motherboard short");
    expect(html).toContain("Handed over to engineer");
  });

  it("prints both copies with a cut line on A4 two-copy", () => {
    const html = buildJobSlipHtml(context({ slipPaperSize: "a4", slipA4Layout: "two-copy" }));
    expect(html).toContain("CUT HERE");
    expect(html).toContain("Customer copy");
    expect(html).toContain("Shop copy");
  });

  it("prints the condition both ways: damage found and items checked fine", () => {
    const html = buildJobSlipHtml(context(), "customer");
    expect(html).toContain("Body dented / scratched (left corner)");
    expect(html).toContain("Checked — no issue");
    expect(html).toContain("Hinge loose");
  });

  it("numbers the shop's own terms", () => {
    const html = buildJobSlipHtml(context({ slipTerms: "First rule\nSecond rule" }), "customer");
    expect(html).toContain("<li>First rule</li><li>Second rule</li>");
  });

  it("escapes what the shop typed", () => {
    const html = buildJobSlipHtml(context({}, { customerNotes: "<script>x</script>" }), "customer");
    expect(html).not.toContain("<script>x");
    expect(html).toContain("&lt;script&gt;");
  });
});

// Set PRINT_PREVIEW_DIR to write each document to disk for a visual check.
describe("print previews", () => {
  it("writes preview files when asked", () => {
    const dir = process.env.PRINT_PREVIEW_DIR;
    if (!dir) return;
    mkdirSync(dir, { recursive: true });
    const bill: Bill = {
      id: "b1",
      invoiceNo: "INV-0088",
      jobId: "job-1",
      customerId: "cust-1",
      date: "2026-11-21",
      partLines: [{ label: "Charging IC", quantity: 1, unitPrice: 900, amount: 900 }],
      labourCharge: 1200,
      discount: 100,
      taxRate: 0,
      taxAmount: 0,
      total: 2000,
      paid: 2000,
      paymentMode: "UPI",
      createdAt: "",
    };
    const files: [string, string, "a4" | "a5", boolean][] = [
      ["a4-two-copy", buildJobSlipHtml(context({ slipPaperSize: "a4", slipA4Layout: "two-copy" })), "a4", true],
      ["a4-single", buildJobSlipHtml(context({ slipPaperSize: "a4", slipA4Layout: "single" })), "a4", false],
      ["a5-customer", buildJobSlipHtml(context({ slipPaperSize: "a5" })), "a5", false],
      ["a4-shop-copy", buildJobSlipHtml(context({ slipPaperSize: "a4", slipA4Layout: "single" }), "shop"), "a4", false],
      ["a5-estimate", buildEstimateHtml(context()), "a5", false],
      [
        "a4-invoice",
        buildInvoiceHtml({ ...context({}, { deliveredOn: "2026-11-21", workDone: "Replaced charging IC" }), bill }),
        "a4",
        false,
      ],
    ];
    for (const [name, html, paper, twoCopy] of files) {
      writeFileSync(join(dir, `${name}.html`), wrapDocument(html, paper, name, twoCopy));
    }
    expect(files.length).toBe(6);
  });
});
