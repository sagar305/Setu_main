// The seven reports of §3.7, derived from the stores on every render.
//
// Nothing here is cached or stored. A repair shop's whole database is a few
// thousand rows even after years, and a figure computed from the jobs cannot
// disagree with the jobs — which matters more here than speed, because the one
// number these shops actually act on is margin, and a stale margin is worse
// than no margin.

import {
  BOARD_STATUSES,
  CLOSED_STATUSES,
  DEVICE_KIND_LABELS,
  IN_SHOP_STATUSES,
  JOB_STATUS_LABELS,
  dateKeyOf,
  deviceLabel,
  todayKey,
  type Bill,
  type DeviceKind,
  type Job,
  type JobStatus,
  type Part,
  type RepairSettings,
  type Technician,
} from "./types";
import {
  agingLevel,
  averageOf,
  daysInShop,
  isLowStock,
  isUncollected,
  isWarrantyClaim,
  jobMargin,
  jobValue,
  partsCostTotal,
  readySince,
  repeatFailures,
  round2,
  turnaroundDays,
} from "./calc";

/** A bill per job, for every report that needs money rather than status. */
export function billsByJob(bills: Bill[]): Map<string, Bill> {
  const map = new Map<string, Bill>();
  for (const bill of bills) map.set(bill.jobId, bill);
  return map;
}

// ---------------------------------------------------------------------------
// Jobs by status
// ---------------------------------------------------------------------------

export type StatusRow = {
  status: JobStatus;
  label: string;
  count: number;
  amber: number;
  red: number;
};

/**
 * The aging picture, plus the count of devices physically in the shop.
 *
 * That second number is the one an owner is asked for when something goes
 * missing, and it is not the same as the job count: a delivered job is still a
 * row, and the device is in somebody's pocket.
 */
export function jobsByStatus(
  jobs: Job[],
  settings: RepairSettings,
  today = todayKey()
): { rows: StatusRow[]; inShop: number; overdue: number } {
  const rows: StatusRow[] = BOARD_STATUSES.map((status) => {
    const inStatus = jobs.filter((job) => job.status === status);
    return {
      status,
      label: JOB_STATUS_LABELS[status],
      count: inStatus.length,
      amber: inStatus.filter((job) => agingLevel(job, settings, today) === "amber").length,
      red: inStatus.filter((job) => agingLevel(job, settings, today) === "red").length,
    };
  });

  return {
    rows,
    inShop: jobs.filter((job) => IN_SHOP_STATUSES.includes(job.status)).length,
    overdue: jobs.filter(
      (job) =>
        IN_SHOP_STATUSES.includes(job.status) &&
        job.promisedDate !== null &&
        job.promisedDate < today
    ).length,
  };
}

// ---------------------------------------------------------------------------
// Uncollected devices
// ---------------------------------------------------------------------------

export type UncollectedRow = {
  job: Job;
  readySince: string;
  days: number;
  value: number;
};

/**
 * Devices ready and not collected, and what they are worth.
 *
 * The total is the point of the report. Dead capital in a drawer does not feel
 * like money until it is added up, and then it is usually more than the owner
 * expected — which is what makes them pick the phone up.
 */
export function uncollectedDevices(
  jobs: Job[],
  bills: Bill[],
  settings: RepairSettings,
  today = todayKey()
): { rows: UncollectedRow[]; totalValue: number } {
  const billFor = billsByJob(bills);
  const rows = jobs
    .filter((job) => isUncollected(job, settings, today))
    .map((job) => {
      const since = readySince(job);
      return {
        job,
        readySince: since,
        days: since ? daysInShop(job, today) : 0,
        value: jobValue(job, billFor.get(job.id) ?? null, settings),
      };
    })
    .sort((a, b) => a.readySince.localeCompare(b.readySince));

  return {
    rows,
    totalValue: round2(rows.reduce((sum, row) => sum + row.value, 0)),
  };
}

// ---------------------------------------------------------------------------
// Turnaround
// ---------------------------------------------------------------------------

