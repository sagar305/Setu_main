// The files a repair shop keeps in the owner's Google Drive, and how a device
// turns them into its local data. Pure — engine.ts does the network,
// encryption (lib/pos/drive/crypto) and IndexedDB.
//
// The owner's main device (the hub) reads every member's changes file, merges
// them into its own data and publishes. Every file is encrypted:
//
//   live.json     shop key   parts stock, team list, merge progress — every sync
//   catalog.json  shop key   business, shared settings, technicians, parts
//                            (names only: no prices, no stock)
//   books.json    books key  customers, jobs (no pictures), bills, vendors,
//                            part prices, staff phones — owner and front desk
//   archive.json  books key  older closed jobs, rewritten once per 300
//   media.json    books key  pictures of open jobs, shrunk — rewritten only
//                            when a job with pictures opens or closes
//   bench-<code>  shop key   one per technician, shared with that technician
//                            only: their open jobs with prices and customers'
//                            phone numbers removed
//   changes-<code>.json  shop key  each member device's changes until merged
//
// Technicians open live, catalog, their bench and their changes file; the
// owner and the front desk also books, archive and media.

import type { Bill, Customer, Job, JobStatus, Part, Technician, Vendor } from "../types";
import { OPEN_STATUSES } from "../types";
import type { Member, Snapshot, SyncRecord } from "./ops";
import { MEDIA_FIELDS, sharedSettings, withSharedSettings } from "./scope";

export const TEAM_APP = "setu-repair-team";
export const TEAM_FILE_VERSION = 1;

/** People in one shop's team, the owner included. */
export const MAX_TEAM_SIZE = 5;

/** Closed jobs stay in books.json until this many, then move to the archive in blocks. */
export const JOB_ARCHIVE_CHUNK = 300;

export const FILE_LABEL = {
  live: "repair:live",
  catalog: "repair:catalog",
  books: "repair:books",
  archive: "repair:archive",
  media: "repair:media",
  bench: (code: string) => `repair:bench:${code}`,
  changes: (code: string) => `repair:changes:${code}`,
} as const;

export type TeamMember = Member & {
  /** Drive id of this member's changes file. */
  fileId: string;
  /** Technicians: Drive id of their bench file. */
  benchFileId?: string | null;
  /** Display name the owner typed, optional. */
  name?: string;
  /** Mobile number for WhatsApp invites. Kept in books.json only. */
  phone?: string;
};

export type ShopFileIds = {
  live: string;
  catalog: string;
  books: string;
  archive: string;
  media: string;
};

export type LiveFile = {
  version: typeof TEAM_FILE_VERSION;
  shopName: string;
  updatedAt: string;
  primaryCode: string;
  primaryEmail: string;
  hubDeviceId: string;
  members: TeamMember[];
  /** Operations applied per member device: key `${code}/${deviceId}`. */
  consumed: Record<string, number>;
  /** Parts stock on hand by part id. */
  stock: Record<string, number>;
  files: ShopFileIds;
  /** Fingerprints of the other files, so devices download only what changed. */
  revs: { catalog: string; books: string; archive: string; media: string; bench: Record<string, string> };
};

export type CatalogFile = {
  version: typeof TEAM_FILE_VERSION;
  business: SyncRecord | null;
  settings: Record<string, unknown>;
  technicians: Technician[];
  /** Without prices or stock. */
  parts: Part[];
};

export type BooksFile = {
  version: typeof TEAM_FILE_VERSION;
  customers: Customer[];
  /** Open and recent jobs, pictures removed (they are in media.json). */
  jobs: Job[];
  bills: Bill[];
  vendors: Vendor[];
  partPrices: Record<string, { costPrice: number; sellingPrice: number }>;
  memberPhones: Record<string, string>;
};

export type ArchiveFile = { version: typeof TEAM_FILE_VERSION; jobs: Job[] };

export type JobMedia = Pick<Job, (typeof MEDIA_FIELDS)[number]>;

export type MediaFile = { version: typeof TEAM_FILE_VERSION; jobs: Record<string, JobMedia> };

export type BenchFile = {
  version: typeof TEAM_FILE_VERSION;
  technicianId: string | null;
  jobs: Job[];
  /** Names only. */
  customers: Customer[];
};

