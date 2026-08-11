// Google Sheet sync for the Tuition Class Manager.
//
// Same protocol as the POS sync (lib/pos/sheetSync.ts): the teacher pastes
// APPS_SCRIPT_TEMPLATE into their own Google Sheet (Extensions → Apps Script)
// and deploys it as a web app. The app then pushes full snapshots of changed
// slices to that URL and can pull everything back onto a new device.
//
// Each tab carries readable columns plus a final "_json" column holding the
// exact record — pushes rewrite whole tabs (idempotent, delete-safe) and
// restore reads only the _json column (lossless round trip).

import type { Business } from "@/lib/pos/types";
import type {
  AttendanceRecord,
  Batch,
  Enquiry,
  FeeDue,
  FeePayment,
  Holiday,
  MarkRecord,
  Student,
  StudentNote,
  TestRecord,
  TuitionSettings,
} from "./types";
import { ATTENDANCE_LABELS, DEFAULT_TUITION_SETTINGS } from "./types";

export type MetaSnapshot = {
  business: Business | null;
  settings: TuitionSettings;
  batches: Batch[];
  holidays: Holiday[];
  notes: StudentNote[];
  enquiries: Enquiry[];
};

export type TuitionSnapshot = MetaSnapshot & {
  students: Student[];
  attendance: AttendanceRecord[];
  dues: FeeDue[];
  payments: FeePayment[];
  tests: TestRecord[];
  marks: MarkRecord[];
};

type TabPayload = { tab: string; headers: string[]; rows: (string | number | boolean)[][] };

export const SHEET_TABS = {
  meta: "Meta",
  students: "Students",
  attendance: "Attendance",
  dues: "Fee Dues",
  payments: "Fee Payments",
  tests: "Tests",
  marks: "Marks",
} as const;

export const SHEET_TAB_NAMES = Object.values(SHEET_TABS);

function metaTab(meta: MetaSnapshot): TabPayload {
  return {
    tab: SHEET_TABS.meta,
    headers: ["Key", "Value"],
    rows: [
      ["business", JSON.stringify(meta.business)],
      ["settings", JSON.stringify(meta.settings)],
      ["batches", JSON.stringify(meta.batches)],
      ["holidays", JSON.stringify(meta.holidays)],
      ["notes", JSON.stringify(meta.notes)],
      ["enquiries", JSON.stringify(meta.enquiries)],
      ["updatedAt", new Date().toISOString()],
    ],
  };
}

function studentsTab(students: Student[], batches: Batch[]): TabPayload {
  const batchNames = (ids: string[]) =>
    ids
      .map((id) => batches.find((b) => b.id === id)?.name ?? "")
      .filter(Boolean)
      .join(", ");
  return {
    tab: SHEET_TABS.students,
    headers: [
      "Name",
      "Roll No",
      "Class",
      "Batches",
      "Parent",
      "Parent Phone",
      "Join Date",
      "Status",
      "_json",
    ],
    rows: students.map((s) => [
      s.name,
      s.rollNo,
      s.classLevel,
      batchNames(s.batchIds),
      s.parentName,
      s.parentPhone,
      s.joinDate,
      s.status,
      JSON.stringify(s),
    ]),
  };
}

function attendanceTab(records: AttendanceRecord[], students: Student[], batches: Batch[]): TabPayload {
  const studentName = (id: string) => students.find((s) => s.id === id)?.name ?? "";
  const batchName = (id: string) => batches.find((b) => b.id === id)?.name ?? "";
  return {
    tab: SHEET_TABS.attendance,
    headers: ["Date", "Student", "Batch", "Status", "Note", "_json"],
    rows: records.map((r) => [
      r.date,
      studentName(r.studentId),
      batchName(r.batchId),
      ATTENDANCE_LABELS[r.status],
      r.note,
      JSON.stringify(r),
    ]),
  };
}

function duesTab(dues: FeeDue[], students: Student[]): TabPayload {
  const studentName = (id: string) => students.find((s) => s.id === id)?.name ?? "";
  return {
    tab: SHEET_TABS.dues,
    headers: ["Student", "Period", "Type", "Label", "Amount", "Due Date", "Waived", "_json"],
    rows: dues.map((d) => [
      studentName(d.studentId),
      d.period,
      d.kind,
      d.label,
      d.amount,
      d.dueDate,
      d.waived,
      JSON.stringify(d),
    ]),
  };
}

function paymentsTab(payments: FeePayment[]): TabPayload {
  return {
    tab: SHEET_TABS.payments,
    headers: ["Receipt", "Date", "Student", "Amount", "Mode", "Towards", "Note", "_json"],
    rows: payments.map((p) => [
      p.receiptNumber,
      p.date,
      p.studentName,
      p.amount,
      p.mode,
      p.appliedTo.join(", "),
      p.note,
      JSON.stringify(p),
    ]),
  };
}