export type TurnaroundRow = {
  key: string;
  label: string;
  jobs: number;
  averageDays: number;
};

/** Average days received → delivered, by device kind. */
export function turnaroundByKind(jobs: Job[]): TurnaroundRow[] {
  const byKind = new Map<DeviceKind, number[]>();
  for (const job of jobs) {
    const days = turnaroundDays(job);
    if (days === null) continue;
    byKind.set(job.deviceKind, [...(byKind.get(job.deviceKind) ?? []), days]);
  }
  return [...byKind.entries()]
    .map(([kind, values]) => ({
      key: kind,
      label: DEVICE_KIND_LABELS[kind],
      jobs: values.length,
      averageDays: averageOf(values),
    }))
    .sort((a, b) => b.jobs - a.jobs);
}

// ---------------------------------------------------------------------------
// Technician throughput
// ---------------------------------------------------------------------------

export type TechnicianRow = {
  technicianId: string | null;
  name: string;
  completed: number;
  averageDays: number;
  revenue: number;
  margin: number;
};

/**
 * What each technician got through, how fast, and what it earned.
 *
 * Warranty claims are excluded from revenue per §4 but still counted as jobs
 * completed — the rework was real work, it just was not paid for twice, and a
 * technician whose claims are high is a signal about parts or about training
 * rather than about effort.
 */
export function technicianThroughput(
  jobs: Job[],
  bills: Bill[],
  technicians: Technician[],
  settings: RepairSettings
): TechnicianRow[] {
  const billFor = billsByJob(bills);
  const nameById = new Map(technicians.map((tech) => [tech.id, tech.name]));
  const groups = new Map<string, Job[]>();

  for (const job of jobs) {
    if (job.status !== "delivered") continue;
    const key = job.technicianId ?? "";
    groups.set(key, [...(groups.get(key) ?? []), job]);
  }

  return [...groups.entries()]
    .map(([key, list]) => {
      const days = list.map(turnaroundDays).filter((value): value is number => value !== null);
      const paid = list.filter((job) => !isWarrantyClaim(job));
      return {
        technicianId: key || null,
        name: key ? (nameById.get(key) ?? "Removed technician") : "Unassigned",
        completed: list.length,
        averageDays: averageOf(days),
        revenue: round2(
          paid.reduce((sum, job) => sum + jobValue(job, billFor.get(job.id) ?? null, settings), 0)
        ),
        margin: round2(
          paid.reduce((sum, job) => sum + jobMargin(job, billFor.get(job.id) ?? null, settings), 0)
        ),
      };
    })
    .sort((a, b) => b.completed - a.completed);
}

// ---------------------------------------------------------------------------
// Margin
// ---------------------------------------------------------------------------

export type MarginRow = {
  job: Job;
  revenue: number;
  partsCost: number;
  margin: number;
};

export type MarginReport = {
  rows: MarginRow[];
  revenue: number;
  partsCost: number;
  margin: number;
  reworkJobs: number;
};

/**
 * Revenue minus what the parts cost — the only number that tells these shops
 * whether they are making money.
 *
 * A shop can turn over ₹2 lakh a month and keep almost none of it, because the
 * screen it charged ₹4,000 for cost ₹3,400 and the labour was thrown in. §4
 * puts warranty claims outside revenue, so they appear here only as a rework
 * count: the parts a claim consumed have already been paid for once.
 */
export function marginReport(
  jobs: Job[],
  bills: Bill[],
  settings: RepairSettings
): MarginReport {
  const billFor = billsByJob(bills);
  const delivered = jobs.filter((job) => job.status === "delivered");
  const paid = delivered.filter((job) => !isWarrantyClaim(job));

  const rows = paid
    .map((job) => {
      const bill = billFor.get(job.id) ?? null;
      return {
        job,
        revenue: jobValue(job, bill, settings),
        partsCost: partsCostTotal(job.partsUsed),
        margin: jobMargin(job, bill, settings),
      };
    })
    .sort((a, b) => b.margin - a.margin);

  return {
    rows,
    revenue: round2(rows.reduce((sum, row) => sum + row.revenue, 0)),
    partsCost: round2(rows.reduce((sum, row) => sum + row.partsCost, 0)),
    margin: round2(rows.reduce((sum, row) => sum + row.margin, 0)),
    reworkJobs: delivered.length - paid.length,
  };
}

