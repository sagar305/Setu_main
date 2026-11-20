// What each team role may do in the Free Repair Job Card.
//
// Checked in three places, like the POS: the screens hide what a role can't
// use, Drive sharing decides which files a device can open at all, and
// merge.ts drops any operation outside its author's role — so a hand-edited
// changes file can't slip a price change or another engineer's job past the
// main device.
//
// The rules, as the shop asked for them:
//   Owner      — everything, plus team, settings and reports.
//   Front desk — intake, delivery, billing (discount up to their limit),
//                customers, parts stock, outside repair, reports. Not
//                settings, not the team, not the technician list.
//   Technician — only the jobs assigned to them: status, diagnosis, work done,
//                parts used from stock, internal notes. No prices, no bills,
//                no customer phone numbers, no promised date, no reassigning.

import type { JobStatus } from "../types";
import type { Member, MemberPermissions, Op, Role, SyncStore } from "./ops";
import { DEFAULT_FRONTDESK_PERMISSIONS } from "./ops";

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  frontdesk: "Front desk",
  technician: "Technician",
};

export const ROLE_HELP: Record<Role, string> = {
  owner: "Everything, including settings, reports and the team.",
  frontdesk: "Intake, delivery, billing, customers, parts and outside repair. No settings or team.",
  technician: "Only their assigned jobs: status, diagnosis, work done and parts used. No prices or bills.",
};

export type RepairScreen = "jobs" | "intake" | "customers" | "parts" | "billing" | "reports" | "settings";

const ROLE_SCREENS: Record<Role, ReadonlySet<RepairScreen>> = {
  owner: new Set<RepairScreen>(["jobs", "intake", "customers", "parts", "billing", "reports", "settings"]),
  frontdesk: new Set<RepairScreen>(["jobs", "intake", "customers", "parts", "billing", "reports"]),
  technician: new Set<RepairScreen>(["jobs"]),
};

export function canSeeScreen(role: Role, screen: RepairScreen): boolean {
  return ROLE_SCREENS[role].has(screen);
}

/** Statuses a technician may move their own job to. */
export const TECHNICIAN_STATUSES: readonly JobStatus[] = ["diagnosing", "in-repair", "awaiting-parts", "ready"];

/** Job fields a technician may change on a job assigned to them. */
export const TECHNICIAN_JOB_FIELDS: ReadonlySet<string> = new Set([
  "status",
  "statusHistory",
  "diagnosis",
  "workDone",
  "partsUsed",
  "internalNotes",
  "tracking",
  "trackingQueuedAt",
  "updatedAt",
]);

/**
 * The intake record. Once a job exists nobody edits these — not even the
 * owner — because a record that can be revised after the argument starts is
 * not evidence (see lib/repair/types).
 */
export const IMMUTABLE_JOB_FIELDS: ReadonlySet<string> = new Set([
  "conditionIn",
  "intakePhotos",
  "intakeSignatureDataUrl",
  "createdAt",
  "customerId",
]);

/** Stores each role may write, and whether it may delete from them. */
const STORE_RULES: Record<Role, Partial<Record<SyncStore, { put: boolean; create: boolean; delete: boolean }>>> = {
  owner: {
    jobs: { put: true, create: true, delete: true },
    customers: { put: true, create: true, delete: true },
    parts: { put: true, create: true, delete: true },
    technicians: { put: true, create: true, delete: true },
    bills: { put: true, create: true, delete: true },
    vendors: { put: true, create: true, delete: true },
    repairSettings: { put: true, create: true, delete: false },
  },
  frontdesk: {
    jobs: { put: true, create: true, delete: true },
    customers: { put: true, create: true, delete: true },
    parts: { put: true, create: true, delete: false },
    bills: { put: true, create: true, delete: false },
    vendors: { put: true, create: true, delete: false },
  },
  technician: {
    jobs: { put: true, create: false, delete: false },
  },
};

export function storeRule(role: Role, store: SyncStore) {
  return STORE_RULES[role][store] ?? { put: false, create: false, delete: false };
}

export function permissionsOf(member: Pick<Member, "role" | "permissions">): MemberPermissions {
  return { ...DEFAULT_FRONTDESK_PERMISSIONS, ...(member.permissions ?? {}) };
}

/** Discount as a % of what the bill was before it. */
export function discountPercent(bill: Record<string, unknown>): number {
  const discount = Number(bill.discount) || 0;
  if (discount <= 0) return 0;
  const lines = Array.isArray(bill.partLines) ? (bill.partLines as { amount?: unknown }[]) : [];
  const gross = lines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0) + (Number(bill.labourCharge) || 0);
  return gross > 0 ? (discount / gross) * 100 : 100;
}

/** Whether a front-desk member may give this discount. Owners always may. */
export function discountAllowed(member: Pick<Member, "role" | "permissions">, bill: Parameters<typeof discountPercent>[0]): boolean {
  if (member.role === "owner") return true;
  // A little slack for rounding in percent discounts.
  return discountPercent(bill) <= permissionsOf(member).maxDiscountPercent + 0.005;
}

export type OpKind = Op["type"];
