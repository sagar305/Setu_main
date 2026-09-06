"use client";

// The seven reports of §3.7.
//
// Two of them are why an owner opens this screen at all: uncollected devices,
// because that is money sitting in a drawer, and margin, because turnover tells
// a repair shop almost nothing — a shop can bill two lakh a month and keep
// nothing, when the screen it charged ₹4,000 for cost ₹3,400 and the labour was
// thrown in. Everything else is context for those two.

import { useMemo, useState } from "react";
import { AlertTriangle, Download, MessageCircle, TrendingUp } from "lucide-react";
import { useRepair } from "@/lib/repair/store";
import {
  estimateConversion,
  jobsByStatus,
  jobsDeliveredInPeriod,
  lowStockParts,
  marginReport,
  repeatFailureReport,
  technicianThroughput,
  turnaroundByKind,
  uncollectedDevices,
} from "@/lib/repair/reports";
import { isNagDue } from "@/lib/repair/calc";
import { uncollectedMessages, type OutboundMessage } from "@/lib/repair/messages";
import {
  downloadCsv,
  jobsCsv,
  partsStockCsv,
  partsUsedCsv,
  uncollectedCsv,
} from "@/lib/repair/csv";
import {
  DEVICE_KIND_LABELS,
  addDays,
  deviceLabel,
  formatDate,
  todayKey,
} from "@/lib/repair/types";
import { formatMoney } from "@/lib/pos/types";
import { SendQueue } from "./SendQueue";
import {
  EmptyState,
  Pill,
  SectionCard,
  StatCard,
  inputClass,
  primaryBtnClass,
  secondaryBtnClass,
} from "./ui";