// ---------------------------------------------------------------------------
// Repeat failures
// ---------------------------------------------------------------------------

export type RepeatFailureRow = {
  serialNo: string;
  device: string;
  visits: number;
  jobs: Job[];
};

export type ModelClaimRow = {
  model: string;
  claims: number;
};

/**
 * The same device back within ninety days, and warranty claims by model.
 *
 * This is the report that tells an owner which parts supplier is bad, which is
 * information they otherwise only get as a slow feeling that a particular screen
 * "keeps coming back". Two rows against one model in a month is a supplier
 * conversation.
 */
export function repeatFailureReport(jobs: Job[]): {
  repeats: RepeatFailureRow[];
  claimsByModel: ModelClaimRow[];
} {
  const repeats = repeatFailures(jobs).map((entry) => ({
    serialNo: entry.serialNo,
    device: deviceLabel(entry.jobs[entry.jobs.length - 1]),
    visits: entry.jobs.length,
    jobs: entry.jobs,
  }));

  const claimCounts = new Map<string, number>();
  for (const job of jobs) {
    if (!isWarrantyClaim(job)) continue;
    const model = deviceLabel(job);
    claimCounts.set(model, (claimCounts.get(model) ?? 0) + 1);
  }

  return {
    repeats,
    claimsByModel: [...claimCounts.entries()]
      .map(([model, claims]) => ({ model, claims }))
      .sort((a, b) => b.claims - a.claims),
  };
}

// ---------------------------------------------------------------------------
// Estimate conversion
// ---------------------------------------------------------------------------

export type EstimateConversion = {
  sent: number;
  approved: number;
  rate: number;
  declined: number;
  pending: number;
};

/**
 * Estimates sent against estimates approved.
 *
 * "Sent" is any job that ever reached `estimate-sent`, read off the status
 * history rather than the current status — a job that was quoted, approved and
 * delivered is no longer sitting in `estimate-sent`, and it is the one that
 * converted. A job quoted and then returned unrepaired is the customer saying
 * no, which is the number an owner should see next to the quote they wrote.
 */
export function estimateConversion(jobs: Job[]): EstimateConversion {
  const quoted = jobs.filter((job) =>
    job.statusHistory.some((change) => change.to === "estimate-sent")
  );
  const approved = quoted.filter(
    (job) =>
      job.estimateApprovedOn !== null ||
      job.statusHistory.some((change) => change.to === "approved")
  );
  const declined = quoted.filter(
    (job) => job.status === "returned-unrepaired" || job.status === "cancelled"
  );

  return {
    sent: quoted.length,
    approved: approved.length,
    rate: quoted.length === 0 ? 0 : round2((approved.length / quoted.length) * 100),
    declined: declined.length,
    pending: quoted.filter((job) => job.status === "estimate-sent").length,
  };
}

// ---------------------------------------------------------------------------
// Parts
// ---------------------------------------------------------------------------

export function lowStockParts(parts: Part[]): Part[] {
  return parts
    .filter(isLowStock)
    .sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------
// Period filtering
// ---------------------------------------------------------------------------

export type Period = { from: string; to: string };

/** Jobs taken in during a window. Reports read the intake date, not delivery. */
export function jobsInPeriod(jobs: Job[], period: Period): Job[] {
  return jobs.filter((job) => {
    const key = dateKeyOf(job.createdAt);
    return Boolean(key) && key >= period.from && key <= period.to;
  });
}

/** Jobs delivered during a window — what the margin and throughput reports read. */
export function jobsDeliveredInPeriod(jobs: Job[], period: Period): Job[] {
  return jobs.filter(
    (job) =>
      CLOSED_STATUSES.includes(job.status) &&
      job.deliveredOn !== null &&
      job.deliveredOn >= period.from &&
      job.deliveredOn <= period.to
  );
}
