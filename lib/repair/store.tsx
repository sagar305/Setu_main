"use client";

// Client-side store for the Free Repair Job Card.
//
// Everything lives in one browser's IndexedDB: no login, no server, no sync
// beyond the Google Sheet push the owner sets up themselves. The provider owns
// every write, which is what lets one rule be enforced in one place —
//
//   §4: `conditionIn`, `intakePhotos` and `intakeSignatureDataUrl` cannot be
//   edited after the job is saved.
//
// — because a record that any screen could quietly revise is not evidence, and
// the whole product rests on it being evidence. `saveJob` below strips those
// three fields out of every update and writes back what was already stored.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { dbBatch, dbGetAll } from "@/lib/pos/db";
import { nowIso as posNowIso, type Business } from "@/lib/pos/types";
import {
  allocateNumber,
  repairBatch,
  repairClearAll,
  repairGetAll,
  type RepairStoreName,
} from "./db";
import { restoreBackup, type RepairBackup } from "./backup";
import { ALL_SYNC_SLICES, buildTabPayloads, isValidSyncUrl, pushToSheet } from "./sheetSync";
import { billTotals, round2, stockDeltas } from "./calc";
import {
  TrackingError,
  mintReplyChannel,
  publishTracking,
  pushTracking,
  readDecision,
} from "./tracking";
import {
  DEFAULT_SETTINGS,
  generateId,
  invoiceNumberFrom,
  jobNumberFrom,
  nowIso,
  todayKey,
  type Bill,
  type ConditionItem,
  type Customer,
  type Job,
  type JobStatus,
  type JobTracking,
  type Part,
  type RepairSettings,
  type Technician,
} from "./types";

export type AppStatus = "loading" | "welcome" | "setup" | "ready" | "error";

export type CustomerInput = Omit<Customer, "id" | "createdAt" | "updatedAt">;
export type PartInput = Omit<Part, "id" | "createdAt" | "updatedAt">;
export type TechnicianInput = Omit<Technician, "id" | "createdAt">;

/** What the intake wizard collects. Everything else on a job starts empty. */
export type IntakeInput = {
  customerId: string;
  deviceKind: Job["deviceKind"];
  brand: string;
  model: string;
  serialNo: string;
  colour: string;
  reportedProblems: string[];
  problemNote: string;
  conditionIn: ConditionItem[];
  intakePhotos: string[];
  accessories: string[];
  unlockCode: string;
  estimateAmount: number | null;
  promisedDate: string | null;
  technicianId: string | null;
  priority: Job["priority"];
  intakeSignatureDataUrl: string;
  customerNotes: string;
  internalNotes: string;
  /** Set when this job is raised as a warranty claim against an earlier one. */
  warrantyClaimOfJobId?: string | null;
};

/** The technician's half of a job — everything intake did not fix in place. */
export type JobWorkInput = Partial<
  Pick<
    Job,
    | "deviceKind"
    | "brand"
    | "model"
    | "serialNo"
    | "colour"
    | "reportedProblems"
    | "problemNote"
    | "accessories"
    | "unlockCode"
    | "estimateAmount"
    | "estimateApprovedOn"
    | "promisedDate"
    | "technicianId"
    | "priority"
    | "customerNotes"
    | "internalNotes"
    | "partsUsed"
    | "labourCharge"
    | "diagnosis"
    | "workDone"
    | "warrantyDays"
  >
>;

export type DeliveryInput = {
  deliveredOn: string;
  warrantyDays: number;
  deliverySignatureDataUrl: string;
  /** Left null for a job with nothing to charge — a goodwill or warranty fix. */
  bill: {
    discount: number;
    taxRate: number;
    paid: number;
    paymentMode: string;
  } | null;
};

