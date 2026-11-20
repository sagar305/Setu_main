"use client";

// Engineer-wise status: how much each engineer is holding right now, and what
// is out with outside vendors.
//
// This is the board turned on its side. The board answers "what is in
// diagnosis"; this answers "how loaded is Amit" and "how many laptops are in
// Delhi". Tapping an engineer opens the board filtered to them.

import { useMemo } from "react";
import { AlertTriangle, Flame, Truck, UserRound } from "lucide-react";
import { useRepair } from "@/lib/repair/store";
import { outsideByVendor, workloadByTechnician, WORKLOAD_STATUSES } from "@/lib/repair/reports";
import { currentOutside } from "@/lib/repair/calc";
import { JOB_STATUS_LABELS, formatDate } from "@/lib/repair/types";
import { Pill, SectionCard } from "./ui";

/** The one-line summary that sits above the board: "Amit 7 · Ravi 4 · Outside 3". */
export function WorkloadStrip({
  onPickTechnician,
  onShowWorkload,
}: {
  onPickTechnician: (technicianId: string) => void;
  onShowWorkload: () => void;
}) {
  const { jobs, technicians, today } = useRepair();
  const rows = useMemo(() => workloadByTechnician(jobs, technicians, today), [jobs, technicians, today]);
  const outside = useMemo(() => jobs.filter((job) => currentOutside(job)).length, [jobs]);
  if (rows.length === 0 && outside === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      {rows.map((row) => (
        <button
          key={row.technicianId ?? "unassigned"}
          type="button"
          onClick={() => (row.technicianId ? onPickTechnician(row.technicianId) : onShowWorkload())}
          className="inline-flex items-center gap-1 rounded-full border border-muted-line/40 bg-white px-2.5 py-1 font-semibold text-ink transition hover:border-indigo/50 hover:text-indigo"
        >
          {row.name}
          <span className="rounded-full bg-cream-paper px-1.5 text-[11px]">{row.open}</span>
          {row.overdue > 0 && <span className="h-1.5 w-1.5 rounded-full bg-red-600" aria-label="has overdue jobs" />}
        </button>
      ))}
      {outside > 0 && (
        <button
          type="button"
          onClick={onShowWorkload}
          className="inline-flex items-center gap-1 rounded-full border border-sky-300 bg-sky-50 px-2.5 py-1 font-semibold text-sky-800"
        >
          <Truck className="h-3.5 w-3.5" aria-hidden="true" />
          Outside
          <span className="rounded-full bg-white px-1.5 text-[11px]">{outside}</span>
        </button>
      )}
    </div>
  );
}

/** The full engineer-wise view. */
export function WorkloadView({
  onPickTechnician,
  onOpenJob,
}: {
  onPickTechnician: (technicianId: string) => void;
  onOpenJob: (jobId: string) => void;
}) {
  const { jobs, technicians, today } = useRepair();
  const rows = useMemo(() => workloadByTechnician(jobs, technicians, today), [jobs, technicians, today]);
  const vendors = useMemo(() => outsideByVendor(jobs, today), [jobs, today]);

  return (
    <div className="grid gap-4">
      <SectionCard title="Engineer workload">
        {rows.length === 0 ? (
          <p className="text-sm text-muted">No engineers added and no open jobs.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((row) => (
              <button
                key={row.technicianId ?? "unassigned"}
                type="button"
                disabled={!row.technicianId}
                onClick={() => row.technicianId && onPickTechnician(row.technicianId)}
                className="rounded-xl border border-muted-line/30 bg-white p-3 text-left transition enabled:hover:border-indigo/50 enabled:hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-sm font-bold text-ink">
                    <UserRound className="h-4 w-4 text-muted" aria-hidden="true" />
                    {row.name}
                  </span>
                  <span className="text-right">
                    <span className="block text-2xl font-bold leading-none text-ink">{row.open}</span>
                    <span className="text-[11px] uppercase tracking-wide text-muted">open</span>
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {row.urgent > 0 && (
                    <Pill tone="warn">
                      <Flame className="h-3 w-3" aria-hidden="true" />
                      {row.urgent} urgent
                    </Pill>
                  )}
                  {row.overdue > 0 && (
                    <Pill tone="danger">
                      <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                      {row.overdue} past promise
                    </Pill>
                  )}
                  {row.outside > 0 && <Pill tone="indigo">{row.outside} outside</Pill>}
                  {row.open > 0 && <Pill tone="muted">oldest {row.oldestDays}d</Pill>}
                  {row.open === 0 && <Pill tone="good">Free</Pill>}
                </div>
                <ul className="mt-2 grid gap-0.5 text-xs text-muted">
                  {WORKLOAD_STATUSES.filter((status) => row.byStatus[status]).map((status) => (
                    <li key={status} className="flex justify-between gap-2">
                      <span>{JOB_STATUS_LABELS[status]}</span>
                      <span className="font-semibold text-ink">{row.byStatus[status]}</span>
                    </li>
                  ))}
                </ul>
              </button>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Outside repair">
        {vendors.length === 0 ? (
          <p className="text-sm text-muted">Nothing is out with a vendor.</p>
        ) : (
          <div className="grid gap-3">
            {vendors.map((vendor) => (
              <div key={vendor.vendorId} className="rounded-xl border border-muted-line/30 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-bold text-ink">
                    {vendor.name}
                    {vendor.city ? <span className="font-normal text-muted"> · {vendor.city}</span> : null}
                  </span>
                  <span className="flex gap-1.5">
                    <Pill tone="indigo">{vendor.out} out</Pill>
                    {vendor.overdue > 0 && <Pill tone="danger">{vendor.overdue} late</Pill>}
                  </span>
                </div>
                <ul className="mt-2 grid gap-1">
                  {vendor.jobs.map((job) => {
                    const trip = currentOutside(job);
                    const late = Boolean(trip?.expectedBackOn && trip.expectedBackOn < today);
                    return (
                      <li key={job.id}>
                        <button
                          type="button"
                          onClick={() => onOpenJob(job.id)}
                          className="flex w-full flex-wrap items-center gap-2 rounded-lg px-2 py-1 text-left text-sm hover:bg-cream-paper"
                        >
                          <span className="font-semibold text-ink">{job.jobNo}</span>
                          <span className="text-muted">{trip?.sentWhat}</span>
                          <span className={`ml-auto text-xs ${late ? "font-semibold text-red-600" : "text-muted"}`}>
                            sent {trip ? formatDate(trip.sentOn) : ""}
                            {trip?.expectedBackOn ? ` · due ${formatDate(trip.expectedBackOn)}` : ""}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

