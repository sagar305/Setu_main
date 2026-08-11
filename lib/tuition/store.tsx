"use client";

// Client-side store for the Tuition Class Manager.
//
// Everything lives in the shared workspace database (IndexedDB). The teacher's
// profile is the workspace `business` record, so a tutor who already used
// another Setu tool on this device lands straight in the app with their name,
// phone, logo and UPI ID already filled in.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { dbBatch, dbClearStores, dbGetAll, type StoreName } from "@/lib/pos/db";
import { generateId, nowIso, type Business } from "@/lib/pos/types";
import {
  buildTabPayloads,
  isValidSyncUrl,
  pullFromSheet,
  pushToSheet,
  settingsFromPull,
  testSheetConnection,
  type TuitionSnapshot,
} from "./sheetSync";
import {
  buildTuitionDue,
  missingDuePeriods,
  studentBalance,
  tuitionDueId,
} from "./calc";
import {
  createBackup,
  downloadBackupFile,
  restoreBackup,
  TUITION_STORES,
  type TuitionBackup,
} from "./backup";
import type { ParsedStudentRow } from "./csv";
import {
  attendanceId,
  currentMonthKey,
  DEFAULT_TUITION_SETTINGS,
  formatReceiptNumber,
  markId,
  monthKey,
  SYNC_SLICES,
  todayIso,
  type AttendanceRecord,
  type AttendanceStatus,
  type Batch,
  type Enquiry,
  type FeeDue,
  type FeeDueKind,
  type FeePayment,
  type Holiday,
  type MarkRecord,
  type Student,
  type StudentNote,
  type SyncDirtyRow,
  type SyncSlice,
  type TestRecord,
  type TuitionSettings,
} from "./types";

export type TuitionStatus = "loading" | "welcome" | "setup" | "ready" | "error";

export type BatchInput = Omit<Batch, "id" | "createdAt" | "updatedAt">;
export type StudentInput = Omit<Student, "id" | "createdAt" | "updatedAt">;
export type EnquiryInput = Omit<Enquiry, "id" | "createdAt" | "updatedAt">;

export type AttendanceEntry = { studentId: string; status: AttendanceStatus; note?: string };

export type PaymentInput = {
  studentId: string;
  amount: number;
  mode: string;
  date: string;
  appliedTo: string[];
  note: string;
};

export type ChargeInput = {
  studentId: string;
  kind: FeeDueKind;
  label: string;
  amount: number;
  dueDate: string;
};

export type MarkEntry = { studentId: string; marks: number | null; remark: string };

type TuitionContextValue = {
  status: TuitionStatus;
  errorMessage: string;
  business: Business | null;
  settings: TuitionSettings;
  batches: Batch[];
  students: Student[];
  attendance: AttendanceRecord[];
  dues: FeeDue[];
  payments: FeePayment[];
  tests: TestRecord[];
  marks: MarkRecord[];
  notes: StudentNote[];
  enquiries: Enquiry[];
  holidays: Holiday[];

  startSetup: () => void;
  backToWelcome: () => void;
  createBusiness: (profile: Omit<Business, "id" | "createdAt">) => Promise<void>;
  updateBusiness: (updates: Partial<Omit<Business, "id" | "createdAt">>) => Promise<void>;
  updateSettings: (updates: Partial<Omit<TuitionSettings, "id">>) => Promise<void>;

  createBatch: (input: BatchInput) => Promise<Batch>;
  updateBatch: (id: string, input: BatchInput) => Promise<void>;
  deleteBatch: (id: string) => Promise<void>;

  createStudent: (input: StudentInput) => Promise<Student>;
  updateStudent: (id: string, input: StudentInput) => Promise<void>;
  deleteStudent: (id: string) => Promise<void>;
  importStudents: (rows: ParsedStudentRow[]) => Promise<number>;

  saveAttendance: (
    date: string,
    batchId: string,
    entries: AttendanceEntry[]
  ) => Promise<void>;
  markAbsenceNotified: (recordIds: string[]) => Promise<void>;

  generateDues: (period?: string) => Promise<number>;
  addCharge: (input: ChargeInput) => Promise<void>;
  setDueWaived: (id: string, waived: boolean) => Promise<void>;
  deleteDue: (id: string) => Promise<void>;
  recordPayment: (input: PaymentInput) => Promise<FeePayment>;
  deletePayment: (id: string) => Promise<void>;

  createTest: (input: Omit<TestRecord, "id" | "createdAt">) => Promise<TestRecord>;
  updateTest: (id: string, input: Omit<TestRecord, "id" | "createdAt">) => Promise<void>;
  deleteTest: (id: string) => Promise<void>;
  saveMarks: (testId: string, entries: MarkEntry[]) => Promise<void>;
  markResultSent: (testId: string, studentIds: string[]) => Promise<void>;

  createNote: (input: Omit<StudentNote, "id" | "createdAt" | "sentAt">) => Promise<void>;
  toggleNote: (id: string) => Promise<void>;
  markNoteSent: (id: string) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;

  createEnquiry: (input: EnquiryInput) => Promise<void>;
  updateEnquiry: (id: string, input: EnquiryInput) => Promise<void>;
  deleteEnquiry: (id: string) => Promise<void>;

  addHoliday: (date: string, name: string) => Promise<void>;
  removeHoliday: (date: string) => Promise<void>;

  sheetSync: {
    url: string;
    dirtyCount: number;
    syncing: boolean;
    lastSyncAt: string | null;
    lastError: string;
  };
  connectSheet: (url: string) => Promise<void>;
  disconnectSheet: () => Promise<void>;
  syncSheetNow: () => Promise<void>;
  resyncSheetAll: () => Promise<void>;
  restoreFromSheet: (url: string) => Promise<void>;

  exportBackup: () => Promise<void>;
  applyRestoredBackup: (backup: TuitionBackup) => Promise<void>;
  resetAll: () => Promise<void>;
};

