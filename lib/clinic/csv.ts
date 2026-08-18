// CSV export + bulk patient import for the Free Clinic Manager.
//
// Import matters for the clinic that already keeps a register in Excel: they
// will not retype nine hundred patients. The Patients screen accepts a pasted
// spreadsheet block (CSV or tab-separated) as well as a file, modelled on
// Tuition/ImportStudents.

import { toCsv } from "@/lib/pos/csv";
import {
  billDue,
  formatAge,
  patientAge,
  patientDues,
  waitMinutes,
} from "./calc";
import {
  formatDate,
  patientCustomFields,
  visitMedicines,
  visitVitals,
  type Bill,
  type Doctor,
  type Patient,
  type Sex,
  type Appointment,
  type Visit,
} from "./types";

export { toCsv, downloadCsv } from "@/lib/pos/csv";

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export function patientsCsv(patients: Patient[], bills: Bill[]): string {
  return toCsv(
    [
      "Code",
      "Name",
      "Age",
      "Sex",
      "Phone",
      "Alt Phone",
      "Blood Group",
      "Address",
      "Allergies",
      "Chronic Conditions",
      "Registered On",
      "Outstanding",
      "Custom Fields",
      "Notes",
    ],
    patients.map((p) => [
      p.code,
      p.name,
      formatAge(patientAge(p)),
      p.sex,
      p.phone,
      p.altPhone,
      p.bloodGroup,
      p.address,
      (p.allergies ?? []).join(" | "),
      (p.chronicConditions ?? []).join(" | "),
      p.registeredOn,
      patientDues(bills, p.id),
      patientCustomFields(p)
        .map((field) => `${field.label}: ${field.value}`)
        .join(" | "),
      p.notes,
    ])
  );
}

export function visitsCsv(visits: Visit[], patients: Patient[], doctors: Doctor[]): string {
  const patientOf = (id: string) => patients.find((p) => p.id === id);
  const doctorName = (id: string) => doctors.find((d) => d.id === id)?.name ?? "";
  return toCsv(
    [
      "Date",
      "Patient Code",
      "Patient",
      "Doctor",
      "Complaints",
      "Diagnosis",
      "Advice",
      "Investigations",
      "Medicines",
      "BP",
      "Pulse",
      "Temp (F)",
      "SpO2",
      "Weight (kg)",
      "BMI",
      "Follow-up (days)",
      "Finalised",
    ],
    visits.map((v) => {
      const patient = patientOf(v.patientId);
      const vitals = visitVitals(v);
      return [
        v.date,
        patient?.code ?? "",
        patient?.name ?? "",
        doctorName(v.doctorId),
        v.complaints,
        v.diagnosis,
        v.advice,
        (v.investigations ?? []).join(" | "),
        visitMedicines(v)
          .map((m) =>
            [m.name, m.strength, m.frequency, m.durationDays ? `${m.durationDays} days` : ""]
              .filter(Boolean)
              .join(" ")
          )
          .join(" | "),
        vitals.bp,
        vitals.pulse ?? "",
        vitals.tempF ?? "",
        vitals.spo2 ?? "",
        vitals.weightKg ?? "",
        vitals.bmi ?? "",
        v.followUpDays ?? "",
        v.finalisedAt ? "Yes" : "Draft",
      ];
    })
  );
}

export function billsCsv(bills: Bill[], patients: Patient[], doctors: Doctor[]): string {
  const patientOf = (id: string) => patients.find((p) => p.id === id);
  const doctorName = (id: string) => doctors.find((d) => d.id === id)?.name ?? "";
  return toCsv(
    ["Receipt No", "Date", "Patient Code", "Patient", "Doctor", "Total", "Paid", "Due", "Mode"],
    bills.map((b) => {
      const patient = patientOf(b.patientId);
      return [
        b.receiptNo,
        b.date,
        patient?.code ?? "",
        patient?.name ?? "",
        doctorName(b.doctorId),
        b.total,
        b.paid,
        billDue(b),
        b.paymentMode,
      ];
    })
  );
}

export function appointmentsCsv(
  appointments: Appointment[],
  patients: Patient[],
  doctors: Doctor[]
): string {
  const patientOf = (id: string) => patients.find((p) => p.id === id);
  const doctorName = (id: string) => doctors.find((d) => d.id === id)?.name ?? "";
  return toCsv(
    [
      "Date",
      "Time",
      "Token",
      "Patient Code",
      "Patient",
      "Doctor",
      "Reason",
      "Status",
      "Wait (min)",
      "Cancel Reason",
    ],
    appointments.map((a) => {
      const patient = patientOf(a.patientId);
      return [
        a.date,
        a.startTime,
        a.tokenNo ?? "",
        patient?.code ?? "",
        patient?.name ?? "",
        doctorName(a.doctorId),
        a.reason,
        a.status,
        waitMinutes(a) ?? "",
        a.cancelReason,
      ];
    })
  );
}

