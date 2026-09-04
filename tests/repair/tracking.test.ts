import { describe, expect, it } from "vitest";
import {
  buildTrackPayload,
  daysUntilExpiry,
  decodeReply,
  decodeTrack,
  encodeReply,
  encodeTrack,
  trackUrl,
  type TrackPayload,
} from "@/lib/repair/tracking";
import { fillTemplate, jobVars } from "@/lib/repair/messages";
import {
  DEFAULT_SETTINGS,
  type Bill,
  type Job,
  type JobStatus,
  type JobTracking,
  type StatusChange,
} from "@/lib/repair/types";
import type { Business } from "@/lib/pos/types";

function at(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0).toISOString();
}

function change(to: JobStatus, on: string, from: JobStatus | null = null): StatusChange {
  return { id: `${to}-${on}`, from, to, at: at(on), note: "", notifiedAt: null };
}

function job(overrides: Partial<Job> = {}): Job {
  return {
    id: "job-1",
    jobNo: "JC-0412",
    customerId: "cust-1",
    deviceKind: "mobile",
    brand: "Samsung",
    model: "Galaxy M31",
    serialNo: "868123456789012",
    colour: "Black",
    reportedProblems: ["Screen broken / not displaying"],
    problemNote: "Dropped it",
    conditionIn: [{ id: "c1", label: "Screen cracked", present: true, note: "top left" }],
    intakePhotos: ["data:image/jpeg;base64,AAAA"],
    accessories: ["Charger"],
    unlockCode: "1234",
    estimateAmount: 1500,
    estimateApprovedOn: null,
    promisedDate: "2026-09-08",
    status: "received",
    technicianId: null,
    priority: "normal",
    intakeSignatureDataUrl: "data:image/png;base64,BBBB",
    customerNotes: "",
    internalNotes: "Supplier screen is poor quality",
    partsUsed: [],
    labourCharge: 0,
    diagnosis: "Display assembly gone",
    workDone: "",
    warrantyDays: 90,
    deliveredOn: null,
    deliverySignatureDataUrl: "",
    warrantyClaimOfJobId: null,
    billId: null,
    statusHistory: [change("received", "2026-09-01")],
    createdAt: at("2026-09-01"),
    updatedAt: at("2026-09-01"),
    ...overrides,
  };
}

const BUSINESS: Business = {
  id: "main",
  name: "Sharma Mobile Care",
  phone: "9876543210",
  address: "12 Main Road",
  currency: "INR",
  email: "",
  taxNumber: "",
  logoDataUrl: "",
  upiId: "sharma@okhdfcbank",
  createdAt: at("2026-01-01"),
};

