// Business rules for the Free Clinic Manager (spec §5).
//
// These live in one module, away from React, because every one of them is
// either printed on a prescription or billed for — they need to be testable and
// they need to give the same answer wherever they are called from.

import {
  daysBetween,
  todayIso,
  type Appointment,
  type Bill,
  type Doctor,
  type Patient,
  type RxLine,
  type Vitals,
  type Visit,
  billLines,
} from "./types";

// ---------------------------------------------------------------------------
// Age
// ---------------------------------------------------------------------------

export type Age = { years: number; months: number };

/**
 * Age today. `dob` wins when present; otherwise the age captured at
 * registration plus the years elapsed since. Returns null when neither is
 * known — an unknown age prints blank rather than "0".
 */
export function patientAge(patient: Patient, asOf: string = todayIso()): Age | null {
  if (patient.dob && /^\d{4}-\d{2}-\d{2}$/.test(patient.dob)) {
    return ageFromDob(patient.dob, asOf);
  }
  if (patient.ageYearsAtRegistration === null || patient.ageYearsAtRegistration === undefined) {
    return null;
  }
  const registered = patient.registeredOn || asOf;
  const elapsedYears = Math.max(0, Math.floor(daysBetween(registered, asOf) / 365.25));
  return { years: patient.ageYearsAtRegistration + elapsedYears, months: 0 };
}

export function ageFromDob(dob: string, asOf: string = todayIso()): Age {
  const [by, bm, bd] = dob.split("-").map(Number);
  const [ay, am, ad] = asOf.split("-").map(Number);
  let years = ay - by;
  let months = am - bm;
  if (ad < bd) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years < 0) return { years: 0, months: 0 };
  return { years, months };
}

/** "34 y" / "8 m" — under 2 years reads in months, per §5. */
export function formatAge(age: Age | null): string {
  if (!age) return "";
  if (age.years < 2) {
    const totalMonths = age.years * 12 + age.months;
    return `${totalMonths} m`;
  }
  return `${age.years} y`;
}

/** "34 y / M" — the form that goes on the patient strip and the Rx. */
export function formatAgeSex(patient: Patient, asOf?: string): string {
  const age = formatAge(patientAge(patient, asOf));
  const sex = patient.sex ? patient.sex.charAt(0).toUpperCase() : "";
  return [age, sex].filter(Boolean).join(" / ");
}

// ---------------------------------------------------------------------------
// Vitals
// ---------------------------------------------------------------------------

/** `weightKg / (heightCm/100)²`, one decimal. Blank unless both present. */
export function computeBmi(weightKg: number | null, heightCm: number | null): number | null {
  if (!weightKg || !heightCm) return null;
  if (weightKg <= 0 || heightCm <= 0) return null;
  const metres = heightCm / 100;
  return Math.round((weightKg / (metres * metres)) * 10) / 10;
}

/**
 * Pull systolic/diastolic out of whatever the assistant typed. BP is kept as
 * free text because "130/80 (L arm)" is a real thing people write, but the
 * trend chart needs numbers, so both are stored.
 */
export function parseBp(bp: string): { systolic: number | null; diastolic: number | null } {
  const match = (bp || "").match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
  if (!match) return { systolic: null, diastolic: null };
  return { systolic: Number(match[1]), diastolic: Number(match[2]) };
}

/** Recompute the derived vitals fields after any edit. */
export function withDerivedVitals(vitals: Vitals): Vitals {
  const { systolic, diastolic } = parseBp(vitals.bp);
  return {
    ...vitals,
    bpSystolic: systolic,
    bpDiastolic: diastolic,
    bmi: computeBmi(vitals.weightKg, vitals.heightCm),
  };
}

export function hasAnyVitals(vitals: Vitals): boolean {
  return Boolean(
    vitals.bp ||
      vitals.pulse ||
      vitals.tempF ||
      vitals.spo2 ||
      vitals.weightKg ||
      vitals.heightCm
  );
}

// ---------------------------------------------------------------------------
// Prescription quantity
// ---------------------------------------------------------------------------

