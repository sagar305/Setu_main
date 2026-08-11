// CSV export + bulk student import for the Tuition Class Manager.
//
// Import matters more here than anywhere else in the toolkit: a coaching class
// with 80 students will not type them in one by one, so the Students screen
// accepts a pasted spreadsheet block (CSV or tab-separated) as well as a file.

import { toCsv } from "@/lib/pos/csv";
import { studentBalance, studentMonthlyFee } from "./calc";
import {
  ATTENDANCE_LABELS,
  formatMonth,
  type AttendanceRecord,
  type Batch,
  type FeeDue,
  type FeePayment,
  type MarkRecord,
  type Student,
  type TestRecord,
} from "./types";

export { toCsv, downloadCsv } from "@/lib/pos/csv";

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export function studentsCsv(students: Student[], batches: Batch[]): string {
  const batchNames = (ids: string[]) =>
    ids
      .map((id) => batches.find((b) => b.id === id)?.name ?? "")
      .filter(Boolean)
      .join(" | ");
  return toCsv(
    [
      "Name",
      "Roll No",
      "Class",
      "School",
      "Batches",
      "Parent",
      "Parent Phone",
      "Alt Phone",
      "Join Date",
      "Monthly Fee",
      "Status",
      "Notes",
    ],
    students.map((s) => [
      s.name,
      s.rollNo,
      s.classLevel,
      s.school,
      batchNames(s.batchIds),
      s.parentName,
      s.parentPhone,
      s.altPhone,
      s.joinDate,
      studentMonthlyFee(s, batches).total,
      s.status,
      s.notes,
    ])
  );
}

export function attendanceCsv(
  records: AttendanceRecord[],
  students: Student[],
  batches: Batch[]
): string {
  const studentName = (id: string) => students.find((s) => s.id === id)?.name ?? "";
  const batchName = (id: string) => batches.find((b) => b.id === id)?.name ?? "";
  return toCsv(
    ["Date", "Student", "Batch", "Status", "Note"],
    [...records]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((r) => [
        r.date,
        studentName(r.studentId),
        batchName(r.batchId),
        ATTENDANCE_LABELS[r.status],
        r.note,
      ])
  );
}

export function feesCsv(students: Student[], dues: FeeDue[], payments: FeePayment[]): string {
  return toCsv(
    ["Student", "Parent Phone", "Billed", "Paid", "Outstanding", "Oldest Pending"],
    students.map((student) => {
      const balance = studentBalance(student.id, dues, payments);
      return [
        student.name,
        student.parentPhone,
        balance.billed,
        balance.paid,
        balance.outstanding,
        balance.oldestPendingDate,
      ];
    })
  );
}

export function paymentsCsv(payments: FeePayment[]): string {
  return toCsv(
    ["Receipt", "Date", "Student", "Amount", "Mode", "Towards", "Note"],
    [...payments]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((p) => [
        p.receiptNumber,
        new Date(p.date).toLocaleString(),
        p.studentName,
        p.amount,
        p.mode,
        p.appliedTo.map((label) => (/^\d{4}-\d{2}$/.test(label) ? formatMonth(label) : label)).join(", "),
        p.note,
      ])
  );
}

export function marksCsv(
  test: TestRecord,
  marks: MarkRecord[],
  students: Student[]
): string {
  const studentName = (id: string) => students.find((s) => s.id === id)?.name ?? "";
  return toCsv(
    ["Student", "Marks", "Max Marks", "Percent", "Remark"],
    marks.map((mark) => [
      studentName(mark.studentId),
      mark.marks === null ? "Absent" : mark.marks,
      test.maxMarks,
      mark.marks === null ? "" : Math.round((mark.marks / test.maxMarks) * 1000) / 10,
      mark.remark,
    ])
  );
}

// ---------------------------------------------------------------------------
// Student import
// ---------------------------------------------------------------------------

export type ParsedStudentRow = {
  name: string;
  rollNo: string;
  classLevel: string;
  school: string;
  parentName: string;
  parentPhone: string;
  altPhone: string;
  joinDate: string;
  /** Batch names as written in the file — matched case-insensitively. */
  batchNames: string[];
  /** Recognised batch ids; unmatched names are reported separately. */
  batchIds: string[];
  unknownBatches: string[];
  customMonthlyFee: number | null;
};

