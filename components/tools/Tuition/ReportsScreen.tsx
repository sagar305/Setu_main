"use client";

// Monthly reports: what was collected, what is still out, who is missing
// classes. Every row can be shared with the parent as a link.

import { useI18n } from "@/lib/i18n";
import { fill } from "@/lib/i18n/translate";
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
  const { t, lang } = useI18n();
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

  // Everyone who owes, including students who have left.
  const totalOutstanding = useMemo(
    () =>
      students.reduce(
        (sum, student) => sum + studentBalance(student.id, dues, payments).outstanding,
        0
      ),
    [students, dues, payments]
  );

  const rows = useMemo(
    () =>
      activeStudents
        .map((student) => {
          const records = filterAttendance(attendance, { studentId: student.id, period });
          const stats = attendanceStats(records);
          const absentDates = records
            .filter((r) => r.status === "absent")
            .map((r) => formatDate(r.date, lang).replace(/ \d{4}$/, ""));
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
            {t("tuRpMonth")}
          </span>
          <select
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
            className={`${inputClass} w-auto`}
          >
            {periods.map((month) => (
              <option key={month} value={month}>
                {formatMonth(month, lang)}
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
            {t("tuRpAttendanceCsv")}
          </button>
          <button
            type="button"
            onClick={() => downloadCsv("fees-summary.csv", feesCsv(students, dues, payments))}
            disabled={students.length === 0}
            className={secondaryBtnClass}
          >
            <Download className="h-4 w-4" />
            {t("tuRpFeesCsv")}
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t("tuRpCollected")}
          value={formatMoney(collected, currency)}
          sub={formatMonth(period, lang)}
        />
        <StatCard
          label={t("tuRpBilled")}
          value={formatMoney(billed, currency)}
          sub={t("tuRpDuesRaised")}
        />
        <StatCard
          label={t("tuRpExpectedMonth")}
          value={formatMoney(expected, currency)}
          sub={fill(t("tuRpActiveStudents"), { count: activeStudents.length })}
        />
        <StatCard
          label={t("tuRpOutstanding")}
          value={formatMoney(totalOutstanding, currency)}
          sub={t("tuRpAllMonths")}
        />
      </div>

      {lowAttendance.length > 0 && (
        <div className="mt-5 rounded-xl border border-saffron/40 bg-saffron/10 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-ink">
            <TriangleAlert className="h-4 w-4 text-saffron" />
            {fill(t(lowAttendance.length === 1 ? "tuRpLowOne" : "tuRpLowMany"), {
              count: lowAttendance.length,
              percent: LOW_ATTENDANCE,
            })}
          </p>
          <p className="mt-1 text-xs text-muted">
            {lowAttendance.map((row) => `${row.student.name} (${row.stats.percent}%)`).join(", ")}
          </p>
        </div>
      )}

      <section className="mt-6">
        <h3 className="text-sm font-bold text-ink">
          {fill(t("tuRpAttendanceForMonth"), { month: formatMonth(period, lang) })}
        </h3>
        {rows.every((row) => row.stats.total === 0) ? (
          <p className="mt-3 rounded-xl bg-cream-paper p-4 text-sm text-muted">
            {t("tuRpNoAttendance")}
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-muted-line/30 bg-white">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="bg-cream-paper text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2 font-semibold">{t("tuRpColStudent")}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t("tuAtPresent")}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t("tuAtAbsent")}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t("tuRpColClasses")}</th>
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
                              formatMonth(period, lang),
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
                        aria-label={fill(t("tuRpShareFor"), { name: student.name })}
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
        recipientLabel={t("tuRpParent")}
        title={t("tuRpAttendanceReport")}
      />
    </div>
  );
}
