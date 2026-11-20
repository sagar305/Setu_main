import { describe, expect, it } from "vitest";
import { captureOps } from "@/lib/repair/team/capture";
import { mergeTeam } from "@/lib/repair/team/merge";
import {
  JOB_ARCHIVE_CHUNK,
  baseFromPublished,
  buildBench,
  buildBooksAndArchive,
  buildCatalog,
  buildStock,
  planApply,
  splitJobs,
  type TeamMember,
} from "@/lib/repair/team/files";
import { sharedSettings, withSharedSettings } from "@/lib/repair/team/scope";
import { discountAllowed } from "@/lib/repair/team/roles";
import type { Member, Op, SyncRecord } from "@/lib/repair/team/ops";
import { DEFAULT_SETTINGS, type Job, type Part } from "@/lib/repair/types";

const owner: Member = { email: "o@x.in", role: "owner", code: "O", addedAt: "" };
const desk: Member = { email: "f@x.in", role: "frontdesk", code: "F1", addedAt: "", permissions: { maxDiscountPercent: 10 } };
const amit: Member = { email: "a@x.in", role: "technician", code: "T1", addedAt: "", technicianId: "tech-amit" };
const ravi: Member = { email: "r@x.in", role: "technician", code: "T2", addedAt: "", technicianId: "tech-ravi" };
const members = [owner, desk, amit, ravi];

function job(overrides: Partial<Job> = {}): Job {
  return {
    id: "job-1",
    jobNo: "JC-0001",
    customerId: "cust-1",
    deviceKind: "laptop",
    brand: "Dell",
    model: "Inspiron",
    serialNo: "SN",
    colour: "",
    reportedProblems: [],
    problemNote: "",
    conditionIn: [{ id: "c", label: "Dent", present: true, note: "" }],
    intakePhotos: ["data:image/jpeg;base64,AAAA"],
    accessories: [],
    unlockCode: "1234",
    estimateAmount: 2500,
    estimateApprovedOn: null,
    promisedDate: "2026-11-25",
    status: "in-repair",
    technicianId: "tech-amit",
    priority: "normal",
    intakeSignatureDataUrl: "data:image/png;base64,SIG",
    customerNotes: "",
    internalNotes: "",
    partsUsed: [],
    labourCharge: 800,
    diagnosis: "",
    workDone: "",
    warrantyDays: 90,
    deliveredOn: null,
    deliverySignatureDataUrl: "",
    warrantyClaimOfJobId: null,
    billId: null,
    statusHistory: [{ id: "h1", from: null, to: "received", at: "2026-11-20T05:00:00.000Z", note: "", notifiedAt: null }],
    createdAt: "2026-11-20T05:00:00.000Z",
    updatedAt: "2026-11-20T05:00:00.000Z",
    ...overrides,
  };
}

const part: Part = {
  id: "part-ic",
  name: "Charging IC",
  sku: "",
  compatibleWith: "",
  costPrice: 300,
  sellingPrice: 900,
  stock: 5,
  lowStockAt: 1,
  supplierName: "",
  active: true,
  createdAt: "",
  updatedAt: "",
};

const rec = <T,>(row: T) => row as unknown as SyncRecord;

let n = 0;
const put = (store: Op extends infer O ? (O extends { store: infer S } ? S : never) : never, recordId: string, fields: Record<string, unknown>, at: string, create = false): Op => ({
  id: `op-${(n += 1)}`,
  at,
  type: "put",
  store,
  recordId,
  create,
  fields,
});

function base(jobOverrides: Partial<Job> = {}) {
  return { jobs: [rec(job(jobOverrides))], parts: [rec(part)], customers: [], bills: [], technicians: [], vendors: [], repairSettings: [] };
}

