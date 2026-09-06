"use client";

// The board. The default screen, and the shop's whole picture.
//
// Desktop gets eight columns side by side behind a horizontal scroll; a phone
// gets the same eight as tabs, because eight columns squeezed onto a 390px
// screen is eight columns nobody can read. Either way the unit is the card, and
// the card carries the four things somebody standing at the counter needs: which
// job, whose device, how long it has been here, and what it is worth.
//
// The aging colour is the feature. A shop full of red cards is a shop with a
// problem, and it should be visible from the doorway without reading a word.

import { useMemo, useState } from "react";
import {
  ClipboardList,
  Filter,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useRepair } from "@/lib/repair/store";
import { agingLevel, daysInShop, isOverdue, jobValue } from "@/lib/repair/calc";
import {
  BOARD_STATUSES,
  DEVICE_KIND_LABELS,
  JOB_STATUS_LABELS,
  deviceLabel,
  type DeviceKind,
  type Job,
  type JobStatus,
} from "@/lib/repair/types";
import { formatMoney } from "@/lib/pos/types";
import {
  AGING_BORDER,
  AgingBadge,
  EmptyState,
  Pill,
  PriorityFlag,
  StatusChip,
  ToggleChip,
  inputClass,
  primaryBtnClass,
  secondaryBtnClass,
} from "./ui";

/**
 * How much of the Delivered column to render.
 *
 * Delivered jobs never stop being rows, and a shop two years in would otherwise
 * paint a column thousands of cards long every time the board opens. The recent
 * ones are what anybody looks at — a customer coming back about a repair from
 * last week — and the rest are found through search and the reports.
 *
 * OPEN QUESTION: the spec does not say how deep the Delivered column goes.
 */
const DELIVERED_ON_BOARD = 20;

type ExtraFilter = "all" | "returned-unrepaired" | "cancelled";

