// Google Sheet sync for the Free Clinic Manager.
//
// Same protocol as the POS and tuition syncs: the clinic pastes the Apps Script
// into their own Google Sheet (Extensions → Apps Script), deploys it as a web
// app, and the app pushes full snapshots of changed slices to that URL.
//
// Each tab carries readable columns plus a final "_json" column holding the
// exact record — pushes rewrite whole tabs (idempotent, delete-safe) and
// restore reads only the _json column (lossless round trip).
//
// A NOTE ON WHAT THIS SENDS. Unlike every other Setu tool's sync, the rows here
// include diagnoses and prescriptions. Sync is off until the clinic pastes a
// URL, and the Settings screen says plainly what leaves the device when they
// do. Nothing is sent otherwise.

import type { Business } from "@/lib/pos/types";
import {
  DEFAULT_CLINIC_SETTINGS,
  formatDate,
  visitMedicines,
  visitVitals,
  type Appointment,
  type Bill,
  type ClinicCharge,
  type ClinicSettings,
  type Doctor,
  type Medicine,
  type Patient,
  type Protocol,
  type Visit,
} from "./types";
import { billDue, formatAge, patientAge } from "./calc";

export type MetaSnapshot = {
  business: Business | null;
  settings: ClinicSettings;
  doctors: Doctor[];
  medicines: Medicine[];
  protocols: Protocol[];
  charges: ClinicCharge[];
};

export type ClinicSnapshot = MetaSnapshot & {
  patients: Patient[];
  appointments: Appointment[];
  visits: Visit[];
  bills: Bill[];
};

type TabPayload = { tab: string; headers: string[]; rows: (string | number | boolean)[][] };

export const SHEET_TABS = {
  meta: "Meta",
  patients: "Patients",
  appointments: "Appointments",
  visits: "Consultations",
  bills: "Bills",
} as const;

export const SHEET_TAB_NAMES = Object.values(SHEET_TABS);

function metaTab(meta: MetaSnapshot): TabPayload {
  return {
    tab: SHEET_TABS.meta,
    headers: ["Key", "Value"],
    rows: [
      ["business", JSON.stringify(meta.business)],
      ["settings", JSON.stringify(meta.settings)],
      ["doctors", JSON.stringify(meta.doctors)],
      ["medicines", JSON.stringify(meta.medicines)],
      ["protocols", JSON.stringify(meta.protocols)],
      ["charges", JSON.stringify(meta.charges)],
      ["updatedAt", new Date().toISOString()],
    ],
  };
}

function patientsTab(patients: Patient[]): TabPayload {
  return {
    tab: SHEET_TABS.patients,
    headers: [
      "Code",
      "Name",
      "Age",
      "Sex",
      "Phone",
      "Blood Group",
      "Allergies",
      "Chronic Conditions",
      "Registered On",
      "_json",
    ],
    rows: patients.map((p) => [
      p.code,
      p.name,
      formatAge(patientAge(p)),
      p.sex,
      p.phone,
      p.bloodGroup,
      (p.allergies ?? []).join(", "),
      (p.chronicConditions ?? []).join(", "),
      p.registeredOn,
      JSON.stringify(p),
    ]),
  };
}

function appointmentsTab(appointments: Appointment[], patients: Patient[], doctors: Doctor[]): TabPayload {
  const patientName = (id: string) => patients.find((p) => p.id === id)?.name ?? "";
  const doctorName = (id: string) => doctors.find((d) => d.id === id)?.name ?? "";
  return {
    tab: SHEET_TABS.appointments,
    headers: ["Date", "Time", "Token", "Patient", "Doctor", "Reason", "Status", "_json"],
    rows: appointments.map((a) => [
      a.date,
      a.startTime,
      a.tokenNo ?? "",
      patientName(a.patientId),
      doctorName(a.doctorId),
      a.reason,
      a.status,
      JSON.stringify(a),
    ]),
  };
}

function visitsTab(visits: Visit[], patients: Patient[], doctors: Doctor[]): TabPayload {
  const patientOf = (id: string) => patients.find((p) => p.id === id);
  const doctorName = (id: string) => doctors.find((d) => d.id === id)?.name ?? "";
  return {
    tab: SHEET_TABS.visits,
    headers: [
      "Date",
      "Patient Code",
      "Patient",
      "Doctor",
      "Diagnosis",
      "Medicines",
      "BP",
      "Weight",
      "Follow-up",
      "_json",
    ],
    rows: visits.map((v) => {
      const vitals = visitVitals(v);
      return [
        v.date,
        patientOf(v.patientId)?.code ?? "",
        patientOf(v.patientId)?.name ?? "",
        doctorName(v.doctorId),
        v.diagnosis,
        visitMedicines(v)
          .map((m) => [m.name, m.strength, m.frequency].filter(Boolean).join(" "))
          .join("; "),
        vitals.bp,
        vitals.weightKg ?? "",
        v.followUpDays ?? "",
        JSON.stringify(v),
      ];
    }),
  };
}

