// Rebuilds the repair shop's shared state from a base snapshot plus every
// member's operations. Pure and deterministic: any device given the same base
// and the same operations gets the same result, whatever order they arrived
// in and however many times an operation was downloaded.
//
// The main device (hub) runs it over its own data with everyone's new
// operations; other devices run it over what the hub published, with their
// own operations the hub has not merged yet.

import type { Job, PartUsage } from "../types";
import {
  compareOps,
  type ChangesFile,
  type Member,
  type Op,
  type Snapshot,
  type SyncRecord,
  type SyncStore,
  SYNC_STORES,
} from "./ops";
import {
  IMMUTABLE_JOB_FIELDS,
  TECHNICIAN_JOB_FIELDS,
  TECHNICIAN_STATUSES,
  discountAllowed,
  storeRule,
} from "./roles";

export type RejectReason =
  | "unknown-member"
  | "member-removed"
  | "not-allowed-for-role"
  | "not-assigned"
  | "fields-not-allowed"
  | "discount-over-limit"
  | "unknown-record";

export type RejectedOp = { memberCode: string; op: Op; reason: RejectReason; fields?: string[] };

export type MergedState = {
  stores: Record<SyncStore, SyncRecord[]>;
  /** Operations (or parts of them) ignored, so the owner can be told. */
  rejected: RejectedOp[];
  /** Latest operation time applied. */
  lastOpAt: string | null;
};

/**
 * Array fields on a job that several people append to. They are merged entry
 * by entry, so the front desk sending a job outside and the engineer changing
 * its status in the same minute both keep their line in the history.
 */
const UNION_FIELDS: Record<string, (entry: Record<string, unknown>) => string> = {
  statusHistory: (entry) => String(entry.id),
  outsideRepairs: (entry) => String(entry.id),
  assignmentHistory: (entry) => `${entry.at}|${entry.technicianId ?? ""}`,
};

const UNION_ORDER: Record<string, string> = {
  statusHistory: "at",
  outsideRepairs: "sentAt",
  assignmentHistory: "at",
};