type RepairContextValue = {
  status: AppStatus;
  errorMessage: string;
  business: Business | null;
  settings: RepairSettings;
  customers: Customer[];
  jobs: Job[];
  parts: Part[];
  technicians: Technician[];
  bills: Bill[];
  today: string;

  startSetup: () => void;
  backToWelcome: () => void;
  createShop: (
    profile: Omit<Business, "id" | "createdAt">,
    firstTechnician: string
  ) => Promise<void>;
  updateBusiness: (updates: Partial<Omit<Business, "id" | "createdAt">>) => Promise<void>;
  updateSettings: (updates: Partial<Omit<RepairSettings, "id">>) => Promise<void>;

  saveCustomer: (input: CustomerInput, id?: string) => Promise<Customer>;
  deleteCustomer: (id: string) => Promise<void>;

  createJob: (input: IntakeInput) => Promise<Job>;
  updateJobWork: (id: string, updates: JobWorkInput) => Promise<Job>;
  setJobStatus: (id: string, status: JobStatus, note?: string) => Promise<Job>;
  markNotified: (jobId: string, changeId: string) => Promise<void>;
  /** Record that an uncollected device was chased, so the nag cycle can restart. */
  recordNag: (jobId: string) => Promise<void>;
  deliverJob: (id: string, input: DeliveryInput) => Promise<Job>;
  raiseWarrantyClaim: (originalJobId: string) => Promise<Job>;
  deleteJob: (id: string) => Promise<void>;

  savePart: (input: PartInput, id?: string) => Promise<Part>;
  adjustStock: (id: string, delta: number) => Promise<void>;
  deletePart: (id: string) => Promise<void>;

  saveTechnician: (input: TechnicianInput, id?: string) => Promise<Technician>;
  deleteTechnician: (id: string) => Promise<void>;

  clearAllData: () => Promise<void>;
  applyRestoredBackup: (backup: RepairBackup) => Promise<void>;
  syncToSheet: () => Promise<void>;
  reloadAll: () => Promise<void>;

  /** Mint this job's tracking link, or re-push it after a failed attempt. */
  publishJobTracking: (jobId: string) => Promise<Job>;
  /** Open the estimate for an answer: mint the reply channel and push it. */
  openEstimateForApproval: (jobId: string) => Promise<Job>;
  /** Poll the reply channel. Returns the decision when one has been given. */
  checkEstimateDecision: (jobId: string) => Promise<"yes" | "no" | null>;
  /** Publish every job whose link is queued because the shop was offline. */
  retryPendingTracking: () => Promise<number>;

  jobById: (id: string) => Job | undefined;
  customerById: (id: string) => Customer | undefined;
  partById: (id: string) => Part | undefined;
  technicianById: (id: string) => Technician | undefined;
  billForJob: (jobId: string) => Bill | undefined;
};

const RepairContext = createContext<RepairContextValue | null>(null);

export function useRepair(): RepairContextValue {
  const context = useContext(RepairContext);
  if (!context) throw new Error("useRepair must be used inside a RepairProvider.");
  return context;
}

function statusChange(from: JobStatus | null, to: JobStatus, note = "") {
  return { id: generateId(), from, to, at: nowIso(), note, notifiedAt: null };
}

