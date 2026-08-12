// Data model for the Tuition Class Manager (/products/free-tuition-software).
//
// Everything is stored client-side in the shared workspace database
// (POS_DATABASE, see lib/pos/db.ts) — no backend, no login. The teacher's
// profile reuses the workspace `business` record, so a tutor who already used
// another Setu tool does not retype their name, phone, logo or UPI ID.

import { generateId, nowIso } from "@/lib/pos/types";

export { generateId, nowIso };

// ---------------------------------------------------------------------------
// Batches (the unit fees are attached to)
// ---------------------------------------------------------------------------

/** A recurring class: a subject, a group of students, days and a timing. */
export type Batch = {
  id: string;
  name: string;
  subject: string;
  /** School class / grade this batch is for, e.g. "Class 10". */
  classLevel: string;
  /** Weekdays the batch runs on: 0 = Sunday … 6 = Saturday. */
  days: number[];
  startTime: string; // "18:00"
  endTime: string; // "19:30"
  /** Fee every enrolled student pays for this batch, per cycle. */
  monthlyFee: number;
  venue: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Students
// ---------------------------------------------------------------------------

export type StudentStatus = "active" | "inactive";

/**
 * Anything else the teacher wants to remember about a student — school test
 * marks, a board roll number, which bus they take. Free-form on purpose: no
 * two teachers track the same things.
 */
export type CustomField = {
  id: string;
  label: string;
  value: string;
};

export type Student = {
  id: string;
  name: string;
  rollNo: string;
  /** School class / grade, e.g. "Class 10". */
  classLevel: string;
  school: string;
  /** Batches the student is enrolled in — fees are the sum of these. */
  batchIds: string[];
  parentName: string;
  /** Primary contact — this is the number reminders are sent to. */
  parentPhone: string;
  altPhone: string;
  studentPhone: string;
  email: string;
  address: string;
  /** YYYY-MM-DD, used for birthday reminders. */
  dob: string;
  /** YYYY-MM-DD — fee dues start from this month. */
  joinDate: string;
  /** Concession (scholarship / sibling discount) on the batch-fee total. */
  concessionType: "flat" | "percent";
  concessionValue: number;
  /** Replaces the batch-fee sum entirely when set; null = use the batches. */
  customMonthlyFee: number | null;
  status: StudentStatus;
  /** YYYY-MM-DD the student stopped coming; "" while they still attend.
   *  Fees stop being raised after this month. */
  leftOn: string;
  leaveReason: string;
  /** Set when a student who had left comes back. Dues resume from this month
   *  instead of their original joining month, so the gap is not back-billed. */
  rejoinedOn: string;
  /** Teacher's own fields — school marks, notes, anything. */
  custom: CustomField[];
  notes: string;
  createdAt: string;
  updatedAt: string;
};

/** Records written before these fields existed load without them. */
export function studentCustomFields(student: Student): CustomField[] {
  return Array.isArray(student.custom) ? student.custom : [];
}

export const COMMON_CUSTOM_FIELDS = [
  "School test marks",
  "School roll number",
  "Board / medium",
  "Weak areas",
  "Target exam",
];

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------

export type AttendanceStatus = "present" | "absent" | "late" | "leave" | "holiday";

export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  leave: "Leave",
  holiday: "Holiday",
};

/**
 * One mark per student per batch per day — a student enrolled in two batches
 * on the same day is marked separately in each.
 */
export type AttendanceRecord = {
  id: string; // `${date}:${batchId}:${studentId}`
  date: string; // YYYY-MM-DD
  batchId: string;
  studentId: string;
  status: AttendanceStatus;
  note: string;
  /** ISO timestamp of when the parent was notified about an absence. */
  notifiedAt: string | null;
  markedAt: string;
};

export function attendanceId(date: string, batchId: string, studentId: string): string {
  return `${date}:${batchId}:${studentId}`;
}

// ---------------------------------------------------------------------------
// Fees
// ---------------------------------------------------------------------------

export type FeeDueKind = "tuition" | "admission" | "exam" | "material" | "transport" | "other";

export const FEE_KIND_LABELS: Record<FeeDueKind, string> = {
  tuition: "Tuition fee",
  admission: "Admission fee",
  exam: "Exam fee",
  material: "Books & material",
  transport: "Transport",
  other: "Other",
};

