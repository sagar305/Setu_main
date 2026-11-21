import { describe, expect, it } from "vitest";
import {
  currentOutside,
  defaultOutsideLabel,
  outsideBillLine,
  isOutsideOverdue,
  isOverdue,
  jobMargin,
  nextChallanNo,
  outsideCostTotal,
} from "@/lib/repair/calc";
import { buildOutsideChallanHtml } from "@/lib/repair/print";
import { buildTrackPayload } from "@/lib/repair/tracking";
import { DEFAULT_SETTINGS, type Job, type OutsideRepair } from "@/lib/repair/types";

function trip(overrides: Partial<OutsideRepair> = {}): OutsideRepair {
  return {
    id: "t1",
    vendorId: "v1",
    vendorName: "Delhi Chip Lab",
    vendorCity: "Delhi",
    sentWhat: "Motherboard only",
    problem: "Short near charging IC",
    sentOn: "2026-11-10",
    sentVia: "DTDC",
    docketNo: "D123",
    quotedCharge: 1500,
    expectedBackOn: "2026-11-15",
    note: "",
    previousStatus: "in-repair",
    challanNo: "JC-0412/O1",
    receivedOn: null,
    outcome: null,
    finalCharge: null,
    returnNote: "",
    sentAt: "2026-11-10T06:00:00.000Z",
    receivedAt: null,
    ...overrides,
  };
}

function job(overrides: Partial<Job> = {}): Job {
  return {
    id: "job-1",
    jobNo: "JC-0412",
    customerId: "c1",
    deviceKind: "laptop",
    brand: "Dell",
    model: "Inspiron",
    serialNo: "SN1",
    colour: "",
    reportedProblems: ["Not switching on"],
    problemNote: "",
    conditionIn: [],
    intakePhotos: [],
    accessories: [],
    unlockCode: "",
    estimateAmount: null,
    estimateApprovedOn: null,
    promisedDate: "2026-11-12",
    status: "outside-repair",
    technicianId: null,
    priority: "normal",
    intakeSignatureDataUrl: "",
    customerNotes: "",
    internalNotes: "",
    partsUsed: [],
    labourCharge: 3000,
    diagnosis: "",
    workDone: "",
    warrantyDays: 90,
    deliveredOn: null,
    deliverySignatureDataUrl: "",
    warrantyClaimOfJobId: null,
    billId: null,
    statusHistory: [],
    createdAt: "2026-11-08T06:00:00.000Z",
    updatedAt: "2026-11-08T06:00:00.000Z",
    ...overrides,
  };
}

describe("outside repair", () => {
  it("finds the trip that is out, and none once it is back", () => {
    expect(currentOutside(job({ outsideRepairs: [trip()] }))?.id).toBe("t1");
    expect(currentOutside(job({ outsideRepairs: [trip({ receivedOn: "2026-11-14" })] }))).toBeNull();
    expect(currentOutside(job())).toBeNull();
  });

  it("flags a vendor past the date they gave", () => {
    const out = job({ outsideRepairs: [trip()] });
    expect(isOutsideOverdue(out, "2026-11-15")).toBe(false);
    expect(isOutsideOverdue(out, "2026-11-16")).toBe(true);
    expect(isOutsideOverdue(job({ outsideRepairs: [trip({ receivedOn: "2026-11-14" })] }), "2026-11-20")).toBe(false);
  });

  it("still counts a job out with a vendor as past its promise to the customer", () => {
    expect(isOverdue(job({ outsideRepairs: [trip()] }), "2026-11-13")).toBe(true);
  });

  it("costs vendor work at the final charge, else the quote, across every trip", () => {
    const j = job({
      outsideRepairs: [
        trip({ id: "a", receivedOn: "2026-11-14", outcome: "not-repaired", finalCharge: 200 }),
        trip({ id: "b", quotedCharge: 1800 }),
      ],
    });
    expect(outsideCostTotal(j)).toBe(2000);
    // Labour 3000 is the revenue; vendor cost comes off the margin, never onto the bill.
    expect(jobMargin(j, null, DEFAULT_SETTINGS)).toBe(1000);
  });

  it("numbers challans per job", () => {
    expect(nextChallanNo(job())).toBe("JC-0412/O1");
    expect(nextChallanNo(job({ outsideRepairs: [trip()] }))).toBe("JC-0412/O2");
  });

  it("never shows the vendor to the customer", () => {
    const payload = buildTrackPayload(job({ outsideRepairs: [trip()] }), null, DEFAULT_SETTINGS, null);
    expect(payload.statusLabel).toBe("With our repair partner");
    expect(JSON.stringify(payload)).not.toContain("Delhi Chip Lab");
  });

  it("prints a returnable challan without the customer's details", () => {
    const html = buildOutsideChallanHtml(
      { business: null, job: job(), customer: { id: "c1", name: "Rohit Verma", phone: "98765", altPhone: "", address: "", companyName: "", gstin: "", createdAt: "", updatedAt: "" }, technician: null, settings: DEFAULT_SETTINGS },
      trip(),
      null
    );
    expect(html).toContain("JC-0412/O1");
    expect(html).toContain("Motherboard only");
    expect(html).toContain("Not for sale");
    expect(html).not.toContain("Rohit Verma");
  });

  it("puts the vendor's work on the bill as a line, and counts its cost only once", () => {
    const back = trip({ receivedOn: "2026-11-14", outcome: "repaired", finalCharge: 3000 });
    expect(defaultOutsideLabel(back)).toBe("Outside repair – Short near charging IC");
    const line = outsideBillLine(back, "Motherboard repair", 3800, "line-1");
    expect(line).toMatchObject({ name: "Motherboard repair", quantity: 1, costPrice: 3000, sellingPrice: 3800, partId: null });

    const billed = job({ labourCharge: 500, outsideRepairs: [{ ...back, billedLineId: "line-1" }], partsUsed: [line] });
    expect(outsideCostTotal(billed)).toBe(0);
    // Revenue 3800 + 500, cost 3000 (on the line) → 1300, not 3800 + 500 − 3000 − 3000.
    expect(jobMargin(billed, null, DEFAULT_SETTINGS)).toBe(1300);

    // If the line is removed from the bill, the cost comes back as an outside cost.
    const removed = { ...billed, partsUsed: [] };
    expect(outsideCostTotal(removed)).toBe(3000);
  });
});