describe("merging the team's changes", () => {
  it("keeps two people's edits to different fields of one job", () => {
    const merged = mergeTeam(base(), members, [
      { memberCode: "F1", ops: [put("jobs", "job-1", { promisedDate: "2026-11-28" }, "2026-11-21T10:00:00Z")] },
      { memberCode: "T1", ops: [put("jobs", "job-1", { diagnosis: "Charging IC short" }, "2026-11-21T10:00:01Z")] },
    ]);
    const result = merged.stores.jobs[0] as unknown as Job;
    expect(result.promisedDate).toBe("2026-11-28");
    expect(result.diagnosis).toBe("Charging IC short");
    expect(merged.rejected).toEqual([]);
  });

  it("merges status history line by line, so simultaneous moves both stay", () => {
    const h = job().statusHistory;
    const merged = mergeTeam(base(), members, [
      { memberCode: "F1", ops: [put("jobs", "job-1", { statusHistory: [...h, { id: "f", from: "in-repair", to: "outside-repair", at: "2026-11-21T10:00:00Z", note: "", notifiedAt: null }] }, "2026-11-21T10:00:00Z")] },
      { memberCode: "T1", ops: [put("jobs", "job-1", { statusHistory: [...h, { id: "t", from: "in-repair", to: "awaiting-parts", at: "2026-11-21T09:59:00Z", note: "", notifiedAt: null }] }, "2026-11-21T09:59:00Z")] },
    ]);
    const history = (merged.stores.jobs[0] as unknown as Job).statusHistory.map((c) => c.id);
    expect(history).toEqual(["h1", "t", "f"]);
  });

  it("ignores a technician's changes to a job that is not theirs", () => {
    const merged = mergeTeam(base(), members, [
      { memberCode: "T2", ops: [put("jobs", "job-1", { diagnosis: "mine now" }, "2026-11-21T10:00:00Z")] },
    ]);
    expect((merged.stores.jobs[0] as unknown as Job).diagnosis).toBe("");
    expect(merged.rejected[0].reason).toBe("not-assigned");
  });

  it("strips prices, promised date and reassignment from a technician's change", () => {
    const merged = mergeTeam(base(), members, [
      {
        memberCode: "T1",
        ops: [
          put(
            "jobs",
            "job-1",
            { labourCharge: 5000, promisedDate: "2027-01-01", technicianId: "tech-ravi", workDone: "Replaced IC", status: "ready" },
            "2026-11-21T10:00:00Z"
          ),
        ],
      },
    ]);
    const result = merged.stores.jobs[0] as unknown as Job;
    expect(result.labourCharge).toBe(800);
    expect(result.promisedDate).toBe("2026-11-25");
    expect(result.technicianId).toBe("tech-amit");
    expect(result.workDone).toBe("Replaced IC");
    expect(result.status).toBe("ready");
    expect(merged.rejected[0]).toMatchObject({ reason: "fields-not-allowed", fields: ["labourCharge", "promisedDate", "technicianId"] });
  });

  it("does not let a technician deliver or cancel", () => {
    const merged = mergeTeam(base(), members, [
      { memberCode: "T1", ops: [put("jobs", "job-1", { status: "cancelled" }, "2026-11-21T10:00:00Z")] },
    ]);
    expect((merged.stores.jobs[0] as unknown as Job).status).toBe("in-repair");
  });

  it("prices a technician's parts from the parts list and drops ad-hoc parts", () => {
    const merged = mergeTeam(base(), members, [
      {
        memberCode: "T1",
        ops: [
          put(
            "jobs",
            "job-1",
            {
              partsUsed: [
                { id: "l1", partId: "part-ic", name: "x", quantity: 1, costPrice: 0, sellingPrice: 0, supplierWarrantyDays: 0 },
                { id: "l2", partId: null, name: "Random", quantity: 1, costPrice: 0, sellingPrice: 99999, supplierWarrantyDays: 0 },
              ],
            },
            "2026-11-21T10:00:00Z"
          ),
        ],
      },
    ]);
    const lines = (merged.stores.jobs[0] as unknown as Job).partsUsed;
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ name: "Charging IC", costPrice: 300, sellingPrice: 900 });
  });

  it("never lets anyone change the intake record, the owner included", () => {
    const merged = mergeTeam(base(), members, [
      { memberCode: "O", ops: [put("jobs", "job-1", { conditionIn: [], intakePhotos: [] }, "2026-11-21T10:00:00Z")] },
    ]);
    const result = merged.stores.jobs[0] as unknown as Job;
    expect(result.conditionIn).toHaveLength(1);
    expect(result.intakePhotos).toHaveLength(1);
  });

  it("adds stock moves from two benches instead of overwriting", () => {
    const merged = mergeTeam(base(), members, [
      { memberCode: "T1", ops: [{ id: "s1", at: "2026-11-21T10:00:00Z", type: "stock", partId: "part-ic", change: -1 }] },
      { memberCode: "T2", ops: [{ id: "s2", at: "2026-11-21T10:00:00Z", type: "stock", partId: "part-ic", change: -2 }] },
      { memberCode: "O", ops: [put("parts", "part-ic", { stock: 100, sellingPrice: 950 }, "2026-11-21T10:01:00Z")] },
    ]);
    const result = merged.stores.parts[0] as unknown as Part;
    expect(result.stock).toBe(2);
    expect(result.sellingPrice).toBe(950);
  });

  it("holds the front desk to their discount limit", () => {
    const bill = { partLines: [{ amount: 900 }], labourCharge: 100, discount: 200 };
    expect(discountAllowed(desk, bill)).toBe(false);
    expect(discountAllowed(desk, { ...bill, discount: 100 })).toBe(true);
    expect(discountAllowed(owner, bill)).toBe(true);
    const merged = mergeTeam(base(), members, [
      { memberCode: "F1", ops: [put("bills", "b1", { ...bill, jobId: "job-1" }, "2026-11-21T10:00:00Z", true)] },
    ]);
    expect(merged.stores.bills).toHaveLength(0);
    expect(merged.rejected[0].reason).toBe("discount-over-limit");
  });

  it("keeps settings and the technician list to the owner", () => {
    const merged = mergeTeam(base(), members, [
      { memberCode: "F1", ops: [put("repairSettings", "main", { taxEnabled: true }, "2026-11-21T10:00:00Z", true)] },
      { memberCode: "F1", ops: [put("technicians", "t9", { name: "New" }, "2026-11-21T10:00:00Z", true)] },
    ]);
    expect(merged.stores.repairSettings).toHaveLength(0);
    expect(merged.stores.technicians).toHaveLength(0);
  });

  it("ignores operations from a removed member after removal, and duplicates", () => {
    const op = put("jobs", "job-1", { diagnosis: "late" }, "2026-11-22T00:00:00Z");
    const merged = mergeTeam(base(), [owner, { ...desk, removedAt: "2026-11-21T00:00:00Z" }], [
      { memberCode: "F1", ops: [op, op] },
    ]);
    expect(merged.rejected).toHaveLength(1);
    expect(merged.rejected[0].reason).toBe("member-removed");
  });
});

