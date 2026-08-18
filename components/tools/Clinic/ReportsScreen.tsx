"use client";

import { useMemo, useState } from "react";
import { Download, MessageCircle } from "lucide-react";
import { useClinic } from "@/lib/clinic/store";
import { averageWaitMinutes, billDue, patientDues } from "@/lib/clinic/calc";
import { downloadCsv, reportCsv } from "@/lib/clinic/csv";
import { fillTemplate, type OutboundMessage } from "@/lib/clinic/messages";
import {
  addDays,
  daysBetween,
  formatDate,
  todayIso,
  type Visit,
} from "@/lib/clinic/types";
import { formatCurrency } from "@/lib/format";
import {
  StatCard,
  inputClass,
  primaryBtnClass,
  secondaryBtnClass,
} from "@/components/tools/FreePos/ui";
import { SendQueue } from "@/components/tools/Tuition/SendQueue";
import type { NavigateFn } from "./nav";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function Block({
  title,
  subtitle,
  onExport,
  children,
}: {
  title: string;
  subtitle?: string;
  onExport?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-muted-line/30 bg-white p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-ink">{title}</h3>
          {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
        </div>
        {onExport && (
          <button
            type="button"
            onClick={onExport}
            aria-label={`Export ${title}`}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-cream hover:text-indigo"
          >
            <Download className="h-4 w-4" />
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

/** A ranked list with a proportional bar — used by most blocks here. */
function RankedList({
  rows,
  formatValue,
}: {
  rows: { label: string; value: number; sub?: string }[];
  formatValue?: (value: number) => string;
}) {
  if (rows.length === 0) return <p className="text-sm text-muted">Nothing in this range yet.</p>;
  const max = Math.max(...rows.map((row) => row.value), 1);
  return (
    <ul className="space-y-1.5">
      {rows.map((row) => (
        <li key={row.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-ink">{row.label}</span>
            <span className="shrink-0 font-semibold text-ink">
              {formatValue ? formatValue(row.value) : row.value}
            </span>
          </div>
          <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-cream">
            <div
              className="h-full rounded-full bg-indigo"
              style={{ width: `${Math.max(2, (row.value / max) * 100)}%` }}
            />
          </div>
          {row.sub && <p className="mt-0.5 text-[11px] text-muted">{row.sub}</p>}
        </li>
      ))}
    </ul>
  );
}

export function ReportsScreen({ onNavigate }: { onNavigate: NavigateFn }) {
  const { visits, appointments, bills, patients, doctors, business, settings } = useClinic();

  const today = todayIso();
  const [from, setFrom] = useState(addDays(today, -30));
  const [to, setTo] = useState(today);
  const [queueOpen, setQueueOpen] = useState(false);

  const currency = business?.currency ?? "INR";
  const inRange = (date: string) => date >= from && date <= to;

  const rangeVisits = useMemo(() => visits.filter((v) => inRange(v.date)), [visits, from, to]);
  const rangeBills = useMemo(() => bills.filter((b) => inRange(b.date)), [bills, from, to]);
  const rangeAppointments = useMemo(
    () => appointments.filter((a) => inRange(a.date)),
    [appointments, from, to]
  );

  const patientOf = (id: string) => patients.find((p) => p.id === id);
  const doctorName = (id: string) => doctors.find((d) => d.id === id)?.name ?? "Unknown";

  // ---- Footfall: new vs repeat -------------------------------------------
  const footfall = useMemo(() => {
    const byDay = new Map<string, { total: number; fresh: number }>();
    // A visit is "new" when it is that patient's first ever, not merely the
    // first inside the range — otherwise a long-standing patient looks new.
    const firstVisitDate = new Map<string, string>();
    for (const visit of visits) {
      const current = firstVisitDate.get(visit.patientId);
      if (!current || visit.date < current) firstVisitDate.set(visit.patientId, visit.date);
    }
    for (const visit of rangeVisits) {
      const row = byDay.get(visit.date) ?? { total: 0, fresh: 0 };
      row.total += 1;
      if (firstVisitDate.get(visit.patientId) === visit.date) row.fresh += 1;
      byDay.set(visit.date, row);
    }
    return [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rangeVisits, visits]);

  const totalSeen = rangeVisits.length;
  const totalNew = footfall.reduce((sum, [, row]) => sum + row.fresh, 0);

  // ---- Revenue ------------------------------------------------------------
  const revenue = rangeBills.reduce((sum, bill) => sum + (bill.paid || 0), 0);
  const billed = rangeBills.reduce((sum, bill) => sum + (bill.total || 0), 0);

  const revenueByDoctor = useMemo(() => {
    const map = new Map<string, number>();
    for (const bill of rangeBills) {
      map.set(bill.doctorId, (map.get(bill.doctorId) ?? 0) + (bill.paid || 0));
    }
    return [...map.entries()]
      .map(([id, value]) => ({ label: doctorName(id), value }))
      .sort((a, b) => b.value - a.value);
  }, [rangeBills, doctors]);

  const revenueByMode = useMemo(() => {
    const map = new Map<string, number>();
    for (const bill of rangeBills) {
      const mode = bill.paymentMode || "Unspecified";
      map.set(mode, (map.get(mode) ?? 0) + (bill.paid || 0));
    }
    return [...map.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [rangeBills]);

  const revenueByKind = useMemo(() => {
    const map = new Map<string, number>();
    for (const bill of rangeBills) {
      for (const line of bill.lines ?? []) {
        map.set(line.label || line.kind, (map.get(line.label || line.kind) ?? 0) + line.amount);
      }
    }
    return [...map.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [rangeBills]);

  // ---- Top diagnoses ------------------------------------------------------
  const topDiagnoses = useMemo(() => {
    const map = new Map<string, number>();
    for (const visit of rangeVisits) {
      const key = (visit.diagnosis || "").trim();
      if (!key) continue;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
  }, [rangeVisits]);

  // ---- No-show rate by weekday -------------------------------------------
  const noShowByWeekday = useMemo(() => {
    const rows = WEEKDAYS.map((label) => ({ label, booked: 0, attended: 0, noShow: 0 }));
    for (const appointment of rangeAppointments) {
      const [y, m, d] = appointment.date.split("-").map(Number);
      const weekday = new Date(y, m - 1, d).getDay();
      const row = rows[weekday];
      if (appointment.status === "cancelled") continue;
      row.booked += 1;
      if (appointment.status === "done") row.attended += 1;
      if (appointment.status === "no-show") row.noShow += 1;
    }
    return rows.filter((row) => row.booked > 0);
  }, [rangeAppointments]);

  const totalBooked = noShowByWeekday.reduce((sum, row) => sum + row.booked, 0);
  const totalNoShow = noShowByWeekday.reduce((sum, row) => sum + row.noShow, 0);

  // ---- Follow-ups due this week ------------------------------------------
  const followUpsDue = useMemo(() => {
    const weekEnd = addDays(today, 7);
    const rows: { visit: Visit; dueOn: string }[] = [];
    for (const visit of visits) {
      if (!visit.followUpDays || !visit.finalisedAt) continue;
      const dueOn = addDays(visit.date, visit.followUpDays);
      if (dueOn < today || dueOn > weekEnd) continue;
      // Skip anyone who already has an appointment on or after the due date.
      const alreadyBooked = appointments.some(
        (a) =>
          a.patientId === visit.patientId &&
          a.date >= today &&
          (a.status === "booked" || a.status === "waiting")
      );
      if (alreadyBooked) continue;
      rows.push({ visit, dueOn });
    }
    return rows.sort((a, b) => a.dueOn.localeCompare(b.dueOn));
  }, [visits, appointments, today]);

  const followUpMessages: OutboundMessage[] = followUpsDue.map(({ visit, dueOn }) => {
    const patient = patientOf(visit.patientId);
    return {
      id: visit.id,
      name: patient?.name ?? "Patient",
      phone: patient?.phone ?? "",
      message: fillTemplate(settings.messageTemplates.followUpDue, {
        patientName: patient?.name ?? "",
        patientCode: patient?.code ?? "",
        doctorName: doctorName(visit.doctorId),
        clinicName: business?.name ?? "",
        clinicPhone: business?.phone ?? "",
        date: formatDate(dueOn),
      }),
    };
  });

  // ---- Outstanding dues, aged --------------------------------------------
  const duesAgeing = useMemo(() => {
    const rows = patients
      .map((patient) => {
        const amount = patientDues(bills, patient.id);
        if (amount <= 0) return null;
        const oldest = bills
          .filter((b) => b.patientId === patient.id && billDue(b) > 0)
          .map((b) => b.date)
          .sort()[0];
        return {
          patient,
          amount,
          ageDays: oldest ? daysBetween(oldest, today) : 0,
        };
      })
      .filter(Boolean) as { patient: (typeof patients)[number]; amount: number; ageDays: number }[];
    return rows.sort((a, b) => b.ageDays - a.ageDays);
  }, [patients, bills, today]);

  // ---- Peak hours ---------------------------------------------------------
  const peakHours = useMemo(() => {
    const map = new Map<number, number>();
    for (const appointment of rangeAppointments) {
      if (!appointment.arrivedAt) continue;
      const hour = new Date(appointment.arrivedAt).getHours();
      map.set(hour, (map.get(hour) ?? 0) + 1);
    }
    return [...map.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([hour, value]) => ({
        label: `${hour % 12 === 0 ? 12 : hour % 12}${hour >= 12 ? "pm" : "am"}`,
        value,
      }));
  }, [rangeAppointments]);

  const avgWait = averageWaitMinutes(rangeAppointments);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-muted-line/30 bg-white p-4">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
            From
          </span>
          <input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
            To
          </span>
          <input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className={inputClass}
          />
        </label>
        <div className="flex gap-2">
          {[
            ["7 days", 7],
            ["30 days", 30],
            ["90 days", 90],
          ].map(([label, days]) => (
            <button
              key={label as string}
              type="button"
              onClick={() => {
                setFrom(addDays(today, -(days as number)));
                setTo(today);
              }}
              className={secondaryBtnClass}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Patients seen"
          value={String(totalSeen)}
          sub={`${totalNew} new · ${totalSeen - totalNew} repeat`}
        />
        <StatCard
          label="Collected"
          value={formatCurrency(revenue, currency)}
          sub={`${formatCurrency(billed, currency)} billed`}
        />
        <StatCard
          label="No-show rate"
          value={totalBooked ? `${Math.round((totalNoShow / totalBooked) * 100)}%` : "—"}
          sub={`${totalNoShow} of ${totalBooked}`}
        />
        <StatCard label="Average wait" value={avgWait === null ? "—" : `${avgWait} min`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Block
          title="Footfall"
          subtitle="Patients seen per day, new vs repeat"
          onExport={() =>
            downloadCsv(
              "footfall.csv",
              reportCsv(
                ["Date", "Total", "New", "Repeat"],
                footfall.map(([date, row]) => [date, row.total, row.fresh, row.total - row.fresh])
              )
            )
          }
        >
          <RankedList
            rows={footfall
              .slice(-14)
              .map(([date, row]) => ({
                label: formatDate(date),
                value: row.total,
                sub: `${row.fresh} new`,
              }))}
          />
        </Block>

        <Block
          title="Top diagnoses"
          subtitle="Most recorded diagnoses in this range"
          onExport={() =>
            downloadCsv(
              "top-diagnoses.csv",
              reportCsv(
                ["Diagnosis", "Count"],
                topDiagnoses.map((row) => [row.label, row.value])
              )
            )
          }
        >
          <RankedList rows={topDiagnoses} />
        </Block>

        <Block
          title="Revenue by payment mode"
          onExport={() =>
            downloadCsv(
              "revenue-by-mode.csv",
              reportCsv(
                ["Mode", "Collected"],
                revenueByMode.map((row) => [row.label, row.value])
              )
            )
          }
        >
          <RankedList
            rows={revenueByMode}
            formatValue={(value) => formatCurrency(value, currency)}
          />
        </Block>

        <Block
          title="Revenue by charge"
          onExport={() =>
            downloadCsv(
              "revenue-by-charge.csv",
              reportCsv(
                ["Charge", "Amount"],
                revenueByKind.map((row) => [row.label, row.value])
              )
            )
          }
        >
          <RankedList
            rows={revenueByKind}
            formatValue={(value) => formatCurrency(value, currency)}
          />
        </Block>

        {revenueByDoctor.length > 1 && (
          <Block title="Revenue by doctor">
            <RankedList
              rows={revenueByDoctor}
              formatValue={(value) => formatCurrency(value, currency)}
            />
          </Block>
        )}

        <Block
          title="No-shows by day of week"
          onExport={() =>
            downloadCsv(
              "no-shows.csv",
              reportCsv(
                ["Day", "Booked", "Attended", "No-show"],
                noShowByWeekday.map((row) => [row.label, row.booked, row.attended, row.noShow])
              )
            )
          }
        >
          <RankedList
            rows={noShowByWeekday.map((row) => ({
              label: row.label,
              value: row.noShow,
              sub: `${row.booked} booked · ${row.attended} attended`,
            }))}
          />
        </Block>

        <Block
          title="Peak hours"
          subtitle="Arrivals by hour — use it to set slot lengths"
          onExport={() =>
            downloadCsv(
              "peak-hours.csv",
              reportCsv(
                ["Hour", "Arrivals"],
                peakHours.map((row) => [row.label, row.value])
              )
            )
          }
        >
          <RankedList rows={peakHours} />
        </Block>

        <Block
          title="Outstanding dues"
          subtitle="Patient-wise, oldest first"
          onExport={() =>
            downloadCsv(
              "outstanding-dues.csv",
              reportCsv(
                ["Patient", "Code", "Phone", "Amount", "Oldest (days)"],
                duesAgeing.map((row) => [
                  row.patient.name,
                  row.patient.code,
                  row.patient.phone,
                  row.amount,
                  row.ageDays,
                ])
              )
            )
          }
        >
          {duesAgeing.length === 0 ? (
            <p className="text-sm text-muted">Nothing outstanding.</p>
          ) : (
            <ul className="space-y-1.5">
              {duesAgeing.slice(0, 12).map((row) => (
                <li key={row.patient.id}>
                  <button
                    type="button"
                    onClick={() => onNavigate("patients", row.patient.id)}
                    className="flex w-full items-baseline justify-between gap-3 text-left text-sm"
                  >
                    <span className="min-w-0 truncate text-ink">{row.patient.name}</span>
                    <span className="shrink-0 font-semibold text-red-600">
                      {formatCurrency(row.amount, currency)}
                    </span>
                  </button>
                  <p className="text-[11px] text-muted">{row.ageDays} days old</p>
                </li>
              ))}
            </ul>
          )}
        </Block>
      </div>

      <Block
        title="Follow-ups due this week"
        subtitle="Patients advised a review, with nothing booked yet — this is the call list"
        onExport={() =>
          downloadCsv(
            "follow-ups-due.csv",
            reportCsv(
              ["Patient", "Code", "Phone", "Due on", "Diagnosis"],
              followUpsDue.map(({ visit, dueOn }) => {
                const patient = patientOf(visit.patientId);
                return [
                  patient?.name ?? "",
                  patient?.code ?? "",
                  patient?.phone ?? "",
                  dueOn,
                  visit.diagnosis,
                ];
              })
            )
          )
        }
      >
        {followUpsDue.length === 0 ? (
          <p className="text-sm text-muted">No follow-ups fall due in the next seven days.</p>
        ) : (
          <>
            <ul className="space-y-1.5">
              {followUpsDue.map(({ visit, dueOn }) => {
                const patient = patientOf(visit.patientId);
                return (
                  <li
                    key={visit.id}
                    className="flex items-baseline justify-between gap-3 text-sm"
                  >
                    <button
                      type="button"
                      onClick={() => patient && onNavigate("patients", patient.id)}
                      className="min-w-0 truncate text-left text-ink"
                    >
                      {patient?.name ?? "Unknown"}
                      <span className="text-muted"> · {visit.diagnosis || "No diagnosis"}</span>
                    </button>
                    <span className="shrink-0 text-xs text-muted">{formatDate(dueOn)}</span>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              onClick={() => setQueueOpen(true)}
              className={`${primaryBtnClass} mt-4`}
            >
              <MessageCircle className="h-4 w-4" />
              Send all {followUpsDue.length}
            </button>
          </>
        )}
      </Block>

      <SendQueue
        open={queueOpen}
        title="Follow-up reminders"
        messages={followUpMessages}
        onClose={() => setQueueOpen(false)}
        onSent={() => setQueueOpen(false)}
      />
    </div>
  );
}