function unionEntries(field: string, current: unknown, incoming: unknown): unknown[] {
  const keyOf = UNION_FIELDS[field];
  const merged = new Map<string, Record<string, unknown>>();
  for (const entry of (Array.isArray(current) ? current : []) as Record<string, unknown>[]) merged.set(keyOf(entry), entry);
  for (const entry of (Array.isArray(incoming) ? incoming : []) as Record<string, unknown>[]) merged.set(keyOf(entry), entry);
  const orderBy = UNION_ORDER[field];
  return [...merged.values()].sort((a, b) => {
    const ta = String(a[orderBy] ?? "");
    const tb = String(b[orderBy] ?? "");
    return ta < tb ? -1 : ta > tb ? 1 : 0;
  });
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * A technician's parts list, made safe: lines already on the job keep the
 * prices the shop set; new lines must be parts from stock, priced from the
 * parts list. A technician can't see prices, so whatever price their device
 * sent is ignored either way.
 */
function sanitizeTechnicianParts(
  incoming: PartUsage[],
  existing: PartUsage[],
  parts: Map<string, SyncRecord>
): { lines: PartUsage[]; dropped: boolean } {
  const known = new Map(existing.map((line) => [line.id, line]));
  let dropped = false;
  const lines: PartUsage[] = [];
  for (const line of incoming) {
    const before = known.get(line.id);
    if (before) {
      lines.push({ ...line, costPrice: before.costPrice, sellingPrice: before.sellingPrice, partId: before.partId, name: before.name });
      continue;
    }
    const part = line.partId ? parts.get(line.partId) : undefined;
    if (!part) {
      dropped = true;
      continue;
    }
    lines.push({
      ...line,
      name: String(part.name ?? line.name),
      costPrice: Number(part.costPrice) || 0,
      sellingPrice: Number(part.sellingPrice) || 0,
    });
  }
  return { lines, dropped };
}

type Tagged = { memberCode: string; op: Op };

export function mergeTeam(base: Snapshot, members: Member[], files: ChangesFile[]): MergedState {
  const maps = {} as Record<SyncStore, Map<string, SyncRecord>>;
  for (const store of SYNC_STORES) {
    maps[store] = new Map((base[store] ?? []).map((row) => [row.id, row]));
  }
  const byCode = new Map(members.map((member) => [member.code, member]));
  const rejected: RejectedOp[] = [];
  let lastOpAt: string | null = null;

  // De-duplicate (a changes file can be read twice) and order.
  const seen = new Set<string>();
  const tagged: Tagged[] = [];
  for (const file of files) {
    for (const op of file.ops) {
      if (seen.has(op.id)) continue;
      seen.add(op.id);
      tagged.push({ memberCode: file.memberCode, op });
    }
  }
  tagged.sort((a, b) => compareOps(a.op, b.op));

  for (const { memberCode, op } of tagged) {
    const member = byCode.get(memberCode);
    const reject = (reason: RejectReason, fields?: string[]) =>
      rejected.push({ memberCode, op, reason, ...(fields ? { fields } : {}) });
    if (!member) {
      reject("unknown-member");
      continue;
    }
    if (member.removedAt && op.at >= member.removedAt) {
      reject("member-removed");
      continue;
    }

    if (op.type === "stock") {
      // Recording parts used is a technician's job too; the stock follows.
      const part = maps.parts.get(op.partId);
      if (!part) {
        reject("unknown-record");
        continue;
      }
      maps.parts.set(op.partId, { ...part, stock: Math.round(((Number(part.stock) || 0) + op.change) * 1000) / 1000 });
      lastOpAt = op.at;
      continue;
    }

    const rule = storeRule(member.role, op.store);
    const map = maps[op.store];

    if (op.type === "delete") {
      if (!rule.delete) {
        reject("not-allowed-for-role");
        continue;
      }
      map.delete(op.recordId);
      lastOpAt = op.at;
      continue;
    }

    // put
    if (!rule.put) {
      reject("not-allowed-for-role");
      continue;
    }
    const existing = map.get(op.recordId);
    const fields: Record<string, unknown> = { ...op.fields };
    delete fields.id;

    if (!existing) {
      if (!op.create) {
        reject("unknown-record");
        continue;
      }
      if (!rule.create) {
        reject("not-allowed-for-role");
        continue;
      }
      const record = { ...fields, id: op.recordId } as SyncRecord;
      if (op.store === "bills" && !discountAllowed(member, record)) {
        reject("discount-over-limit");
        continue;
      }
      map.set(op.recordId, record);
      lastOpAt = op.at;
      continue;
    }

    const dropped: string[] = [];

    if (op.store === "jobs") {
      const job = existing as unknown as Job;
      for (const key of Object.keys(fields)) {
        if (IMMUTABLE_JOB_FIELDS.has(key) && !same(fields[key], (existing as SyncRecord)[key])) {
          delete fields[key];
          dropped.push(key);
        }
      }
      if (member.role === "technician") {
        if (!member.technicianId || job.technicianId !== member.technicianId) {
          reject("not-assigned");
          continue;
        }
        for (const key of Object.keys(fields)) {
          if (!TECHNICIAN_JOB_FIELDS.has(key)) {
            delete fields[key];
            dropped.push(key);
          }
        }
        if (
          "status" in fields &&
          fields.status !== job.status &&
          !TECHNICIAN_STATUSES.includes(fields.status as Job["status"])
        ) {
          delete fields.status;
          dropped.push("status");
        }
        if (Array.isArray(fields.statusHistory)) {
          // Keep only history the technician could have made: moves into their statuses.
          const known = new Set(job.statusHistory.map((change) => change.id));
          fields.statusHistory = (fields.statusHistory as Job["statusHistory"]).filter(
            (change) => known.has(change.id) || TECHNICIAN_STATUSES.includes(change.to) || change.to === change.from
          );
        }
        if (Array.isArray(fields.partsUsed)) {
          const clean = sanitizeTechnicianParts(fields.partsUsed as PartUsage[], job.partsUsed ?? [], maps.parts);
          fields.partsUsed = clean.lines;
          if (clean.dropped) dropped.push("partsUsed");
        }
      }
      for (const field of Object.keys(UNION_FIELDS)) {
        if (field in fields) fields[field] = unionEntries(field, (existing as SyncRecord)[field], fields[field]);
      }
    }

    if (op.store === "parts") {
      // Stock moves only as deltas; a level written by a put would undo
      // another bench's usage.
      if ("stock" in fields) delete fields.stock;
    }

    const next = { ...existing, ...fields, id: op.recordId } as SyncRecord;
    if (op.store === "bills" && !same(next.discount, existing.discount) && !discountAllowed(member, next)) {
      reject("discount-over-limit");
      continue;
    }
    if (dropped.length) reject("fields-not-allowed", dropped);
    map.set(op.recordId, next);
    lastOpAt = op.at;
  }

  const stores = {} as Record<SyncStore, SyncRecord[]>;
  for (const store of SYNC_STORES) stores[store] = [...maps[store].values()];
  return { stores, rejected, lastOpAt };
}