export function ReportsScreen({ onOpenJob }: { onOpenJob: (id: string) => void }) {
  const {
    jobs,
    bills,
    parts,
    customers,
    technicians,
    settings,
    business,
    today,
    recordNag,
  } = useRepair();
  const currency = business?.currency ?? "INR";
  const money = (value: number) => formatMoney(value, currency);

  const [from, setFrom] = useState(() => addDays(todayKey(), -30));
  const [to, setTo] = useState(() => todayKey());
  const [queue, setQueue] = useState<OutboundMessage[] | null>(null);

  const period = useMemo(() => ({ from, to }), [from, to]);
  const deliveredInPeriod = useMemo(
    () => jobsDeliveredInPeriod(jobs, period),
    [jobs, period]
  );

  const statuses = useMemo(() => jobsByStatus(jobs, settings, today), [jobs, settings, today]);
  const uncollected = useMemo(
    () => uncollectedDevices(jobs, bills, settings, today),
    [jobs, bills, settings, today]
  );
  const margin = useMemo(
    () => marginReport(deliveredInPeriod, bills, settings),
    [deliveredInPeriod, bills, settings]
  );
  const turnaround = useMemo(() => turnaroundByKind(deliveredInPeriod), [deliveredInPeriod]);
  const throughput = useMemo(
    () => technicianThroughput(deliveredInPeriod, bills, technicians, settings),
    [deliveredInPeriod, bills, technicians, settings]
  );
  const repeats = useMemo(() => repeatFailureReport(jobs), [jobs]);
  const conversion = useMemo(() => estimateConversion(jobs), [jobs]);
  const lowStock = useMemo(() => lowStockParts(parts), [parts]);

  const nagDue = useMemo(
    () => uncollected.rows.filter((row) => isNagDue(row.job, settings, today)),
    [uncollected.rows, settings, today]
  );

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-muted-line/30 bg-white p-4">
        <label className="text-xs font-semibold uppercase tracking-wide text-muted">
          From
          <input
            type="date"
            className={inputClass}
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </label>
        <label className="text-xs font-semibold uppercase tracking-wide text-muted">
          To
          <input
            type="date"
            className={inputClass}
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </label>
        <p className="text-xs text-muted">
          Margin, turnaround and technician figures cover jobs <strong>delivered</strong> in this
          window. The board figures are always today.
        </p>
      </div>

      {/* Jobs by status ------------------------------------------------- */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Devices in the shop"
          value={String(statuses.inShop)}
          sub="Physically here, and somebody is answerable for each one"
        />
        <StatCard
          label="Past their promised date"
          value={String(statuses.overdue)}
          sub={statuses.overdue > 0 ? "Somebody is expecting a call" : "Nothing overdue"}
        />
        <StatCard
          label="Uncollected value"
          value={money(uncollected.totalValue)}
          sub={`${uncollected.rows.length} devices ready and not picked up`}
        />
      </div>

      <SectionCard
        title="Jobs by status"
        action={
          <button
            type="button"
            onClick={() =>
              downloadCsv(
                `jobs-${todayKey()}.csv`,
                jobsCsv(jobs, customers, technicians, bills, settings)
              )
            }
            className={secondaryBtnClass}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            All jobs CSV
          </button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="border-b border-muted-line/40 text-left text-xs uppercase tracking-wide text-muted">
                <th className="py-2">Status</th>
                <th className="py-2 text-right">Jobs</th>
                <th className="py-2 text-right">Ageing</th>
                <th className="py-2 text-right">Overdue</th>
              </tr>
            </thead>
            <tbody>
              {statuses.rows.map((row) => (
                <tr key={row.status} className="border-b border-muted-line/20">
                  <td className="py-2 font-semibold text-ink">{row.label}</td>
                  <td className="py-2 text-right text-ink">{row.count}</td>
                  <td className="py-2 text-right">
                    {row.amber > 0 && <Pill tone="warn">{row.amber} amber</Pill>}
                  </td>
                  <td className="py-2 text-right">
                    {row.red > 0 && <Pill tone="danger">{row.red} red</Pill>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Uncollected ---------------------------------------------------- */}
      <SectionCard
        title="Uncollected devices"
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                downloadCsv(
                  `uncollected-${todayKey()}.csv`,
                  uncollectedCsv(uncollected.rows, customers)
                )
              }
              className={secondaryBtnClass}
              disabled={uncollected.rows.length === 0}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              CSV
            </button>
            <button
              type="button"
              onClick={() =>
                setQueue(
                  uncollectedMessages(
                    nagDue.map((row) => row.job),
                    customers,
                    business,
                    settings
                  )
                )
              }
              className={primaryBtnClass}
              disabled={nagDue.length === 0}
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              Chase {nagDue.length > 0 ? nagDue.length : ""}
            </button>
          </div>
        }
      >
        {uncollected.rows.length === 0 ? (
          <p className="text-sm text-muted">
            Nothing sitting on the ready shelf longer than {settings.uncollectedNagDays} days.
          </p>
        ) : (
          <>
            <p className="mb-3 text-sm text-muted">
              <strong className="text-ink">{money(uncollected.totalValue)}</strong> of finished work
              is sitting in the shop waiting to be collected.
            </p>
            <ul className="grid gap-2">
              {uncollected.rows.map((row) => (
                <li key={row.job.id}>
                  <button
                    type="button"
                    onClick={() => onOpenJob(row.job.id)}
                    className="flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border border-muted-line/30 p-3 text-left transition hover:border-indigo/50"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-ink">
                        {row.job.jobNo} · {deviceLabel(row.job)}
                      </span>
                      <span className="block text-xs text-muted">
                        Ready since {formatDate(row.readySince)}
                        {isNagDue(row.job, settings, today) ? " · due a reminder" : ""}
                      </span>
                    </span>
                    <span className="shrink-0 font-bold text-ink">{money(row.value)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </SectionCard>

      {/* Margin --------------------------------------------------------- */}
      <SectionCard
        title="Margin"
        action={
          <button
            type="button"
            onClick={() =>
              downloadCsv(`parts-used-${todayKey()}.csv`, partsUsedCsv(deliveredInPeriod))
            }
            className={secondaryBtnClass}
            disabled={deliveredInPeriod.length === 0}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Parts CSV
          </button>
        }
      >
        {margin.rows.length === 0 ? (
          <EmptyState
            icon={<TrendingUp className="h-6 w-6" />}
            title="Nothing delivered in this window"
            message="Margin is measured on jobs handed back to the customer, so it fills in as devices go out."
          />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard label="Revenue" value={money(margin.revenue)} sub="Net of tax" />
              <StatCard label="Parts cost" value={money(margin.partsCost)} />
              <StatCard
                label="Margin"
                value={money(margin.margin)}
                sub={
                  margin.revenue > 0
                    ? `${Math.round((margin.margin / margin.revenue) * 100)}% of revenue`
                    : undefined
                }
              />
            </div>
            {margin.reworkJobs > 0 && (
              <p className="mt-3 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                {margin.reworkJobs} warranty {margin.reworkJobs === 1 ? "claim was" : "claims were"}{" "}
                delivered in this window. They earn nothing and are left out of the figures above.
              </p>
            )}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-muted-line/40 text-left text-xs uppercase tracking-wide text-muted">
                    <th className="py-2">Job</th>
                    <th className="py-2">Device</th>
                    <th className="py-2 text-right">Revenue</th>
                    <th className="py-2 text-right">Parts cost</th>
                    <th className="py-2 text-right">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {margin.rows.slice(0, 25).map((row) => (
                    <tr key={row.job.id} className="border-b border-muted-line/20">
                      <td className="py-2">
                        <button
                          type="button"
                          onClick={() => onOpenJob(row.job.id)}
                          className="font-semibold text-indigo hover:underline"
                        >
                          {row.job.jobNo}
                        </button>
                      </td>
                      <td className="py-2 text-ink">{deviceLabel(row.job)}</td>
                      <td className="py-2 text-right text-ink">{money(row.revenue)}</td>
                      <td className="py-2 text-right text-muted">{money(row.partsCost)}</td>
                      <td className="py-2 text-right font-bold text-ink">{money(row.margin)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </SectionCard>

      {/* Turnaround and technicians ------------------------------------- */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Turnaround by device kind">
          {turnaround.length === 0 ? (
            <p className="text-sm text-muted">Nothing delivered in this window yet.</p>
          ) : (
            <ul className="grid gap-2">
              {turnaround.map((row) => (
                <li
                  key={row.key}
                  className="flex items-center justify-between gap-3 rounded-xl border border-muted-line/30 p-3"
                >
                  <span className="text-sm font-semibold text-ink">
                    {DEVICE_KIND_LABELS[row.key as keyof typeof DEVICE_KIND_LABELS] ?? row.label}
                  </span>
                  <span className="text-sm text-muted">
                    <strong className="text-ink">{row.averageDays}</strong> days average ·{" "}
                    {row.jobs} jobs
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Technician throughput">
          {throughput.length === 0 ? (
            <p className="text-sm text-muted">Nothing delivered in this window yet.</p>
          ) : (
            <ul className="grid gap-2">
              {throughput.map((row) => (
                <li
                  key={row.technicianId ?? "unassigned"}
                  className="rounded-xl border border-muted-line/30 p-3"
                >
                  <p className="text-sm font-bold text-ink">{row.name}</p>
                  <p className="text-xs text-muted">
                    {row.completed} completed · {row.averageDays} days average ·{" "}
                    {money(row.revenue)} billed · {money(row.margin)} margin
                  </p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* Repeat failures and conversion --------------------------------- */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Repeat failures">
          <p className="mb-3 text-xs text-muted">
            The same device back within 90 days, and warranty claims by model. This is the report
            that tells you which parts supplier is letting you down.
          </p>
          {repeats.repeats.length === 0 && repeats.claimsByModel.length === 0 ? (
            <p className="text-sm text-muted">Nothing has come back. Good.</p>
          ) : (
            <div className="grid gap-4">
              {repeats.repeats.length > 0 && (
                <ul className="grid gap-2">
                  {repeats.repeats.slice(0, 10).map((row) => (
                    <li
                      key={row.serialNo}
                      className="rounded-xl border border-amber-300 bg-amber-50 p-3"
                    >
                      <p className="text-sm font-bold text-ink">{row.device}</p>
                      <p className="text-xs text-amber-900">
                        {row.serialNo} · {row.visits} visits
                      </p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {row.jobs.map((job) => (
                          <button
                            key={job.id}
                            type="button"
                            onClick={() => onOpenJob(job.id)}
                            className="text-xs font-semibold text-indigo hover:underline"
                          >
                            {job.jobNo}
                          </button>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {repeats.claimsByModel.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                    Warranty claims by model
                  </p>
                  <ul className="grid gap-1">
                    {repeats.claimsByModel.map((row) => (
                      <li key={row.model} className="flex justify-between text-sm">
                        <span className="text-ink">{row.model}</span>
                        <span className="font-bold text-ink">{row.claims}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Estimate conversion">
          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard label="Estimates sent" value={String(conversion.sent)} />
            <StatCard
              label="Approved"
              value={`${conversion.rate}%`}
              sub={`${conversion.approved} of ${conversion.sent}`}
            />
          </div>
          <p className="mt-3 text-sm text-muted">
            {conversion.pending} waiting for an answer · {conversion.declined} turned down.
          </p>
          <p className="mt-2 text-xs text-muted">
            A customer replying to your WhatsApp does not reach this app — the approval is ticked
            here when you hear back, by moving the job to Approved.
          </p>
        </SectionCard>
      </div>

      {/* Low stock ------------------------------------------------------ */}
      <SectionCard
        title="Low stock"
        action={
          <button
            type="button"
            onClick={() => downloadCsv(`parts-stock-${todayKey()}.csv`, partsStockCsv(parts))}
            className={secondaryBtnClass}
            disabled={parts.length === 0}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            CSV
          </button>
        }
      >
        {lowStock.length === 0 ? (
          <p className="text-sm text-muted">Nothing at or below its low-stock mark.</p>
        ) : (
          <ul className="grid gap-2">
            {lowStock.map((part) => (
              <li
                key={part.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-ink">{part.name}</span>
                  {part.supplierName && (
                    <span className="block text-xs text-amber-900">{part.supplierName}</span>
                  )}
                </span>
                <span className="shrink-0 text-sm font-bold text-ink">
                  {part.stock} left
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SendQueue
        open={queue !== null}
        title="Chase uncollected devices"
        intro="One customer at a time — WhatsApp opens with the message ready. Coming back marks that customer chased, and the next reminder is due after your nag interval."
        messages={queue ?? []}
        onClose={() => setQueue(null)}
        onSent={(ids) => {
          for (const id of ids) void recordNag(id);
        }}
      />
    </div>
  );
}
