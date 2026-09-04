import { describe, expect, it } from "vitest";
import {
  agingLevel,
  billDue,
  billTotals,
  daysInShop,
  isNagDue,
  isOverdue,
  isUncollected,
  isWarrantyClaim,
  jobMargin,
  lastNaggedAt,
  partsCostTotal,
  partsSellingTotal,
  readySince,
  repeatFailures,
  stockDeltas,
  turnaroundDays,
  warrantyDaysLeft,
  warrantyEndOf,
  warrantyStateOf,
} from "@/lib/repair/calc";
import {
  estimateConversion,
  jobsByStatus,
  marginReport,
  repeatFailureReport,
  technicianThroughput,
  turnaroundByKind,
  uncollectedDevices,
} from "@/lib/repair/reports";
import { fillTemplate, jobVars } from "@/lib/repair/messages";
import {
  DEFAULT_SETTINGS,
  addDays,
  daysBetween,
  deviceLabel,
  jobNumberFrom,
  toDateKey,
  whatsAppNumber,
  type Bill,
  type Job,
  type JobStatus,
  type Part,
  type PartUsage,
  type StatusChange,
} from "@/lib/repair/types";

const TODAY = "2026-09-04";

/** An ISO timestamp at local noon on a given day key — never midnight, which
 *  would let a timezone nudge the date across. */
function at(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0).toISOString();
}

function change(to: JobStatus, on: string, extra: Partial<StatusChange> = {}): StatusChange {
  return {
    id: `${to}-${on}`,
    from: null,
    to,
    at: at(on),
    note: "",
    notifiedAt: null,
    ...extra,
  };
}

