"use client";

import { useMemo, useState } from "react";
import {
  CalendarCheck,
  MessageCircle,
  Pencil,
  Phone,
  RotateCcw,
  Share2,
  Trash2,
  UserMinus,
} from "lucide-react";
import { useTuition } from "@/lib/tuition/store";
import {
  attendanceStats,
  filterAttendance,
  studentBalance,
  studentMonthlyFee,
  testsForStudent,
} from "@/lib/tuition/calc";
import { formatMoney } from "@/lib/pos/types";
import { fillTemplate } from "@/lib/tuition/messages";
import {
  currentMonthKey,
  formatDate,
  formatMonth,
  studentCustomFields,
  todayIso,
  type Student,
} from "@/lib/tuition/types";
import { businessToShare, type SharedDoc } from "@/lib/toolkit/shareLink";
import { ShareDialog } from "@/components/toolkit/ShareDialog";
import {
  ConfirmDialog,
  Modal,
  dangerBtnClass,
  inputClass,
  primaryBtnClass,
  secondaryBtnClass,
} from "@/components/tools/FreePos/ui";
import { attendanceDoc, feeReceiptDoc, shareUrlFor } from "./share";
import { SendQueue } from "./SendQueue";

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-muted-line/30 bg-white p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 text-lg font-bold ${tone ?? "text-ink"}`}>{value}</p>
    </div>
  );
}

export function StudentDetail({
  student,
  onClose,
  onEdit,
}: {
  student: Student | null;
  onClose: () => void;
  onEdit: (student: Student) => void;
}) {
  const {
    business,
    settings,
    batches,
    dues,
    payments,
    attendance,
    tests,
    marks,
    deleteStudent,
    markStudentLeft,
    reinstateStudent,
  } = useTuition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [shareDoc, setShareDoc] = useState<SharedDoc | null>(null);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leftOn, setLeftOn] = useState(todayIso());
  const [leaveReason, setLeaveReason] = useState("");
  const currency = business?.currency ?? "INR";
  const period = currentMonthKey();

  const balance = useMemo(
    () => (student ? studentBalance(student.id, dues, payments) : null),
    [student, dues, payments]
  );

  const fee = useMemo(
    () => (student ? studentMonthlyFee(student, batches) : null),
    [student, batches]
  );

  const monthRecords = useMemo(
    () => (student ? filterAttendance(attendance, { studentId: student.id, period }) : []),
    [student, attendance, period]
  );
  const monthStats = useMemo(() => attendanceStats(monthRecords), [monthRecords]);

  const studentPayments = useMemo(
    () => (student ? payments.filter((p) => p.studentId === student.id) : []),
    [student, payments]
  );

  const results = useMemo(
    () => (student ? testsForStudent(tests, marks, student.id) : []),
    [student, tests, marks]
  );

  if (!student || !balance || !fee) return null;

  const enrolled = batches.filter((b) => student.batchIds.includes(b.id));
  const hasLeft = student.status !== "active";
  const customFields = studentCustomFields(student);
  const absentDates = monthRecords
    .filter((r) => r.status === "absent")
    .map((r) => formatDate(r.date).replace(/ \d{4}$/, ""));

  const reminderMessage = () => {
    const doc: SharedDoc = {
      t: "led",
      b: businessToShare(business),
      cn: student.name,
      cp: student.parentPhone || undefined,
      bal: balance.outstanding,
      note: `Fees pending for ${student.name}`,
    };
    return fillTemplate(settings.templates.feeReminder, {
      parent: student.parentName || "Sir/Ma'am",
      student: student.name,
      class: student.classLevel,
      amount: formatMoney(balance.outstanding, currency),
      period: balance.dues
        .filter((d) => d.remaining > 0)
        .map((d) => (d.due.period ? formatMonth(d.due.period) : d.due.label))
        .join(", "),
      due: balance.oldestPendingDate ? formatDate(balance.oldestPendingDate) : "",
      link: shareUrlFor(doc),
      teacher: business?.name ?? "",
    });
  };

  const shareAttendance = () => {
    setShareDoc(
      attendanceDoc(
        business,
        student,
        formatMonth(period),
        { present: monthStats.present + monthStats.late, total: monthStats.total, percent: monthStats.percent },
        absentDates
      )
    );
  };

  return (
    <>
      <Modal open={Boolean(student)} onClose={onClose} title={student.name} wide>
        {hasLeft && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-muted-line/40 bg-cream-paper px-4 py-3">
            <p className="text-sm text-ink">
              <span className="font-bold">Left</span>
              {student.leftOn ? ` on ${formatDate(student.leftOn)}` : ""}
              {student.leaveReason ? ` · ${student.leaveReason}` : ""}
              {balance.outstanding > 0 && (
                <span className="ml-2 font-semibold text-red-600">
                  still owes {formatMoney(balance.outstanding, currency)}
                </span>
              )}
            </p>
            <button
              type="button"
              onClick={() => void reinstateStudent(student.id)}
              className={`${secondaryBtnClass} px-3 py-1.5`}
            >
              <RotateCcw className="h-4 w-4" />
              They&apos;re back
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted">
              {[student.classLevel, student.school].filter(Boolean).join(" · ") || "No class set"}
            </p>
            <p className="mt-1 text-sm text-ink">
              {student.parentName || "Parent"}
              {student.parentPhone ? (
                <a
                  href={`tel:${student.parentPhone}`}
                  className="ml-2 inline-flex items-center gap-1 font-semibold text-indigo"
                >
                  <Phone className="h-3.5 w-3.5" />
                  {student.parentPhone}
                </a>
              ) : (
                <span className="ml-2 text-xs text-saffron">No parent number saved</span>
              )}
            </p>
            {enrolled.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {enrolled.map((batch) => (
                  <span
                    key={batch.id}
                    className="rounded-full bg-cream-paper px-2.5 py-1 text-xs font-semibold text-muted"
                  >
                    {batch.name}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => onEdit(student)} className={secondaryBtnClass}>
              <Pencil className="h-4 w-4" />
              Edit
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className={dangerBtnClass}
              aria-label="Delete student"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Fee / month" value={formatMoney(fee.total, currency)} />
          <Stat
            label="Outstanding"
            value={formatMoney(balance.outstanding, currency)}
            tone={balance.outstanding > 0 ? "text-red-600" : "text-emerald-600"}
          />
          <Stat
            label={`Attendance ${formatMonth(period)}`}
            value={monthStats.total ? `${monthStats.percent}%` : "—"}
          />
          <Stat label="Tests" value={String(results.length)} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {balance.outstanding > 0 && (
            <button
              type="button"
              onClick={() => setReminderOpen(true)}
              className={primaryBtnClass}
            >
              <MessageCircle className="h-4 w-4" />
              Send fee reminder
            </button>
          )}
          <button type="button" onClick={shareAttendance} className={secondaryBtnClass}>
            <CalendarCheck className="h-4 w-4" />
            Share attendance report
          </button>
          {!hasLeft && (
            <button
              type="button"
              onClick={() => {
                setLeftOn(todayIso());
                setLeaveReason("");
                setLeaveOpen(true);
              }}
              className={secondaryBtnClass}
            >
              <UserMinus className="h-4 w-4" />
              Student left
            </button>
          )}
        </div>

        {customFields.length > 0 && (
          <section className="mt-6">
            <h4 className="text-xs font-bold uppercase tracking-wide text-muted">
              Your own fields
            </h4>
            <dl className="mt-2 grid gap-2 sm:grid-cols-2">
              {customFields.map((field) => (
                <div
                  key={field.id}
                  className="rounded-xl border border-muted-line/30 bg-white px-3 py-2"
                >
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                    {field.label || "Note"}
                  </dt>
                  <dd className="text-sm text-ink">{field.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        <section className="mt-6">
          <h4 className="text-xs font-bold uppercase tracking-wide text-muted">Fee dues</h4>
          {balance.dues.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No dues raised yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-muted-line/20 rounded-xl border border-muted-line/30 bg-white">
              {balance.dues
                .slice()
                .reverse()
                .slice(0, 8)
                .map((row) => (
                  <li key={row.due.id} className="flex items-center justify-between px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold text-ink">
                        {row.due.period ? formatMonth(row.due.period) : row.due.label}
                      </p>
                      <p className="text-xs text-muted">Due {formatDate(row.due.dueDate)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-ink">
                        {formatMoney(row.due.amount, currency)}
                      </p>
                      <p
                        className={`text-xs font-semibold ${
                          row.status === "paid"
                            ? "text-emerald-600"
                            : row.overdue
                              ? "text-red-600"
                              : "text-saffron"
                        }`}
                      >
                        {row.status === "paid"
                          ? "Paid"
                          : `${formatMoney(row.remaining, currency)} pending`}
                      </p>
                    </div>
                  </li>
                ))}
            </ul>
          )}
        </section>

        <section className="mt-6">
          <h4 className="text-xs font-bold uppercase tracking-wide text-muted">Payments</h4>
          {studentPayments.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No payments recorded yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-muted-line/20 rounded-xl border border-muted-line/30 bg-white">
              {studentPayments.slice(0, 8).map((payment) => (
                <li key={payment.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">
                      {formatMoney(payment.amount, currency)}
                      <span className="ml-2 text-xs font-normal text-muted">{payment.mode}</span>
                    </p>
                    <p className="truncate text-xs text-muted">
                      {payment.receiptNumber} · {formatDate(payment.date.slice(0, 10))}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setShareDoc(feeReceiptDoc(business, student, payment, balance.outstanding))
                    }
                    className={`${secondaryBtnClass} px-3 py-1.5`}
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    Receipt
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-6">
          <h4 className="text-xs font-bold uppercase tracking-wide text-muted">Test results</h4>
          {results.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No marks entered yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-muted-line/20 rounded-xl border border-muted-line/30 bg-white">
              {results.slice(0, 8).map(({ test, mark }) => (
                <li key={mark.id} className="flex items-center justify-between px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold text-ink">{test.name}</p>
                    <p className="text-xs text-muted">
                      {[test.subject, formatDate(test.date)].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-ink">
                    {mark.marks === null ? (
                      <span className="text-saffron">Absent</span>
                    ) : (
                      <>
                        {mark.marks}
                        <span className="text-xs font-normal text-muted"> / {test.maxMarks}</span>
                      </>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {student.notes && (
          <p className="mt-6 rounded-xl bg-cream-paper p-3 text-sm text-muted">{student.notes}</p>
        )}
      </Modal>

      <ShareDialog
        open={Boolean(shareDoc)}
        doc={shareDoc}
        onClose={() => setShareDoc(null)}
        recipientLabel="parent"
        title="Share with the parent"
      />

      <SendQueue
        open={reminderOpen}
        title="Fee reminder"
        messages={[
          {
            id: student.id,
            name: student.name,
            phone: student.parentPhone,
            message: reminderMessage(),
          },
        ]}
        onClose={() => setReminderOpen(false)}
        onSent={() => {}}
      />

      <Modal
        open={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        title={`${student.name} has left`}
      >
        <p className="text-sm text-muted">
          They come off the roll and off every batch&apos;s attendance list. Their record,
          attendance, fees and marks are all kept, no fee is raised after the month they left, and
          anything still pending stays on the Fees screen.
        </p>
        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
              Last day
            </span>
            <input
              type="date"
              value={leftOn}
              onChange={(event) => setLeftOn(event.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
              Reason (optional)
            </span>
            <input
              type="text"
              value={leaveReason}
              onChange={(event) => setLeaveReason(event.target.value)}
              placeholder="e.g. shifted city, board exams over"
              className={inputClass}
            />
          </label>
          {balance.outstanding > 0 && (
            <p className="rounded-lg bg-saffron/10 px-3 py-2 text-xs text-ink">
              {formatMoney(balance.outstanding, currency)} is still pending. It stays on the fees
              list so you can follow it up — waive the dues there if you are writing it off.
            </p>
          )}
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setLeaveOpen(false)}
            className={secondaryBtnClass}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              void markStudentLeft(student.id, leftOn, leaveReason.trim());
              setLeaveOpen(false);
            }}
            className={primaryBtnClass}
          >
            Mark as left
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${student.name}?`}
        message="Their attendance, fees, payments, marks and notes will be deleted too. This cannot be undone."
        confirmLabel="Delete student"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          void deleteStudent(student.id);
          setConfirmDelete(false);
          onClose();
        }}
      />
    </>
  );
}
