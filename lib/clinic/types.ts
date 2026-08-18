// Data model for the Free Clinic Manager (/products/free-clinic-software).
//
// Everything is stored client-side in the shared workspace IndexedDB — no
// backend, no login. Store names are prefixed `clinic_` because the workspace
// database is shared with the POS, the Business Toolkit and the Tuition
// manager; unprefixed names like `patients` or `bills` would be a landmine for
// whichever tool wants them next.
//
// Note on the appointment store: the toolkit already owns a generic
// `appointments` store (lib/toolkit/types.ts), edited by the Appointment Book
// tool and shaped for salons and repair shops. A clinic appointment carries a
// token number, a consult lifecycle and a doctor, none of which fit that shape,
// so clinic appointments live in `clinic_appointments` and the two tools do not
// collide.

import type { StoreName } from "@/lib/pos/db";

// ---------------------------------------------------------------------------
// Doctors
// ---------------------------------------------------------------------------

/** A doctor/consultant at this clinic. The clinic itself is the workspace Business. */
export type Doctor = {
  id: string;
  name: string;
  qualifications: string; // "MBBS, MD (Medicine)"
  registrationNo: string; // state medical council reg. no — prints on Rx
  speciality: string;
  consultationFee: number;
  followUpFee: number; // 0 = follow-ups are free
  /** Follow-up inside this many days bills at followUpFee. 0 = never auto. */
  followUpFreeDays: number;
  signatureDataUrl: string; // drawn or uploaded, prints above the reg. no
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Patients
// ---------------------------------------------------------------------------

export type Sex = "male" | "female" | "other";

export type CustomField = { id: string; label: string; value: string };

export type Patient = {
  id: string;
  /** Human-facing id, e.g. "SC-0142". Generated from settings prefix + serial. */
  code: string;
  name: string;
  /** Store dob when known; else store age at registration and derive forward. */
  dob: string | null;
  ageYearsAtRegistration: number | null;
  registeredOn: string;
  sex: Sex;
  phone: string;
  altPhone: string;
  address: string;
  bloodGroup: string;
  /** Shown as a red banner at the top of the chart. */
  allergies: string[];
  chronicConditions: string[];
  /** Links members of one household; usually the primary phone holder's id. */
  familyId: string | null;
  photoDataUrl: string;
  /** Free-form, same pattern as lib/tuition CustomField. */
  customFields: CustomField[];
  notes: string;
  /**
   * The workspace `customers` record this patient was matched to, when the
   * phone number already existed on this device. Match is on phone, never on
   * name — two different people share a name far more often than a number.
   */
  customerId: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Records written before these fields existed load without them. */
export function patientAllergies(patient: Patient): string[] {
  return Array.isArray(patient.allergies) ? patient.allergies : [];
}

export function patientConditions(patient: Patient): string[] {
  return Array.isArray(patient.chronicConditions) ? patient.chronicConditions : [];
}

export function patientCustomFields(patient: Patient): CustomField[] {
  return Array.isArray(patient.customFields) ? patient.customFields : [];
}

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

// ---------------------------------------------------------------------------
// Appointments
// ---------------------------------------------------------------------------

export type AppointmentStatus =
  | "booked"
  | "waiting" // arrived, in the waiting room
  | "in-consult"
  | "done"
  | "no-show"
  | "cancelled";

export type Appointment = {
  id: string;
  patientId: string;
  doctorId: string;
  /** Local date "YYYY-MM-DD" — indexed, this is the main query key. */
  date: string;
  startTime: string; // "18:00"
  durationMinutes: number;
  status: AppointmentStatus;
  /** Sequence within the day per doctor. Assigned on arrival, not on booking. */
  tokenNo: number | null;
  /** Emergencies and the elderly move up the queue without changing token. */
  priority: boolean;
  arrivedAt: string | null;
  consultStartedAt: string | null;
  consultEndedAt: string | null;
  reason: string;
  cancelReason: string;
  /** Set when this was auto-created by a "review after N days" advice. */
  createdFromVisitId: string | null;
  remindedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Statuses that still belong in the live part of the Today queue. */
export const ACTIVE_STATUSES: AppointmentStatus[] = [
  "booked",
  "waiting",
  "in-consult",
  "done",
];

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  booked: "Booked",
  waiting: "Waiting",
  "in-consult": "In consult",
  done: "Done",
  "no-show": "No-show",
  cancelled: "Cancelled",
};

// ---------------------------------------------------------------------------
// Visits — the clinical record
// ---------------------------------------------------------------------------

export type Vitals = {
  bp: string; // "120/80" — free text, too varied to model
  /** Parsed from `bp` when it parses; kept so the trend chart has numbers. */
  bpSystolic: number | null;
  bpDiastolic: number | null;
  pulse: number | null;
  tempF: number | null;
  spo2: number | null;
  weightKg: number | null;
  heightCm: number | null;
  /** Derived, stored so historic BMI does not shift if the formula changes. */
  bmi: number | null;
};

export const EMPTY_VITALS: Vitals = {
  bp: "",
  bpSystolic: null,
  bpDiastolic: null,
  pulse: null,
  tempF: null,
  spo2: null,
  weightKg: null,
  heightCm: null,
  bmi: null,
};

export type MedicineForm =
  | "tablet"
  | "capsule"
  | "syrup"
  | "injection"
  | "drops"
  | "ointment"
  | "inhaler"
  | "sachet"
  | "other";

export const MEDICINE_FORMS: MedicineForm[] = [
  "tablet",
  "capsule",
  "syrup",
  "injection",
  "drops",
  "ointment",
  "inhaler",
  "sachet",
  "other",
];

/** Short form printed on the Rx line — "Tab.", "Cap.", "Syp." */
export const FORM_SHORT: Record<MedicineForm, string> = {
  tablet: "Tab.",
  capsule: "Cap.",
  syrup: "Syp.",
  injection: "Inj.",
  drops: "Drops",
  ointment: "Oint.",
  inhaler: "Inh.",
  sachet: "Sach.",
  other: "",
};

export type RxTiming = "before-food" | "after-food" | "with-food" | "";

export const TIMING_LABELS: Record<Exclude<RxTiming, "">, string> = {
  "before-food": "Before food",
  "after-food": "After food",
  "with-food": "With food",
};

export type RxLine = {
  id: string;
  medicineId: string | null; // null = typed ad hoc, not in the master
  name: string;
  strength: string; // "500 mg"
  form: MedicineForm;
  /** "1-0-1" morning-noon-night, or free text for odd schedules. */
  frequency: string;
  durationDays: number | null;
  timing: RxTiming;
  /** Auto-computed from frequency × durationDays; editable. */
  quantity: number | null;
  instructions: string;
};

/** One consultation. The clinical record; immutable-ish once finalised. */
export type Visit = {
  id: string;
  patientId: string;
  doctorId: string;
  appointmentId: string | null; // null = pure walk-in
  date: string;
  vitals: Vitals;
  complaints: string;
  findings: string;
  diagnosis: string;
  advice: string;
  /** Free-text lab/imaging advice, one per line; prints as an investigation slip. */
  investigations: string[];
  medicines: RxLine[];
  followUpDays: number | null; // drives the "review after N days" booking
  /** Not printed. Visible only inside the app. */
  internalNotes: string;
  finalisedAt: string | null; // null = still a draft
  /** Set when a finalised visit is edited afterwards; shows an "edited" marker. */
  editedAfterFinaliseAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export function visitInvestigations(visit: Visit): string[] {
  return Array.isArray(visit.investigations) ? visit.investigations : [];
}

export function visitMedicines(visit: Visit): RxLine[] {
  return Array.isArray(visit.medicines) ? visit.medicines : [];
}

export function visitVitals(visit: Visit): Vitals {
  return { ...EMPTY_VITALS, ...(visit.vitals ?? {}) };
}

// ---------------------------------------------------------------------------
// Medicine master & protocols
// ---------------------------------------------------------------------------

export type Medicine = {
  id: string;
  name: string;
  strength: string;
  form: MedicineForm;
  /** Generic/salt name — powers substitute search. */
  composition: string;
  defaultFrequency: string;
  defaultDurationDays: number | null;
  defaultTiming: RxTiming;
  timesUsed: number; // drives "frequently prescribed" ordering
  createdAt: string;
};

/** A saved whole-prescription template, e.g. "Viral fever – adult". */
export type Protocol = {
  id: string;
  name: string;
  doctorId: string | null; // null = shared across doctors
  complaints: string;
  diagnosis: string;
  advice: string;
  investigations: string[];
  medicines: RxLine[];
  followUpDays: number | null;
  timesUsed: number;
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Billing
// ---------------------------------------------------------------------------

export type ClinicCharge = {
  id: string;
  name: string; // "Dressing", "ECG", "Nebulisation"
  amount: number;
  active: boolean;
};

export type BillLineKind = "consultation" | "procedure" | "other";

export type BillLine = {
  id: string;
  label: string;
  amount: number;
  kind: BillLineKind;
};

export type Bill = {
  id: string;
  receiptNo: string; // formatted with prefix, e.g. "RCP-0231"
  patientId: string;
  doctorId: string;
  visitId: string | null;
  date: string;
  lines: BillLine[];
  discount: number;
  total: number;
  paid: number; // < total leaves a due
  paymentMode: string; // from settings.paymentModes
  createdAt: string;
  updatedAt: string;
};

export function billLines(bill: Bill): BillLine[] {
  return Array.isArray(bill.lines) ? bill.lines : [];
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export type ClinicTemplateKey =
  | "appointmentConfirmed"
  | "appointmentReminder"
  | "followUpDue"
  | "reportReady"
  | "duesReminder";

export type ClinicBreak = { id: string; label: string; start: string; end: string };
export type ClinicHoliday = { id: string; date: string; reason: string };

export type RxPaperSize = "a4" | "a5";
export type ReceiptPaperSize = "58mm" | "80mm" | "a4";
export type SlotMinutes = 10 | 15 | 20 | 30;

export type ClinicSettings = {
  id: "main";
  patientCodePrefix: string; // "SC-"
  nextPatientSerial: number;
  receiptPrefix: string;
  nextReceiptNumber: number;
  slotMinutes: SlotMinutes;
  openTime: string; // "09:00"
  closeTime: string; // "21:00"
  /** Recurring closed windows, e.g. lunch. */
  breaks: ClinicBreak[];
  weeklyOffDays: number[]; // 0 = Sunday
  holidays: ClinicHoliday[];
  paymentModes: string[];
  rxPaperSize: RxPaperSize;
  /** false = printing on pre-printed letterhead, so suppress the header. */
  printClinicHeader: boolean;
  rxFooterText: string;
  showVitalsOnRx: boolean;
  messageTemplates: Record<ClinicTemplateKey, string>;
  receiptPaperSize: ReceiptPaperSize;
  /** The one-time medico-legal notice has been acknowledged on this device. */
  disclaimerAcceptedAt: string | null;
  lastBackupAt: string | null;
  sheetSyncUrl: string;
  /** SHA-256 (salted) of the app PIN; "" = no PIN set. */
  pinHash?: string;
  pinSalt?: string;
  /** Lock the screen after this many idle minutes; 0 = never. */
  autoLockMinutes?: number;
};

export const DEFAULT_PAYMENT_MODES = ["Cash", "UPI", "Card"];

/**
 * The disclaimer that prints under every prescription, and the notice shown
 * once on first run. Deliberately narrow: it states what the software is not,
 * and makes clear the prescribing decision belongs to the doctor. It is not
 * legal advice and the clinic can rewrite it in Settings.
 */
export const DEFAULT_RX_FOOTER =
  "This prescription is valid only for the named patient. Not valid for medico-legal purposes.";

export const FIRST_RUN_DISCLAIMER =
  "Setu Clinic Manager is a record-keeping tool. It does not check doses, interactions or allergies, and it gives no clinical advice — every prescribing decision is the treating doctor's. Patient data is stored only in this browser on this device, so keep your own backups.";

export const DEFAULT_MESSAGE_TEMPLATES: Record<ClinicTemplateKey, string> = {
  appointmentConfirmed:
    "Namaste {{patientName}}, your appointment at {{clinicName}} is confirmed for {{date}} at {{time}} with {{doctorName}}. — {{clinicPhone}}",
  appointmentReminder:
    "Reminder: your appointment at {{clinicName}} is tomorrow, {{date}} at {{time}}. Reply here to reschedule.",
  followUpDue:
    "Namaste {{patientName}}, {{doctorName}} advised a review around {{date}}. Shall we book you in?",
  reportReady: "Your reports are ready for collection at {{clinicName}}.",
  duesReminder:
    "Namaste {{patientName}}, ₹{{amount}} is pending at {{clinicName}}. Pay by UPI: {{upiId}}",
};

export const DEFAULT_CLINIC_SETTINGS: ClinicSettings = {
  id: "main",
  patientCodePrefix: "SC-",
  nextPatientSerial: 1,
  receiptPrefix: "RCP-",
  nextReceiptNumber: 1,
  slotMinutes: 15,
  openTime: "09:00",
  closeTime: "21:00",
  breaks: [],
  weeklyOffDays: [],
  holidays: [],
  paymentModes: [...DEFAULT_PAYMENT_MODES],
  rxPaperSize: "a4",
  printClinicHeader: true,
  rxFooterText: DEFAULT_RX_FOOTER,
  showVitalsOnRx: true,
  messageTemplates: { ...DEFAULT_MESSAGE_TEMPLATES },
  receiptPaperSize: "80mm",
  disclaimerAcceptedAt: null,
  lastBackupAt: null,
  sheetSyncUrl: "",
  pinHash: "",
  pinSalt: "",
  autoLockMinutes: 0,
};

/**
 * `prefix + zero-padded serial`, padded to 4. Serials past 9999 simply grow
 * wider rather than wrapping — the serial is never reused.
 */
export function formatPatientCode(prefix: string, serial: number): string {
  return `${prefix}${String(serial).padStart(4, "0")}`;
}

export function formatReceiptNumber(prefix: string, n: number): string {
  return `${prefix}${String(n).padStart(4, "0")}`;
}

// ---------------------------------------------------------------------------
// Stores & sync slices
// ---------------------------------------------------------------------------

export const CLINIC_STORES: StoreName[] = [
  "clinic_doctors",
  "clinic_patients",
  "clinic_appointments",
  "clinic_visits",
  "clinic_medicines",
  "clinic_protocols",
  "clinic_charges",
  "clinic_bills",
  "clinic_settings",
];

/**
 * Prefixed so clinic dirty-flags never collide with the POS's or the tuition
 * manager's rows in the shared `sync_queue` store.
 */
export type SyncSlice =
  | "c_meta"
  | "c_patients"
  | "c_appointments"
  | "c_visits"
  | "c_bills";

export const SYNC_SLICES: SyncSlice[] = [
  "c_meta",
  "c_patients",
  "c_appointments",
  "c_visits",
  "c_bills",
];

export type SyncDirtyRow = { id: SyncSlice; dirtyAt: string };

// ---------------------------------------------------------------------------
// Date & phone helpers (local time — a 6pm consult belongs to the local day)
// ---------------------------------------------------------------------------

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayIso(): string {
  return toDateKey(new Date());
}

/** "2026-08-11" → "11 Aug 2026" */
export function formatDate(dateKey: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return dateKey;
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** "18:00" → "6:00 pm" */
export function formatTime(time: string): string {
  if (!/^\d{1,2}:\d{2}$/.test(time)) return time;
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** Shift a date key by N days, staying in local time. */
export function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const a = new Date(fy, fm - 1, fd).getTime();
  const b = new Date(ty, tm - 1, td).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** Digits only, with India's country code when the number is a bare 10 digits. */
export function whatsAppNumber(phone: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

/** The last 10 digits, used to match a patient to a workspace customer. */
export function phoneKey(phone: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}
