"use client";

// The landing screen: what is happening today and what needs a tap.

import { useI18n } from "@/lib/i18n";
import { fill } from "@/lib/i18n/translate";
import { useMemo } from "react";
import {
  Cake,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  NotebookPen,
  PhoneCall,
  Wallet,
} from "lucide-react";
import { useTuition } from "@/lib/tuition/store";
import { batchesOnDate, daysOverdue, studentBalance, studentsInBatch } from "@/lib/tuition/calc";
import { formatMoney } from "@/lib/pos/types";
import {
  currentMonthKey,
  formatDate,
  formatMonth,
  formatTime,
  todayIso,
} from "@/lib/tuition/types";
import { StatCard } from "@/components/tools/FreePos/ui";
import type { NavigateFn } from "./nav";

export function TodayScreen({ onNavigate }: { onNavigate: NavigateFn }) {
  const { t, lang } = useI18n();
  const { batches, students, attendance, dues, payments, notes, enquiries, business, holidays } =
    useTuition();
  const today = todayIso();
  const currency = business?.currency ?? "INR";
  const period = currentMonthKey();

  const todaysBatches = useMemo(() => batchesOnDate(batches, today), [batches, today]);
  const holiday = holidays.find((h) => h.date === today);

  const marked = useMemo(
    () => new Set(attendance.filter((a) => a.date === today).map((a) => a.batchId)),
    [attendance, today]
  );

  // Students who have left stay here while they still owe — money does not
  // disappear because someone stopped coming.
  const pending = useMemo(
    () =>
      students
        .map((student) => ({ student, balance: studentBalance(student.id, dues, payments) }))
        .filter((row) => row.balance.outstanding > 0)
        .sort(
          (a, b) =>
            daysOverdue(b.balance.oldestPendingDate) - daysOverdue(a.balance.oldestPendingDate)
        ),
    [students, dues, payments]
  );

  const collectedThisMonth = useMemo(
    () =>
      payments
        .filter((payment) => payment.date.slice(0, 7) === period)
        .reduce((sum, payment) => sum + payment.amount, 0),
    [payments, period]
  );

  const absentToday = useMemo(
    () => attendance.filter((a) => a.date === today && a.status === "absent"),
    [attendance, today]
  );

  const dueNotes = useMemo(
    () => notes.filter((note) => !note.done && note.date <= today),
    [notes, today]
  );

  const followUps = useMemo(
    () =>
      enquiries.filter(
        (e) =>
          e.followUpDate &&
          e.followUpDate <= today &&
          e.status !== "joined" &&
          e.status !== "lost"
      ),
    [enquiries, today]
  );

  const birthdays = useMemo(
    () =>
      students.filter(
        (s) => s.status === "active" && s.dob && s.dob.slice(5) === today.slice(5)
      ),
    [students, today]
  );

  const studentName = (id: string) => students.find((s) => s.id === id)?.name ?? "";
  const totalPending = pending.reduce((sum, row) => sum + row.balance.outstanding, 0);

  return (
    <div>
      <p className="text-sm text-muted">{formatDate(today, lang)}</p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t("tuTdClassesToday")}
          value={String(todaysBatches.length)}
          sub={fill(t("tuTdMarkedN"), { count: marked.size })}
        />
        <StatCard
          label={t("tuTdPendingFees")}
          value={formatMoney(totalPending, currency)}
          sub={fill(t(pending.length === 1 ? "tuStCountOne" : "tuStCountMany"), {
            count: pending.length,
          })}
        />
        <StatCard
          label={fill(t("tuTdCollected"), { month: formatMonth(period, lang) })}
          value={formatMoney(collectedThisMonth, currency)}
        />
        <StatCard
          label={t("tuTdAbsentToday")}
          value={String(absentToday.length)}
          sub={fill(t("tuTdParentsTold"), {
            count: absentToday.filter((a) => a.notifiedAt).length,
          })}
        />
      </div>

      {holiday && (
        <p className="mt-4 rounded-xl border border-saffron/40 bg-saffron/10 px-4 py-3 text-sm text-ink">
          {fill(t("tuTdHoliday"), { name: holiday.name })}
        </p>
      )}

      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-ink">{t("tuTdTodaysClasses")}</h3>
          <button
            type="button"
            onClick={() => onNavigate("attendance")}
            className="text-xs font-semibold text-indigo hover:underline"
          >
            {t("tuTdAllAttendance")}
          </button>
        </div>
        {todaysBatches.length === 0 ? (
          <p className="mt-2 rounded-xl bg-cream-paper p-4 text-sm text-muted">
            {t("tuTdNoClassToday")}
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {todaysBatches.map((batch) => {
              const count = studentsInBatch(students, batch.id).length;
              const done = marked.has(batch.id);
              return (
                <li key={batch.id}>
                  <button
                    type="button"
                    onClick={() => onNavigate("attendance", batch.id)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-muted-line/30 bg-white p-3 text-left transition hover:border-indigo/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-ink">{batch.name}</p>
                      <p className="text-xs text-muted">
                        {formatTime(batch.startTime, lang)}–{formatTime(batch.endTime, lang)} ·{" "}
                        {fill(t(count === 1 ? "tuStCountOne" : "tuStCountMany"), { count })}
                      </p>
                    </div>
                    <span className="flex shrink-0 items-center gap-2">
                      {done ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                          <CheckCircle2 className="h-4 w-4" />
                          {t("tuTdMarked")}
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-indigo">{t("tuTdMarkAttendance")}</span>
                      )}
                      <ChevronRight className="h-4 w-4 text-muted" />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <section>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-ink">{t("tuTdFeesToChase")}</h3>
            <button
              type="button"
              onClick={() => onNavigate("fees")}
              className="text-xs font-semibold text-indigo hover:underline"
            >
              {t("tuTdOpenFees")}
            </button>
          </div>
          {pending.length === 0 ? (
            <p className="mt-2 rounded-xl bg-cream-paper p-4 text-sm text-muted">
              {t("tuTdNothingPending")}
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {pending.slice(0, 5).map((row) => {
                const overdue = daysOverdue(row.balance.oldestPendingDate);
                return (
                  <li key={row.student.id}>
                    <button
                      type="button"
                      onClick={() => onNavigate("fees")}
                      className="flex w-full items-center justify-between gap-3 rounded-xl border border-muted-line/30 bg-white p-3 text-left transition hover:border-indigo/40"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Wallet className="h-4 w-4 shrink-0 text-muted" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-ink">
                            {row.student.name}
                          </span>
                          {overdue > 0 && (
                            <span className="block text-xs text-red-600">
                              {fill(t(overdue === 1 ? "tuTdOverdueOne" : "tuTdOverdueMany"), {
                                count: overdue,
                              })}
                            </span>
                          )}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-bold text-ink">
                        {formatMoney(row.balance.outstanding, currency)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-ink">{t("tuTdReminders")}</h3>
            <button
              type="button"
              onClick={() => onNavigate("diary")}
              className="text-xs font-semibold text-indigo hover:underline"
            >
              {t("tuTdOpenDiary")}
            </button>
          </div>
          {dueNotes.length === 0 && followUps.length === 0 && birthdays.length === 0 ? (
            <p className="mt-2 rounded-xl bg-cream-paper p-4 text-sm text-muted">
              {t("tuTdNothingToday")}
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {birthdays.map((student) => (
                <li
                  key={`bday-${student.id}`}
                  className="flex items-center gap-2 rounded-xl border border-saffron/40 bg-saffron/10 p-3"
                >
                  <Cake className="h-4 w-4 shrink-0 text-saffron" />
                  <span className="text-sm text-ink">
                    {fill(t("tuTdBirthdayOf"), { name: student.name })}
                  </span>
                </li>
              ))}
              {dueNotes.slice(0, 5).map((note) => (
                <li key={note.id}>
                  <button
                    type="button"
                    onClick={() => onNavigate("diary")}
                    className="flex w-full items-start gap-2 rounded-xl border border-muted-line/30 bg-white p-3 text-left transition hover:border-indigo/40"
                  >
                    <NotebookPen className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-ink">{note.text}</span>
                      <span className="block text-xs text-muted">
                        {[note.studentId ? studentName(note.studentId) : t("tuGeneral"),
                          note.date < today
                            ? fill(t("tuTdFromDate"), { date: formatDate(note.date, lang) })
                            : ""]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
              {followUps.slice(0, 3).map((enquiry) => (
                <li key={`enq-${enquiry.id}`}>
                  <button
                    type="button"
                    onClick={() => onNavigate("enquiries")}
                    className="flex w-full items-center gap-2 rounded-xl border border-muted-line/30 bg-white p-3 text-left transition hover:border-indigo/40"
                  >
                    <PhoneCall className="h-4 w-4 shrink-0 text-muted" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-ink">
                        {fill(t("tuTdFollowUp"), { name: enquiry.name })}
                      </span>
                      <span className="block text-xs text-muted">
                        {enquiry.phone || t("sqNoNumber")}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {absentToday.length > 0 && (
        <section className="mt-6">
          <h3 className="text-sm font-bold text-ink">Absent today</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {absentToday.map((record) => (
              <li
                key={record.id}
                className="flex items-center gap-2 rounded-full bg-cream-paper px-3 py-1.5 text-xs"
              >
                <CalendarClock className="h-3.5 w-3.5 text-muted" />
                <span className="text-ink">{studentName(record.studentId)}</span>
                {record.notifiedAt && <span className="text-emerald-600">told</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
