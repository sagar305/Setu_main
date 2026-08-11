// Fee, attendance and marks arithmetic for the Tuition Class Manager.
//
// Fees are driven by BATCHES: a student pays the sum of the fees of every
// batch they are enrolled in, minus their concession. A per-student override
// replaces that sum when the teacher sets one.

import {
  monthKey,
  monthsBetween,
  todayIso,
  type AttendanceRecord,
  type AttendanceStatus,
  type Batch,
  type FeeDue,
  type FeePayment,
  type MarkRecord,
  type Student,
  type TestRecord,
} from "./types";

export type FeeBreakdownLine = { batchId: string; batchName: string; amount: number };

export type StudentFee = {
  gross: number;
  concession: number;
  /** What the student actually owes per cycle. */
  total: number;
  breakdown: FeeBreakdownLine[];
  /** True when a per-student amount replaced the batch sum. */
  overridden: boolean;
};

/** Round to 2 decimals without float dust (₹ amounts stay exact). */
export function round2(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

/** Fee for one cycle: sum of the student's batches, less any concession. */
export function studentMonthlyFee(student: Student, batches: Batch[]): StudentFee {
  const breakdown: FeeBreakdownLine[] = [];
  for (const batchId of student.batchIds) {
    const batch = batches.find((b) => b.id === batchId);
    if (!batch) continue;
    breakdown.push({
      batchId: batch.id,
      batchName: batch.name,
      amount: round2(batch.monthlyFee),
    });
  }

  const batchSum = round2(breakdown.reduce((sum, line) => sum + line.amount, 0));
  const gross =
    student.customMonthlyFee !== null && student.customMonthlyFee >= 0
      ? round2(student.customMonthlyFee)
      : batchSum;

  const concession =
    student.concessionValue > 0
      ? student.concessionType === "percent"
        ? round2((gross * student.concessionValue) / 100)
        : round2(Math.min(student.concessionValue, gross))
      : 0;

  return {
    gross,
    concession,
    total: round2(Math.max(gross - concession, 0)),
    breakdown,
    overridden: student.customMonthlyFee !== null && student.customMonthlyFee >= 0,
  };
}

export function tuitionDueId(studentId: string, period: string): string {
  return `${studentId}:${period}`;
}

/** The monthly tuition due for one student, snapshotting today's fee. */
export function buildTuitionDue(
  student: Student,
  batches: Batch[],
  period: string,
  feeDueDay: number,
  createdAt: string
): FeeDue {
  const fee = studentMonthlyFee(student, batches);
  const day = String(Math.min(Math.max(feeDueDay, 1), 28)).padStart(2, "0");
  return {
    id: tuitionDueId(student.id, period),
    studentId: student.id,
    period,
    kind: "tuition",
    label: "Tuition fee",
    amount: fee.total,
    breakdown: fee.breakdown,
    concession: fee.concession,
    dueDate: `${period}-${day}`,
    waived: false,
    createdAt,
  };
}

/**
 * Which monthly dues are missing for a student — from their joining month up
 * to the current month. Dues already generated are never rebuilt, so a later
 * fee change does not rewrite history.
 */
export function missingDuePeriods(
  student: Student,
  existingDues: FeeDue[],
  upToPeriod = monthKey(todayIso())
): string[] {
  if (student.status !== "active") return [];
  const start = student.joinDate ? monthKey(student.joinDate) : upToPeriod;
  const have = new Set(
    existingDues.filter((d) => d.studentId === student.id && d.kind === "tuition").map((d) => d.period)
  );
  return monthsBetween(start, upToPeriod).filter((period) => !have.has(period));
}

// ---------------------------------------------------------------------------
// Balances
// ---------------------------------------------------------------------------

export type DueStatus = "paid" | "partial" | "pending";

export type AllocatedDue = {
  due: FeeDue;
  paid: number;
  remaining: number;
  status: DueStatus;
  overdue: boolean;
};

export type StudentBalance = {
  billed: number;
  paid: number;
  /** Positive = the student owes money; negative shown as advance. */
  outstanding: number;
  advance: number;
  dues: AllocatedDue[];
  oldestPendingDate: string;
};

/**
 * Payments are applied to dues oldest-first. The app deliberately does not ask
 * the teacher to allocate each payment to a month — the running balance is
 * what matters, and FIFO is how fees are settled in practice.
 */
export function studentBalance(
  studentId: string,
  dues: FeeDue[],
  payments: FeePayment[],
  today = todayIso()
): StudentBalance {
  const mine = dues
    .filter((d) => d.studentId === studentId && !d.waived)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const paidTotal = round2(
    payments.filter((p) => p.studentId === studentId).reduce((sum, p) => sum + p.amount, 0)
  );

  let pool = paidTotal;
  const allocated: AllocatedDue[] = mine.map((due) => {
    const paid = round2(Math.min(pool, due.amount));
    pool = round2(pool - paid);
    const remaining = round2(due.amount - paid);
    return {
      due,
      paid,
      remaining,
      status: remaining <= 0 ? "paid" : paid > 0 ? "partial" : "pending",
      overdue: remaining > 0 && due.dueDate < today,
    };
  });

  const billed = round2(mine.reduce((sum, d) => sum + d.amount, 0));
  const outstanding = round2(Math.max(billed - paidTotal, 0));
  const oldestPending = allocated.find((a) => a.remaining > 0);

  return {
    billed,
    paid: paidTotal,
    outstanding,
    advance: round2(Math.max(paidTotal - billed, 0)),
    dues: allocated,
    oldestPendingDate: oldestPending?.due.dueDate ?? "",
  };
}

export function daysOverdue(dueDate: string, today = todayIso()): number {
  if (!dueDate || dueDate >= today) return 0;
  const from = new Date(`${dueDate}T00:00:00`).getTime();
  const to = new Date(`${today}T00:00:00`).getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.floor((to - from) / 86_400_000);
}

/** Periods (or labels) still unpaid — used to describe a fee reminder. */
export function pendingLabels(balance: StudentBalance): string[] {
  return balance.dues
    .filter((a) => a.remaining > 0)
    .map((a) => (a.due.period ? a.due.period : a.due.label));
}

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------

export type AttendanceStats = {
  present: number;
  absent: number;
  late: number;
  leave: number;
  /** Classes that count towards the percentage (holidays excluded). */
  total: number;
  percent: number;
};

const COUNTS_AS_PRESENT: AttendanceStatus[] = ["present", "late"];

export function attendanceStats(records: AttendanceRecord[]): AttendanceStats {
  let present = 0;
  let absent = 0;
  let late = 0;
  let leave = 0;
  for (const record of records) {
    if (record.status === "present") present += 1;
    else if (record.status === "absent") absent += 1;
    else if (record.status === "late") late += 1;
    else if (record.status === "leave") leave += 1;
  }
  const total = present + absent + late + leave;
  const attended = records.filter((r) => COUNTS_AS_PRESENT.includes(r.status)).length;
  return {
    present,
    absent,
    late,
    leave,
    total,
    percent: total === 0 ? 0 : Math.round((attended / total) * 100),
  };
}

export function filterAttendance(
  records: AttendanceRecord[],
  filter: { studentId?: string; batchId?: string; from?: string; to?: string; period?: string }
): AttendanceRecord[] {
  return records.filter((record) => {
    if (filter.studentId && record.studentId !== filter.studentId) return false;
    if (filter.batchId && record.batchId !== filter.batchId) return false;
    if (filter.period && monthKey(record.date) !== filter.period) return false;
    if (filter.from && record.date < filter.from) return false;
    if (filter.to && record.date > filter.to) return false;
    return true;
  });
}

/** Batches scheduled on a given date, ordered by start time. */
export function batchesOnDate(batches: Batch[], dateKey: string): Batch[] {
  const weekday = new Date(`${dateKey}T00:00:00`).getDay();
  return batches
    .filter((batch) => batch.active && batch.days.includes(weekday))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

export function studentsInBatch(students: Student[], batchId: string): Student[] {
  return students
    .filter((s) => s.status === "active" && s.batchIds.includes(batchId))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------
// Tests & marks
// ---------------------------------------------------------------------------

export type TestStats = {
  appeared: number;
  average: number;
  highest: number;
  lowest: number;
  /** studentId → 1-based rank among students who appeared. */
  ranks: Record<string, number>;
};

export function testStats(marks: MarkRecord[]): TestStats {
  const scored = marks.filter((m) => m.marks !== null) as (MarkRecord & { marks: number })[];
  if (scored.length === 0) {
    return { appeared: 0, average: 0, highest: 0, lowest: 0, ranks: {} };
  }
  const values = scored.map((m) => m.marks);
  const ranks: Record<string, number> = {};
  [...scored]
    .sort((a, b) => b.marks - a.marks)
    .forEach((mark, index, sorted) => {
      // Equal scores share a rank.
      const previous = sorted[index - 1];
      ranks[mark.studentId] =
        previous && previous.marks === mark.marks ? ranks[previous.studentId] : index + 1;
    });
  return {
    appeared: scored.length,
    average: round2(values.reduce((sum, v) => sum + v, 0) / scored.length),
    highest: Math.max(...values),
    lowest: Math.min(...values),
    ranks,
  };
}

export function percentOf(marks: number, maxMarks: number): number {
  if (!maxMarks) return 0;
  return Math.round((marks / maxMarks) * 1000) / 10;
}

/** Every test a student has a mark in, newest first. */
export function testsForStudent(
  tests: TestRecord[],
  marks: MarkRecord[],
  studentId: string
): { test: TestRecord; mark: MarkRecord }[] {
  return marks
    .filter((m) => m.studentId === studentId)
    .map((mark) => ({ test: tests.find((t) => t.id === mark.testId), mark }))
    .filter((row): row is { test: TestRecord; mark: MarkRecord } => Boolean(row.test))
    .sort((a, b) => b.test.date.localeCompare(a.test.date));
}