/** One device's not-yet-trimmed changes; `base` = how many earlier ones were trimmed. */
export type DeviceSection = { base: number; ops: import("./ops").Op[] };

export type ChangesFileBody = { memberCode: string; devices: Record<string, DeviceSection> };

// ---------------------------------------------------------------------------
// Changes files and merge progress (same scheme as the POS)
// ---------------------------------------------------------------------------

export function consumedKey(memberCode: string, deviceId: string): string {
  return `${memberCode}/${deviceId}`;
}

export function deviceSections(body: ChangesFileBody | null | undefined): Record<string, DeviceSection> {
  return { ...(body?.devices ?? {}) };
}

export function withDeviceSection(
  body: ChangesFileBody | null | undefined,
  memberCode: string,
  deviceId: string,
  section: DeviceSection
): ChangesFileBody {
  return { memberCode, devices: { ...deviceSections(body), [deviceId]: section } };
}

/** Operations the hub hasn't applied yet, per device, and the new progress. */
export function freshOps(
  memberCode: string,
  body: ChangesFileBody,
  consumed: Record<string, number>
): { ops: import("./ops").Op[]; consumed: Record<string, number> } {
  const next = { ...consumed };
  const ops: import("./ops").Op[] = [];
  for (const [deviceId, section] of Object.entries(deviceSections(body))) {
    const key = consumedKey(memberCode, deviceId);
    const done = next[key] ?? 0;
    const start = Math.max(0, done - section.base);
    ops.push(...section.ops.slice(start));
    next[key] = Math.max(done, section.base + section.ops.length);
  }
  return { ops, consumed: next };
}

/** A device's operations not yet applied by the hub, from its local list. */
export function pendingOps<T>(ops: T[], localBase: number, consumed: number): T[] {
  return ops.slice(Math.max(0, consumed - localBase));
}

// ---------------------------------------------------------------------------
// Building the files on the hub
// ---------------------------------------------------------------------------

const rows = <T>(local: Snapshot, store: string) => (local[store] ?? []) as unknown as T[];

/** A job with its pictures taken out. */
export function withoutMedia(job: Job): Job {
  return { ...job, intakePhotos: [], intakeSignatureDataUrl: "", deliverySignatureDataUrl: "" };
}

export function hasMedia(job: Job): boolean {
  return job.intakePhotos.length > 0 || Boolean(job.intakeSignatureDataUrl) || Boolean(job.deliverySignatureDataUrl);
}

export function isOpen(job: Pick<Job, "status">): boolean {
  return OPEN_STATUSES.includes(job.status as JobStatus);
}

export function buildCatalog(local: Snapshot, business: SyncRecord | null): CatalogFile {
  const settings = rows<Record<string, unknown>>(local, "repairSettings").find((row) => row.id === "main");
  return {
    version: TEAM_FILE_VERSION,
    business,
    settings: settings ? sharedSettings(settings) : {},
    technicians: rows<Technician>(local, "technicians"),
    parts: rows<Part>(local, "parts").map((part) => ({ ...part, costPrice: 0, sellingPrice: 0, stock: 0 })),
  };
}

export function buildStock(local: Snapshot): Record<string, number> {
  const stock: Record<string, number> = {};
  for (const part of rows<Part>(local, "parts")) stock[part.id] = part.stock ?? 0;
  return stock;
}

/**
 * Open jobs and the newest closed ones stay in books; the oldest whole blocks
 * of JOB_ARCHIVE_CHUNK closed jobs go to the archive, so books.json stays
 * small however many years of jobs the shop has.
 */
export function splitJobs(jobs: Job[]): { books: Job[]; archive: Job[] } {
  const closed = jobs.filter((job) => !isOpen(job)).sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
  const cut = Math.floor(closed.length / JOB_ARCHIVE_CHUNK) * JOB_ARCHIVE_CHUNK;
  const archived = new Set(closed.slice(0, cut).map((job) => job.id));
  return {
    books: jobs.filter((job) => !archived.has(job.id)),
    archive: closed.slice(0, cut),
  };
}