describe("capturing changes", () => {
  let id = 0;
  const ctx = (role: Member["role"]) => ({ role, newId: () => `c${(id += 1)}`, now: "2026-11-21T10:00:00Z" });

  it("sends only the fields that changed, and stock as a delta", () => {
    const before = job();
    const after = { ...before, diagnosis: "IC short", updatedAt: "later" };
    const ops = captureOps(
      {
        writes: { jobs: [after], parts: [{ ...part, stock: 4 }] },
        deletes: {},
        before: { jobs: { "job-1": before }, parts: { "part-ic": part } },
      },
      ctx("frontdesk")
    );
    expect(ops).toHaveLength(2);
    expect(ops.find((op) => op.type === "put")).toMatchObject({ fields: { diagnosis: "IC short", updatedAt: "later" }, create: false });
    expect(ops.find((op) => op.type === "stock")).toMatchObject({ partId: "part-ic", change: -1 });
  });

  it("skips a save that changed nothing but the time", () => {
    const before = job();
    expect(
      captureOps({ writes: { jobs: [{ ...before, updatedAt: "later" }] }, deletes: {}, before: { jobs: { "job-1": before } } }, ctx("owner"))
    ).toEqual([]);
  });

  it("keeps this device's own settings (counters, printer, PIN) out of sync", () => {
    const before = { ...DEFAULT_SETTINGS };
    const after = { ...DEFAULT_SETTINGS, nextJobNumber: 9, slipPaperSize: "a4", taxEnabled: true };
    const ops = captureOps({ writes: { repairSettings: [after] }, deletes: {}, before: { repairSettings: { main: before } } }, ctx("owner"));
    expect(ops).toHaveLength(1);
    expect((ops[0] as { fields: Record<string, unknown> }).fields).toEqual({ taxEnabled: true });
    expect(captureOps({ writes: { repairSettings: [after] }, deletes: {}, before: { repairSettings: { main: before } } }, ctx("frontdesk"))).toEqual([]);
  });

  it("sends nothing but job work from a technician", () => {
    const before = job();
    const ops = captureOps(
      {
        writes: { jobs: [{ ...before, diagnosis: "x", labourCharge: 0 }], customers: [{ id: "c" }] },
        deletes: { jobs: ["job-1"] },
        before: { jobs: { "job-1": before } },
      },
      ctx("technician")
    );
    expect(ops).toHaveLength(1);
    expect((ops[0] as { fields: Record<string, unknown> }).fields).toEqual({ diagnosis: "x" });
  });
});