export type ImportResult = {
  rows: ParsedStudentRow[];
  /** Line-level problems, e.g. a row with no name. */
  errors: string[];
  /** Batch names in the file that do not exist yet. */
  unknownBatches: string[];
};

/** Split one delimited line, honouring "quoted, values". */
function splitLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

const HEADER_ALIASES: Record<string, keyof ParsedStudentRow | "fee"> = {
  name: "name",
  student: "name",
  "student name": "name",
  roll: "rollNo",
  "roll no": "rollNo",
  "roll number": "rollNo",
  class: "classLevel",
  standard: "classLevel",
  grade: "classLevel",
  school: "school",
  parent: "parentName",
  "parent name": "parentName",
  father: "parentName",
  guardian: "parentName",
  phone: "parentPhone",
  mobile: "parentPhone",
  contact: "parentPhone",
  "parent phone": "parentPhone",
  "parent mobile": "parentPhone",
  "whatsapp": "parentPhone",
  "alt phone": "altPhone",
  "alternate phone": "altPhone",
  batch: "batchNames",
  batches: "batchNames",
  subject: "batchNames",
  subjects: "batchNames",
  "join date": "joinDate",
  joined: "joinDate",
  "admission date": "joinDate",
  fee: "fee",
  fees: "fee",
  "monthly fee": "fee",
};

/**
 * Parse a pasted spreadsheet block or CSV file. A header row is used when
 * present; otherwise columns are read positionally as
 * Name, Class, Parent, Parent Phone, Batches.
 */
export function parseStudentImport(text: string, batches: Batch[]): ImportResult {
  const errors: string[] = [];
  const rows: ParsedStudentRow[] = [];
  const unknown = new Set<string>();

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return { rows, errors: ["Nothing to import."], unknownBatches: [] };

  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const firstCells = splitLine(lines[0], delimiter).map((c) => c.toLowerCase());
  const hasHeader = firstCells.some((cell) => cell === "name" || cell === "student" || cell === "student name");

  const columns: (keyof ParsedStudentRow | "fee" | null)[] = hasHeader
    ? firstCells.map((cell) => HEADER_ALIASES[cell] ?? null)
    : ["name", "classLevel", "parentName", "parentPhone", "batchNames"];

  const matchBatch = (label: string): string | null => {
    const needle = label.trim().toLowerCase();
    if (!needle) return null;
    const found = batches.find(
      (b) => b.name.toLowerCase() === needle || b.subject.toLowerCase() === needle
    );
    return found ? found.id : null;
  };

  for (const [index, line] of lines.entries()) {
    if (hasHeader && index === 0) continue;
    const cells = splitLine(line, delimiter);
    const row: ParsedStudentRow = {
      name: "",
      rollNo: "",
      classLevel: "",
      school: "",
      parentName: "",
      parentPhone: "",
      altPhone: "",
      joinDate: "",
      batchNames: [],
      batchIds: [],
      unknownBatches: [],
      customMonthlyFee: null,
    };

    cells.forEach((value, columnIndex) => {
      const field = columns[columnIndex];
      if (!field || !value) return;
      if (field === "batchNames") {
        row.batchNames = value
          .split(/[|;/]/)
          .map((part) => part.trim())
          .filter(Boolean);
      } else if (field === "fee") {
        const amount = Number(value.replace(/[^\d.]/g, ""));
        row.customMonthlyFee = Number.isFinite(amount) && amount > 0 ? amount : null;
      } else if (field === "joinDate") {
        row.joinDate = normaliseDate(value);
      } else {
        row[field] = value as never;
      }
    });

    if (!row.name) {
      errors.push(`Line ${index + 1}: no student name — skipped.`);
      continue;
    }

    for (const label of row.batchNames) {
      const id = matchBatch(label);
      if (id) row.batchIds.push(id);
      else {
        row.unknownBatches.push(label);
        unknown.add(label);
      }
    }

    rows.push(row);
  }

  return { rows, errors, unknownBatches: [...unknown] };
}

/** Accept 2026-08-11, 11/08/2026 and 11-08-2026; anything else is dropped. */
function normaliseDate(value: string): string {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!match) return "";
  const [, day, month, year] = match;
  const fullYear = year.length === 2 ? `20${year}` : year;
  return `${fullYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}