export function buildBooksAndArchive(
  local: Snapshot,
  members: TeamMember[]
): { books: BooksFile; archive: ArchiveFile } {
  const jobs = rows<Job>(local, "jobs").map(withoutMedia);
  const split = splitJobs(jobs);
  const partPrices: BooksFile["partPrices"] = {};
  for (const part of rows<Part>(local, "parts")) {
    partPrices[part.id] = { costPrice: part.costPrice ?? 0, sellingPrice: part.sellingPrice ?? 0 };
  }
  const memberPhones: Record<string, string> = {};
  for (const member of members) if (member.phone) memberPhones[member.code] = member.phone;
  return {
    books: {
      version: TEAM_FILE_VERSION,
      customers: rows<Customer>(local, "customers"),
      jobs: split.books,
      bills: rows<Bill>(local, "bills"),
      vendors: rows<Vendor>(local, "vendors"),
      partPrices,
      memberPhones,
    },
    archive: { version: TEAM_FILE_VERSION, jobs: split.archive },
  };
}

export type Shrink = (dataUrls: string[]) => Promise<string[]>;

/** Pictures of open jobs, shrunk. Closed jobs' pictures stay where they were taken. */
export async function buildMedia(local: Snapshot, shrink: Shrink): Promise<MediaFile> {
  const jobs: Record<string, JobMedia> = {};
  for (const job of rows<Job>(local, "jobs")) {
    if (!isOpen(job) || !hasMedia(job)) continue;
    jobs[job.id] = {
      intakePhotos: await shrink(job.intakePhotos),
      intakeSignatureDataUrl: job.intakeSignatureDataUrl,
      deliverySignatureDataUrl: job.deliverySignatureDataUrl,
    };
  }
  return { version: TEAM_FILE_VERSION, jobs };
}

/**
 * What a technician's device gets: their open jobs (Ready included), with
 * every price and every customer contact detail removed.
 */
export function stripJobForTechnician(job: Job): Job {
  return {
    ...job,
    estimateAmount: null,
    labourCharge: 0,
    partsUsed: job.partsUsed.map((line) => ({ ...line, costPrice: 0, sellingPrice: 0 })),
    outsideRepairs: (job.outsideRepairs ?? []).map((trip) => ({ ...trip, quotedCharge: null, finalCharge: null })),
    intakeSignatureDataUrl: "",
    deliverySignatureDataUrl: "",
    billId: null,
  };
}

export function customerNameOnly(customer: Customer): Customer {
  return {
    id: customer.id,
    name: customer.name,
    phone: "",
    altPhone: "",
    address: "",
    companyName: "",
    gstin: "",
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
  };
}

export async function buildBench(local: Snapshot, technicianId: string | null, shrink: Shrink): Promise<BenchFile> {
  const jobs = rows<Job>(local, "jobs").filter((job) => technicianId && job.technicianId === technicianId && isOpen(job));
  const customerIds = new Set(jobs.map((job) => job.customerId));
  const stripped: Job[] = [];
  for (const job of jobs) stripped.push({ ...stripJobForTechnician(job), intakePhotos: await shrink(job.intakePhotos) });
  return {
    version: TEAM_FILE_VERSION,
    technicianId,
    jobs: stripped,
    customers: rows<Customer>(local, "customers").filter((c) => customerIds.has(c.id)).map(customerNameOnly),
  };
}

/** The team list as everyone may see it: no phone numbers. */
export function publicMembers(members: TeamMember[]): TeamMember[] {
  return members.map((member) => {
    const copy = { ...member };
    delete copy.phone;
    return copy;
  });
}

/** People in the team now (removed ones don't count towards the limit). */
export function activeMembers(members: TeamMember[]): TeamMember[] {
  return members.filter((member) => !member.removedAt);
}

// ---------------------------------------------------------------------------
// A member device's base from what the hub published
// ---------------------------------------------------------------------------

export type Published = {
  live: LiveFile;
  catalog: CatalogFile;
  books: BooksFile | null;
  archive: ArchiveFile | null;
  media: MediaFile | null;
  bench: BenchFile | null;
};

/**
 * The shop as this member may see it. Owners and front desk get books (and the
 * archive and pictures); a technician gets only their bench.
 */
