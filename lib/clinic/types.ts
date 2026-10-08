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
import type { LanguageCode } from "@/lib/i18n/config";
import { intlLocaleFor } from "@/lib/i18n/pages";
import { relabelSeed } from "@/lib/i18n/seed-labels";
import { translate, type TKey } from "@/lib/i18n/translate";

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

/**
 * The status a record stores is the coded value above, never its label — a
 * queue saved while the front desk was reading Hindi must still be readable,
 * and filterable, on the English screen. Only the display follows the reader.
 */
const STATUS_KEYS: Record<AppointmentStatus, TKey> = {
  booked: "clStBooked",
  waiting: "clStWaiting",
  "in-consult": "clStInConsult",
  done: "clStDone",
  "no-show": "clStNoShow",
  cancelled: "clStCancelled",
};

export function statusLabel(status: AppointmentStatus, lang: LanguageCode): string {
  const key = STATUS_KEYS[status];
  return key ? translate(lang, key) : status;
}

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

/**
 * Short form printed on the Rx line — "Tab.", "Cap.", "Syp." A pharmacist
 * reads this off the paper, so it is written in the language the prescription
 * is printed in. `other` has no prefix in any language.
 */
const FORM_SHORT_KEYS: Record<MedicineForm, TKey | ""> = {
  tablet: "clFormTablet",
  capsule: "clFormCapsule",
  syrup: "clFormSyrup",
  injection: "clFormInjection",
  drops: "clFormDrops",
  ointment: "clFormOintment",
  inhaler: "clFormInhaler",
  sachet: "clFormSachet",
  other: "",
};

export function formShort(form: MedicineForm, lang: LanguageCode): string {
  const key = FORM_SHORT_KEYS[form];
  return key ? translate(lang, key) : "";
}

export type RxTiming = "before-food" | "after-food" | "with-food" | "";

const TIMING_KEYS: Record<Exclude<RxTiming, "">, TKey> = {
  "before-food": "clTimingBeforeFood",
  "after-food": "clTimingAfterFood",
  "with-food": "clTimingWithFood",
};

export function timingLabel(timing: RxTiming, lang: LanguageCode): string {
  if (!timing) return "";
  const key = TIMING_KEYS[timing];
  return key ? translate(lang, key) : "";
}

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

/**
 * The seeded payment modes. The clinic edits this list in Settings and the
 * chosen mode is written onto the bill, so the stored strings stay as they
 * were seeded — in English — and `paymentModeLabel` is what a reader sees.
 * A mode the clinic typed themselves is their words and is shown as written.
 */
export const DEFAULT_PAYMENT_MODES = ["Cash", "UPI", "Card"];

const PAYMENT_MODE_KEYS: TKey[] = ["clPayCash", "clPayUpi", "clPayCard"];

export function paymentModeLabel(mode: string, lang: LanguageCode): string {
  return relabelSeed(mode, PAYMENT_MODE_KEYS, lang);
}

/**
 * The disclaimer that prints under every prescription, and the notice shown
 * once on first run. Deliberately narrow: it states what the software is not,
 * and makes clear the prescribing decision belongs to the doctor. It is not
 * legal advice and the clinic can rewrite it in Settings.
 */
export function defaultRxFooter(lang: LanguageCode): string {
  return translate(lang, "clRxFooterDefault");
}

/**
 * The footer as it should print: the clinic's own wording when they rewrote
 * it, and our seed in the language the prescription is being printed in when
 * they left it alone.
 */
export function rxFooterFor(text: string, lang: LanguageCode): string {
  return relabelSeed(text, ["clRxFooterDefault"], lang);
}

export function firstRunDisclaimer(lang: LanguageCode): string {
  return translate(lang, "clFirstRunDisclaimer");
}

const TEMPLATE_KEYS: Record<ClinicTemplateKey, TKey> = {
  appointmentConfirmed: "clTplApptConfirmed",
  appointmentReminder: "clTplApptReminder",
  followUpDue: "clTplFollowUpDue",
  reportReady: "clTplReportReady",
  duesReminder: "clTplDuesReminder",
};

/**
 * The seeded WhatsApp templates. A patient reads these, so they are seeded in
 * the language the clinic set up in; the clinic can rewrite any of them.
 */
export function defaultMessageTemplates(
  lang: LanguageCode
): Record<ClinicTemplateKey, string> {
  return {
    appointmentConfirmed: translate(lang, TEMPLATE_KEYS.appointmentConfirmed),
    appointmentReminder: translate(lang, TEMPLATE_KEYS.appointmentReminder),
    followUpDue: translate(lang, TEMPLATE_KEYS.followUpDue),
    reportReady: translate(lang, TEMPLATE_KEYS.reportReady),
    duesReminder: translate(lang, TEMPLATE_KEYS.duesReminder),
  };
}

/**
 * The shape every stored settings record is merged over, so a record written
 * by an older version gains new fields. The reader-facing seeds in it — the
 * Rx footer and the message templates — are left empty here and filled by
 * `defaultClinicSettings` at the two points that actually seed a clinic.
 */
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
  rxFooterText: "",
  showVitalsOnRx: true,
  messageTemplates: {
    appointmentConfirmed: "",
    appointmentReminder: "",
    followUpDue: "",
    reportReady: "",
    duesReminder: "",
  },
  receiptPaperSize: "80mm",
  disclaimerAcceptedAt: null,
  lastBackupAt: null,
  sheetSyncUrl: "",
  pinHash: "",
  pinSalt: "",
  autoLockMinutes: 0,
};

/** A fresh clinic's settings, with the patient-facing text in `lang`. */
export function defaultClinicSettings(lang: LanguageCode): ClinicSettings {
  return {
    ...DEFAULT_CLINIC_SETTINGS,
    rxFooterText: defaultRxFooter(lang),
    messageTemplates: defaultMessageTemplates(lang),
  };
}

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

/** "2026-08-11" → "11 Aug 2026", with the month name in `lang`. */
export function formatDate(dateKey: string, lang: LanguageCode): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return dateKey;
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(intlLocaleFor(lang), {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * "2026-08-11" → "11 Aug", for a chart axis with no room for the year.
 * The axis used to take the first six characters of the full date, which is
 * "11 Aug" only as long as the date is written in English.
 */
export function formatDayMonth(dateKey: string, lang: LanguageCode): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return dateKey;
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(intlLocaleFor(lang), {
    day: "numeric",
    month: "short",
  });
}

/**
 * "18:00" → "6:00 pm", written the way `lang` writes a clock time. The
 * am/pm marker used to be hand-built here, so every language got the English
 * one in the middle of its own sentence.
 */
export function formatTime(time: string, lang: LanguageCode): string {
  if (!/^\d{1,2}:\d{2}$/.test(time)) return time;
  const [h, m] = time.split(":").map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(intlLocaleFor(lang), {
    hour: "numeric",
    minute: "2-digit",
  });
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