const TuitionContext = createContext<TuitionContextValue | null>(null);

const LAST_SYNC_KEY = "tuition_sheet_sync_last";

export function TuitionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<TuitionStatus>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [business, setBusiness] = useState<Business | null>(null);
  const [settings, setSettings] = useState<TuitionSettings>(DEFAULT_TUITION_SETTINGS);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [dues, setDues] = useState<FeeDue[]>([]);
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [tests, setTests] = useState<TestRecord[]>([]);
  const [marks, setMarks] = useState<MarkRecord[]>([]);
  const [notes, setNotes] = useState<StudentNote[]>([]);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [dirtySlices, setDirtySlices] = useState<SyncSlice[]>([]);
  const [sheetSyncing, setSheetSyncing] = useState(false);
  const [sheetLastSyncAt, setSheetLastSyncAt] = useState<string | null>(null);
  const [sheetLastError, setSheetLastError] = useState("");
  const flushingRef = useRef(false);
  const duesGeneratedRef = useRef(false);

  // Latest snapshot for the sync engine (avoids stale closures).
  const snapshotRef = useRef<TuitionSnapshot | null>(null);
  useEffect(() => {
    snapshotRef.current = {
      business,
      settings,
      batches,
      holidays,
      notes,
      enquiries,
      students,
      attendance,
      dues,
      payments,
      tests,
      marks,
    };
  });

  useEffect(() => {
    try {
      setSheetLastSyncAt(localStorage.getItem(LAST_SYNC_KEY));
    } catch {
      // Status display only.
    }
  }, []);

  const markDirtyState = useCallback((slices: SyncSlice[]) => {
    if (slices.length === 0) return;
    setDirtySlices((prev) => Array.from(new Set([...prev, ...slices])));
  }, []);

  /** Run a DB write and flag the given sync slices in the same transaction. */
  const batchWithSync = useCallback(
    async (
      writes: Partial<Record<StoreName, unknown[]>>,
      deletes: Partial<Record<StoreName, string[]>> = {},
      slices: SyncSlice[] = []
    ) => {
      const dirtyRows: SyncDirtyRow[] = slices.map((id) => ({ id, dirtyAt: nowIso() }));
      await dbBatch(slices.length ? { ...writes, sync_queue: dirtyRows } : writes, deletes);
      markDirtyState(slices);
    },
    [markDirtyState]
  );

  const loadAll = useCallback(async () => {
    const [
      businessRows,
      settingsRows,
      batchRows,
      studentRows,
      attendanceRows,
      dueRows,
      paymentRows,
      testRows,
      markRows,
      noteRows,
      enquiryRows,
      holidayRows,
      dirtyRows,
    ] = await Promise.all([
      dbGetAll<Business>("business"),
      dbGetAll<TuitionSettings>("tuition_settings"),
      dbGetAll<Batch>("batches"),
      dbGetAll<Student>("students"),
      dbGetAll<AttendanceRecord>("attendance"),
      dbGetAll<FeeDue>("fee_dues"),
      dbGetAll<FeePayment>("fee_payments"),
      dbGetAll<TestRecord>("tests"),
      dbGetAll<MarkRecord>("marks"),
      dbGetAll<StudentNote>("student_notes"),
      dbGetAll<Enquiry>("enquiries"),
      dbGetAll<Holiday>("holidays"),
      dbGetAll<SyncDirtyRow>("sync_queue"),
    ]);

    const loadedBusiness = businessRows.find((b) => b.id === "main") ?? null;
    setBusiness(loadedBusiness);
    setBatches(batchRows.sort((a, b) => a.startTime.localeCompare(b.startTime)));
    setStudents(studentRows.sort((a, b) => a.name.localeCompare(b.name)));
    setAttendance(attendanceRows);
    setDues(dueRows);
    setPayments(paymentRows.sort((a, b) => b.date.localeCompare(a.date)));
    setTests(testRows.sort((a, b) => b.date.localeCompare(a.date)));
    setMarks(markRows);
    setNotes(noteRows.sort((a, b) => a.date.localeCompare(b.date)));
    setEnquiries(enquiryRows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    setHolidays(holidayRows.sort((a, b) => a.date.localeCompare(b.date)));
    // Only tuition rows — the POS keeps its own flags in the same store.
    setDirtySlices(
      dirtyRows.filter((row) => SYNC_SLICES.includes(row.id)).map((row) => row.id)
    );

    // Merge with defaults so records written by older versions gain new fields.
    const stored = settingsRows.find((s) => s.id === "main");
    const loadedSettings: TuitionSettings = stored
      ? {
          ...DEFAULT_TUITION_SETTINGS,
          ...stored,
          templates: { ...DEFAULT_TUITION_SETTINGS.templates, ...stored.templates },
        }
      : DEFAULT_TUITION_SETTINGS;
    setSettings(loadedSettings);

    return { business: loadedBusiness, settings: loadedSettings, hasSetup: Boolean(stored) };
  }, []);

  useEffect(() => {
    let active = true;
    loadAll()
      .then((loaded) => {
        if (!active) return;
        // A teacher who already used another Setu tool has a business profile
        // — they go straight in, we never ask for it twice.
        setStatus(loaded.business ? "ready" : "welcome");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Could not open local storage. Please use a modern browser outside private mode."
        );
        setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [loadAll]);

  const startSetup = useCallback(() => setStatus("setup"), []);
  const backToWelcome = useCallback(() => setStatus("welcome"), []);

  // ---- Profile & settings --------------------------------------------------

  const persistSettings = useCallback(
    async (next: TuitionSettings) => {
      await batchWithSync({ tuition_settings: [next] }, {}, ["t_meta"]);
      setSettings(next);
    },
    [batchWithSync]
  );

  const updateSettings = useCallback(
    async (updates: Partial<Omit<TuitionSettings, "id">>) => {
      await persistSettings({ ...settings, ...updates, id: "main" });
    },
    [persistSettings, settings]
  );

  const createBusiness = useCallback(
    async (profile: Omit<Business, "id" | "createdAt">) => {
      const newBusiness: Business = { ...profile, id: "main", createdAt: nowIso() };
      const newSettings: TuitionSettings = { ...DEFAULT_TUITION_SETTINGS };
      await batchWithSync(
        { business: [newBusiness], tuition_settings: [newSettings] },
        {},
        ["t_meta"]
      );
      setBusiness(newBusiness);
      setSettings(newSettings);
      setStatus("ready");
    },
    [batchWithSync]
  );

  const updateBusiness = useCallback(
    async (updates: Partial<Omit<Business, "id" | "createdAt">>) => {
      if (!business) return;
      const next: Business = { ...business, ...updates };
      await batchWithSync({ business: [next] }, {}, ["t_meta"]);
      setBusiness(next);
    },
    [business, batchWithSync]
  );

  // ---- Batches -------------------------------------------------------------

  const createBatch = useCallback(
    async (input: BatchInput) => {
      const batch: Batch = { ...input, id: generateId(), createdAt: nowIso(), updatedAt: nowIso() };
      await batchWithSync({ batches: [batch] }, {}, ["t_meta"]);
      setBatches((prev) => [...prev, batch].sort((a, b) => a.startTime.localeCompare(b.startTime)));
      return batch;
    },
    [batchWithSync]
  );

  const updateBatch = useCallback(
    async (id: string, input: BatchInput) => {
      const existing = batches.find((b) => b.id === id);
      if (!existing) return;
      const next: Batch = { ...existing, ...input, updatedAt: nowIso() };
      await batchWithSync({ batches: [next] }, {}, ["t_meta"]);
      setBatches((prev) =>
        prev.map((b) => (b.id === id ? next : b)).sort((a, b) => a.startTime.localeCompare(b.startTime))
      );
    },
    [batches, batchWithSync]
  );

  /** Removing a batch un-enrols its students; their history is kept. */
  const deleteBatch = useCallback(
    async (id: string) => {
      const affected = students
        .filter((s) => s.batchIds.includes(id))
        .map((s) => ({ ...s, batchIds: s.batchIds.filter((b) => b !== id), updatedAt: nowIso() }));
      await batchWithSync({ students: affected }, { batches: [id] }, ["t_meta", "t_students"]);
      setBatches((prev) => prev.filter((b) => b.id !== id));
      if (affected.length) {
        setStudents((prev) =>
          prev.map((s) => affected.find((a) => a.id === s.id) ?? s)
        );
      }
    },
    [students, batchWithSync]
  );

  // ---- Students ------------------------------------------------------------

  const createStudent = useCallback(
    async (input: StudentInput) => {
      const student: Student = {
        ...input,
        id: generateId(),
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      await batchWithSync({ students: [student] }, {}, ["t_students"]);
      setStudents((prev) => [...prev, student].sort((a, b) => a.name.localeCompare(b.name)));
      return student;
    },
    [batchWithSync]
  );

  const updateStudent = useCallback(
    async (id: string, input: StudentInput) => {
      const existing = students.find((s) => s.id === id);
      if (!existing) return;
      const next: Student = { ...existing, ...input, updatedAt: nowIso() };
      await batchWithSync({ students: [next] }, {}, ["t_students"]);
      setStudents((prev) =>
        prev.map((s) => (s.id === id ? next : s)).sort((a, b) => a.name.localeCompare(b.name))
      );
    },
    [students, batchWithSync]
  );

  /** Deleting a student removes their attendance, fees, marks and notes too. */
  const deleteStudent = useCallback(
    async (id: string) => {
      const attendanceIds = attendance.filter((a) => a.studentId === id).map((a) => a.id);
      const dueIds = dues.filter((d) => d.studentId === id).map((d) => d.id);
      const paymentIds = payments.filter((p) => p.studentId === id).map((p) => p.id);
      const markIds = marks.filter((m) => m.studentId === id).map((m) => m.id);
      const noteIds = notes.filter((n) => n.studentId === id).map((n) => n.id);

      await batchWithSync(
        {},
        {
          students: [id],
          attendance: attendanceIds,
          fee_dues: dueIds,
          fee_payments: paymentIds,
          marks: markIds,
          student_notes: noteIds,
        },
        ["t_students", "t_attendance", "t_fees", "t_marks", "t_meta"]
      );

      setStudents((prev) => prev.filter((s) => s.id !== id));
      setAttendance((prev) => prev.filter((a) => a.studentId !== id));
      setDues((prev) => prev.filter((d) => d.studentId !== id));
      setPayments((prev) => prev.filter((p) => p.studentId !== id));
      setMarks((prev) => prev.filter((m) => m.studentId !== id));
      setNotes((prev) => prev.filter((n) => n.studentId !== id));
    },
    [attendance, dues, payments, marks, notes, batchWithSync]
  );

  const importStudents = useCallback(
    async (rows: ParsedStudentRow[]) => {
      if (rows.length === 0) return 0;
      const today = todayIso();
      const created: Student[] = rows.map((row) => ({
        id: generateId(),
        name: row.name,
        rollNo: row.rollNo,
        classLevel: row.classLevel,
        school: row.school,
        batchIds: row.batchIds,
        parentName: row.parentName,
        parentPhone: row.parentPhone,
        altPhone: row.altPhone,
        studentPhone: "",
        email: "",
        address: "",
        dob: "",
        joinDate: row.joinDate || today,
        concessionType: "flat",
        concessionValue: 0,
        customMonthlyFee: row.customMonthlyFee,
        status: "active",
        notes: "",
        createdAt: nowIso(),
        updatedAt: nowIso(),
      }));
      await batchWithSync({ students: created }, {}, ["t_students"]);
      setStudents((prev) => [...prev, ...created].sort((a, b) => a.name.localeCompare(b.name)));
      return created.length;
    },
    [batchWithSync]
  );

  // ---- Attendance ----------------------------------------------------------

  const saveAttendance = useCallback(
    async (date: string, batchId: string, entries: AttendanceEntry[]) => {
      if (entries.length === 0) return;
      const now = nowIso();
      const records: AttendanceRecord[] = entries.map((entry) => {
        const id = attendanceId(date, batchId, entry.studentId);
        const existing = attendance.find((a) => a.id === id);
        return {
          id,
          date,
          batchId,
          studentId: entry.studentId,
          status: entry.status,
          note: entry.note ?? existing?.note ?? "",
          // Changing a mark away from "absent" clears the notified flag.
          notifiedAt: entry.status === "absent" ? existing?.notifiedAt ?? null : null,
          markedAt: now,
        };
      });
      await batchWithSync({ attendance: records }, {}, ["t_attendance"]);
      setAttendance((prev) => {
        const byId = new Map(prev.map((a) => [a.id, a]));
        for (const record of records) byId.set(record.id, record);
        return [...byId.values()];
      });
    },
    [attendance, batchWithSync]
  );

  const markAbsenceNotified = useCallback(
    async (recordIds: string[]) => {
      if (recordIds.length === 0) return;
      const now = nowIso();
      const updated = attendance
        .filter((a) => recordIds.includes(a.id))
        .map((a) => ({ ...a, notifiedAt: now }));
      if (updated.length === 0) return;
      await batchWithSync({ attendance: updated }, {}, ["t_attendance"]);
      setAttendance((prev) => prev.map((a) => updated.find((u) => u.id === a.id) ?? a));
    },
    [attendance, batchWithSync]
  );

  // ---- Fees ----------------------------------------------------------------

  const generateDues = useCallback(
    async (period?: string) => {
      const target = period ?? currentMonthKey();
      const now = nowIso();
      const created: FeeDue[] = [];
      for (const student of students) {
        if (student.status !== "active") continue;
        for (const missing of missingDuePeriods(student, dues, target)) {
          created.push(
            buildTuitionDue(student, batches, missing, settings.feeDueDay, now)
          );
        }
      }
      if (created.length === 0) return 0;
      await batchWithSync({ fee_dues: created }, {}, ["t_fees"]);
      setDues((prev) => [...prev, ...created]);
      return created.length;
    },
    [students, dues, batches, settings.feeDueDay, batchWithSync]
  );

  // Generate the current month's dues once per session when switched on.
  useEffect(() => {
    if (status !== "ready" || !settings.autoGenerateDues || duesGeneratedRef.current) return;
    if (students.length === 0) return;
    duesGeneratedRef.current = true;
    void generateDues();
  }, [status, settings.autoGenerateDues, students.length, generateDues]);

  const addCharge = useCallback(
    async (input: ChargeInput) => {
      const due: FeeDue = {
        id: generateId(),
        studentId: input.studentId,
        period: "",
        kind: input.kind,
        label: input.label,
        amount: input.amount,
        breakdown: [],
        concession: 0,
        dueDate: input.dueDate,
        waived: false,
        createdAt: nowIso(),
      };
      await batchWithSync({ fee_dues: [due] }, {}, ["t_fees"]);
      setDues((prev) => [...prev, due]);
    },
    [batchWithSync]
  );

  const setDueWaived = useCallback(
    async (id: string, waived: boolean) => {
      const existing = dues.find((d) => d.id === id);
      if (!existing) return;
      const next = { ...existing, waived };
      await batchWithSync({ fee_dues: [next] }, {}, ["t_fees"]);
      setDues((prev) => prev.map((d) => (d.id === id ? next : d)));
    },
    [dues, batchWithSync]
  );

  const deleteDue = useCallback(
    async (id: string) => {
      await batchWithSync({}, { fee_dues: [id] }, ["t_fees"]);
      setDues((prev) => prev.filter((d) => d.id !== id));
    },
    [batchWithSync]
  );

  const recordPayment = useCallback(
    async (input: PaymentInput) => {
      const student = students.find((s) => s.id === input.studentId);
      const receiptNumber = formatReceiptNumber(
        settings.receiptPrefix,
        settings.nextReceiptNumber
      );
      const payment: FeePayment = {
        id: generateId(),
        receiptNumber,
        studentId: input.studentId,
        studentName: student?.name ?? "",
        date: input.date,
        amount: input.amount,
        mode: input.mode,
        appliedTo: input.appliedTo,
        note: input.note,
        createdAt: nowIso(),
      };
      const nextSettings: TuitionSettings = {
        ...settings,
        nextReceiptNumber: settings.nextReceiptNumber + 1,
      };
      await batchWithSync(
        { fee_payments: [payment], tuition_settings: [nextSettings] },
        {},
        ["t_fees", "t_meta"]
      );
      setPayments((prev) => [payment, ...prev]);
      setSettings(nextSettings);
      return payment;
    },
    [students, settings, batchWithSync]
  );

  const deletePayment = useCallback(
    async (id: string) => {
      await batchWithSync({}, { fee_payments: [id] }, ["t_fees"]);
      setPayments((prev) => prev.filter((p) => p.id !== id));
    },
    [batchWithSync]
  );

  // ---- Tests & marks -------------------------------------------------------

  const createTest = useCallback(
    async (input: Omit<TestRecord, "id" | "createdAt">) => {
      const test: TestRecord = { ...input, id: generateId(), createdAt: nowIso() };
      await batchWithSync({ tests: [test] }, {}, ["t_marks"]);
      setTests((prev) => [test, ...prev].sort((a, b) => b.date.localeCompare(a.date)));
      return test;
    },
    [batchWithSync]
  );

  const updateTest = useCallback(
    async (id: string, input: Omit<TestRecord, "id" | "createdAt">) => {
      const existing = tests.find((t) => t.id === id);
      if (!existing) return;
      const next: TestRecord = { ...existing, ...input };
      await batchWithSync({ tests: [next] }, {}, ["t_marks"]);
      setTests((prev) =>
        prev.map((t) => (t.id === id ? next : t)).sort((a, b) => b.date.localeCompare(a.date))
      );
    },
    [tests, batchWithSync]
  );

  const deleteTest = useCallback(
    async (id: string) => {
      const markIds = marks.filter((m) => m.testId === id).map((m) => m.id);
      await batchWithSync({}, { tests: [id], marks: markIds }, ["t_marks"]);
      setTests((prev) => prev.filter((t) => t.id !== id));
      setMarks((prev) => prev.filter((m) => m.testId !== id));
    },
    [marks, batchWithSync]
  );

  const saveMarks = useCallback(
    async (testId: string, entries: MarkEntry[]) => {
      const now = nowIso();
      const records: MarkRecord[] = entries.map((entry) => {
        const id = markId(testId, entry.studentId);
        const existing = marks.find((m) => m.id === id);
        return {
          id,
          testId,
          studentId: entry.studentId,
          marks: entry.marks,
          remark: entry.remark,
          sentAt: existing?.sentAt ?? null,
          updatedAt: now,
        };
      });
      await batchWithSync({ marks: records }, {}, ["t_marks"]);
      setMarks((prev) => {
        const byId = new Map(prev.map((m) => [m.id, m]));
        for (const record of records) byId.set(record.id, record);
        return [...byId.values()];
      });
    },
    [marks, batchWithSync]
  );

  const markResultSent = useCallback(
    async (testId: string, studentIds: string[]) => {
      const now = nowIso();
      const ids = studentIds.map((studentId) => markId(testId, studentId));
      const updated = marks.filter((m) => ids.includes(m.id)).map((m) => ({ ...m, sentAt: now }));
      if (updated.length === 0) return;
      await batchWithSync({ marks: updated }, {}, ["t_marks"]);
      setMarks((prev) => prev.map((m) => updated.find((u) => u.id === m.id) ?? m));
    },
    [marks, batchWithSync]
  );

  // ---- Diary notes ---------------------------------------------------------

  const createNote = useCallback(
    async (input: Omit<StudentNote, "id" | "createdAt" | "sentAt">) => {
      const note: StudentNote = { ...input, id: generateId(), sentAt: null, createdAt: nowIso() };
      await batchWithSync({ student_notes: [note] }, {}, ["t_meta"]);
      setNotes((prev) => [...prev, note].sort((a, b) => a.date.localeCompare(b.date)));
    },
    [batchWithSync]
  );

  const toggleNote = useCallback(
    async (id: string) => {
      const existing = notes.find((n) => n.id === id);
      if (!existing) return;
      const next = { ...existing, done: !existing.done };
      await batchWithSync({ student_notes: [next] }, {}, ["t_meta"]);
      setNotes((prev) => prev.map((n) => (n.id === id ? next : n)));
    },
    [notes, batchWithSync]
  );

  const markNoteSent = useCallback(
    async (id: string) => {
      const existing = notes.find((n) => n.id === id);
      if (!existing) return;
      const next = { ...existing, sentAt: nowIso() };
      await batchWithSync({ student_notes: [next] }, {}, ["t_meta"]);
      setNotes((prev) => prev.map((n) => (n.id === id ? next : n)));
    },
    [notes, batchWithSync]
  );

  const deleteNote = useCallback(
    async (id: string) => {
      await batchWithSync({}, { student_notes: [id] }, ["t_meta"]);
      setNotes((prev) => prev.filter((n) => n.id !== id));
    },
    [batchWithSync]
  );

  // ---- Enquiries -----------------------------------------------------------

  const createEnquiry = useCallback(
    async (input: EnquiryInput) => {
      const enquiry: Enquiry = {
        ...input,
        id: generateId(),
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      await batchWithSync({ enquiries: [enquiry] }, {}, ["t_meta"]);
      setEnquiries((prev) => [enquiry, ...prev]);
    },
    [batchWithSync]
  );

  const updateEnquiry = useCallback(
    async (id: string, input: EnquiryInput) => {
      const existing = enquiries.find((e) => e.id === id);
      if (!existing) return;
      const next: Enquiry = { ...existing, ...input, updatedAt: nowIso() };
      await batchWithSync({ enquiries: [next] }, {}, ["t_meta"]);
      setEnquiries((prev) => prev.map((e) => (e.id === id ? next : e)));
    },
    [enquiries, batchWithSync]
  );

  const deleteEnquiry = useCallback(
    async (id: string) => {
      await batchWithSync({}, { enquiries: [id] }, ["t_meta"]);
      setEnquiries((prev) => prev.filter((e) => e.id !== id));
    },
    [batchWithSync]
  );

  // ---- Holidays ------------------------------------------------------------

  const addHoliday = useCallback(
    async (date: string, name: string) => {
      const holiday: Holiday = { id: date, date, name, createdAt: nowIso() };
      await batchWithSync({ holidays: [holiday] }, {}, ["t_meta"]);
      setHolidays((prev) =>
        [...prev.filter((h) => h.id !== date), holiday].sort((a, b) => a.date.localeCompare(b.date))
      );
    },
    [batchWithSync]
  );

  const removeHoliday = useCallback(
    async (date: string) => {
      await batchWithSync({}, { holidays: [date] }, ["t_meta"]);
      setHolidays((prev) => prev.filter((h) => h.id !== date));
    },
    [batchWithSync]
  );

  // ---- Google Sheet sync ---------------------------------------------------

  const runSheetFlush = useCallback(async () => {
    const snapshot = snapshotRef.current;
    const url = snapshot?.settings.sheetSyncUrl;
    if (!snapshot || !url || flushingRef.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    const queued = (await dbGetAll<SyncDirtyRow>("sync_queue")).filter((row) =>
      SYNC_SLICES.includes(row.id)
    );
    if (queued.length === 0) return;

    flushingRef.current = true;
    setSheetSyncing(true);
    try {
      const tabs = buildTabPayloads(
        queued.map((row) => row.id),
        snapshot
      );
      await pushToSheet(url, tabs);

      // Only clear flags that weren't re-dirtied while the push was in flight.
      const current = await dbGetAll<SyncDirtyRow>("sync_queue");
      const clearable = queued
        .filter((row) => current.some((c) => c.id === row.id && c.dirtyAt === row.dirtyAt))
        .map((row) => row.id);
      if (clearable.length) {
        await dbBatch({}, { sync_queue: clearable });
      }
      const remaining = (await dbGetAll<SyncDirtyRow>("sync_queue")).filter((row) =>
        SYNC_SLICES.includes(row.id)
      );
      setDirtySlices(remaining.map((row) => row.id));

      const now = nowIso();
      setSheetLastSyncAt(now);
      setSheetLastError("");
      try {
        localStorage.setItem(LAST_SYNC_KEY, now);
      } catch {
        // Status display only.
      }
    } catch (error) {
      setSheetLastError(
        error instanceof Error ? error.message : "Could not sync to the sheet."
      );
    } finally {
      flushingRef.current = false;
      setSheetSyncing(false);
    }
  }, []);

  // Debounced auto-flush whenever something is dirty and a sheet is connected.
  useEffect(() => {
    if (status !== "ready" || !settings.sheetSyncUrl || dirtySlices.length === 0) return;
    const timer = setTimeout(() => {
      void runSheetFlush();
    }, 1500);
    return () => clearTimeout(timer);
  }, [status, settings.sheetSyncUrl, dirtySlices, runSheetFlush]);

  // Coming back online flushes anything queued while offline.
  useEffect(() => {
    const onOnline = () => {
      void runSheetFlush();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [runSheetFlush]);

  const connectSheet = useCallback(
    async (url: string) => {
      const trimmed = url.trim();
      if (!isValidSyncUrl(trimmed)) {
        throw new Error("Paste the full https:// web app URL from Apps Script.");
      }
      const test = await testSheetConnection(trimmed);
      if (!test.ok) {
        throw new Error(test.error || "Could not connect to the script.");
      }
      await updateSettings({ sheetSyncUrl: trimmed });
      // The first sync sends everything.
      await batchWithSync({}, {}, SYNC_SLICES);
    },
    [updateSettings, batchWithSync]
  );

  const disconnectSheet = useCallback(async () => {
    await updateSettings({ sheetSyncUrl: "" });
    setSheetLastError("");
  }, [updateSettings]);

  const syncSheetNow = useCallback(async () => {
    await runSheetFlush();
  }, [runSheetFlush]);

  const resyncSheetAll = useCallback(async () => {
    await batchWithSync({}, {}, SYNC_SLICES);
    await runSheetFlush();
  }, [batchWithSync, runSheetFlush]);

  const restoreFromSheet = useCallback(
    async (url: string) => {
      const trimmed = url.trim();
      if (!isValidSyncUrl(trimmed)) {
        throw new Error("Paste the full https:// web app URL from Apps Script.");
      }
      const pull = await pullFromSheet(trimmed);
      if (pull.students.length === 0 && !pull.meta.business) {
        throw new Error(
          "This sheet has no tuition data yet. Connect the app to it and sync at least once first."
        );
      }
      const backup: TuitionBackup = {
        app: "setu-tuition",
        version: 1,
        exportedAt: nowIso(),
        data: {
          business: pull.meta.business ? [pull.meta.business] : [],
          tuition_settings: [settingsFromPull(pull, trimmed)],
          batches: pull.meta.batches ?? [],
          holidays: pull.meta.holidays ?? [],
          student_notes: pull.meta.notes ?? [],
          enquiries: pull.meta.enquiries ?? [],
          students: pull.students,
          attendance: pull.attendance,
          fee_dues: pull.dues,
          fee_payments: pull.payments,
          tests: pull.tests,
          marks: pull.marks,
        },
      };
      await restoreBackup(backup);
      const loaded = await loadAll();
      duesGeneratedRef.current = false;
      setStatus(loaded.business ? "ready" : "welcome");
    },
    [loadAll]
  );

  // ---- Backup --------------------------------------------------------------

  const exportBackup = useCallback(async () => {
    const backup = await createBackup();
    downloadBackupFile(backup);
    await updateSettings({ lastBackupAt: nowIso() });
  }, [updateSettings]);

  const applyRestoredBackup = useCallback(
    async (backup: TuitionBackup) => {
      await restoreBackup(backup);
      // The restored data is the new truth — push all of it on the next flush.
      await dbBatch({
        sync_queue: SYNC_SLICES.map((id) => ({ id, dirtyAt: nowIso() })),
      });
      const loaded = await loadAll();
      duesGeneratedRef.current = false;
      setStatus(loaded.business ? "ready" : "welcome");
    },
    [loadAll]
  );

  /** Wipes tuition data only — a POS or invoice history in the same browser
   *  is left completely untouched. */
  const resetAll = useCallback(async () => {
    await dbClearStores(TUITION_STORES.filter((store) => store !== "business"));
    setStudents([]);
    setBatches([]);
    setAttendance([]);
    setDues([]);
    setPayments([]);
    setTests([]);
    setMarks([]);
    setNotes([]);
    setEnquiries([]);
    setHolidays([]);
    setDirtySlices([]);
    setSheetLastError("");
    setSettings(DEFAULT_TUITION_SETTINGS);
    duesGeneratedRef.current = false;
    setStatus(business ? "ready" : "welcome");
  }, [business]);

  const sheetSync = useMemo(
    () => ({
      url: settings.sheetSyncUrl,
      dirtyCount: dirtySlices.length,
      syncing: sheetSyncing,
      lastSyncAt: sheetLastSyncAt,
      lastError: sheetLastError,
    }),
    [settings.sheetSyncUrl, dirtySlices, sheetSyncing, sheetLastSyncAt, sheetLastError]
  );

  const value = useMemo<TuitionContextValue>(
    () => ({
      status,
      errorMessage,
      business,
      settings,
      batches,
      students,
      attendance,
      dues,
      payments,
      tests,
      marks,
      notes,
      enquiries,
      holidays,
      startSetup,
      backToWelcome,
      createBusiness,
      updateBusiness,
      updateSettings,
      createBatch,
      updateBatch,
      deleteBatch,
      createStudent,
      updateStudent,
      deleteStudent,
      importStudents,
      saveAttendance,
      markAbsenceNotified,
      generateDues,
      addCharge,
      setDueWaived,
      deleteDue,
      recordPayment,
      deletePayment,
      createTest,
      updateTest,
      deleteTest,
      saveMarks,
      markResultSent,
      createNote,
      toggleNote,
      markNoteSent,
      deleteNote,
      createEnquiry,
      updateEnquiry,
      deleteEnquiry,
      addHoliday,
      removeHoliday,
      sheetSync,
      connectSheet,
      disconnectSheet,
      syncSheetNow,
      resyncSheetAll,
      restoreFromSheet,
      exportBackup,
      applyRestoredBackup,
      resetAll,
    }),
    [
      status,
      errorMessage,
      business,
      settings,
      batches,
      students,
      attendance,
      dues,
      payments,
      tests,
      marks,
      notes,
      enquiries,
      holidays,
      startSetup,
      backToWelcome,
      createBusiness,
      updateBusiness,
      updateSettings,
      createBatch,
      updateBatch,
      deleteBatch,
      createStudent,
      updateStudent,
      deleteStudent,
      importStudents,
      saveAttendance,
      markAbsenceNotified,
      generateDues,
      addCharge,
      setDueWaived,
      deleteDue,
      recordPayment,
      deletePayment,
      createTest,
      updateTest,
      deleteTest,
      saveMarks,
      markResultSent,
      createNote,
      toggleNote,
      markNoteSent,
      deleteNote,
      createEnquiry,
      updateEnquiry,
      deleteEnquiry,
      addHoliday,
      removeHoliday,
      sheetSync,
      connectSheet,
      disconnectSheet,
      syncSheetNow,
      resyncSheetAll,
      restoreFromSheet,
      exportBackup,
      applyRestoredBackup,
      resetAll,
    ]
  );

  return <TuitionContext.Provider value={value}>{children}</TuitionContext.Provider>;
}

export function useTuition(): TuitionContextValue {
  const context = useContext(TuitionContext);
  if (!context) {
    throw new Error("useTuition must be used inside a TuitionProvider.");
  }
  return context;
}

/** Convenience: outstanding balance for one student. */
export function useStudentBalance(studentId: string) {
  const { dues, payments } = useTuition();
  return useMemo(() => studentBalance(studentId, dues, payments), [studentId, dues, payments]);
}

export { tuitionDueId, monthKey };
