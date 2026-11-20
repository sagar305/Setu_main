// Operation log for Google Drive team sync in the Free Repair Job Card.
//
// Same idea as the POS (lib/pos/drive/ops.ts): devices upload what they did,
// not the state they ended up with, and the owner's main device (the hub)
// merges everyone's operations in a fixed order. The difference is shape.
// A POS sale is an event; a repair job is a record several people edit at
// once — the front desk changes the promised date while the engineer writes
// the diagnosis — so an edit travels as the fields that changed, and two
// people changing different fields of one job both keep their change.
//
// Pure: no network, no IndexedDB. Runs in Node tests as-is.

export type Role = "owner" | "frontdesk" | "technician";

/** Limits the owner sets per front-desk member (ignored for other roles). */
export type MemberPermissions = {
  /** Largest bill discount allowed, as % of parts + labour. 0 = no discounts. */
  maxDiscountPercent: number;
};

export const DEFAULT_FRONTDESK_PERMISSIONS: MemberPermissions = { maxDiscountPercent: 10 };

export type Member = {
  email: string;
  role: Role;
  /** Short code used in file names and the member's number series: "O", "F1", "T1". */
  code: string;
  addedAt: string;
  /** Set when removed; their later operations are ignored. */
  removedAt?: string | null;
  permissions?: MemberPermissions;
  /** For a technician: the Technician record (lib/repair/types) whose jobs they see. */
  technicianId?: string | null;
};

/** Stores team sync shares. The business profile lives in the POS workspace and is published by the hub. */
export const SYNC_STORES = ["jobs", "customers", "parts", "technicians", "bills", "vendors", "repairSettings"] as const;
export type SyncStore = (typeof SYNC_STORES)[number];

export function isSyncStore(store: string): store is SyncStore {
  return (SYNC_STORES as readonly string[]).includes(store);
}

type OpBase = {
  /** Globally unique (member code + device id + counter); de-duplicates re-downloads. */
  id: string;
  /** ISO time the device recorded the operation. */
  at: string;
};

export type Op = OpBase &
  (
    | {
        /** Create a record (`create`) or change some of its fields. */
        type: "put";
        store: SyncStore;
        recordId: string;
        create: boolean;
        fields: Record<string, unknown>;
      }
    | { type: "delete"; store: SyncStore; recordId: string }
    /** Parts stock moves as a delta, never as a level: two benches using the same part both count. */
    | { type: "stock"; partId: string; change: number }
  );

export type OpType = Op["type"];

/** One member's operations, author taken from the file (only they can write it). */
export type ChangesFile = { memberCode: string; ops: Op[] };

/** Every record has a string id. */
export type SyncRecord = { id: string } & Record<string, unknown>;

/** Store → rows: what a device has, or should have. */
export type Snapshot = Partial<Record<string, SyncRecord[]>>;

/** Stable ordering so every device applies operations identically. */
export function compareOps(a: Op, b: Op): number {
  if (a.at !== b.at) return a.at < b.at ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Job number prefix for a non-main device: "JC-" + "F1" + "K7Q" → "JC-F1K7Q-". */
export function memberSeriesPrefix(basePrefix: string, code: string, deviceTag: string): string {
  return `${basePrefix}${code}${deviceTag}-`;
}

/** Short device tag for number series, so two devices of one person never collide. */
export function deviceTag(deviceId: string): string {
  return deviceId.replace(/[^a-z0-9]/gi, "").slice(-3).toUpperCase();
}
