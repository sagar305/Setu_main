// Turns a write to the repair database into team-sync operations.
//
// Every screen writes through lib/repair/db, which hands this the rows being
// written and the rows they replace. A new row becomes a create; a changed
// row becomes the fields that changed; parts stock becomes a delta. Pure: it
// sees only the write, never the database.

import type { CapturedWrite } from "../db";
import type { Role, Op, SyncRecord } from "./ops";
import { isSyncStore } from "./ops";
import { TECHNICIAN_JOB_FIELDS } from "./roles";
import { sharedSettings } from "./scope";

export type CaptureContext = {
  role: Role;
  /** Unique id for a new operation (device-prefixed). */
  newId: () => string;
  /** ISO time stamped on every operation in this write. */
  now: string;
};

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function changedFields(before: SyncRecord, after: SyncRecord): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    if (key === "id") continue;
    if (!same(before[key], after[key])) fields[key] = after[key] === undefined ? null : after[key];
  }
  return fields;
}

export function captureOps(write: CapturedWrite, ctx: CaptureContext): Op[] {
  const ops: Op[] = [];
  const at = ctx.now;

  for (const [store, rows] of Object.entries(write.writes)) {
    if (!isSyncStore(store)) continue;
    // Settings are the owner's; anyone else's change to them stays on their device.
    if (store === "repairSettings" && ctx.role !== "owner") continue;
    if (ctx.role === "technician" && store !== "jobs") continue;

    for (const raw of (rows ?? []) as SyncRecord[]) {
      if (!raw?.id) continue;
      let row = raw;
      let previous = write.before[store]?.[row.id] as SyncRecord | undefined;
      if (store === "repairSettings") {
        row = { id: row.id, ...sharedSettings(row) } as SyncRecord;
        previous = previous ? ({ id: previous.id, ...sharedSettings(previous) } as SyncRecord) : undefined;
      }

      if (!previous) {
        if (ctx.role === "technician") continue; // technicians never create records
        const fields = { ...row };
        delete (fields as Record<string, unknown>).id;
        ops.push({ id: ctx.newId(), at, type: "put", store, recordId: row.id, create: true, fields });
        continue;
      }

      if (store === "parts") {
        const change = (Number(row.stock) || 0) - (Number(previous.stock) || 0);
        if (change !== 0) ops.push({ id: ctx.newId(), at, type: "stock", partId: row.id, change });
      }

      const fields = changedFields(previous, row);
      if (store === "parts") delete fields.stock;
      if (ctx.role === "technician") {
        for (const key of Object.keys(fields)) if (!TECHNICIAN_JOB_FIELDS.has(key)) delete fields[key];
      }
      // A save that touched nothing but the timestamp is not a change.
      const meaningful = Object.keys(fields).filter((key) => key !== "updatedAt");
      if (meaningful.length === 0) continue;
      ops.push({ id: ctx.newId(), at, type: "put", store, recordId: row.id, create: false, fields });
    }
  }

  for (const [store, ids] of Object.entries(write.deletes)) {
    if (!isSyncStore(store) || ctx.role === "technician") continue;
    if (store === "repairSettings") continue;
    for (const id of ids ?? []) ops.push({ id: ctx.newId(), at, type: "delete", store, recordId: id });
  }

  return ops;
}
