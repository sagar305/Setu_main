import { describe, expect, it } from "vitest";

import {
  allotSeats,
  batchCapacity,
  batchesForAttendance,
  batchStrength,
  expensesInMonth,
  isBatchFull,
  monthProfit,
} from "@/lib/tuition/calc";
import type { AttendanceRecord, Batch, FeePayment, Student } from "@/lib/tuition/types";

const batch = (id: string, over: Partial<Batch> = {}): Batch => ({
  id,
  name: id,
  subject: "Maths",
  classLevel: "Class 10",
  days: [1, 3, 5],
  startTime: "18:00",
  endTime: "19:00",
  monthlyFee: 1000,
  venue: "",
  active: true,
  createdAt: "",
  updatedAt: "",
  ...over,
});

const student = (id: string, batchIds: string[], status: Student["status"] = "active") =>
  ({ id, name: id, batchIds, status }) as Student;

describe("batch size limit", () => {
  it("treats a missing, zero or blank limit as no limit", () => {
    expect(batchCapacity(batch("a"))).toBeNull();
    expect(batchCapacity(batch("a", { maxStudents: null }))).toBeNull();
    expect(batchCapacity(batch("a", { maxStudents: 0 }))).toBeNull();
    expect(batchCapacity(batch("a", { maxStudents: 12 }))).toBe(12);
  });

  it("counts only active students, and can leave one out", () => {
    const students = [student("s1", ["a"]), student("s2", ["a"]), student("s3", ["a"], "inactive")];
    expect(batchStrength(students, "a")).toBe(2);
    expect(batchStrength(students, "a", "s1")).toBe(1);
  });

  it("is full at the limit, but not for a student already in it", () => {
    const limited = batch("a", { maxStudents: 2 });
    const students = [student("s1", ["a"]), student("s2", ["a"])];
    expect(isBatchFull(limited, students)).toBe(true);
    expect(isBatchFull(limited, students, "s1")).toBe(false);
    expect(isBatchFull(batch("a"), students)).toBe(false);
  });

  it("seats an import in order and drops the batch from rows that do not fit", () => {
    const batches = [batch("a", { maxStudents: 2 }), batch("b")];
    const result = allotSeats(
      [{ batchIds: ["a", "b"] }, { batchIds: ["a"] }, { batchIds: ["b"] }],
      batches,
      [student("s1", ["a"])]
    );
    expect(result.rows.map((r) => r.batchIds)).toEqual([["a", "b"], [], ["b"]]);
    expect(result.overflowed.map((b) => b.id)).toEqual(["a"]);
  });
});

describe("batches offered for attendance", () => {
  const batches = [
    batch("mwf", { days: [1, 3, 5], startTime: "18:00" }),
    batch("tts", { days: [2, 4, 6], startTime: "17:00" }),
    batch("anyday", { days: [], startTime: "09:00" }),
    batch("closed", { days: [1], active: false }),
  ];
  // 2026-11-16 is a Monday.
  it("lists the day's batches and those with no fixed days, by start time", () => {
    expect(batchesForAttendance(batches, [], "2026-11-16").map((b) => b.id)).toEqual([
      "anyday",
      "mwf",
    ]);
  });

  it("keeps a batch whose extra class was already marked that day", () => {
    const marked = [{ date: "2026-11-16", batchId: "tts" }] as AttendanceRecord[];
    expect(batchesForAttendance(batches, marked, "2026-11-16").map((b) => b.id)).toEqual([
      "anyday",
      "tts",
      "mwf",
    ]);
  });
});

describe("monthly profit", () => {
  const payments = [
    { date: "2026-11-03T10:00:00.000Z", amount: 5000 },
    { date: "2026-11-20T10:00:00.000Z", amount: 3000 },
    { date: "2026-10-20T10:00:00.000Z", amount: 9999 },
  ] as FeePayment[];
  const expenses = [
    { date: "2026-11-01", amount: 2000, category: "Rent", createdByTool: "tuition-manager" },
    { date: "2026-11-05", amount: 500, category: "Electricity", createdByTool: "expense-tracker" },
    { date: "2026-11-09", amount: 700, category: "Purchases", createdByTool: "purchase-register" },
    { date: "2026-10-01", amount: 2000, category: "Rent", createdByTool: "expense-tracker" },
  ];

  it("is the month's fees collected less the month's expenses", () => {
    const result = monthProfit(payments, expenses, "2026-11");
    expect(result).toMatchObject({ collected: 8000, expenses: 2500, profit: 5500, marginPercent: 69 });
    expect(result.byCategory).toEqual([
      { category: "Rent", amount: 2000 },
      { category: "Electricity", amount: 500 },
    ]);
  });

  it("leaves out stock purchases mirrored from the Purchase Register", () => {
    expect(expensesInMonth(expenses, "2026-11").map((e) => e.category)).toEqual([
      "Electricity",
      "Rent",
    ]);
  });

  it("reports a loss, and no margin when nothing was collected", () => {
    expect(monthProfit([], expenses, "2026-11")).toMatchObject({ profit: -2500, marginPercent: null });
  });
});