/** One line the student owes. Monthly tuition dues are generated per cycle. */
export type FeeDue = {
  id: string; // tuition: `${studentId}:${period}`; one-off charges: uuid
  studentId: string;
  /** YYYY-MM for tuition cycles; "" for one-off charges. */
  period: string;
  kind: FeeDueKind;
  label: string;
  /** Payable amount, after concession. */
  amount: number;
  /** How the amount was arrived at — snapshotted so later fee changes
   *  never rewrite an old month. */
  breakdown: { batchId: string; batchName: string; amount: number }[];
  concession: number;
  dueDate: string; // YYYY-MM-DD
  waived: boolean;
  createdAt: string;
};

export type FeePayment = {
  id: string;
  receiptNumber: string;
  studentId: string;
  /** Snapshot so an old receipt still reads correctly if the name changes. */
  studentName: string;
  date: string; // ISO datetime
  amount: number;
  mode: string;
  /** Periods/labels this payment was collected against (shown on the receipt). */
  appliedTo: string[];
  note: string;
  createdAt: string;
};

export const DEFAULT_PAYMENT_MODES = ["Cash", "UPI", "Bank transfer", "Cheque"];

// ---------------------------------------------------------------------------
// Tests & marks
// ---------------------------------------------------------------------------

export type TestRecord = {
  id: string;
  name: string;
  subject: string;
  batchId: string;
  date: string; // YYYY-MM-DD
  maxMarks: number;
  createdAt: string;
};

export type MarkRecord = {
  id: string; // `${testId}:${studentId}`
  testId: string;
  studentId: string;
  /** null = the student did not appear for this test. */
  marks: number | null;
  remark: string;
  /** ISO timestamp of when the result was sent to the parent. */
  sentAt: string | null;
  updatedAt: string;
};

export function markId(testId: string, studentId: string): string {
  return `${testId}:${studentId}`;
}

// ---------------------------------------------------------------------------
// Diary (dated reminders) and enquiries
// ---------------------------------------------------------------------------

/** A note pinned to a date — "bring the geometry box", "call mother". */
export type StudentNote = {
  id: string;
  /** "" = a general reminder for the day, not tied to one student. */
  studentId: string;
  date: string; // YYYY-MM-DD the reminder is FOR
  text: string;
  done: boolean;
  /** Whether this note is meant to be sent to the parent. */
  notifyParent: boolean;
  sentAt: string | null;
  createdAt: string;
};

export type EnquiryStatus = "new" | "followup" | "demo" | "joined" | "lost";

export const ENQUIRY_LABELS: Record<EnquiryStatus, string> = {
  new: "New",
  followup: "Follow up",
  demo: "Demo taken",
  joined: "Joined",
  lost: "Lost",
};

export type Enquiry = {
  id: string;
  name: string;
  parentName: string;
  phone: string;
  classLevel: string;
  subjects: string;
  /** Walk-in / Call / Reference / Online … */
  source: string;
  status: EnquiryStatus;
  followUpDate: string; // YYYY-MM-DD
  note: string;
  createdAt: string;
  updatedAt: string;
};