function billsTab(bills: Bill[], patients: Patient[]): TabPayload {
  const patientName = (id: string) => patients.find((p) => p.id === id)?.name ?? "";
  return {
    tab: SHEET_TABS.bills,
    headers: ["Receipt No", "Date", "Patient", "Total", "Paid", "Due", "Mode", "_json"],
    rows: bills.map((b) => [
      b.receiptNo,
      formatDate(b.date),
      patientName(b.patientId),
      b.total,
      b.paid,
      billDue(b),
      b.paymentMode,
      JSON.stringify(b),
    ]),
  };
}

export function buildTabPayloads(slices: string[], snapshot: ClinicSnapshot): TabPayload[] {
  const tabs: TabPayload[] = [];
  if (slices.includes("c_meta")) tabs.push(metaTab(snapshot));
  if (slices.includes("c_patients")) tabs.push(patientsTab(snapshot.patients));
  if (slices.includes("c_appointments")) {
    tabs.push(appointmentsTab(snapshot.appointments, snapshot.patients, snapshot.doctors));
  }
  if (slices.includes("c_visits")) {
    tabs.push(visitsTab(snapshot.visits, snapshot.patients, snapshot.doctors));
  }
  if (slices.includes("c_bills")) tabs.push(billsTab(snapshot.bills, snapshot.patients));
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
    const result = (await postToScript(url, { action: "test", app: "setu-clinic" })) as {
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
        'Could not reach the script. Check the URL, and make sure the deployment\'s access is set to "Anyone".',
    };
  }
}

export async function pushToSheet(url: string, tabs: TabPayload[]): Promise<void> {
  const result = (await postToScript(url, { action: "push", app: "setu-clinic", tabs })) as {
    ok?: boolean;
    error?: string;
  };
  if (result && result.ok === false) {
    throw new Error(result.error || "The sheet script rejected the update.");
  }
}

export type SheetPullResult = {
  meta: Partial<MetaSnapshot>;
  patients: Patient[];
  appointments: Appointment[];
  visits: Visit[];
  bills: Bill[];
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
    throw new Error(body?.error || "The script did not return your clinic data.");
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
        if (key === "doctors") meta.doctors = JSON.parse(value);
        if (key === "medicines") meta.medicines = JSON.parse(value);
        if (key === "protocols") meta.protocols = JSON.parse(value);
        if (key === "charges") meta.charges = JSON.parse(value);
      } catch {
        // Ignore corrupted meta entries.
      }
    }
  }

  return {
    meta,
    patients: parseJsonColumn<Patient>(body.tabs[SHEET_TABS.patients] ?? []),
    appointments: parseJsonColumn<Appointment>(body.tabs[SHEET_TABS.appointments] ?? []),
    visits: parseJsonColumn<Visit>(body.tabs[SHEET_TABS.visits] ?? []),
    bills: parseJsonColumn<Bill>(body.tabs[SHEET_TABS.bills] ?? []),
  };
}

/** Merge pulled settings over the defaults so older sheets gain new fields. */
export function settingsFromPull(pulled: Partial<ClinicSettings> | undefined): ClinicSettings {
  if (!pulled) return { ...DEFAULT_CLINIC_SETTINGS };
  return {
    ...DEFAULT_CLINIC_SETTINGS,
    ...pulled,
    id: "main",
    messageTemplates: {
      ...DEFAULT_CLINIC_SETTINGS.messageTemplates,
      ...(pulled.messageTemplates ?? {}),
    },
  };
}

/**
 * The Apps Script the clinic pastes into their sheet. Identical in shape to the
 * tuition one so a clinic that already runs another Setu tool recognises it.
 */
export const APPS_SCRIPT_TEMPLATE = `function doPost(e) {
  var body = JSON.parse(e.postData.contents);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (body.action === 'test') {
    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (body.action === 'push') {
    body.tabs.forEach(function (tab) {
      var sheet = ss.getSheetByName(tab.tab) || ss.insertSheet(tab.tab);
      sheet.clear();
      var rows = [tab.headers].concat(tab.rows);
      if (rows.length) {
        sheet.getRange(1, 1, rows.length, tab.headers.length).setValues(rows);
      }
    });
    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Unknown action' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tabs = {};
  ss.getSheets().forEach(function (sheet) {
    tabs[sheet.getName()] = sheet.getDataRange().getValues();
  });
  return ContentService.createTextOutput(JSON.stringify({ ok: true, tabs: tabs }))
    .setMimeType(ContentService.MimeType.JSON);
}`;
