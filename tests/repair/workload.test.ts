import { describe, expect, it } from "vitest";
import {
  assigneeAt,
  jobsDonePerTechnician,
  outsideByVendor,
  workloadByTechnician,
} from "@/lib/repair/reports";
import type { Job, JobStatus, Technician } from "@/lib/repair/types";

const techs: Technician[] = [
  { id: "amit", name: "Amit", phone: "", speciality: "", active: true, createdAt: "" },
  { id: "ravi", name: "Ravi", phone: "", speciality: "", active: true, createdAt: "" },
  { id: "old", name: "Old", phone: "", speciality: "", active: false, createdAt: "" },
];

function at(day: string, hour = 12): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d, hour).toISOString();
}

let n = 0;
function job(status: JobStatus, overrides: Partial<Job> = {}): Job {
  n += 1;
  return {
    id: `j${n}`,
    jobNo: `JC-${n}`,
    customerId: "c",
    deviceKind: "laptop",
    brand: "",
    model: "",
    serialNo: "",
    colour: "",
    reportedProblems: [],
    problemNote: "",
    conditionIn: [],
    intakePhotos: [],
    accessories: [],
    unlockCode: "",
    estimateAmount: null,
    estimateApprovedOn: null,
    promisedDate: null,
    status,
    technicianId: "amit",
    priority: "normal",
    intakeSignatureDataUrl: "",
    customerNotes: "",
    internalNotes: "",
    partsUsed: [],
    labourCharge: 500,
    diagnosis: "",
    workDone: "",
    warrantyDays: 0,
    deliveredOn: null,
    deliverySignatureDataUrl: "",
    warrantyClaimOfJobId: null,
    billId: null,
    statusHistory: [],
    createdAt: at("2026-11-01"),
    updatedAt: at("2026-11-01"),
    ...overrides,
  };
}

describe("engineer workload", () => {
  it("counts open jobs per engineer, lists free engineers, and leaves ready out of the load", () => {
    const rows = workloadByTechnician(
      [
        job("in-repair", { priority: "urgent" }),
        job("diagnosing", { promisedDate: "2026-11-05" }),
        job("ready"),
        job("delivered"),
        job("received", { technicianId: null }),
      ],
      techs,
      "2026-11-10"
    );
    const amit = rows.find((row) => row.technicianId === "amit")!;
    expect(amit.open).toBe(2);
    expect(amit.urgent).toBe(1);
    expect(amit.overdue).toBe(1);
    expect(amit.byStatus.ready).toBe(1);
    expect(amit.oldestDays).toBe(9);
    expect(rows.find((row) => row.technicianId === "ravi")!.open).toBe(0);
    expect(rows.find((row) => row.technicianId === "old")).toBeUndefined();
    expect(rows[rows.length - 1].name).toBe("Unassigned");
  });

  it("groups devices by the vendor holding them", () => {
    const trip = {
      id: "t",
      vendorId: "v1",
      vendorName: "Chip Lab",
      vendorCity: "Delhi",
      sentWhat: "Whole device",
      problem: "",
      sentOn: "2026-11-02",
      sentVia: "",
      docketNo: "",
      quotedCharge: null,
      expectedBackOn: "2026-11-05",
      note: "",
      previousStatus: "in-repair" as JobStatus,
      challanNo: "x",
      receivedOn: null,
      outcome: null,
      finalCharge: null,
      returnNote: "",
      sentAt: "",
      receivedAt: null,
    };
    const rows = outsideByVendor(
      [
        job("outside-repair", { outsideRepairs: [trip] }),
        job("outside-repair", { outsideRepairs: [{ ...trip, expectedBackOn: "2026-11-20" }] }),
        job("in-repair", { outsideRepairs: [{ ...trip, receivedOn: "2026-11-04" }] }),
      ],
      "2026-11-10"
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].out).toBe(2);
    expect(rows[0].overdue).toBe(1);
  });
});

describe("jobs done per engineer", () => {
  it("credits the engineer who held the job when it was first marked ready", () => {
    const handedOver = job("delivered", {
      technicianId: "ravi",
      assignmentHistory: [
        { technicianId: "amit", at: at("2026-11-01") },
        { technicianId: "ravi", at: at("2026-11-08") },
      ],
      statusHistory: [
        { id: "1", from: "in-repair", to: "ready", at: at("2026-11-05"), note: "", notifiedAt: null },
        { id: "2", from: "ready", to: "ready", at: at("2026-11-07"), note: "nag", notifiedAt: null },
        { id: "3", from: "in-repair", to: "ready", at: at("2026-11-09"), note: "", notifiedAt: null },
      ],
    });
    expect(assigneeAt(handedOver, at("2026-11-05"))).toBe("amit");

    const rows = jobsDonePerTechnician([handedOver], techs, { from: "2026-11-01", to: "2026-11-30" });
    expect(rows).toEqual([
      { technicianId: "amit", name: "Amit", done: 1, labour: 500, averageDays: 4, jobIds: [handedOver.id] },
    ]);
  });

  it("ignores jobs first marked ready outside the period, and older jobs without history", () => {
    const early = job("ready", {
      statusHistory: [{ id: "1", from: "in-repair", to: "ready", at: at("2026-10-20"), note: "", notifiedAt: null }],
    });
    const legacy = job("ready", {
      technicianId: "ravi",
      statusHistory: [{ id: "1", from: "in-repair", to: "ready", at: at("2026-11-03"), note: "", notifiedAt: null }],
    });
    const rows = jobsDonePerTechnician([early, legacy], techs, { from: "2026-11-01", to: "2026-11-30" });
    expect(rows.map((row) => [row.name, row.done])).toEqual([["Ravi", 1]]);
  });
});