/** Generic two-column report export, used by every block on the Reports screen. */
export function reportCsv(headers: string[], rows: (string | number)[][]): string {
  return toCsv(headers, rows);
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

export type ParsedPatientRow = {
  name: string;
  phone: string;
  altPhone: string;
  sex: Sex | "";
  /** Either a DOB or a plain age in years — whichever the file carried. */
  dob: string;
  ageYears: number | null;
  address: string;
  bloodGroup: string;
  allergies: string[];
  chronicConditions: string[];
  notes: string;
};

export type PatientImportResult = {
  rows: ParsedPatientRow[];
  /** Line-level problems, e.g. a row with no name. */
  errors: string[];
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

type ImportField = keyof ParsedPatientRow | "age" | null;

const HEADER_ALIASES: Record<string, ImportField> = {
  name: "name",
  patient: "name",
  "patient name": "name",
  phone: "phone",
  mobile: "phone",
  contact: "phone",
  "mobile no": "phone",
  "phone no": "phone",
  whatsapp: "phone",
  "alt phone": "altPhone",
  "alternate phone": "altPhone",
  "alt mobile": "altPhone",
  sex: "sex",
  gender: "sex",
  dob: "dob",
  "date of birth": "dob",
  birthday: "dob",
  age: "age",
  "age (years)": "age",
  years: "age",
  address: "address",
  "blood group": "bloodGroup",
  blood: "bloodGroup",
  allergy: "allergies",
  allergies: "allergies",
  conditions: "chronicConditions",
  "chronic conditions": "chronicConditions",
  history: "chronicConditions",
  notes: "notes",
  remarks: "notes",
};

function normaliseSex(value: string): Sex | "" {
  const text = value.trim().toLowerCase();
  if (["m", "male", "man", "boy"].includes(text)) return "male";
  if (["f", "female", "woman", "girl"].includes(text)) return "female";
  if (!text) return "";
  return "other";
}

/**
 * Accept the date formats an Indian clinic register actually contains:
 * 1995-04-12, 12/04/1995 and 12-04-1995 are all the same day. Day-first is
 * assumed for the slashed forms because that is the local convention.
 */
function normaliseDob(value: string): string {
  const text = value.trim();
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!match) return "";
  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function splitList(value: string): string[] {
  return value
    .split(/[|;,]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * Parse a pasted spreadsheet block or CSV file. A header row is used when
 * present; otherwise columns are read positionally as
 * Name, Phone, Age, Sex, Address.
 */
export function parsePatientImport(text: string): PatientImportResult {
  const errors: string[] = [];
  const rows: ParsedPatientRow[] = [];

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return { rows, errors: ["Nothing to import."] };

  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const firstCells = splitLine(lines[0], delimiter).map((c) => c.toLowerCase());
  const hasHeader = firstCells.some((cell) =>
    ["name", "patient", "patient name"].includes(cell)
  );

  const columns: ImportField[] = hasHeader
    ? firstCells.map((cell) => HEADER_ALIASES[cell] ?? null)
    : ["name", "phone", "age", "sex", "address"];

  const seenPhones = new Set<string>();

  for (const [index, line] of lines.entries()) {
    if (hasHeader && index === 0) continue;
    const cells = splitLine(line, delimiter);
    const row: ParsedPatientRow = {
      name: "",
      phone: "",
      altPhone: "",
      sex: "",
      dob: "",
      ageYears: null,
      address: "",
      bloodGroup: "",
      allergies: [],
      chronicConditions: [],
      notes: "",
    };

    cells.forEach((value, columnIndex) => {
      const field = columns[columnIndex];
      if (!field || !value) return;
      switch (field) {
        case "age": {
          const years = Number(value.replace(/[^\d.]/g, ""));
          row.ageYears = Number.isFinite(years) && years > 0 ? Math.floor(years) : null;
          break;
        }
        case "dob":
          row.dob = normaliseDob(value);
          break;
        case "sex":
          row.sex = normaliseSex(value);
          break;
        case "allergies":
          row.allergies = splitList(value);
          break;
        case "chronicConditions":
          row.chronicConditions = splitList(value);
          break;
        case "name":
        case "phone":
        case "altPhone":
        case "address":
        case "bloodGroup":
        case "notes":
          row[field] = value;
          break;
        default:
          break;
      }
    });

    if (!row.name) {
      errors.push(`Line ${index + 1}: no patient name — skipped.`);
      continue;
    }
    const digits = row.phone.replace(/\D/g, "");
    if (digits && seenPhones.has(digits)) {
      errors.push(`Line ${index + 1}: ${row.name} repeats phone ${row.phone} — still imported.`);
    }
    if (digits) seenPhones.add(digits);
    rows.push(row);
  }

  return { rows, errors };
}

/** A blank template the clinic can fill in and paste back. */
export function patientImportTemplate(): string {
  return toCsv(
    ["Name", "Phone", "Age", "Sex", "Address", "Blood Group", "Allergies", "Chronic Conditions"],
    [
      ["Ramesh Kumar", "9876543210", "42", "M", "12 MG Road", "B+", "Penicillin", "Diabetes"],
      ["Sunita Devi", "9876500011", "35", "F", "8 Nehru Nagar", "O+", "", "Hypertension"],
    ]
  );
}

/** Reported back after an import so the screen can say what happened. */
export function describeImport(rows: ParsedPatientRow[]): string {
  const withPhone = rows.filter((r) => r.phone.trim()).length;
  const withAge = rows.filter((r) => r.dob || r.ageYears !== null).length;
  return `${rows.length} patients · ${withPhone} with a phone number · ${withAge} with an age`;
}

/** Used by the chart export header. */
export function formatVisitDate(dateKey: string): string {
  return formatDate(dateKey);
}
