"use client";

// Monthly reports: what was collected, what is still out, who is missing
// classes. Every row can be shared with the parent as a link.

import { useMemo, useState } from "react";
import { Download, Share2, TriangleAlert } from "lucide-react";
import { useTuition } from "@/lib/tuition/store";
import {
  attendanceStats,
  filterAttendance,
  studentBalance,
  studentMonthlyFee,
} from "@/lib/tuition/calc";
import { attendanceCsv, downloadCsv, feesCsv } from "@/lib/tuition/csv";
import { formatMoney } from "@/lib/pos/types";
import { currentMonthKey, formatDate, formatMonth, monthsBetween } from "@/lib/tuition/types";
import type { SharedDoc } from "@/lib/toolkit/shareLink";
import { ShareDialog } from "@/components/toolkit/ShareDialog";
import { inputClass, secondaryBtnClass, StatCard } from "@/components/tools/FreePos/ui";
import { attendanceDoc } from "./share";

const LOW_ATTENDANCE = 75;

export function ReportsScreen() {
  const { students, batches, attendance, dues, payments, business } = useTuition();
  const [period, setPeriod] = useState(currentMonthKey());
  const [shareDoc, setShareDoc] = useState<SharedDoc | null>(null);
  const currency = business?.currency ?? "INR";

  // Offer every month that has any activity, newest first.
  const periods = useMemo(() => {
    const earliest = [
      ...students.map((s) => s.joinDate).filter(Boolean),
      ...payments.map((p) => p.date.slice(0, 10)),
    ].sort()[0];
    const months = monthsBetween(earliest ?? currentMonthKey(), currentMonthKey());
    return months.length > 0 ? months.reverse() : [currentMonthKey()];
  }, [students, payments]);

  const activeStudents = useMemo(
    () => students.filter((s) => s.status === "active"),
    [students]
  );

  const collected = useMemo(
    () =>
      payments
        .filter((payment) => payment.date.slice(0, 7) === period)
        .reduce((sum, payment) => sum + payment.amount, 0),
    [payments, period]
  );

  const billed = useMemo(
    () =>
      dues
        .filter((due) => !due.waived && (due.period === period || due.dueDate.slice(0, 7) === period))
        .reduce((sum, due) => sum + due.amount, 0),
    [dues, period]
  );

  const expected = useMemo(
    () =>
      activeStudents.reduce((sum, student) => sum + studentMonthlyFee(student, batches).total, 0),
    [activeStudents, batches]
  );

  const totalOutstanding = useMemo(
    () =>
      activeStudents.reduce(
        (sum, student) => sum + studentBalance(student.id, dues, payments).outstanding,
        0
      ),
    [activeStudents, dues, payments]
  );

  const rows = useMemo(
    () =>
      activeStudents
        .map((student) => {
          const records = filterAttendance(attendance, { studentId: student.id, period });
          const stats = attendanceStats(records);
          const absentDates = records
            .filter((r) => r.status === "absent")
            .map((r) => formatDate(r.date).replace(/ \d{4}$/, ""));
          return { student, stats, absentDates };
        })
        .sort((a, b) => a.stats.percent - b.stats.percent),
    [activeStudents, attendance, period]
  );

  const lowAttendance = rows.filter((row) => row.stats.total > 0 && row.stats.percent < LOW_ATTENDANCE);

  const periodRecords = useMemo(
    () => filterAttendance(attendance, { period }),
    [attendance, period]
  );

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
            Month
          </span>
          <select
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
            className={`${inputClass} w-auto`}
          >
            {periods.map((month) => (
              <option key={month} value={month}>
                {formatMonth(month)}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              downloadCsv(
                `attendance-${period}.csv`,
                attendanceCsv(periodRecords, students, batches)
              )
            }
            disabled={periodRecords.length === 0}
            className={secondaryBtnClass}
          >
            <Download className="h-4 w-4" />
            Attendance CSV
          </button>
          <button
            type="button"
            onClick={() => downloadCsv("fees-summary.csv", feesCsv(students, dues, payments))}
            disabled={students.length === 0}
            className={secondaryBtnClass}
          >
            <Download className="h-4 w-4" />
            Fees CSV
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Collected" value={formatMoney(collected, currency)} sub={formatMonth(period)} />
        <StatCard label="Billed" value={formatMoney(billed, currency)} sub="Dues raised this month" />
        <StatCard
          label="Expected / month"
          value={formatMoney(expected, currency)}
          sub={`${activeStudents.length} active students`}
        />
        <StatCard
          label="Outstanding"
          value={formatMoney(totalOutstanding, currency)}
          sub="All months"
        />
      </div>

      {lowAttendance.length > 0 && (
        <div className="mt-5 rounded-xl border border-saffron/40 bg-saffron/10 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-ink">
            <TriangleAlert className="h-4 w-4 text-saffron" />
            {lowAttendance.length} student{lowAttendance.length > 1 ? "s" : ""} below{" "}
            {LOW_ATTENDANCE}% attendance
          </p>
          <p className="mt-1 text-xs text-muted">
            {lowAttendance.map((row) => `${row.student.name} (${row.stats.percent}%)`).join(", ")}
          </p>
        </div>
      )}

      <section className="mt-6">
        <h3 className="text-sm font-bold text-ink">Attendance — {formatMonth(period)}</h3>
        {rows.every((row) => row.stats.total === 0) ? (
          <p className="mt-3 rounded-xl bg-cream-paper p-4 text-sm text-muted">
            No attendance marked for this month yet.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-muted-line/30 bg-white">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="bg-cream-paper text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2 font-semibold">Student</th>
                  <th className="px-3 py-2 text-right font-semibold">Present</th>
                  <th className="px-3 py-2 text-right font-semibold">Absent</th>
                  <th className="px-3 py-2 text-right font-semibold">Classes</th>
                  <th className="px-3 py-2 text-right font-semibold">%</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map(({ student, stats, absentDates }) => (
                  <tr key={student.id} className="border-t border-muted-line/20">
                    <td className="px-3 py-2 font-semibold text-ink">{student.name}</td>
                    <td className="px-3 py-2 text-right text-muted">{stats.present + stats.late}</td>
                    <td className="px-3 py-2 text-right text-muted">{stats.absent}</td>
                    <td className="px-3 py-2 text-right text-muted">{stats.total}</td>
                    <td
                      className={`px-3 py-2 text-right font-bold ${
                        stats.total === 0
                          ? "text-muted"
                          : stats.percent >= LOW_ATTENDANCE
                            ? "text-emerald-600"
                            : "text-red-600"
                      }`}
                    >
                      {stats.total === 0 ? "—" : `${stats.percent}%`}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        disabled={stats.total === 0}
                        onClick={() =>
                          setShareDoc(
                            attendanceDoc(
                              business,
                              student,
                              formatMonth(period),
                              {
                                present: stats.present + stats.late,
                                total: stats.total,
                                percent: stats.percent,
                              },
                              absentDates
                            )
                          )
                        }
                        className={`${secondaryBtnClass} px-2.5 py-1`}
                        aria-label={`Share ${student.name}'s attendance report`}
                      >
                        <Share2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ShareDialog
        open={Boolean(shareDoc)}
        doc={shareDoc}
        onClose={() => setShareDoc(null)}
        recipientLabel="parent"
        title="Attendance report"
      />
    </div>
  );
}