export type Holiday = {
  id: string; // YYYY-MM-DD
  date: string;
  name: string;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Message templates
// ---------------------------------------------------------------------------

/**
 * Every message the teacher sends is built from an editable template. The
 * app never sends anything by itself — it opens WhatsApp with the text
 * pre-filled, one parent at a time.
 *
 * Placeholders: {student} {parent} {class} {batch} {amount} {period} {date}
 * {due} {test} {subject} {marks} {max} {percent} {average} {link} {teacher}
 */
export type MessageTemplates = {
  feeReminder: string;
  absent: string;
  receipt: string;
  marks: string;
  diary: string;
  birthday: string;
  attendanceReport: string;
};

export const DEFAULT_TEMPLATES: MessageTemplates = {
  feeReminder:
    "Namaste {parent}, this is a gentle reminder that {amount} is pending for {student} ({period}). You can view the details and pay here: {link}\n\n— {teacher}",
  absent:
    "Namaste {parent}, {student} was absent from the {batch} class on {date}. Please let us know if everything is alright.\n\n— {teacher}",
  receipt:
    "Namaste {parent}, we have received {amount} towards {student}'s fees. Your receipt: {link}\n\nThank you.\n— {teacher}",
  marks:
    "Namaste {parent}, {student} scored {marks}/{max} ({percent}%) in {test} — {subject}. Full result: {link}\n\n— {teacher}",
  diary: "Namaste {parent}, a note for {student}: {note}\n\n— {teacher}",
  birthday: "Wishing {student} a very happy birthday from all of us at {teacher}! 🎂",
  attendanceReport:
    "Namaste {parent}, {student}'s attendance for {period}: {percent}% ({present} of {total} classes). Details: {link}\n\n— {teacher}",
};

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export type TuitionSettings = {
  id: "main";
  receiptPrefix: string;
  nextReceiptNumber: number;
  /** Day of the month monthly fees fall due. */
  feeDueDay: number;
  /** Generate the current month's tuition dues automatically on open. */
  autoGenerateDues: boolean;
  paymentModes: string[];
  templates: MessageTemplates;
  /** Show the class average / rank on a shared marks report. */
  showClassAverage: boolean;
  showRank: boolean;
  /** Google Apps Script web-app URL for Sheet sync; "" = not connected. */
  sheetSyncUrl: string;
  lastBackupAt: string | null;
  /** SHA-256 (salted) of the app PIN; "" = no PIN set. */
  pinHash?: string;
  pinSalt?: string;
  /** Lock the screen after this many idle minutes; 0 = never. */
  autoLockMinutes?: number;
};

export const DEFAULT_TUITION_SETTINGS: TuitionSettings = {
  id: "main",
  receiptPrefix: "RCPT-",
  nextReceiptNumber: 1,
  feeDueDay: 5,
  autoGenerateDues: true,
  paymentModes: [...DEFAULT_PAYMENT_MODES],
  templates: { ...DEFAULT_TEMPLATES },
  showClassAverage: true,
  showRank: false,
  sheetSyncUrl: "",
  lastBackupAt: null,
  pinHash: "",
  pinSalt: "",
  autoLockMinutes: 0,
};

export function formatReceiptNumber(prefix: string, n: number): string {
  return `${prefix}${String(n).padStart(4, "0")}`;
}

// ---------------------------------------------------------------------------
// Google Sheet sync slices
// ---------------------------------------------------------------------------

/**
 * Prefixed so tuition dirty-flags never collide with the POS's rows in the
 * shared `sync_queue` store.
 */
export type SyncSlice = "t_meta" | "t_students" | "t_attendance" | "t_fees" | "t_marks";

export const SYNC_SLICES: SyncSlice[] = [
  "t_meta",
  "t_students",
  "t_attendance",
  "t_fees",
  "t_marks",
];

export type SyncDirtyRow = { id: SyncSlice; dirtyAt: string };

// ---------------------------------------------------------------------------
// Date helpers (local time — a class at 6pm belongs to the local day)
// ---------------------------------------------------------------------------

export function todayIso(): string {
  return toDateKey(new Date());
}

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** "2026-08-11" → "2026-08" */
export function monthKey(dateKey: string): string {
  return dateKey.slice(0, 7);
}

export function currentMonthKey(): string {
  return monthKey(todayIso());
}

/** "2026-08" → "Aug 2026" */
export function formatMonth(period: string): string {
  if (!/^\d{4}-\d{2}$/.test(period)) return period;
  const [year, month] = period.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

/** "2026-08-11" → "11 Aug 2026" */
export function formatDate(dateKey: string): string {
  if (!dateKey) return "";
  const date = new Date(`${dateKey.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateKey;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** All month keys from `from` up to and including `to`, oldest first. */
export function monthsBetween(from: string, to: string): string[] {
  const months: string[] = [];
  if (!/^\d{4}-\d{2}/.test(from) || !/^\d{4}-\d{2}/.test(to)) return months;
  let [year, month] = from.slice(0, 7).split("-").map(Number);
  const [toYear, toMonth] = to.slice(0, 7).split("-").map(Number);
  let guard = 0;
  while ((year < toYear || (year === toYear && month <= toMonth)) && guard < 600) {
    months.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
    guard += 1;
  }
  return months;
}

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function describeDays(days: number[]): string {
  if (days.length === 0) return "No fixed days";
  if (days.length === 7) return "Daily";
  return [...days]
    .sort((a, b) => a - b)
    .map((d) => WEEKDAYS[d])
    .join(", ");
}

/** "18:00" → "6:00 PM" */
export function formatTime(value: string): string {
  if (!/^\d{2}:\d{2}$/.test(value)) return value;
  const [h, m] = value.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

/**
 * Digits-only phone with a country code, ready for wa.me. Indian 10-digit
 * numbers get 91 prefixed; anything already carrying a country code is kept.
 */
export function whatsAppNumber(phone: string, defaultCode = "91"): string {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `${defaultCode}${digits}`;
  if (digits.length > 10 && digits.startsWith("0")) return `${defaultCode}${digits.slice(-10)}`;
  return digits;
}
