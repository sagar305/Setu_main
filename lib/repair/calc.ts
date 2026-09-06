// The business rules from §4, in one place, as pure functions.
//
// Every screen reads these rather than working the numbers out again. A board
// card, the reports screen and the printed invoice all have to agree on how old
// a job is and what it earned — and the answers are subtle enough (a delivered
// job stops ageing; a warranty claim earns nothing) that three copies of the
// arithmetic would be three different answers within a month.

import {
  CLOSED_STATUSES,
  IN_SHOP_STATUSES,
  REPEAT_FAILURE_DAYS,
  addDays,
  dateKeyOf,
  daysBetween,
  todayKey,
  type Bill,
  type Job,
  type Part,
  type PartUsage,
  type RepairSettings,
} from "./types";

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Time in the shop
// ---------------------------------------------------------------------------

/**
 * How many days this device has been in the shop.
 *
 * §4: `today − createdAt` for anything not delivered, cancelled or returned
 * unrepaired. A job that has left stops ageing on the day it left rather than
 * carrying on for ever, so a shop that took a device in last March does not
 * show a card claiming 500 days against a device the customer has been using
 * since.
 */
export function daysInShop(job: Job, today = todayKey()): number {
  const from = dateKeyOf(job.createdAt);
  if (!from) return 0;
  if (CLOSED_STATUSES.includes(job.status)) {
    const until = job.deliveredOn || dateKeyOf(job.updatedAt) || today;
    return Math.max(0, daysBetween(from, until));
  }
  return Math.max(0, daysBetween(from, today));
}

export type AgingLevel = "fresh" | "amber" | "red";

/**
 * Amber past `agingAmberDays`, red past `agingRedDays`.
 *
 * Only for devices still in the shop. A delivered job is not late, however long
 * it took — the colour is a queue signal, not a scorecard.
 */
export function agingLevel(
  job: Job,
  settings: RepairSettings,
  today = todayKey()
): AgingLevel {
  if (!IN_SHOP_STATUSES.includes(job.status)) return "fresh";
  const days = daysInShop(job, today);
  if (days >= settings.agingRedDays) return "red";
  if (days >= settings.agingAmberDays) return "amber";
  return "fresh";
}

/** The promise has been broken: a date was given, it has passed, the device is here. */
export function isOverdue(job: Job, today = todayKey()): boolean {
  if (!job.promisedDate) return false;
  if (!IN_SHOP_STATUSES.includes(job.status)) return false;
  return job.promisedDate < today;
}

// ---------------------------------------------------------------------------
// Uncollected devices
// ---------------------------------------------------------------------------

/**
 * When this job last entered `ready` — the clock the nag cycle runs on.
 *
 * Only a genuine transition counts. A reminder is recorded as a `ready` →
 * `ready` entry (see `lastNaggedAt`), and treating that as the device becoming
 * ready again would restart the clock every time the customer was chased: a
 * device sitting since August would report itself ready since this morning, and
 * would drop off the uncollected list the moment somebody nagged about it.
 */
export function readySince(job: Job): string {
  const readyChanges = job.statusHistory.filter(
    (change) => change.to === "ready" && change.from !== "ready"
  );
  const last = readyChanges[readyChanges.length - 1];
  return last ? dateKeyOf(last.at) : "";
}

/**
 * When the customer was last chased about collecting this device.
 *
 * A nag is recorded as a `StatusChange` from `ready` to `ready` with its
 * `notifiedAt` stamped, so the reminder appears on the job's own timeline
 * rather than in a field nothing else can see. §4 asks for a re-nag "every
 * interval", and the timeline is the only place in the spec's model that can
 * honestly answer "when did we last ring them".
 *
 * OPEN QUESTION: the spec models `StatusChange.notifiedAt` as a once-only guard
 * and does not say where a repeat nag is recorded. Confirm the timeline is the
 * right home, rather than a `lastNaggedAt` field on the job.
 */
