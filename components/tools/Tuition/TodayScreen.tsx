"use client";

// The landing screen: what is happening today and what needs a tap.

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
      <p className="text-sm text-muted">{formatDate(today)}</p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Classes today"
          value={String(todaysBatches.length)}
          sub={`${marked.size} marked`}
        />
        <StatCard
          label="Pending fees"
          value={formatMoney(totalPending, currency)}
          sub={`${pending.length} student${pending.length === 1 ? "" : "s"}`}
        />
        <StatCard
          label={`Collected ${formatMonth(period)}`}
          value={formatMoney(collectedThisMonth, currency)}
        />
        <StatCard
          label="Absent today"
          value={String(absentToday.length)}
          sub={`${absentToday.filter((a) => a.notifiedAt).length} parents told`}
        />
      </div>

      {holiday && (
        <p className="mt-4 rounded-xl border border-saffron/40 bg-saffron/10 px-4 py-3 text-sm text-ink">
          Today is a holiday — {holiday.name}.
        </p>
      )}

      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-ink">Today&apos;s classes</h3>
          <button
            type="button"
            onClick={() => onNavigate("attendance")}
            className="text-xs font-semibold text-indigo hover:underline"
          >
            All attendance
          </button>
        </div>
        {todaysBatches.length === 0 ? (
          <p className="mt-2 rounded-xl bg-cream-paper p-4 text-sm text-muted">
            No batch is scheduled for today.
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
                        {formatTime(batch.startTime)}–{formatTime(batch.endTime)} · {count}{" "}
                        student{count === 1 ? "" : "s"}
                      </p>
                    </div>
                    <span className="flex shrink-0 items-center gap-2">
                      {done ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                          <CheckCircle2 className="h-4 w-4" />
                          Marked
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-indigo">Mark attendance</span>
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
            <h3 className="text-sm font-bold text-ink">Fees to chase</h3>
            <button
              type="button"
              onClick={() => onNavigate("fees")}
              className="text-xs font-semibold text-indigo hover:underline"
            >
              Open fees
            </button>
          </div>
          {pending.length === 0 ? (
            <p className="mt-2 rounded-xl bg-cream-paper p-4 text-sm text-muted">
              Nothing pending. Everyone is up to date.
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
                              {overdue} day{overdue > 1 ? "s" : ""} overdue
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
            <h3 className="text-sm font-bold text-ink">Reminders</h3>
            <button
              type="button"
              onClick={() => onNavigate("diary")}
              className="text-xs font-semibold text-indigo hover:underline"
            >
              Open diary
            </button>
          </div>
          {dueNotes.length === 0 && followUps.length === 0 && birthdays.length === 0 ? (
            <p className="mt-2 rounded-xl bg-cream-paper p-4 text-sm text-muted">
              Nothing to remember today.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {birthdays.map((student) => (
                <li
                  key={`bday-${student.id}`}
                  className="flex items-center gap-2 rounded-xl border border-saffron/40 bg-saffron/10 p-3"
                >
                  <Cake className="h-4 w-4 shrink-0 text-saffron" />
                  <span className="text-sm text-ink">{student.name}&apos;s birthday today</span>
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
                        {[note.studentId ? studentName(note.studentId) : "General",
                          note.date < today ? `from ${formatDate(note.date)}` : ""]
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
                        Follow up: {enquiry.name}
                      </span>
                      <span className="block text-xs text-muted">
                        {enquiry.phone || "no number"}
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