function testsTab(tests: TestRecord[], batches: Batch[]): TabPayload {
  const batchName = (id: string) => batches.find((b) => b.id === id)?.name ?? "";
  return {
    tab: SHEET_TABS.tests,
    headers: ["Date", "Test", "Subject", "Batch", "Max Marks", "_json"],
    rows: tests.map((t) => [
      t.date,
      t.name,
      t.subject,
      batchName(t.batchId),
      t.maxMarks,
      JSON.stringify(t),
    ]),
  };
}

function marksTab(marks: MarkRecord[], tests: TestRecord[], students: Student[]): TabPayload {
  const test = (id: string) => tests.find((t) => t.id === id);
  const studentName = (id: string) => students.find((s) => s.id === id)?.name ?? "";
  return {
    tab: SHEET_TABS.marks,
    headers: ["Test", "Date", "Student", "Marks", "Max Marks", "Remark", "_json"],
    rows: marks.map((m) => {
      const parent = test(m.testId);
      return [
        parent?.name ?? "",
        parent?.date ?? "",
        studentName(m.studentId),
        m.marks === null ? "Absent" : m.marks,
        parent?.maxMarks ?? "",
        m.remark,
        JSON.stringify(m),
      ];
    }),
  };
}

export function buildTabPayloads(slices: string[], snapshot: TuitionSnapshot): TabPayload[] {
  const tabs: TabPayload[] = [];
  if (slices.includes("t_meta")) tabs.push(metaTab(snapshot));
  if (slices.includes("t_students")) tabs.push(studentsTab(snapshot.students, snapshot.batches));
  if (slices.includes("t_attendance")) {
    tabs.push(attendanceTab(snapshot.attendance, snapshot.students, snapshot.batches));
  }
  if (slices.includes("t_fees")) {
    tabs.push(duesTab(snapshot.dues, snapshot.students));
    tabs.push(paymentsTab(snapshot.payments));
  }
  if (slices.includes("t_marks")) {
    tabs.push(testsTab(snapshot.tests, snapshot.batches));
    tabs.push(marksTab(snapshot.marks, snapshot.tests, snapshot.students));
  }
  return tabs;
}

/**
 * Accept the Apps Script https URL, plus http://localhost for advanced users
 * pointing at a local proxy (and for testing).
 */
export function isValidSyncUrl(url: string): boolean {
  const trimmed = url.trim();
  return (
    /^https:\/\//.test(trimmed) ||
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(trimmed)
  );
}

async function postToScript(url: string, payload: unknown): Promise<unknown> {
  // text/plain keeps this a "simple" request (no CORS preflight, which Apps
  // Script cannot answer). Deployed with access "Anyone", the response carries
  // Access-Control-Allow-Origin: * and is readable.
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
    redirect: "follow",
  });
  try {
    return await response.json();
  } catch {
    return { ok: response.ok };
  }
}

export async function testSheetConnection(url: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const result = (await postToScript(url, { action: "test", app: "setu-tuition" })) as {
      ok?: boolean;
      error?: string;
    };
    if (result && result.ok === false) {
      return { ok: false, error: result.error || "The script reported an error." };
    }
    return { ok: true };
  } catch {
    return {
      ok: false,
      error:
        "Could not reach the script. Check the URL, and make sure the deployment's access is set to \"Anyone\".",
    };
  }
}

export async function pushToSheet(url: string, tabs: TabPayload[]): Promise<void> {
  const result = (await postToScript(url, { action: "push", app: "setu-tuition", tabs })) as {
    ok?: boolean;
    error?: string;
  };
  if (result && result.ok === false) {
    throw new Error(result.error || "The sheet script rejected the update.");
  }
}

export type SheetPullResult = {
  meta: Partial<MetaSnapshot>;
  students: Student[];
  attendance: AttendanceRecord[];
  dues: FeeDue[];
  payments: FeePayment[];
  tests: TestRecord[];
  marks: MarkRecord[];
};

function parseJsonColumn<T>(rows: unknown[][]): T[] {
  if (!Array.isArray(rows) || rows.length < 2) return [];
  const headers = rows[0] as string[];
  const jsonIndex = headers.indexOf("_json");
  if (jsonIndex === -1) return [];
  const records: T[] = [];
  for (const row of rows.slice(1)) {
    const cell = row[jsonIndex];
    if (typeof cell !== "string" || !cell) continue;
    try {
      records.push(JSON.parse(cell) as T);
    } catch {
      // Skip corrupted rows instead of failing the whole restore.
    }
  }
  return records;
}