export function lastNaggedAt(job: Job): string {
  const nags = job.statusHistory.filter(
    (change) => change.to === "ready" && change.from === "ready" && change.notifiedAt
  );
  const last = nags[nags.length - 1];
  return last?.notifiedAt ?? "";
}

/** §4: ready, and ready for longer than the nag interval. */
export function isUncollected(
  job: Job,
  settings: RepairSettings,
  today = todayKey()
): boolean {
  if (job.status !== "ready") return false;
  const since = readySince(job);
  if (!since) return false;
  return daysBetween(since, today) > settings.uncollectedNagDays;
}

/** Uncollected, and not chased within the interval — so it is due another nag. */
export function isNagDue(
  job: Job,
  settings: RepairSettings,
  today = todayKey()
): boolean {
  if (!isUncollected(job, settings, today)) return false;
  const nagged = lastNaggedAt(job);
  if (!nagged) return true;
  return daysBetween(dateKeyOf(nagged), today) >= settings.uncollectedNagDays;
}

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

export function partsSellingTotal(parts: PartUsage[]): number {
  return round2(parts.reduce((sum, part) => sum + part.sellingPrice * part.quantity, 0));
}

export function partsCostTotal(parts: PartUsage[]): number {
  return round2(parts.reduce((sum, part) => sum + part.costPrice * part.quantity, 0));
}

export type BillTotals = {
  partsTotal: number;
  labourCharge: number;
  discount: number;
  taxable: number;
  taxRate: number;
  taxAmount: number;
  total: number;
};

/**
 * What a job comes to.
 *
 * Tax is added on top of parts and labour, not read out of them: `Bill` carries
 * `taxAmount` as a figure of its own beside a `total`, which only adds up if
 * the line amounts are net. A shop that prices inclusive of GST should leave
 * tax switched off and quote the price it means.
 *
 * OPEN QUESTION: the spec does not say whether prices are tax-inclusive. This
 * reads `Bill`'s own shape literally as exclusive; confirm.
 */
export function billTotals(
  input: {
    partsUsed: PartUsage[];
    labourCharge: number;
    discount?: number;
    taxRate?: number;
  },
  settings: RepairSettings
): BillTotals {
  const partsTotal = partsSellingTotal(input.partsUsed);
  const labourCharge = round2(input.labourCharge || 0);
  // OPEN QUESTION: `Bill.discount` is typed as a number with no unit given.
  // Treated as a flat amount off the bill, matching the hire book.
  const discount = round2(Math.max(0, input.discount || 0));
  const taxable = round2(Math.max(0, partsTotal + labourCharge - discount));
  const taxRate = settings.taxEnabled ? (input.taxRate ?? settings.defaultTaxRate) : 0;
  const taxAmount = round2((taxable * taxRate) / 100);
  return {
    partsTotal,
    labourCharge,
    discount,
    taxable,
    taxRate,
    taxAmount,
    total: round2(taxable + taxAmount),
  };
}

/** What is still owed on a bill. Deliveries may take part payment. */
export function billDue(bill: Bill): number {
  return round2(Math.max(0, bill.total - bill.paid));
}

/**
 * §4: `total − Σ(partsUsed.costPrice × quantity)`. Labour is pure margin.
 *
 * The total is the billed total when the job has been billed, and the parts and
 * labour otherwise — a job in progress should show the margin it is heading for
 * while the technician can still do something about it, which is the whole
 * point of putting cost and selling price side by side on the parts list.
 */
export function jobMargin(job: Job, bill: Bill | null, settings: RepairSettings): number {
  const revenue = bill
    ? bill.total - bill.taxAmount
    : billTotals(job, settings).taxable;
  return round2(revenue - partsCostTotal(job.partsUsed));
}

/** What the customer is being asked for, billed or not yet. */
export function jobValue(job: Job, bill: Bill | null, settings: RepairSettings): number {
  if (bill) return bill.total;
  return billTotals(job, settings).total;
}

// ---------------------------------------------------------------------------
// Warranty
// ---------------------------------------------------------------------------