/**
 * Sum of the numeric parts of `frequency` × `durationDays`, rounded up.
 *
 * "1-0-1" over 5 days is 10. "1/2-0-1/2" is a real way to write half a tablet,
 * so fractions count. A frequency with no digits at all ("SOS", "As directed")
 * cannot be counted and leaves the quantity blank for the doctor to fill in.
 */
export function computeQuantity(frequency: string, durationDays: number | null): number | null {
  if (!durationDays || durationDays <= 0) return null;
  const perDay = dosesPerDay(frequency);
  if (perDay === null) return null;
  return Math.ceil(perDay * durationDays);
}

/** Doses per day encoded in a frequency string, or null when it does not parse. */
export function dosesPerDay(frequency: string): number | null {
  const text = (frequency || "").trim();
  if (!text) return null;
  // Fractions first, so "1/2" is one dose of 0.5 and not "1" then "2".
  const parts = text.match(/\d+\s*\/\s*\d+|\d+(?:\.\d+)?/g);
  if (!parts) return null;
  let total = 0;
  for (const part of parts) {
    if (part.includes("/")) {
      const [num, den] = part.split("/").map((n) => Number(n.trim()));
      if (!den) return null;
      total += num / den;
    } else {
      total += Number(part);
    }
  }
  return total > 0 ? total : null;
}

/** The Rx line as one printable string: "Tab. Paracetamol 500 mg". */
export function rxLineTitle(line: RxLine, formShort: string): string {
  return [formShort, line.name, line.strength].filter(Boolean).join(" ").trim();
}

// ---------------------------------------------------------------------------
// Tokens & the Today queue
// ---------------------------------------------------------------------------

/**
 * Next token for a doctor on a date. Per doctor, per day, from 1, assigned on
 * arrival rather than on booking — a patient who booked at 10am but walked in
 * at 6pm is seen in the order they actually arrived.
 */
export function nextTokenNo(
  appointments: Appointment[],
  doctorId: string,
  date: string
): number {
  const used = appointments
    .filter((a) => a.doctorId === doctorId && a.date === date && a.tokenNo !== null)
    .map((a) => a.tokenNo as number);
  return used.length === 0 ? 1 : Math.max(...used) + 1;
}

const QUEUE_RANK: Record<Appointment["status"], number> = {
  "in-consult": 0,
  waiting: 1,
  booked: 2,
  done: 3,
  "no-show": 4,
  cancelled: 5,
};

/**
 * Today's ordering. Live rows first, then done, with no-shows and cancellations
 * collapsed to the bottom (§3.1). Priority flags float a patient up inside
 * their status group without changing the token they were issued.
 */
export function compareQueue(a: Appointment, b: Appointment): number {
  const rank = QUEUE_RANK[a.status] - QUEUE_RANK[b.status];
  if (rank !== 0) return rank;
  if (a.priority !== b.priority) return a.priority ? -1 : 1;
  if (a.tokenNo !== null && b.tokenNo !== null) return a.tokenNo - b.tokenNo;
  if (a.tokenNo !== null) return -1;
  if (b.tokenNo !== null) return 1;
  return a.startTime.localeCompare(b.startTime);
}

// ---------------------------------------------------------------------------
// Wait time
// ---------------------------------------------------------------------------

/** Minutes from arrival to consult start, or null when either stamp is missing. */
export function waitMinutes(appointment: Appointment): number | null {
  if (!appointment.arrivedAt || !appointment.consultStartedAt) return null;
  const waited =
    new Date(appointment.consultStartedAt).getTime() -
    new Date(appointment.arrivedAt).getTime();
  if (!Number.isFinite(waited) || waited < 0) return null;
  return Math.round(waited / 60_000);
}

/** Average wait across the given appointments; null when none can be measured. */
export function averageWaitMinutes(appointments: Appointment[]): number | null {
  const waits = appointments
    .map(waitMinutes)
    .filter((minutes): minutes is number => minutes !== null);
  if (waits.length === 0) return null;
  return Math.round(waits.reduce((sum, n) => sum + n, 0) / waits.length);
}

/** How long someone has been waiting right now, for the live timer on a row. */
export function elapsedWaitMinutes(appointment: Appointment, now: number = Date.now()): number | null {
  if (!appointment.arrivedAt || appointment.consultStartedAt) return null;
  const waited = now - new Date(appointment.arrivedAt).getTime();
  if (!Number.isFinite(waited) || waited < 0) return null;
  return Math.floor(waited / 60_000);
}

