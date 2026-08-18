"use client";

// The screen a teacher opens every single day. The whole flow is built to be
// finished on a phone in a few seconds: pick the batch, everyone starts as
// present, tap the two who are missing, save, notify their parents.

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, MessageCircle, Save, UserX } from "lucide-react";
import { useTuition } from "@/lib/tuition/store";
import { batchesOnDate, studentsInBatch } from "@/lib/tuition/calc";
import { fillTemplate, type OutboundMessage } from "@/lib/tuition/messages";
import {
  ATTENDANCE_LABELS,
  attendanceId,
  formatDate,
  formatTime,
  todayIso,
  type AttendanceStatus,
} from "@/lib/tuition/types";
import {
  EmptyState,
  inputClass,
  primaryBtnClass,
  secondaryBtnClass,
} from "@/components/tools/FreePos/ui";
import { SendQueue } from "./SendQueue";

const STATUS_ORDER: AttendanceStatus[] = ["present", "absent", "late", "leave"];

const STATUS_STYLES: Record<AttendanceStatus, string> = {
  present: "bg-emerald-600 text-white",
  absent: "bg-red-600 text-white",
  late: "bg-saffron text-ink",
  leave: "bg-indigo text-white",
  holiday: "bg-muted text-white",
};

export function AttendanceScreen({
  batchRequest,
}: {
  /** Set by the Today screen when the teacher taps a specific class. */
  batchRequest?: { value: string; nonce: number } | null;
}) {
  const {
    batches,
    students,
    attendance,
    holidays,
    business,
    settings,
    saveAttendance,
    markAbsenceNotified,
  } = useTuition();

  const [date, setDate] = useState(todayIso());
  const [batchId, setBatchId] = useState("");
  const [entries, setEntries] = useState<Record<string, AttendanceStatus>>({});
  const [saved, setSaved] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);

  const scheduled = useMemo(() => batchesOnDate(batches, date), [batches, date]);
  const activeBatches = useMemo(() => batches.filter((b) => b.active), [batches]);
  const holiday = holidays.find((h) => h.date === date);

  // Default to the first batch running on the chosen day.
  useEffect(() => {
    if (batchId && activeBatches.some((b) => b.id === batchId)) return;
    setBatchId(scheduled[0]?.id ?? activeBatches[0]?.id ?? "");
  }, [scheduled, activeBatches, batchId]);

  // Opening a specific class from the Today screen jumps straight to it.
  useEffect(() => {
    if (batchRequest?.value) {
      setBatchId(batchRequest.value);
      setDate(todayIso());
    }
  }, [batchRequest]);

  const batch = batches.find((b) => b.id === batchId) ?? null;
  const roll = useMemo(
    () => (batch ? studentsInBatch(students, batch.id) : []),
    [students, batch]
  );

  const existing = useMemo(
    () => attendance.filter((record) => record.date === date && record.batchId === batchId),
    [attendance, date, batchId]
  );

  // Reset the working copy whenever the day or batch changes: already-marked
  // students keep their mark, everyone else starts as present.
  useEffect(() => {
    const next: Record<string, AttendanceStatus> = {};
    for (const student of roll) {
      next[student.id] =
        existing.find((record) => record.studentId === student.id)?.status ?? "present";
    }
    setEntries(next);
    setSaved(false);
    // `existing` is derived from date+batch, so this runs exactly once per switch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, batchId, roll.length]);

  const setStatus = (studentId: string, status: AttendanceStatus) => {
    setEntries((prev) => ({ ...prev, [studentId]: status }));
    setSaved(false);
  };

  const markAllPresent = () => {
    const next: Record<string, AttendanceStatus> = {};
    for (const student of roll) next[student.id] = "present";
    setEntries(next);
    setSaved(false);
  };

  const counts = useMemo(() => {
    const values = Object.values(entries);
    return {
      present: values.filter((v) => v === "present").length,
      absent: values.filter((v) => v === "absent").length,
      late: values.filter((v) => v === "late").length,
      leave: values.filter((v) => v === "leave").length,
    };
  }, [entries]);

  const handleSave = async () => {
    if (!batch) return;
    await saveAttendance(
      date,
      batch.id,
      roll.map((student) => ({ studentId: student.id, status: entries[student.id] ?? "present" }))
    );
    setSaved(true);
  };

  const absentStudents = useMemo(
    () => roll.filter((student) => entries[student.id] === "absent"),
    [roll, entries]
  );

  const messages: OutboundMessage[] = useMemo(() => {
    if (!batch) return [];
    return absentStudents.map((student) => ({
      id: student.id,
      name: student.name,
      phone: student.parentPhone,
      message: fillTemplate(settings.templates.absent, {
        parent: student.parentName || "Sir/Ma'am",
        student: student.name,
        batch: batch.name,
        class: student.classLevel,
        date: formatDate(date),
        teacher: business?.name ?? "",
      }),
    }));
  }, [absentStudents, batch, settings.templates.absent, date, business]);

  const notifyAndRecord = async (studentIds: string[]) => {
    if (!batch || studentIds.length === 0) return;
    await markAbsenceNotified(studentIds.map((id) => attendanceId(date, batch.id, id)));
  };

  if (activeBatches.length === 0) {
    return (
      <EmptyState
        icon={<CalendarDays className="h-6 w-6" />}
        title="Create a batch first"
        message="Attendance is marked batch by batch. Add your first batch in Settings → Batches, then enrol students into it."
      />
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
              Date
            </span>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value || todayIso())}
              className={`${inputClass} w-auto`}
            />
          </label>
          <button
            type="button"
            onClick={() => setDate(todayIso())}
            className={`${secondaryBtnClass} h-[38px]`}
          >
            Today
          </button>
        </div>
        <div className="text-sm text-muted">
          {counts.present + counts.late} present · {counts.absent} absent
        </div>
      </div>

      {holiday && (
        <p className="mt-4 rounded-xl border border-saffron/40 bg-saffron/10 px-4 py-3 text-sm text-ink">
          {formatDate(date)} is marked as a holiday ({holiday.name}). You can still take
          attendance if you held a class.
        </p>
      )}

      <div className="-mx-1 mt-4 flex gap-2 overflow-x-auto pb-1" aria-label="Batches">
        {activeBatches.map((item) => {
          const runsToday = scheduled.some((b) => b.id === item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setBatchId(item.id)}
              aria-current={batchId === item.id ? "true" : undefined}
              className={`inline-flex shrink-0 flex-col items-start rounded-xl border px-3 py-2 text-left transition ${
                batchId === item.id
                  ? "border-indigo bg-indigo text-white"
                  : "border-muted-line/30 bg-white text-ink hover:border-indigo/40"
              }`}
            >
              <span className="text-sm font-semibold">{item.name}</span>
              <span
                className={`text-xs ${batchId === item.id ? "text-white/70" : "text-muted"}`}
              >
                {formatTime(item.startTime)}
                {runsToday ? " · today" : ""}
              </span>
            </button>
          );
        })}
      </div>

      {!batch ? null : roll.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={<UserX className="h-6 w-6" />}
            title="No students in this batch"
            message="Enrol students into this batch from the Students screen to start marking attendance."
          />
        </div>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <button type="button" onClick={markAllPresent} className={secondaryBtnClass}>
              <Check className="h-4 w-4" />
              Mark all present
            </button>
            <div className="flex items-center gap-2">
              {saved && absentStudents.length > 0 && (
                <button
                  type="button"
                  onClick={() => setQueueOpen(true)}
                  className={secondaryBtnClass}
                >
                  <MessageCircle className="h-4 w-4" />
                  Notify {absentStudents.length} parent
                  {absentStudents.length > 1 ? "s" : ""}
                </button>
              )}
              <button type="button" onClick={() => void handleSave()} className={primaryBtnClass}>
                <Save className="h-4 w-4" />
                {saved ? "Saved" : "Save attendance"}
              </button>
            </div>
          </div>

          <ul className="mt-4 space-y-2">
            {roll.map((student) => {
              const status = entries[student.id] ?? "present";
              const record = existing.find((r) => r.studentId === student.id);
              return (
                <li
                  key={student.id}
                  className="flex flex-col gap-2 rounded-xl border border-muted-line/30 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">
                      {student.name}
                      {student.rollNo ? (
                        <span className="ml-2 text-xs font-normal text-muted">
                          #{student.rollNo}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted">
                      {student.classLevel}
                      {record?.notifiedAt ? " · parent notified" : ""}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {STATUS_ORDER.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setStatus(student.id, option)}
                        aria-pressed={status === option}
                        className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold transition sm:flex-none ${
                          status === option
                            ? STATUS_STYLES[option]
                            : "bg-cream-paper text-muted hover:text-ink"
                        }`}
                      >
                        {ATTENDANCE_LABELS[option]}
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <SendQueue
        open={queueOpen}
        title="Tell parents their child was absent"
        messages={messages}
        onClose={() => setQueueOpen(false)}
        onSent={(ids) => void notifyAndRecord(ids)}
      />
    </div>
  );
}