function job(overrides: Partial<Job> = {}): Job {
  const createdAt = overrides.createdAt ?? at("2026-09-01");
  return {
    id: "job-1",
    jobNo: "JC-0001",
    customerId: "cust-1",
    deviceKind: "mobile",
    brand: "Samsung",
    model: "Galaxy M31",
    serialNo: "868123456789012",
    colour: "Black",
    reportedProblems: ["Screen broken / not displaying"],
    problemNote: "",
    conditionIn: [],
    intakePhotos: [],
    accessories: [],
    unlockCode: "",
    estimateAmount: null,
    estimateApprovedOn: null,
    promisedDate: null,
    status: "received",
    technicianId: null,
    priority: "normal",
    intakeSignatureDataUrl: "",
    customerNotes: "",
    internalNotes: "",
    partsUsed: [],
    labourCharge: 0,
    diagnosis: "",
    workDone: "",
    warrantyDays: 90,
    deliveredOn: null,
    deliverySignatureDataUrl: "",
    warrantyClaimOfJobId: null,
    billId: null,
    statusHistory: [change("received", "2026-09-01")],
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

function part(overrides: Partial<PartUsage> = {}): PartUsage {
  return {
    id: "pu-1",
    partId: "part-1",
    name: "M31 display",
    quantity: 1,
    costPrice: 2200,
    sellingPrice: 3500,
    supplierWarrantyDays: 30,
    ...overrides,
  };
}

function bill(overrides: Partial<Bill> = {}): Bill {
  return {
    id: "bill-1",
    invoiceNo: "INV-0001",
    jobId: "job-1",
    customerId: "cust-1",
    date: "2026-09-03",
    partLines: [],
    labourCharge: 500,
    discount: 0,
    taxRate: 0,
    taxAmount: 0,
    total: 4000,
    paid: 4000,
    paymentMode: "Cash",
    createdAt: at("2026-09-03"),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// §4 — Days in shop and ageing
// ---------------------------------------------------------------------------

describe("days in shop", () => {
  it("counts from intake to today while the device is still here", () => {
    expect(daysInShop(job({ createdAt: at("2026-09-01") }), TODAY)).toBe(3);
  });

  it("stops counting once the device has gone back", () => {
    const delivered = job({
      createdAt: at("2026-08-01"),
      status: "delivered",
      deliveredOn: "2026-08-06",
    });
    // Five days, not the thirty-four it has been since — the customer has been
    // using the device for most of that.
    expect(daysInShop(delivered, TODAY)).toBe(5);
  });

  it("stops counting for a job returned unrepaired or cancelled", () => {
    const returned = job({
      createdAt: at("2026-08-01"),
      status: "returned-unrepaired",
      updatedAt: at("2026-08-03"),
    });
    expect(daysInShop(returned, TODAY)).toBe(2);
  });

  it("never goes negative on a job created later than the reference day", () => {
    expect(daysInShop(job({ createdAt: at("2026-09-10") }), TODAY)).toBe(0);
  });
});

describe("ageing", () => {
  const settings = { ...DEFAULT_SETTINGS, agingAmberDays: 3, agingRedDays: 7 };

  it("is fresh below the amber threshold", () => {
    expect(agingLevel(job({ createdAt: at("2026-09-03") }), settings, TODAY)).toBe("fresh");
  });

  it("turns amber exactly at the amber threshold", () => {
    expect(agingLevel(job({ createdAt: at("2026-09-01") }), settings, TODAY)).toBe("amber");
  });

  it("turns red exactly at the red threshold", () => {
    expect(agingLevel(job({ createdAt: at("2026-08-28") }), settings, TODAY)).toBe("red");
  });

  it("never colours a job that has left the shop, however long it took", () => {
    const delivered = job({
      createdAt: at("2026-06-01"),
      status: "delivered",
      deliveredOn: "2026-08-01",
    });
    expect(agingLevel(delivered, settings, TODAY)).toBe("fresh");
  });
});

describe("overdue promises", () => {
  it("flags a device still here past its promised date", () => {
    expect(isOverdue(job({ promisedDate: "2026-09-02" }), TODAY)).toBe(true);
  });

  it("does not flag a promise that is still in the future", () => {
    expect(isOverdue(job({ promisedDate: "2026-09-06" }), TODAY)).toBe(false);
  });

  it("does not flag a delivered job, late or not", () => {
    const delivered = job({
      promisedDate: "2026-09-02",
      status: "delivered",
      deliveredOn: "2026-09-03",
    });
    expect(isOverdue(delivered, TODAY)).toBe(false);
  });

  it("does not flag a job with no promise made", () => {
    expect(isOverdue(job({ promisedDate: null }), TODAY)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// §4 — Uncollected and the nag cycle
// ---------------------------------------------------------------------------

describe("uncollected devices", () => {
  const settings = { ...DEFAULT_SETTINGS, uncollectedNagDays: 3 };

  const ready = (readyOn: string, history: StatusChange[] = []) =>
    job({
      status: "ready",
      statusHistory: [change("received", "2026-08-20"), change("ready", readyOn), ...history],
    });

  it("reads the ready date off the last move into ready", () => {
    const rework = job({
      status: "ready",
      statusHistory: [
        change("ready", "2026-08-20"),
        change("in-repair", "2026-08-22"),
        change("ready", "2026-08-30"),
      ],
    });
    // The second time it became ready is when the customer was told to collect.
    expect(readySince(rework)).toBe("2026-08-30");
  });

  it("is not uncollected until past the interval", () => {
    expect(isUncollected(ready("2026-09-01"), settings, TODAY)).toBe(false);
  });

  it("is uncollected once past the interval", () => {
    expect(isUncollected(ready("2026-08-31"), settings, TODAY)).toBe(true);
  });

  it("is never uncollected unless the status is ready", () => {
    const inRepair = job({
      status: "in-repair",
      statusHistory: [change("ready", "2026-08-01")],
    });
    expect(isUncollected(inRepair, settings, TODAY)).toBe(false);
  });

  it("is due a nag the first time, with no reminder yet sent", () => {
    expect(isNagDue(ready("2026-08-25"), settings, TODAY)).toBe(true);
  });

  it("is not due another nag inside the interval", () => {
    const nagged = ready("2026-08-25", [
      { ...change("ready", "2026-09-03", { from: "ready" }), notifiedAt: at("2026-09-03") },
    ]);
    expect(lastNaggedAt(nagged)).toBe(at("2026-09-03"));
    expect(isNagDue(nagged, settings, TODAY)).toBe(false);
  });

  it("does not treat a reminder as the device becoming ready again", () => {
    const nagged = ready("2026-08-20", [
      { ...change("ready", "2026-09-03", { from: "ready" }), notifiedAt: at("2026-09-03") },
    ]);
    // The clock runs from when it actually became ready, not from the last time
    // somebody was chased about it.
    expect(readySince(nagged)).toBe("2026-08-20");
    expect(isUncollected(nagged, settings, TODAY)).toBe(true);
  });

  it("is due again once the interval has passed since the last nag", () => {
    const nagged = ready("2026-08-20", [
      { ...change("ready", "2026-09-01", { from: "ready" }), notifiedAt: at("2026-09-01") },
    ]);
    expect(isNagDue(nagged, settings, TODAY)).toBe(true);
  });

  it("totals the value tied up on the ready shelf", () => {
    const jobs = [
      { ...ready("2026-08-25"), id: "a", labourCharge: 500, partsUsed: [part()] },
      { ...ready("2026-08-26"), id: "b", labourCharge: 800, partsUsed: [] },
    ];
    const report = uncollectedDevices(jobs, [], DEFAULT_SETTINGS, TODAY);
    expect(report.rows).toHaveLength(2);
    expect(report.totalValue).toBe(4800);
  });
});

// ---------------------------------------------------------------------------
// §4 — Money and margin
// ---------------------------------------------------------------------------

describe("bill totals", () => {
  it("adds parts and labour with no tax when tax is off", () => {
    const totals = billTotals(
      { partsUsed: [part()], labourCharge: 500 },
      { ...DEFAULT_SETTINGS, taxEnabled: false }
    );
    expect(totals.partsTotal).toBe(3500);
    expect(totals.taxAmount).toBe(0);
    expect(totals.total).toBe(4000);
  });

  it("takes the discount off before tax is applied", () => {
    const totals = billTotals(
      { partsUsed: [part()], labourCharge: 500, discount: 200, taxRate: 18 },
      { ...DEFAULT_SETTINGS, taxEnabled: true }
    );
    expect(totals.taxable).toBe(3800);
    expect(totals.taxAmount).toBe(684);
    expect(totals.total).toBe(4484);
  });

  it("never lets a discount larger than the bill push the total negative", () => {
    const totals = billTotals(
      { partsUsed: [], labourCharge: 300, discount: 1000 },
      DEFAULT_SETTINGS
    );
    expect(totals.taxable).toBe(0);
    expect(totals.total).toBe(0);
  });

  it("multiplies part prices by their quantity", () => {
    const parts = [part({ quantity: 3, costPrice: 100, sellingPrice: 250 })];
    expect(partsSellingTotal(parts)).toBe(750);
    expect(partsCostTotal(parts)).toBe(300);
  });

  it("reports what is still owed on a part-paid bill", () => {
    expect(billDue(bill({ total: 4000, paid: 2500 }))).toBe(1500);
    expect(billDue(bill({ total: 4000, paid: 4000 }))).toBe(0);
  });
});

describe("margin", () => {
  it("is revenue less the parts cost, with labour as pure margin", () => {
    const repaired = job({ partsUsed: [part()], labourCharge: 500 });
    // 4000 billed − 2200 the screen cost = 1800.
    expect(jobMargin(repaired, null, DEFAULT_SETTINGS)).toBe(1800);
  });

  it("measures against the billed total once a bill exists, net of tax", () => {
    const repaired = job({ partsUsed: [part()], labourCharge: 500 });
    const withTax = bill({ total: 4720, taxAmount: 720 });
    expect(jobMargin(repaired, withTax, DEFAULT_SETTINGS)).toBe(1800);
  });

  it("is the whole amount when nothing was bought in", () => {
    const softwareOnly = job({ partsUsed: [], labourCharge: 600 });
    expect(jobMargin(softwareOnly, null, DEFAULT_SETTINGS)).toBe(600);
  });
});

// ---------------------------------------------------------------------------
// §4 — Warranty
// ---------------------------------------------------------------------------

describe("warranty", () => {
  const delivered = (on: string, days = 90) =>
    job({ status: "delivered", deliveredOn: on, warrantyDays: days });

  it("runs from delivery for the number of days given", () => {
    expect(warrantyEndOf(delivered("2026-08-01", 90))).toBe("2026-10-30");
  });

  it("covers a repair inside the window", () => {
    expect(warrantyStateOf(delivered("2026-08-01"), TODAY)).toBe("covered");
    expect(warrantyDaysLeft(delivered("2026-08-01"), TODAY)).toBe(56);
  });

  it("counts the expiry day itself as still covered", () => {
    const expiring = delivered("2026-06-06", 90);
    expect(warrantyEndOf(expiring)).toBe(TODAY);
    expect(warrantyStateOf(expiring, TODAY)).toBe("covered");
    expect(warrantyDaysLeft(expiring, TODAY)).toBe(0);
  });

  it("is expired the day after", () => {
    expect(warrantyStateOf(delivered("2026-06-05", 90), TODAY)).toBe("expired");
  });

  it("reports none when no warranty was given", () => {
    expect(warrantyStateOf(delivered("2026-08-01", 0), TODAY)).toBe("none");
    expect(warrantyEndOf(delivered("2026-08-01", 0))).toBe("");
  });

  it("has nothing to report before delivery", () => {
    expect(warrantyStateOf(job({ status: "ready" }), TODAY)).toBe("not-delivered");
  });

  it("recognises a claim by its link back to the original", () => {
    expect(isWarrantyClaim(job({ warrantyClaimOfJobId: "job-1" }))).toBe(true);
    expect(isWarrantyClaim(job())).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// §4 — Repeat failures
// ---------------------------------------------------------------------------

describe("repeat failures", () => {
  it("pairs jobs on the same serial inside the window", () => {
    const first = job({
      id: "a",
      serialNo: "868111",
      createdAt: at("2026-07-01"),
      deliveredOn: "2026-07-03",
      status: "delivered",
    });
    const second = job({ id: "b", serialNo: "868111", createdAt: at("2026-07-20") });
    const found = repeatFailures([first, second]);
    expect(found).toHaveLength(1);
    expect(found[0].serialNo).toBe("868111");
    expect(found[0].jobs).toHaveLength(2);
  });

  it("ignores a return outside the window", () => {
    const first = job({
      id: "a",
      serialNo: "868111",
      createdAt: at("2026-01-01"),
      deliveredOn: "2026-01-03",
      status: "delivered",
    });
    const second = job({ id: "b", serialNo: "868111", createdAt: at("2026-07-20") });
    expect(repeatFailures([first, second])).toHaveLength(0);
  });

  it("matches serials case-insensitively and ignores jobs with none", () => {
    const first = job({ id: "a", serialNo: "abc123", createdAt: at("2026-07-01") });
    const second = job({ id: "b", serialNo: "ABC123", createdAt: at("2026-07-10") });
    const blank1 = job({ id: "c", serialNo: "", createdAt: at("2026-07-11") });
    const blank2 = job({ id: "d", serialNo: "  ", createdAt: at("2026-07-12") });
    const found = repeatFailures([first, second, blank1, blank2]);
    expect(found).toHaveLength(1);
    expect(found[0].serialNo).toBe("ABC123");
  });
});

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

describe("reports", () => {
  it("counts devices physically in the shop, not rows", () => {
    const jobs = [
      job({ id: "a", status: "received" }),
      job({ id: "b", status: "in-repair" }),
      job({ id: "c", status: "delivered", deliveredOn: "2026-09-02" }),
      job({ id: "d", status: "cancelled" }),
    ];
    const report = jobsByStatus(jobs, DEFAULT_SETTINGS, TODAY);
    expect(report.inShop).toBe(2);
  });

  it("leaves warranty claims out of revenue and counts them as rework", () => {
    const paid = job({
      id: "a",
      status: "delivered",
      deliveredOn: "2026-09-02",
      partsUsed: [part()],
      labourCharge: 500,
    });
    const claim = job({
      id: "b",
      status: "delivered",
      deliveredOn: "2026-09-03",
      warrantyClaimOfJobId: "a",
      partsUsed: [part({ id: "pu-2" })],
      labourCharge: 0,
    });
    const report = marginReport([paid, claim], [], DEFAULT_SETTINGS);
    expect(report.rows).toHaveLength(1);
    expect(report.revenue).toBe(4000);
    expect(report.margin).toBe(1800);
    expect(report.reworkJobs).toBe(1);
  });

  it("averages turnaround by device kind", () => {
    const jobs = [
      job({ id: "a", deviceKind: "mobile", createdAt: at("2026-09-01"), deliveredOn: "2026-09-03" }),
      job({ id: "b", deviceKind: "mobile", createdAt: at("2026-09-01"), deliveredOn: "2026-09-05" }),
      job({ id: "c", deviceKind: "laptop", createdAt: at("2026-09-01"), deliveredOn: "2026-09-08" }),
    ];
    const rows = turnaroundByKind(jobs);
    expect(rows.find((row) => row.key === "mobile")?.averageDays).toBe(3);
    expect(rows.find((row) => row.key === "laptop")?.averageDays).toBe(7);
  });

  it("returns nothing for a job that never went out", () => {
    expect(turnaroundDays(job({ deliveredOn: null }))).toBeNull();
  });

  it("groups throughput by technician and names the unassigned", () => {
    const jobs = [
      job({
        id: "a",
        status: "delivered",
        deliveredOn: "2026-09-03",
        technicianId: "t1",
        labourCharge: 500,
      }),
      job({ id: "b", status: "delivered", deliveredOn: "2026-09-03", technicianId: null }),
    ];
    const rows = technicianThroughput(
      jobs,
      [],
      [{ id: "t1", name: "Imran", phone: "", speciality: "", active: true, createdAt: at("2026-01-01") }],
      DEFAULT_SETTINGS
    );
    expect(rows.map((row) => row.name).sort()).toEqual(["Imran", "Unassigned"]);
  });

  it("counts an estimate as sent from the history, not the current status", () => {
    const converted = job({
      id: "a",
      status: "delivered",
      deliveredOn: "2026-09-03",
      estimateApprovedOn: "2026-09-02",
      statusHistory: [change("estimate-sent", "2026-09-01"), change("approved", "2026-09-02")],
    });
    const declined = job({
      id: "b",
      status: "returned-unrepaired",
      statusHistory: [change("estimate-sent", "2026-09-01")],
    });
    const waiting = job({
      id: "c",
      status: "estimate-sent",
      statusHistory: [change("estimate-sent", "2026-09-03")],
    });
    const report = estimateConversion([converted, declined, waiting]);
    expect(report.sent).toBe(3);
    expect(report.approved).toBe(1);
    expect(report.declined).toBe(1);
    expect(report.pending).toBe(1);
    expect(report.rate).toBe(33.33);
  });

  it("counts warranty claims by model", () => {
    const jobs = [
      job({ id: "a", brand: "Xiaomi", model: "Redmi 9", warrantyClaimOfJobId: "x" }),
      job({ id: "b", brand: "Xiaomi", model: "Redmi 9", warrantyClaimOfJobId: "y" }),
      job({ id: "c", brand: "Apple", model: "iPhone 11", warrantyClaimOfJobId: "z" }),
    ];
    const report = repeatFailureReport(jobs);
    expect(report.claimsByModel[0]).toEqual({ model: "Xiaomi Redmi 9", claims: 2 });
  });
});

// ---------------------------------------------------------------------------
// Parts stock deltas
// ---------------------------------------------------------------------------

describe("stock deltas", () => {
  it("takes stock off the shelf for a newly fitted part", () => {
    const deltas = stockDeltas([], [part({ quantity: 2 })]);
    expect(deltas.get("part-1")).toBe(-2);
  });

  it("gives stock back when a quantity is reduced", () => {
    const deltas = stockDeltas([part({ quantity: 3 })], [part({ quantity: 1 })]);
    expect(deltas.get("part-1")).toBe(2);
  });

  it("returns everything when a part is removed from a job", () => {
    const deltas = stockDeltas([part({ quantity: 2 })], []);
    expect(deltas.get("part-1")).toBe(2);
  });

  it("moves nothing when the list is unchanged", () => {
    const deltas = stockDeltas([part({ quantity: 2 })], [part({ quantity: 2 })]);
    expect(deltas.size).toBe(0);
  });

  it("ignores ad-hoc parts that were never on the shelf", () => {
    const deltas = stockDeltas([], [part({ partId: null })]);
    expect(deltas.size).toBe(0);
  });

  it("handles a swap of one stocked part for another", () => {
    const deltas = stockDeltas(
      [part({ partId: "part-1", quantity: 1 })],
      [part({ id: "pu-2", partId: "part-2", quantity: 1 })]
    );
    expect(deltas.get("part-1")).toBe(1);
    expect(deltas.get("part-2")).toBe(-1);
  });
});

// ---------------------------------------------------------------------------
// Numbering, dates and messages
// ---------------------------------------------------------------------------

describe("job numbering", () => {
  it("zero-pads to four digits, matching the spec's own example", () => {
    expect(jobNumberFrom("JC-", 412)).toBe("JC-0412");
    expect(jobNumberFrom("JC-", 1)).toBe("JC-0001");
  });

  it("widens rather than truncating past four digits", () => {
    expect(jobNumberFrom("JC-", 12345)).toBe("JC-12345");
  });
});

describe("date helpers", () => {
  it("builds a local date key without a timezone shift", () => {
    expect(toDateKey(new Date(2026, 8, 4, 23, 30))).toBe("2026-09-04");
  });

  it("adds days across a month boundary", () => {
    expect(addDays("2026-08-30", 5)).toBe("2026-09-04");
  });

  it("counts days backwards as negative", () => {
    expect(daysBetween("2026-09-04", "2026-09-01")).toBe(-3);
  });
});

describe("messages", () => {
  it("fills the placeholders the spec names", () => {
    expect(
      fillTemplate("{{shopName}}: received your {{device}} — job {{jobNo}}.", {
        shopName: "Sharma Mobile Care",
        device: "Samsung Galaxy M31",
        jobNo: "JC-0412",
      })
    ).toBe("Sharma Mobile Care: received your Samsung Galaxy M31 — job JC-0412.");
  });

  it("strips a placeholder it has no value for rather than sending the braces", () => {
    expect(fillTemplate("Pay by UPI: {{upiId}}", {})).toBe("Pay by UPI:");
  });

  it("quotes the estimate before there is a bill, and the total afterwards", () => {
    const quoted = job({ estimateAmount: 1500 });
    expect(jobVars(quoted, null, null, DEFAULT_SETTINGS).amount).toBe("1,500");

    const billed = job({ estimateAmount: 1500, partsUsed: [part()], labourCharge: 500 });
    expect(jobVars(billed, null, null, DEFAULT_SETTINGS).amount).toBe("4,000");
  });

  it("names the device by brand and model, falling back to the kind", () => {
    expect(deviceLabel(job())).toBe("Samsung Galaxy M31");
    expect(deviceLabel(job({ brand: "", model: "", deviceKind: "laptop" }))).toBe("Laptop");
  });
});

describe("whatsapp numbers", () => {
  it("adds the country code to a bare ten-digit Indian number", () => {
    expect(whatsAppNumber("98765 43210")).toBe("919876543210");
  });

  it("leaves a number that already carries a country code alone", () => {
    expect(whatsAppNumber("+91 98765 43210")).toBe("919876543210");
  });

  it("returns nothing for an empty number", () => {
    expect(whatsAppNumber("")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Low stock
// ---------------------------------------------------------------------------

describe("low stock", () => {
  const shelfPart = (overrides: Partial<Part> = {}): Part => ({
    id: "part-1",
    name: "M31 display",
    sku: "",
    compatibleWith: "",
    costPrice: 2200,
    sellingPrice: 3500,
    stock: 5,
    lowStockAt: 2,
    supplierName: "",
    active: true,
    createdAt: at("2026-01-01"),
    updatedAt: at("2026-01-01"),
    ...overrides,
  });

  it("warns at the mark, not only below it", async () => {
    const { isLowStock } = await import("@/lib/repair/calc");
    expect(isLowStock(shelfPart({ stock: 2, lowStockAt: 2 }))).toBe(true);
    expect(isLowStock(shelfPart({ stock: 3, lowStockAt: 2 }))).toBe(false);
  });

  it("never warns about a part that is no longer stocked", async () => {
    const { isLowStock } = await import("@/lib/repair/calc");
    expect(isLowStock(shelfPart({ stock: 0, active: false }))).toBe(false);
  });
});