/** The last day this repair is covered, or "" when it never was. */
export function warrantyEndOf(job: Job): string {
  if (!job.deliveredOn || job.warrantyDays <= 0) return "";
  return addDays(job.deliveredOn, job.warrantyDays);
}

export type WarrantyState = "covered" | "expired" | "none" | "not-delivered";

export function warrantyStateOf(job: Job, today = todayKey()): WarrantyState {
  if (!job.deliveredOn) return "not-delivered";
  if (job.warrantyDays <= 0) return "none";
  return warrantyEndOf(job) >= today ? "covered" : "expired";
}

export function warrantyDaysLeft(job: Job, today = todayKey()): number {
  const end = warrantyEndOf(job);
  if (!end) return 0;
  return Math.max(0, daysBetween(today, end));
}

/** §4: warranty claims are excluded from revenue and counted as rework instead. */
export function isWarrantyClaim(job: Job): boolean {
  return Boolean(job.warrantyClaimOfJobId);
}

/**
 * Jobs on the same serial that came back within the repeat-failure window.
 *
 * Matched on serial number, because that is the only thing that identifies the
 * physical unit — a customer's name changes spelling between visits and a model
 * is shared by thousands of devices. Jobs with no serial are skipped rather
 * than all matching each other.
 */
export function repeatFailures(
  jobs: Job[],
  windowDays = REPEAT_FAILURE_DAYS
): { serialNo: string; jobs: Job[] }[] {
  const bySerial = new Map<string, Job[]>();
  for (const job of jobs) {
    const serial = job.serialNo.trim().toUpperCase();
    if (!serial) continue;
    bySerial.set(serial, [...(bySerial.get(serial) ?? []), job]);
  }

  const out: { serialNo: string; jobs: Job[] }[] = [];
  for (const [serial, list] of bySerial) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const repeats = sorted.filter((job, index) => {
      if (index === 0) return false;
      const previous = sorted[index - 1];
      const from = previous.deliveredOn || dateKeyOf(previous.createdAt);
      const to = dateKeyOf(job.createdAt);
      return Boolean(from && to) && daysBetween(from, to) <= windowDays;
    });
    if (repeats.length > 0) out.push({ serialNo: serial, jobs: sorted });
  }
  return out.sort((a, b) => b.jobs.length - a.jobs.length);
}

// ---------------------------------------------------------------------------
// Parts stock
// ---------------------------------------------------------------------------

export function isLowStock(part: Part): boolean {
  return part.active && part.stock <= part.lowStockAt;
}

/**
 * The net stock movement a job's parts list implies, against what it used to be.
 *
 * Editing a parts list is not "decrement what is there" — a technician who
 * changes a quantity from 2 to 1, or swaps one part for another, has to give
 * one back. Working in deltas against the previous list is what keeps stock
 * right across an edit, and it is why the store never decrements directly.
 */
export function stockDeltas(before: PartUsage[], after: PartUsage[]): Map<string, number> {
  const deltas = new Map<string, number>();
  for (const part of before) {
    if (!part.partId) continue;
    deltas.set(part.partId, (deltas.get(part.partId) ?? 0) + part.quantity);
  }
  for (const part of after) {
    if (!part.partId) continue;
    deltas.set(part.partId, (deltas.get(part.partId) ?? 0) - part.quantity);
  }
  for (const [id, delta] of deltas) if (delta === 0) deltas.delete(id);
  return deltas;
}

// ---------------------------------------------------------------------------
// Turnaround
// ---------------------------------------------------------------------------

/** Days from received to delivered, for jobs that got there. */
export function turnaroundDays(job: Job): number | null {
  if (!job.deliveredOn) return null;
  const from = dateKeyOf(job.createdAt);
  if (!from) return null;
  return Math.max(0, daysBetween(from, job.deliveredOn));
}

export function averageOf(values: number[]): number {
  if (values.length === 0) return 0;
  return round2(values.reduce((sum, value) => sum + value, 0) / values.length);
}