export function RepairProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AppStatus>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [business, setBusiness] = useState<Business | null>(null);
  const [settings, setSettings] = useState<RepairSettings>(DEFAULT_SETTINGS);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [today, setToday] = useState<string>(() => todayKey());

  const jobMap = useMemo(() => new Map(jobs.map((job) => [job.id, job])), [jobs]);
  const partMap = useMemo(() => new Map(parts.map((part) => [part.id, part])), [parts]);
  const billByJob = useMemo(() => {
    const map = new Map<string, Bill>();
    for (const bill of bills) map.set(bill.jobId, bill);
    return map;
  }, [bills]);

  /* ---------------------------------------------------------------------
   * Loading
   * ------------------------------------------------------------------ */

  const load = useCallback(async () => {
    try {
      const [
        storedSettings,
        storedCustomers,
        storedJobs,
        storedParts,
        storedTechnicians,
        storedBills,
        workspace,
      ] = await Promise.all([
        repairGetAll<RepairSettings>("repairSettings"),
        repairGetAll<Customer>("customers"),
        repairGetAll<Job>("jobs"),
        repairGetAll<Part>("parts"),
        repairGetAll<Technician>("technicians"),
        repairGetAll<Bill>("bills"),
        dbGetAll<Business>("business"),
      ]);

      const stored = storedSettings.find((row) => row.id === "main");
      setSettings({ ...DEFAULT_SETTINGS, ...(stored ?? {}) });
      setCustomers(storedCustomers);
      setJobs(storedJobs);
      setParts(storedParts);
      setTechnicians(storedTechnicians);
      setBills(storedBills);
      setToday(todayKey());
      setBusiness(workspace.find((row) => row.id === "main") ?? null);

      // A job card exists once its settings row has been written — that is what
      // Setup does. A workspace alone is not enough: somebody who used the
      // invoice tool last month has a business record and no shop here.
      setStatus(stored ? "ready" : "welcome");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not open the repair database."
      );
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Roll the day over under a tab left open overnight.
   *
   * Aging colours and the uncollected list are read off `today`; a board opened
   * on Friday and still showing Friday on Monday morning shows a shop calmer
   * than it is.
   */
  useEffect(() => {
    if (status !== "ready") return;
    const timer = window.setInterval(() => {
      const current = todayKey();
      setToday((previous) => (previous === current ? previous : current));
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [status]);

  const reloadAll = useCallback(async () => {
    const [storedSettings, storedCustomers, storedJobs, storedParts, storedTechs, storedBills] =
      await Promise.all([
        repairGetAll<RepairSettings>("repairSettings"),
        repairGetAll<Customer>("customers"),
        repairGetAll<Job>("jobs"),
        repairGetAll<Part>("parts"),
        repairGetAll<Technician>("technicians"),
        repairGetAll<Bill>("bills"),
      ]);
    setSettings({ ...DEFAULT_SETTINGS, ...(storedSettings.find((r) => r.id === "main") ?? {}) });
    setCustomers(storedCustomers);
    setJobs(storedJobs);
    setParts(storedParts);
    setTechnicians(storedTechs);
    setBills(storedBills);
  }, []);

  /* ---------------------------------------------------------------------
   * Setup and settings
   * ------------------------------------------------------------------ */

  const startSetup = useCallback(() => setStatus("setup"), []);
  const backToWelcome = useCallback(() => setStatus("welcome"), []);

  const persistSettings = useCallback(async (next: RepairSettings) => {
    await repairBatch({ repairSettings: [next] });
    setSettings(next);
  }, []);

  const updateSettings = useCallback(
    async (updates: Partial<Omit<RepairSettings, "id">>) => {
      await persistSettings({ ...settings, ...updates, id: "main" });
    },
    [persistSettings, settings]
  );

  const createShop = useCallback(
    async (profile: Omit<Business, "id" | "createdAt">, firstTechnician: string) => {
      const existing = (await dbGetAll<Business>("business")).find((row) => row.id === "main");
      const record: Business = existing
        ? { ...existing, ...profile }
        : { ...profile, id: "main", createdAt: posNowIso() };
      await dbBatch({ business: [record] });

      const nextSettings: RepairSettings = { ...DEFAULT_SETTINGS, id: "main" };
      const writes: Partial<Record<RepairStoreName, unknown[]>> = {
        repairSettings: [nextSettings],
      };

      const techName = firstTechnician.trim();
      const techs: Technician[] = techName
        ? [
            {
              id: generateId(),
              name: techName,
              phone: "",
              speciality: "",
              active: true,
              createdAt: nowIso(),
            },
          ]
        : [];
      if (techs.length > 0) writes.technicians = techs;

      await repairBatch(writes);
      setBusiness(record);
      setSettings(nextSettings);
      setTechnicians(techs);
      setStatus("ready");
    },
    []
  );

  const updateBusiness = useCallback(
    async (updates: Partial<Omit<Business, "id" | "createdAt">>) => {
      const existing = (await dbGetAll<Business>("business")).find((row) => row.id === "main");
      const record: Business = existing
        ? { ...existing, ...updates }
        : {
            id: "main",
            name: "",
            phone: "",
            address: "",
            currency: "INR",
            email: "",
            taxNumber: "",
            logoDataUrl: "",
            createdAt: posNowIso(),
            ...updates,
          };
      await dbBatch({ business: [record] });
      setBusiness(record);
    },
    []
  );

  /* ---------------------------------------------------------------------
   * Customers
   * ------------------------------------------------------------------ */

  const saveCustomer = useCallback(
    async (input: CustomerInput, id?: string) => {
      const existing = id ? customers.find((customer) => customer.id === id) : undefined;
      const record: Customer = existing
        ? { ...existing, ...input, updatedAt: nowIso() }
        : { ...input, id: generateId(), createdAt: nowIso(), updatedAt: nowIso() };
      await repairBatch({ customers: [record] });
      setCustomers((previous) =>
        existing
          ? previous.map((customer) => (customer.id === record.id ? record : customer))
          : [...previous, record]
      );
      return record;
    },
    [customers]
  );

  const deleteCustomer = useCallback(
    async (id: string) => {
      if (jobs.some((job) => job.customerId === id)) {
        throw new Error("This customer has jobs on the board. Delete or deliver those first.");
      }
      await repairBatch({}, { customers: [id] });
      setCustomers((previous) => previous.filter((customer) => customer.id !== id));
    },
    [jobs]
  );

  /* ---------------------------------------------------------------------
   * Jobs
   * ------------------------------------------------------------------ */

  /**
   * Bring a job's tracking link in line with the job, and hand back the job
   * carrying whatever the attempt produced.
   *
   * Never throws, and never blocks. Publishing needs the network, and the whole
   * app is built to work without it — so a failure is recorded on the job as
   * `pendingSince` and retried later rather than surfacing as an error over a
   * write that already succeeded. The device is on the counter either way; the
   * customer's link catching up ten minutes later costs nobody anything.
   *
   * Returns the same object when there is nothing to do, so callers can compare
   * by identity and skip a pointless second write.
   */
  const applyTracking = useCallback(
    async (job: Job, billForThisJob: Bill | null): Promise<Job> => {
      if (!settings.trackingEnabled) return job;
      if (typeof window === "undefined") return job;
      const origin = window.location.origin;

      try {
        if (!job.tracking) {
          const tracking = await publishTracking(job, business, settings, billForThisJob, origin);
          return { ...job, tracking };
        }
        const tracking = await pushTracking(job.tracking, job, business, settings, billForThisJob);
        return tracking === job.tracking ? job : { ...job, tracking };
      } catch (error) {
        // "disabled" and "not-configured" are settled facts rather than
        // failures to retry, so they leave no queue entry behind.
        const reason = error instanceof TrackingError ? error.reason : "failed";
        if (reason === "disabled" || reason === "not-configured") return job;
        if (job.tracking?.pendingSince || job.trackingQueuedAt) return job;
        // A job that has no link yet records the intent on itself, so
        // retryPendingTracking can find it again.
        return job.tracking
          ? { ...job, tracking: { ...job.tracking, pendingSince: nowIso() } }
          : { ...job, trackingQueuedAt: nowIso() };
      }
    },
    [business, settings]
  );

  /** Persist a tracking change that happened after the job itself was written. */
  const persistTracking = useCallback(async (before: Job, after: Job) => {
    if (before === after) return;
    await repairBatch({ jobs: [after] });
    setJobs((previous) => previous.map((job) => (job.id === after.id ? after : job)));
  }, []);


  const createJob = useCallback(
    async (input: IntakeInput) => {
      const timestamp = nowIso();
      const job = await allocateNumber<Job>("nextJobNumber", "jobs", (next) => ({
        id: generateId(),
        jobNo: jobNumberFrom(settings.jobPrefix, next),
        customerId: input.customerId,
        deviceKind: input.deviceKind,
        brand: input.brand,
        model: input.model,
        serialNo: input.serialNo,
        colour: input.colour,
        reportedProblems: input.reportedProblems,
        problemNote: input.problemNote,
        conditionIn: input.conditionIn,
        intakePhotos: input.intakePhotos,
        accessories: input.accessories,
        unlockCode: input.unlockCode,
        estimateAmount: input.estimateAmount,
        estimateApprovedOn: null,
        promisedDate: input.promisedDate,
        status: "received",
        technicianId: input.technicianId,
        priority: input.priority,
        intakeSignatureDataUrl: input.intakeSignatureDataUrl,
        customerNotes: input.customerNotes,
        internalNotes: input.internalNotes,
        partsUsed: [],
        labourCharge: 0,
        diagnosis: "",
        workDone: "",
        warrantyDays: settings.defaultWarrantyDays,
        deliveredOn: null,
        deliverySignatureDataUrl: "",
        warrantyClaimOfJobId: input.warrantyClaimOfJobId ?? null,
        billId: null,
        statusHistory: [statusChange(null, "received", "Device received")],
        createdAt: timestamp,
        updatedAt: timestamp,
      }));

      setJobs((previous) => [...previous, job]);
      setSettings((previous) => ({ ...previous, nextJobNumber: previous.nextJobNumber + 1 }));

      // The link is minted here so the "received" message can carry it. When
      // the shop is offline the job still saves, the message still goes, and
      // the link is queued — see retryPendingTracking.
      const tracked = await applyTracking(job, null);
      await persistTracking(job, tracked);
      return tracked;
    },
    [settings.jobPrefix, settings.defaultWarrantyDays, applyTracking, persistTracking]
  );

  /**
   * Everything about a job that can still change.
   *
   * The intake record is not in `JobWorkInput` at all, so there is no route by
   * which a later screen can revise the condition checklist, the photos or the
   * signature — the type says no before the runtime has to. Parts changes are
   * turned into stock deltas against what the job used to carry, so editing a
   * quantity down puts the difference back on the shelf.
   */
  const updateJobWork = useCallback(
    async (id: string, updates: JobWorkInput) => {
      const existing = jobMap.get(id);
      if (!existing) throw new Error("That job no longer exists.");

      const next: Job = { ...existing, ...updates, updatedAt: nowIso() };
      const deltas = updates.partsUsed
        ? stockDeltas(existing.partsUsed, next.partsUsed)
        : new Map<string, number>();

      const changedParts: Part[] = [];
      for (const [partId, delta] of deltas) {
        const part = partMap.get(partId);
        if (!part) continue;
        changedParts.push({ ...part, stock: part.stock + delta, updatedAt: nowIso() });
      }

      await repairBatch({
        jobs: [next],
        ...(changedParts.length > 0 ? { parts: changedParts } : {}),
      });

      setJobs((previous) => previous.map((job) => (job.id === id ? next : job)));
      if (changedParts.length > 0) {
        const byId = new Map(changedParts.map((part) => [part.id, part]));
        setParts((previous) => previous.map((part) => byId.get(part.id) ?? part));
      }
      return next;
    },
    [jobMap, partMap]
  );

  /**
   * Move a job to a new status, appending to the timeline.
   *
   * Any move is allowed, including backwards — a device marked ready that turns
   * out to still be faulty goes back to `in-repair`, and a board that refused
   * that would just be lied to instead. `delivered` is the exception: it is
   * reached through `deliverJob`, because §3.4 makes delivery the moment the
   * bill is settled and the signature taken, and a status set without those
   * would leave a delivered job with no record of either.
   *
   * OPEN QUESTION: the spec gives no transition graph. Confirm free movement
   * plus the delivery exception is the intended behaviour.
   */
  const setJobStatus = useCallback(
    async (id: string, next: JobStatus, note = "") => {
      const existing = jobMap.get(id);
      if (!existing) throw new Error("That job no longer exists.");
      if (next === "delivered" && existing.status !== "delivered") {
        throw new Error("Use Deliver, so the bill and signature are recorded with it.");
      }
      if (existing.status === next) return existing;

      const updated: Job = {
        ...existing,
        status: next,
        // Approving an estimate is a date the reports read; stamp it on the way
        // past rather than asking the technician to set it twice.
        estimateApprovedOn:
          next === "approved" && !existing.estimateApprovedOn
            ? todayKey()
            : existing.estimateApprovedOn,
        statusHistory: [...existing.statusHistory, statusChange(existing.status, next, note)],
        updatedAt: nowIso(),
      };

      await repairBatch({ jobs: [updated] });
      setJobs((previous) => previous.map((job) => (job.id === id ? updated : job)));

      // The board has already moved. Bringing the customer's link up to date is
      // a second, best-effort step — it cannot fail the status change.
      const synced = await applyTracking(updated, billByJob.get(updated.id) ?? null);
      await persistTracking(updated, synced);
      return synced;
    },
    [jobMap, applyTracking, persistTracking, billByJob]
  );

  /** §4: a status change may be notified once; `notifiedAt` guards duplicates. */
  const markNotified = useCallback(
    async (jobId: string, changeId: string) => {
      const existing = jobMap.get(jobId);
      if (!existing) return;
      const updated: Job = {
        ...existing,
        statusHistory: existing.statusHistory.map((change) =>
          change.id === changeId && !change.notifiedAt
            ? { ...change, notifiedAt: nowIso() }
            : change
        ),
        updatedAt: nowIso(),
      };
      await repairBatch({ jobs: [updated] });
      setJobs((previous) => previous.map((job) => (job.id === jobId ? updated : job)));
    },
    [jobMap]
  );

  /**
   * Record that an uncollected device was chased.
   *
   * Written as a `ready` → `ready` entry with `notifiedAt` stamped, so the nag
   * shows on the job's own timeline and the next one is due an interval later.
   * See the note on `lastNaggedAt` in calc.ts.
   */
  const recordNag = useCallback(
    async (jobId: string) => {
      const existing = jobMap.get(jobId);
      if (!existing) return;
      const at = nowIso();
      const updated: Job = {
        ...existing,
        statusHistory: [
          ...existing.statusHistory,
          { ...statusChange("ready", "ready", "Collection reminder sent"), notifiedAt: at },
        ],
        updatedAt: at,
      };
      await repairBatch({ jobs: [updated] });
      setJobs((previous) => previous.map((job) => (job.id === jobId ? updated : job)));
    },
    [jobMap]
  );

  /**
   * Hand the device back: bill it, take the signature, start the warranty.
   *
   * The bill is optional. A warranty claim, or a fault that turned out to be a
   * loose connector, is delivered with nothing to charge — forcing a zero
   * invoice on those would put rows in the register that mean nothing and would
   * make the invoice counter climb for no reason.
   *
   * OPEN QUESTION: confirm a no-charge delivery should leave `billId` null
   * rather than raising a zero-value invoice.
   */
  const deliverJob = useCallback(
    async (id: string, input: DeliveryInput) => {
      const existing = jobMap.get(id);
      if (!existing) throw new Error("That job no longer exists.");

      const at = nowIso();
      const base: Job = {
        ...existing,
        status: "delivered",
        deliveredOn: input.deliveredOn,
        warrantyDays: input.warrantyDays,
        deliverySignatureDataUrl: input.deliverySignatureDataUrl,
        statusHistory: [
          ...existing.statusHistory,
          statusChange(existing.status, "delivered", "Device handed over"),
        ],
        updatedAt: at,
      };

      if (!input.bill) {
        await repairBatch({ jobs: [base] });
        setJobs((previous) => previous.map((job) => (job.id === id ? base : job)));
        const syncedFree = await applyTracking(base, null);
        await persistTracking(base, syncedFree);
        return syncedFree;
      }

      const totals = billTotals(
        {
          partsUsed: existing.partsUsed,
          labourCharge: existing.labourCharge,
          discount: input.bill.discount,
          taxRate: input.bill.taxRate,
        },
        settings
      );

      // The bill and the job that points at it are allocated and written in one
      // transaction: an invoice number handed out for a job that then failed to
      // save is a gap in the register nobody can explain later.
      const bill = await allocateNumber<Bill>(
        "nextInvoiceNumber",
        "bills",
        (next) => {
          const record: Bill = {
            id: generateId(),
            invoiceNo: invoiceNumberFrom(settings.invoicePrefix, next),
            jobId: existing.id,
            customerId: existing.customerId,
            date: input.deliveredOn,
            partLines: existing.partsUsed.map((part) => ({
              label: part.name,
              quantity: part.quantity,
              unitPrice: part.sellingPrice,
              amount: round2(part.sellingPrice * part.quantity),
            })),
            labourCharge: totals.labourCharge,
            discount: totals.discount,
            taxRate: totals.taxRate,
            taxAmount: totals.taxAmount,
            total: totals.total,
            paid: round2(Math.min(input.bill!.paid, totals.total)),
            paymentMode: input.bill!.paymentMode,
            createdAt: at,
          };
          return record;
        }
      );

      const delivered: Job = { ...base, billId: bill.id };
      await repairBatch({ jobs: [delivered] });

      setJobs((previous) => previous.map((job) => (job.id === id ? delivered : job)));
      setBills((previous) => [...previous, bill]);
      setSettings((previous) => ({
        ...previous,
        nextInvoiceNumber: previous.nextInvoiceNumber + 1,
      }));

      // The delivered payload carries the warranty end date and the invoice
      // number, which is the version of the page a customer comes back to.
      const synced = await applyTracking(delivered, bill);
      await persistTracking(delivered, synced);
      return synced;
    },
    [jobMap, settings, applyTracking, persistTracking]
  );

  /**
   * Open a new job against an earlier one, on the same device.
   *
   * A fresh intake record is taken rather than copied: the device has been in
   * the customer's hands since, so the condition it arrives in the second time
   * is a new fact and the photos have to be new photos. What carries over is the
   * device itself, the customer, and the link back — which is what makes the
   * rework visible in the reports.
   *
   * Labour starts at zero because §4 makes a claim free by default; the
   * technician can still add parts and charge for them.
   */
  const raiseWarrantyClaim = useCallback(
    async (originalJobId: string) => {
      const original = jobMap.get(originalJobId);
      if (!original) throw new Error("That job no longer exists.");

      const claim = await createJob({
        customerId: original.customerId,
        deviceKind: original.deviceKind,
        brand: original.brand,
        model: original.model,
        serialNo: original.serialNo,
        colour: original.colour,
        reportedProblems: [],
        problemNote: "",
        conditionIn: [],
        intakePhotos: [],
        accessories: [],
        unlockCode: "",
        estimateAmount: null,
        promisedDate: null,
        technicianId: original.technicianId,
        priority: original.priority,
        intakeSignatureDataUrl: "",
        customerNotes: "",
        internalNotes: `Warranty claim against ${original.jobNo}.`,
        warrantyClaimOfJobId: original.id,
      });

      return claim;
    },
    [createJob, jobMap]
  );

  const deleteJob = useCallback(
    async (id: string) => {
      const job = jobMap.get(id);
      if (!job) return;
      if (job.billId) {
        throw new Error("This job has been billed. Cancel it instead of deleting it.");
      }
      // Parts the job consumed go back on the shelf — the repair did not happen.
      const changedParts: Part[] = [];
      for (const [partId, delta] of stockDeltas(job.partsUsed, [])) {
        const part = partMap.get(partId);
        if (!part) continue;
        changedParts.push({ ...part, stock: part.stock + delta, updatedAt: nowIso() });
      }

      await repairBatch(
        changedParts.length > 0 ? { parts: changedParts } : {},
        { jobs: [id] }
      );
      setJobs((previous) => previous.filter((row) => row.id !== id));
      if (changedParts.length > 0) {
        const byId = new Map(changedParts.map((part) => [part.id, part]));
        setParts((previous) => previous.map((part) => byId.get(part.id) ?? part));
      }
    },
    [jobMap, partMap]
  );

  /* ---------------------------------------------------------------------
   * Parts
   * ------------------------------------------------------------------ */

  const savePart = useCallback(
    async (input: PartInput, id?: string) => {
      const existing = id ? partMap.get(id) : undefined;
      const record: Part = existing
        ? { ...existing, ...input, updatedAt: nowIso() }
        : { ...input, id: generateId(), createdAt: nowIso(), updatedAt: nowIso() };
      await repairBatch({ parts: [record] });
      setParts((previous) =>
        existing ? previous.map((part) => (part.id === record.id ? record : part)) : [...previous, record]
      );
      return record;
    },
    [partMap]
  );

  const adjustStock = useCallback(
    async (id: string, delta: number) => {
      const existing = partMap.get(id);
      if (!existing) return;
      const record: Part = {
        ...existing,
        stock: existing.stock + delta,
        updatedAt: nowIso(),
      };
      await repairBatch({ parts: [record] });
      setParts((previous) => previous.map((part) => (part.id === id ? record : part)));
    },
    [partMap]
  );

  const deletePart = useCallback(async (id: string) => {
    // Jobs keep their own copy of what a part cost and sold for, so removing the
    // master row never rewrites history — a delivered job's margin stays what it
    // was on the day.
    await repairBatch({}, { parts: [id] });
    setParts((previous) => previous.filter((part) => part.id !== id));
  }, []);

  /* ---------------------------------------------------------------------
   * Technicians
   * ------------------------------------------------------------------ */

  const saveTechnician = useCallback(
    async (input: TechnicianInput, id?: string) => {
      const existing = id ? technicians.find((tech) => tech.id === id) : undefined;
      const record: Technician = existing
        ? { ...existing, ...input }
        : { ...input, id: generateId(), createdAt: nowIso() };
      await repairBatch({ technicians: [record] });
      setTechnicians((previous) =>
        existing ? previous.map((tech) => (tech.id === record.id ? record : tech)) : [...previous, record]
      );
      return record;
    },
    [technicians]
  );

  const deleteTechnician = useCallback(async (id: string) => {
    await repairBatch({}, { technicians: [id] });
    setTechnicians((previous) => previous.filter((tech) => tech.id !== id));
  }, []);

  /* ---------------------------------------------------------------------
   * Customer tracking links
   * ------------------------------------------------------------------ */

  /** Mint a link for a job that has none, or retry one that failed. */
  const publishJobTracking = useCallback(
    async (jobId: string) => {
      const existing = jobMap.get(jobId);
      if (!existing) throw new Error("That job no longer exists.");
      if (typeof window === "undefined") throw new Error("Tracking needs a browser.");

      const tracking = await publishTracking(
        existing,
        business,
        settings,
        billByJob.get(jobId) ?? null,
        window.location.origin
      );
      const updated: Job = { ...existing, tracking, trackingQueuedAt: null };
      await repairBatch({ jobs: [updated] });
      setJobs((previous) => previous.map((job) => (job.id === jobId ? updated : job)));
      return updated;
    },
    [jobMap, business, settings, billByJob]
  );

  /**
   * Put the estimate in front of the customer to answer.
   *
   * Mints the reply channel — a second, throwaway code holding nothing but a
   * yes/no — and pushes a payload that carries its token, which is what turns
   * the tracking page's Approve and Decline buttons on. See tracking.ts for why
   * the customer never receives the tracking link's own token.
   */
  const openEstimateForApproval = useCallback(
    async (jobId: string) => {
      const existing = jobMap.get(jobId);
      if (!existing) throw new Error("That job no longer exists.");
      if (typeof window === "undefined") throw new Error("Tracking needs a browser.");
      if (!settings.trackingEnabled) {
        throw new Error("Customer tracking links are switched off in Settings.");
      }

      const bill = billByJob.get(jobId) ?? null;

      // A job quoted before it had a link gets one now — the estimate is the
      // message the customer is most likely to act on, so it must carry a URL.
      const base: JobTracking =
        existing.tracking ??
        (await publishTracking(existing, business, settings, bill, window.location.origin));

      // Re-used rather than re-minted, so a re-sent estimate does not orphan a
      // channel the customer may already have open on their phone.
      const reply = base.reply ?? (await mintReplyChannel(existing, settings));
      const withReply: JobTracking = {
        ...base,
        reply: { ...reply, decision: null, decidedAt: null },
      };

      const pushed = await pushTracking(
        withReply,
        { ...existing, tracking: withReply },
        business,
        settings,
        bill
      );

      const updated: Job = { ...existing, tracking: pushed, trackingQueuedAt: null };
      await repairBatch({ jobs: [updated] });
      setJobs((previous) => previous.map((job) => (job.id === jobId ? updated : job)));
      return updated;
    },
    [jobMap, business, settings, billByJob]
  );

  /**
   * Has the customer answered the estimate yet?
   *
   * Polling, because there is no push and there cannot be one without a server
   * of our own. Returns null for "no answer, or we could not tell" — a
   * tracking failure must never be able to stall the board, so the caller
   * simply carries on waiting.
   *
   * The answer moves the job itself: yes to `approved` (which stamps
   * `estimateApprovedOn`), no to `returned-unrepaired`. The customer's write is
   * a signal, never a status the shop has to accept blindly — it lands on the
   * timeline like any other change.
   */
  const checkEstimateDecision = useCallback(
    async (jobId: string) => {
      const existing = jobMap.get(jobId);
      const reply = existing?.tracking?.reply;
      if (!existing || !reply || reply.decision) return null;

      const answer = await readDecision(reply.code);
      if (!answer) return null;

      const recorded: Job = {
        ...existing,
        tracking: {
          ...existing.tracking!,
          reply: { ...reply, decision: answer.decision, decidedAt: answer.at },
        },
      };
      await repairBatch({ jobs: [recorded] });
      setJobs((previous) => previous.map((job) => (job.id === jobId ? recorded : job)));

      await setJobStatus(
        jobId,
        answer.decision === "yes" ? "approved" : "returned-unrepaired",
        answer.decision === "yes"
          ? "Approved by the customer on their tracking page"
          : "Declined by the customer on their tracking page"
      );
      return answer.decision;
    },
    [jobMap, setJobStatus]
  );

  /**
   * Work the queue of links that could not be published when they were wanted.
   *
   * Called when the app comes back online. Failures are left queued rather than
   * cleared, so a shop that is offline all afternoon does not lose the links it
   * was owed.
   */
  const retryPendingTracking = useCallback(async () => {
    if (!settings.trackingEnabled || typeof window === "undefined") return 0;
    const pending = jobs.filter(
      (job) => job.trackingQueuedAt || job.tracking?.pendingSince
    );
    let done = 0;
    for (const job of pending) {
      try {
        const synced = await applyTracking(
          job.tracking ? { ...job, tracking: { ...job.tracking, pendingSince: null } } : job,
          billByJob.get(job.id) ?? null
        );
        if (synced.tracking && !synced.tracking.pendingSince) {
          const cleared: Job = { ...synced, trackingQueuedAt: null };
          await repairBatch({ jobs: [cleared] });
          setJobs((previous) => previous.map((row) => (row.id === job.id ? cleared : row)));
          done += 1;
        }
      } catch {
        // Still offline, or still down. It stays queued.
      }
    }
    return done;
  }, [jobs, settings.trackingEnabled, applyTracking, billByJob]);

  /* ---------------------------------------------------------------------
   * Whole-database operations
   * ------------------------------------------------------------------ */

  const clearAllData = useCallback(async () => {
    await repairClearAll();
    setCustomers([]);
    setJobs([]);
    setParts([]);
    setTechnicians([]);
    setBills([]);
    setSettings(DEFAULT_SETTINGS);
    setStatus("welcome");
  }, []);

  const applyRestoredBackup = useCallback(
    async (backup: RepairBackup) => {
      await restoreBackup(backup);
      await load();
    },
    [load]
  );

  const syncToSheet = useCallback(async () => {
    if (!isValidSyncUrl(settings.sheetSyncUrl)) {
      throw new Error("Add your Google Sheet script URL in Settings first.");
    }
    const payloads = buildTabPayloads(
      { business, settings, customers, jobs, parts, technicians, bills },
      ALL_SYNC_SLICES
    );
    await pushToSheet(settings.sheetSyncUrl, payloads);
  }, [business, settings, customers, jobs, parts, technicians, bills]);

  const value = useMemo<RepairContextValue>(
    () => ({
      status,
      errorMessage,
      business,
      settings,
      customers,
      jobs,
      parts,
      technicians,
      bills,
      today,
      startSetup,
      backToWelcome,
      createShop,
      updateBusiness,
      updateSettings,
      saveCustomer,
      deleteCustomer,
      createJob,
      updateJobWork,
      setJobStatus,
      markNotified,
      recordNag,
      deliverJob,
      raiseWarrantyClaim,
      deleteJob,
      savePart,
      adjustStock,
      deletePart,
      saveTechnician,
      deleteTechnician,
      clearAllData,
      applyRestoredBackup,
      syncToSheet,
      reloadAll,
      publishJobTracking,
      openEstimateForApproval,
      checkEstimateDecision,
      retryPendingTracking,
      jobById: (id: string) => jobMap.get(id),
      customerById: (id: string) => customers.find((customer) => customer.id === id),
      partById: (id: string) => partMap.get(id),
      technicianById: (id: string) => technicians.find((tech) => tech.id === id),
      billForJob: (jobId: string) => billByJob.get(jobId),
    }),
    [
      status,
      errorMessage,
      business,
      settings,
      customers,
      jobs,
      parts,
      technicians,
      bills,
      today,
      startSetup,
      backToWelcome,
      createShop,
      updateBusiness,
      updateSettings,
      saveCustomer,
      deleteCustomer,
      createJob,
      updateJobWork,
      setJobStatus,
      markNotified,
      recordNag,
      deliverJob,
      raiseWarrantyClaim,
      deleteJob,
      savePart,
      adjustStock,
      deletePart,
      saveTechnician,
      deleteTechnician,
      clearAllData,
      applyRestoredBackup,
      syncToSheet,
      reloadAll,
      publishJobTracking,
      openEstimateForApproval,
      checkEstimateDecision,
      retryPendingTracking,
      jobMap,
      partMap,
      billByJob,
    ]
  );

  return <RepairContext.Provider value={value}>{children}</RepairContext.Provider>;
}