export function baseFromPublished(published: Published): Snapshot {
  const { live, catalog, books, archive, media, bench } = published;
  const prices = books?.partPrices ?? {};
  const parts = catalog.parts.map((part) => ({
    ...part,
    stock: live.stock[part.id] ?? 0,
    costPrice: prices[part.id]?.costPrice ?? 0,
    sellingPrice: prices[part.id]?.sellingPrice ?? 0,
  }));
  let jobs: Job[];
  let customers: Customer[];
  if (books) {
    jobs = [...(archive?.jobs ?? []), ...books.jobs].map((job) => ({ ...job, ...(media?.jobs[job.id] ?? {}) }));
    customers = books.customers;
  } else {
    jobs = bench?.jobs ?? [];
    customers = bench?.customers ?? [];
  }
  return {
    jobs: jobs as unknown as SyncRecord[],
    customers: customers as unknown as SyncRecord[],
    parts: parts as unknown as SyncRecord[],
    technicians: catalog.technicians as unknown as SyncRecord[],
    bills: (books?.bills ?? []) as unknown as SyncRecord[],
    vendors: (books?.vendors ?? []) as unknown as SyncRecord[],
    repairSettings: [{ ...catalog.settings, id: "main" } as SyncRecord],
  };
}

// ---------------------------------------------------------------------------
// Applying a target to a device
// ---------------------------------------------------------------------------

export type ApplyPlan = {
  writes: Record<string, SyncRecord[]>;
  deletes: Record<string, string[]>;
};

/**
 * Keep this device's pictures when they are at least as good as what came in.
 *
 * The counter that took a job in holds its photos at full size; everyone else
 * gets them shrunk. Re-applying the team's copy must not swap the counter's
 * originals for thumbnails, and a job whose pictures were left out of the
 * team's copy (it closed) must not lose the ones this device has.
 */
function keepLocalMedia(mine: SyncRecord, next: SyncRecord): SyncRecord {
  const out = { ...next };
  const localPhotos = (mine.intakePhotos as string[] | undefined) ?? [];
  const nextPhotos = (next.intakePhotos as string[] | undefined) ?? [];
  if (localPhotos.length >= nextPhotos.length && localPhotos.length > 0) out.intakePhotos = localPhotos;
  for (const field of ["intakeSignatureDataUrl", "deliverySignatureDataUrl"] as const) {
    if (!out[field] && mine[field]) out[field] = mine[field];
  }
  return out;
}

/**
 * What to write so the device's `stores` match `target`. Unchanged rows are
 * skipped. Settings keep this device's own fields; jobs keep this device's
 * pictures when they are better.
 */
export function planApply(local: Snapshot, target: Snapshot, stores: readonly string[]): ApplyPlan {
  const writes: Record<string, SyncRecord[]> = {};
  const deletes: Record<string, string[]> = {};
  for (const store of stores) {
    if (!(store in target)) continue;
    const current = new Map((local[store] ?? []).map((row) => [row.id, row]));
    const wanted = new Map((target[store] ?? []).map((row) => [row.id, row]));
    const put: SyncRecord[] = [];
    for (const [id, row] of wanted) {
      let next = row;
      const mine = current.get(id);
      if (store === "repairSettings") next = withSharedSettings(mine, row) as SyncRecord;
      else if (store === "jobs" && mine) next = keepLocalMedia(mine, row);
      if (!mine || JSON.stringify(mine) !== JSON.stringify(next)) put.push(next);
    }
    const gone = [...current.keys()].filter((id) => !wanted.has(id));
    if (put.length) writes[store] = put;
    // Never delete this device's own settings row.
    if (gone.length && store !== "repairSettings") deletes[store] = gone;
  }
  return { writes, deletes };
}

/** Job ids whose status differs between two snapshots (to refresh customers' tracking links). */
export function jobsWithNewStatus(before: Snapshot, after: Snapshot): string[] {
  const was = new Map(((before.jobs ?? []) as SyncRecord[]).map((job) => [job.id, job.status]));
  return ((after.jobs ?? []) as SyncRecord[]).filter((job) => was.has(job.id) && was.get(job.id) !== job.status).map((job) => job.id);
}