function tracking(overrides: Partial<JobTracking> = {}): JobTracking {
  return {
    code: "AbCdEf1234",
    editToken: "Zz9876Yy54",
    url: "https://setutechnology.com/track/AbCdEf1234",
    publishedAt: at("2026-09-01"),
    expiresAt: at("2026-12-01"),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Round-tripping
// ---------------------------------------------------------------------------

describe("payload encoding", () => {
  it("round-trips a tracking payload", () => {
    const payload = buildTrackPayload(job(), BUSINESS, DEFAULT_SETTINGS, null);
    const decoded = decodeTrack(encodeTrack(payload));
    expect(decoded).toEqual(payload);
  });

  it("refuses a payload from a future version rather than half-reading it", () => {
    const encoded = encodeTrack({ ...buildTrackPayload(job(), BUSINESS, DEFAULT_SETTINGS, null), v: 2 } as unknown as TrackPayload);
    expect(decodeTrack(encoded)).toBeNull();
  });

  it("returns null for junk rather than throwing", () => {
    expect(decodeTrack("not-a-payload")).toBeNull();
    expect(decodeTrack("")).toBeNull();
  });

  it("round-trips a reply payload", () => {
    const encoded = encodeReply({ v: 1, jobNo: "JC-0412", decision: "yes", at: at("2026-09-03") });
    expect(decodeReply(encoded)).toEqual({
      v: 1,
      jobNo: "JC-0412",
      decision: "yes",
      at: at("2026-09-03"),
    });
  });

  it("rejects a reply carrying anything but yes, no or nothing", () => {
    const encoded = encodeReply({
      v: 1,
      jobNo: "JC-0412",
      decision: "maybe" as unknown as "yes",
      at: null,
    });
    expect(decodeReply(encoded)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// What the customer is and is not shown
// ---------------------------------------------------------------------------

describe("what the tracking payload carries", () => {
  const payload = buildTrackPayload(job(), BUSINESS, DEFAULT_SETTINGS, null);
  const asText = JSON.stringify(payload);

  it("tells the customer what they came to find out", () => {
    expect(payload.jobNo).toBe("JC-0412");
    expect(payload.device).toBe("Samsung Galaxy M31");
    expect(payload.shop).toBe("Sharma Mobile Care");
    expect(payload.statusLabel).toBe("Received");
    expect(payload.promisedDate).toBe("2026-09-08");
    expect(payload.amount).toBe(1500);
    expect(payload.amountKind).toBe("estimate");
  });

  it("never carries the intake evidence", () => {
    expect(asText).not.toContain("data:image");
    expect(payload).not.toHaveProperty("intakePhotos");
    expect(payload).not.toHaveProperty("intakeSignatureDataUrl");
    expect(payload).not.toHaveProperty("conditionIn");
  });

  it("never carries the unlock code, internal notes or the diagnosis", () => {
    expect(asText).not.toContain("1234");
    expect(asText).not.toContain("Supplier screen is poor quality");
    expect(asText).not.toContain("Display assembly gone");
  });

  it("never carries the serial number or the customer's own details", () => {
    expect(asText).not.toContain("868123456789012");
    expect(payload).not.toHaveProperty("customerId");
  });

  it("never carries the parts list or their cost", () => {
    const withParts = job({
      partsUsed: [
        {
          id: "pu-1",
          partId: "p1",
          name: "M31 display",
          quantity: 1,
          costPrice: 2200,
          sellingPrice: 3500,
          supplierWarrantyDays: 30,
        },
      ],
      labourCharge: 500,
    });
    const built = JSON.stringify(buildTrackPayload(withParts, BUSINESS, DEFAULT_SETTINGS, null));
    expect(built).not.toContain("M31 display");
    expect(built).not.toContain("2200");
  });

  it("shows the billed total rather than the estimate once there is a bill", () => {
    const bill: Bill = {
      id: "bill-1",
      invoiceNo: "INV-0007",
      jobId: "job-1",
      customerId: "cust-1",
      date: "2026-09-05",
      partLines: [],
      labourCharge: 500,
      discount: 0,
      taxRate: 0,
      taxAmount: 0,
      total: 4000,
      paid: 4000,
      paymentMode: "Cash",
      createdAt: at("2026-09-05"),
    };
    const built = buildTrackPayload(job(), BUSINESS, DEFAULT_SETTINGS, bill);
    expect(built.amount).toBe(4000);
    expect(built.amountKind).toBe("bill");
    expect(built.invoiceNo).toBe("INV-0007");
  });

  it("leaves the collection-reminder entries off the customer's timeline", () => {
    const nagged = job({
      status: "ready",
      statusHistory: [
        change("received", "2026-09-01"),
        change("ready", "2026-09-02", "in-repair"),
        // A nag: ready → ready. The shop chasing the customer is not progress.
        change("ready", "2026-09-05", "ready"),
      ],
    });
    const built = buildTrackPayload(nagged, BUSINESS, DEFAULT_SETTINGS, null);
    expect(built.timeline).toHaveLength(2);
    expect(built.timeline.every((entry) => entry.at !== at("2026-09-05"))).toBe(true);
  });

  it("carries the warranty end date once delivered", () => {
    const delivered = job({ status: "delivered", deliveredOn: "2026-09-05", warrantyDays: 90 });
    expect(buildTrackPayload(delivered, BUSINESS, DEFAULT_SETTINGS, null).warrantyEnd).toBe(
      "2026-12-04"
    );
  });
});

// ---------------------------------------------------------------------------
// The reply channel
// ---------------------------------------------------------------------------

describe("the estimate reply channel", () => {
  const withReply = (status: JobStatus, decision: "yes" | "no" | null = null) =>
    job({
      status,
      tracking: tracking({
        reply: { code: "Reply12345", editToken: "Tok0987654", decision, decidedAt: null },
      }),
    });

  it("offers the buttons only while an estimate is genuinely outstanding", () => {
    const built = buildTrackPayload(withReply("estimate-sent"), BUSINESS, DEFAULT_SETTINGS, null);
    expect(built.reply).toEqual({ code: "Reply12345", token: "Tok0987654" });
    expect(built.reply?.decided).toBeUndefined();
  });

  it("shows the answer instead of the buttons once one has been given", () => {
    const built = buildTrackPayload(
      withReply("estimate-sent", "yes"),
      BUSINESS,
      DEFAULT_SETTINGS,
      null
    );
    expect(built.reply?.decided).toBe("yes");
  });

  it("does not invite an answer once the job has moved on", () => {
    const built = buildTrackPayload(withReply("in-repair"), BUSINESS, DEFAULT_SETTINGS, null);
    expect(built.reply).toBeUndefined();
  });

  it("never puts the tracking link's own token in the payload", () => {
    const built = JSON.stringify(
      buildTrackPayload(withReply("estimate-sent"), BUSINESS, DEFAULT_SETTINGS, null)
    );
    // The reply channel's token travels; the one that can rewrite the repair
    // record must not.
    expect(built).toContain("Tok0987654");
    expect(built).not.toContain("Zz9876Yy54");
  });
});

// ---------------------------------------------------------------------------
// Links in messages
// ---------------------------------------------------------------------------

describe("the tracking link in messages", () => {
  it("puts the URL into the received message when there is one", () => {
    const tracked = job({ tracking: tracking() });
    const message = fillTemplate(
      DEFAULT_SETTINGS.messageTemplates.received,
      jobVars(tracked, null, BUSINESS, DEFAULT_SETTINGS)
    );
    expect(message).toContain("https://setutechnology.com/track/AbCdEf1234");
  });

  it("reads cleanly when there is no link, with no stray token or double space", () => {
    const message = fillTemplate(
      DEFAULT_SETTINGS.messageTemplates.received,
      jobVars(job(), null, BUSINESS, DEFAULT_SETTINGS)
    );
    expect(message).not.toContain("{{trackUrl}}");
    expect(message).not.toContain("  ");
    expect(message.endsWith("Track it here:")).toBe(true);
  });

  it("builds the URL under /track", () => {
    expect(trackUrl("AbCdEf1234", "https://setutechnology.com")).toBe(
      "https://setutechnology.com/track/AbCdEf1234"
    );
  });
});

// ---------------------------------------------------------------------------
// Expiry
// ---------------------------------------------------------------------------

describe("expiry", () => {
  it("counts the days a link has left", () => {
    const now = new Date(2026, 10, 21, 12, 0, 0); // 21 Nov 2026
    expect(daysUntilExpiry(tracking(), now)).toBe(10);
  });

  it("goes negative once a link is already dead", () => {
    const now = new Date(2026, 11, 11, 12, 0, 0); // 11 Dec 2026
    expect(daysUntilExpiry(tracking(), now)).toBe(-10);
  });

  it("says nothing when the service gave no expiry", () => {
    expect(daysUntilExpiry(tracking({ expiresAt: "" }))).toBeNull();
    expect(daysUntilExpiry(tracking({ expiresAt: "not a date" }))).toBeNull();
  });
});