describe("published files", () => {
  const local = {
    jobs: [rec(job()), rec(job({ id: "job-2", technicianId: "tech-ravi" })), rec(job({ id: "job-3", status: "delivered" }))],
    customers: [rec({ id: "cust-1", name: "Rohit", phone: "98765", altPhone: "", address: "Kalkaji", companyName: "", gstin: "", createdAt: "", updatedAt: "" })],
    parts: [rec(part)],
    technicians: [],
    bills: [],
    vendors: [],
    repairSettings: [rec({ ...DEFAULT_SETTINGS, nextJobNumber: 42, taxEnabled: true })],
  };
  const team: TeamMember[] = [{ ...owner, fileId: "f0", phone: "98100" }];

  it("keeps prices and stock out of the catalog everyone can open", () => {
    const catalog = buildCatalog(local, null);
    expect(catalog.parts[0]).toMatchObject({ costPrice: 0, sellingPrice: 0, stock: 0 });
    expect(catalog.settings.taxEnabled).toBe(true);
    expect(catalog.settings).not.toHaveProperty("nextJobNumber");
  });

  it("gives a technician only their open jobs, without prices or customer contact", async () => {
    const bench = await buildBench(local, "tech-amit", async (urls) => urls.map(() => "thumb"));
    expect(bench.jobs.map((j) => j.id)).toEqual(["job-1"]);
    expect(bench.jobs[0]).toMatchObject({ estimateAmount: null, labourCharge: 0, intakePhotos: ["thumb"], unlockCode: "1234", intakeSignatureDataUrl: "" });
    expect(bench.customers[0]).toMatchObject({ name: "Rohit", phone: "", address: "" });
  });

  it("rebuilds the same shop on a front-desk device from the published files", () => {
    const { books, archive } = buildBooksAndArchive(local, team);
    expect(books.jobs.every((j) => j.intakePhotos.length === 0)).toBe(true);
    const snapshot = baseFromPublished({
      live: { stock: buildStock(local) } as never,
      catalog: buildCatalog(local, null),
      books,
      archive,
      media: { version: 1, jobs: { "job-1": { intakePhotos: ["t"], intakeSignatureDataUrl: "s", deliverySignatureDataUrl: "" } } },
      bench: null,
    });
    const parts = snapshot.parts as unknown as Part[];
    expect(parts[0]).toMatchObject({ stock: 5, costPrice: 300, sellingPrice: 900 });
    expect((snapshot.jobs as unknown as Job[]).find((j) => j.id === "job-1")?.intakePhotos).toEqual(["t"]);
    expect(snapshot.jobs).toHaveLength(3);
  });

  it("archives closed jobs in whole blocks only", () => {
    const many = Array.from({ length: JOB_ARCHIVE_CHUNK + 5 }, (_, i) =>
      job({ id: `j${i}`, status: "delivered", createdAt: `2026-01-01T00:00:${String(i).padStart(4, "0")}` })
    );
    const split = splitJobs([...many, job({ id: "open" })]);
    expect(split.archive).toHaveLength(JOB_ARCHIVE_CHUNK);
    expect(split.books).toHaveLength(6);
  });

  it("applies the team's data without losing this device's photos or own settings", () => {
    const mine = { ...job(), intakePhotos: ["full-1", "full-2"] };
    const theirs = { ...job(), intakePhotos: ["t1", "t2"], diagnosis: "new" };
    const plan = planApply(
      { jobs: [rec(mine)], repairSettings: [rec({ ...DEFAULT_SETTINGS, nextJobNumber: 7, pinHash: "h" })] },
      { jobs: [rec(theirs)], repairSettings: [rec({ id: "main", ...sharedSettings({ ...DEFAULT_SETTINGS, taxEnabled: true }) })] },
      ["jobs", "repairSettings"]
    );
    expect(plan.writes.jobs[0]).toMatchObject({ intakePhotos: ["full-1", "full-2"], diagnosis: "new" });
    expect(plan.writes.repairSettings[0]).toMatchObject({ nextJobNumber: 7, pinHash: "h", taxEnabled: true });
    expect(withSharedSettings(undefined, { id: "main", taxEnabled: true })).toMatchObject({ taxEnabled: true });
  });
});