export function JobsScreen({
  onOpenJob,
  onNewJob,
}: {
  onOpenJob: (id: string) => void;
  onNewJob: () => void;
}) {
  const { jobs, customers, technicians, settings, business, today, billForJob } = useRepair();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<JobStatus>("received");
  const [showFilters, setShowFilters] = useState(false);
  const [technicianId, setTechnicianId] = useState("");
  const [deviceKind, setDeviceKind] = useState<DeviceKind | "">("");
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [extra, setExtra] = useState<ExtraFilter>("all");

  const currency = business?.currency ?? "INR";
  const customerById = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer])),
    [customers]
  );
  const techById = useMemo(
    () => new Map(technicians.map((tech) => [tech.id, tech])),
    [technicians]
  );

  /**
   * Search across the four things a customer might read out.
   *
   * IMEI matters most and is matched as a substring: somebody reading fifteen
   * digits off a box gets the last six right far more often than all of them,
   * and an exact-match lookup would fail exactly when it is needed.
   */
  const searched = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return jobs;
    return jobs.filter((job) => {
      const customer = customerById.get(job.customerId);
      return (
        job.jobNo.toLowerCase().includes(needle) ||
        job.serialNo.toLowerCase().includes(needle) ||
        deviceLabel(job).toLowerCase().includes(needle) ||
        (customer?.name ?? "").toLowerCase().includes(needle) ||
        (customer?.phone ?? "").toLowerCase().includes(needle)
      );
    });
  }, [jobs, search, customerById]);

  const filtered = useMemo(
    () =>
      searched.filter((job) => {
        if (technicianId && job.technicianId !== technicianId) return false;
        if (deviceKind && job.deviceKind !== deviceKind) return false;
        if (urgentOnly && job.priority !== "urgent") return false;
        if (overdueOnly && !isOverdue(job, today)) return false;
        return true;
      }),
    [searched, technicianId, deviceKind, urgentOnly, overdueOnly, today]
  );

  const byStatus = useMemo(() => {
    const map = new Map<JobStatus, Job[]>();
    for (const status of [...BOARD_STATUSES, "returned-unrepaired", "cancelled"] as JobStatus[]) {
      map.set(status, []);
    }
    for (const job of filtered) {
      map.set(job.status, [...(map.get(job.status) ?? []), job]);
    }
    // Oldest first everywhere except Delivered, where the newest is the one
    // somebody is asking about.
    for (const [status, list] of map) {
      list.sort((a, b) =>
        status === "delivered"
          ? b.createdAt.localeCompare(a.createdAt)
          : a.createdAt.localeCompare(b.createdAt)
      );
    }
    return map;
  }, [filtered]);

  const columnJobs = (status: JobStatus) => {
    const list = byStatus.get(status) ?? [];
    return status === "delivered" && !search ? list.slice(0, DELIVERED_ON_BOARD) : list;
  };

  const filtersOn =
    Boolean(technicianId) || Boolean(deviceKind) || urgentOnly || overdueOnly || extra !== "all";

  const clearFilters = () => {
    setTechnicianId("");
    setDeviceKind("");
    setUrgentOnly(false);
    setOverdueOnly(false);
    setExtra("all");
  };

  const card = (job: Job) => {
    const customer = customerById.get(job.customerId);
    const level = agingLevel(job, settings, today);
    const tech = job.technicianId ? techById.get(job.technicianId) : null;
    const value = jobValue(job, billForJob(job.id) ?? null, settings);

    return (
      <button
        key={job.id}
        type="button"
        onClick={() => onOpenJob(job.id)}
        className={`w-full rounded-xl border-l-4 border-y border-r bg-white p-3 text-left transition hover:border-indigo/50 hover:shadow-sm ${AGING_BORDER[level]}`}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-bold text-ink">{job.jobNo}</span>
          <PriorityFlag priority={job.priority} />
        </div>
        <p className="mt-0.5 truncate text-sm font-semibold text-ink">{deviceLabel(job)}</p>
        <p className="truncate text-xs text-muted">{customer?.name ?? "—"}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <AgingBadge days={daysInShop(job, today)} level={level} />
          {isOverdue(job, today) && <Pill tone="danger">Past promise</Pill>}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 text-xs">
          <span className="truncate text-muted">{tech ? tech.name : "Unassigned"}</span>
          {value > 0 && (
            <span className="shrink-0 font-bold text-ink">{formatMoney(value, currency)}</span>
          )}
        </div>
      </button>
    );
  };

  const visibleStatuses: JobStatus[] =
    extra === "all" ? BOARD_STATUSES : ([extra] as JobStatus[]);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted/60"
            aria-hidden="true"
          />
          <input
            type="search"
            className={`${inputClass} pl-9`}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Job no, IMEI, phone or name"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowFilters((previous) => !previous)}
          className={`${secondaryBtnClass} ${filtersOn ? "border-indigo/60 text-indigo" : ""}`}
          aria-expanded={showFilters}
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          Filters
          {filtersOn && <span className="ml-1 h-2 w-2 rounded-full bg-indigo" aria-hidden="true" />}
        </button>
        <button type="button" onClick={onNewJob} className={primaryBtnClass}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          New job
        </button>
      </div>

      {showFilters && (
        <div className="grid gap-3 rounded-2xl border border-muted-line/30 bg-white p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
                Technician
              </span>
              <select
                className={inputClass}
                value={technicianId}
                onChange={(event) => setTechnicianId(event.target.value)}
              >
                <option value="">Everyone</option>
                {technicians.map((tech) => (
                  <option key={tech.id} value={tech.id}>
                    {tech.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
                Device kind
              </span>
              <select
                className={inputClass}
                value={deviceKind}
                onChange={(event) => setDeviceKind(event.target.value as DeviceKind | "")}
              >
                <option value="">All kinds</option>
                {settings.deviceKinds.map((kind) => (
                  <option key={kind} value={kind}>
                    {DEVICE_KIND_LABELS[kind]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
                Show
              </span>
              <select
                className={inputClass}
                value={extra}
                onChange={(event) => setExtra(event.target.value as ExtraFilter)}
              >
                <option value="all">The board</option>
                <option value="returned-unrepaired">Returned unrepaired</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ToggleChip active={urgentOnly} onClick={() => setUrgentOnly((value) => !value)}>
              Urgent only
            </ToggleChip>
            <ToggleChip active={overdueOnly} onClick={() => setOverdueOnly((value) => !value)}>
              Past promised date
            </ToggleChip>
            {filtersOn && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-indigo"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={jobs.length === 0 ? <ClipboardList className="h-6 w-6" /> : <Filter className="h-6 w-6" />}
          title={jobs.length === 0 ? "No devices in yet" : "Nothing matches"}
          message={
            jobs.length === 0
              ? "Take in the first device and it will appear here, with the clock already running on it."
              : "No job matches that search and those filters."
          }
          action={
            jobs.length === 0 ? (
              <button type="button" onClick={onNewJob} className={primaryBtnClass}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Take in a device
              </button>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* Mobile: the same statuses as tabs. */}
          <div className="lg:hidden">
            <div className="-mx-1 mb-3 flex gap-1 overflow-x-auto px-1 pb-1">
              {visibleStatuses.map((status) => {
                const count = columnJobs(status).length;
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setTab(status)}
                    aria-current={tab === status ? "page" : undefined}
                    className={`inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition ${
                      tab === status ? "bg-indigo text-white" : "bg-white text-muted"
                    }`}
                  >
                    {JOB_STATUS_LABELS[status]}
                    <span
                      className={`rounded-full px-1.5 text-xs ${
                        tab === status ? "bg-white/20" : "bg-cream-paper"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="grid gap-2">
              {columnJobs(visibleStatuses.includes(tab) ? tab : visibleStatuses[0]).map(card)}
              {columnJobs(visibleStatuses.includes(tab) ? tab : visibleStatuses[0]).length === 0 && (
                <p className="rounded-xl border border-dashed border-muted-line/40 p-6 text-center text-sm text-muted">
                  Nothing at this stage.
                </p>
              )}
            </div>
          </div>

          {/* Desktop: the whole board at once. */}
          <div className="-mx-1 hidden gap-3 overflow-x-auto px-1 pb-2 lg:flex">
            {visibleStatuses.map((status) => {
              const list = columnJobs(status);
              return (
                <section
                  key={status}
                  className="flex w-64 shrink-0 flex-col gap-2 rounded-2xl bg-white/60 p-2"
                  aria-label={JOB_STATUS_LABELS[status]}
                >
                  <div className="flex items-center justify-between gap-2 px-1">
                    <StatusChip status={status} />
                    <span className="text-xs font-bold text-muted">{list.length}</span>
                  </div>
                  <div className="grid gap-2">
                    {list.map(card)}
                    {list.length === 0 && (
                      <p className="rounded-xl border border-dashed border-muted-line/40 p-4 text-center text-xs text-muted">
                        Empty
                      </p>
                    )}
                  </div>
                  {status === "delivered" &&
                    !search &&
                    (byStatus.get("delivered") ?? []).length > DELIVERED_ON_BOARD && (
                      <p className="px-1 text-xs text-muted">
                        Showing the last {DELIVERED_ON_BOARD}. Search to find older ones.
                      </p>
                    )}
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