// ---------------------------------------------------------------------------
// Fees
// ---------------------------------------------------------------------------

/**
 * Which consultation fee applies. A finalised visit with the same doctor inside
 * the doctor's `followUpFreeDays` window bills at the follow-up rate — which is
 * often zero, and is the rule clinics ask about first.
 */
export function consultationFeeFor(
  doctor: Doctor,
  patientId: string,
  visits: Visit[],
  onDate: string = todayIso(),
  excludeVisitId?: string
): { amount: number; isFollowUp: boolean; withinDays: number | null } {
  const window = doctor.followUpFreeDays ?? 0;
  if (window <= 0) {
    return { amount: doctor.consultationFee, isFollowUp: false, withinDays: null };
  }
  const previous = visits
    .filter(
      (v) =>
        v.patientId === patientId &&
        v.doctorId === doctor.id &&
        v.finalisedAt &&
        v.id !== excludeVisitId &&
        v.date <= onDate
    )
    .sort((a, b) => b.date.localeCompare(a.date))[0];

  if (!previous) {
    return { amount: doctor.consultationFee, isFollowUp: false, withinDays: null };
  }
  const gap = daysBetween(previous.date, onDate);
  if (gap >= 0 && gap <= window) {
    return { amount: doctor.followUpFee, isFollowUp: true, withinDays: window };
  }
  return { amount: doctor.consultationFee, isFollowUp: false, withinDays: null };
}

export function billSubtotal(bill: Bill): number {
  return billLines(bill).reduce((sum, line) => sum + (line.amount || 0), 0);
}

export function billTotal(lines: { amount: number }[], discount: number): number {
  const subtotal = lines.reduce((sum, line) => sum + (line.amount || 0), 0);
  return Math.max(0, round2(subtotal - (discount || 0)));
}

export function billDue(bill: Bill): number {
  return Math.max(0, round2((bill.total || 0) - (bill.paid || 0)));
}

/** Total outstanding across every bill for a patient. */
export function patientDues(bills: Bill[], patientId: string): number {
  return round2(
    bills
      .filter((b) => b.patientId === patientId)
      .reduce((sum, bill) => sum + billDue(bill), 0)
  );
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// ---------------------------------------------------------------------------
// No-shows
// ---------------------------------------------------------------------------

/**
 * Anything still `booked` on a day that has passed was a no-show. There is no
 * server to run this at midnight, so it is swept on open — which also means a
 * clinic that does not open for three days gets all three days marked the next
 * time they do. Reversible from the row.
 */
export function findLapsedBookings(
  appointments: Appointment[],
  today: string = todayIso()
): Appointment[] {
  return appointments.filter((a) => a.status === "booked" && a.date < today);
}

// ---------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------

/** "09:00" → 540. */
export function timeToMinutes(time: string): number {
  const [h, m] = (time || "0:0").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function minutesToTime(minutes: number): string {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Every slot start between open and close, in slot-length steps. */
export function buildSlots(openTime: string, closeTime: string, slotMinutes: number): string[] {
  const start = timeToMinutes(openTime);
  const end = timeToMinutes(closeTime);
  if (!(slotMinutes > 0) || end <= start) return [];
  const slots: string[] = [];
  for (let t = start; t < end; t += slotMinutes) slots.push(minutesToTime(t));
  return slots;
}

export function isWithinBreak(
  time: string,
  breaks: { start: string; end: string }[]
): boolean {
  const minutes = timeToMinutes(time);
  return breaks.some(
    (b) => minutes >= timeToMinutes(b.start) && minutes < timeToMinutes(b.end)
  );
}

/** Sunday = 0, matching `weeklyOffDays`. */
export function weekdayOf(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

export function isClinicClosed(
  dateKey: string,
  weeklyOffDays: number[],
  holidays: { date: string }[]
): boolean {
  if ((weeklyOffDays ?? []).includes(weekdayOf(dateKey))) return true;
  return (holidays ?? []).some((h) => h.date === dateKey);
}