export async function pullFromSheet(url: string): Promise<SheetPullResult> {
  const separator = url.includes("?") ? "&" : "?";
  const response = await fetch(`${url}${separator}action=pull`, { redirect: "follow" });
  const body = (await response.json()) as {
    ok?: boolean;
    error?: string;
    tabs?: Record<string, unknown[][]>;
  };
  if (!body || body.ok === false || !body.tabs) {
    throw new Error(body?.error || "The script did not return your class data.");
  }

  const meta: Partial<MetaSnapshot> = {};
  const metaRows = body.tabs[SHEET_TABS.meta];
  if (Array.isArray(metaRows)) {
    for (const row of metaRows) {
      const [key, value] = row as [string, string];
      if (typeof value !== "string" || !value) continue;
      try {
        if (key === "business") meta.business = JSON.parse(value);
        if (key === "settings") meta.settings = JSON.parse(value);
        if (key === "batches") meta.batches = JSON.parse(value);
        if (key === "holidays") meta.holidays = JSON.parse(value);
        if (key === "notes") meta.notes = JSON.parse(value);
        if (key === "enquiries") meta.enquiries = JSON.parse(value);
      } catch {
        // Ignore corrupted meta entries.
      }
    }
  }

  return {
    meta,
    students: parseJsonColumn<Student>(body.tabs[SHEET_TABS.students] ?? []),
    attendance: parseJsonColumn<AttendanceRecord>(body.tabs[SHEET_TABS.attendance] ?? []),
    dues: parseJsonColumn<FeeDue>(body.tabs[SHEET_TABS.dues] ?? []),
    payments: parseJsonColumn<FeePayment>(body.tabs[SHEET_TABS.payments] ?? []),
    tests: parseJsonColumn<TestRecord>(body.tabs[SHEET_TABS.tests] ?? []),
    marks: parseJsonColumn<MarkRecord>(body.tabs[SHEET_TABS.marks] ?? []),
  };
}

/** Settings that came back from a sheet, merged onto today's defaults. */
export function settingsFromPull(pull: SheetPullResult, url: string): TuitionSettings {
  const stored = pull.meta.settings;
  return {
    ...DEFAULT_TUITION_SETTINGS,
    ...(stored ?? {}),
    templates: { ...DEFAULT_TUITION_SETTINGS.templates, ...(stored?.templates ?? {}) },
    id: "main",
    sheetSyncUrl: url,
  };
}

// ---------------------------------------------------------------------------
// The script teachers paste into their Google Sheet (Extensions → Apps Script)
// Kept free of backticks/template literals so it embeds cleanly here.
// ---------------------------------------------------------------------------
export const APPS_SCRIPT_TEMPLATE = `// Setu Tuition Class Manager — Google Sheet sync script (v1)
// 1. In your Google Sheet: Extensions -> Apps Script, replace everything with this file.
// 2. Click Deploy -> New deployment -> type: Web app.
//    - Execute as: Me
//    - Who has access: Anyone
// 3. Copy the Web app URL and paste it into the app (Settings -> Google Sheet sync).
// Treat that URL like the share link of this sheet.

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || "";
  if (action === "pull") return respond_(pullAll_());
  return respond_({ ok: true, app: "setu-tuition-sheet-sync", version: 1 });
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.action === "test") {
      writeTab_("Meta", [["Key", "Value"], ["connectedAt", new Date().toISOString()]], true);
      return respond_({ ok: true, sheet: SpreadsheetApp.getActive().getName() });
    }
    if (body.action === "push") {
      var tabs = body.tabs || [];
      for (var i = 0; i < tabs.length; i++) {
        var t = tabs[i];
        var values = [t.headers].concat(t.rows || []);
        writeTab_(t.tab, values, false);
      }
      return respond_({ ok: true, updated: tabs.length });
    }
    if (body.action === "pull") return respond_(pullAll_());
    return respond_({ ok: false, error: "Unknown action" });
  } catch (err) {
    return respond_({ ok: false, error: String(err) });
  }
}

function writeTab_(name, values, keepExisting) {
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (!keepExisting) sheet.clearContents();
  if (values.length === 0) return;
  var width = 0;
  for (var i = 0; i < values.length; i++) {
    if (values[i].length > width) width = values[i].length;
  }
  for (var j = 0; j < values.length; j++) {
    while (values[j].length < width) values[j].push("");
  }
  sheet.getRange(1, 1, values.length, width).setValues(values);
}

function pullAll_() {
  var names = ["Meta", "Students", "Attendance", "Fee Dues", "Fee Payments", "Tests", "Marks"];
  var ss = SpreadsheetApp.getActive();
  var tabs = {};
  for (var i = 0; i < names.length; i++) {
    var sheet = ss.getSheetByName(names[i]);
    tabs[names[i]] = sheet ? sheet.getDataRange().getValues() : [];
  }
  return { ok: true, app: "setu-tuition-sheet-sync", tabs: tabs };
}

function respond_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
`;
