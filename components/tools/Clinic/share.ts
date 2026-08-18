// Builders for the links the clinic sends patients.
//
// Each of these mirrors the matching layout in lib/clinic/print.ts, so what a
// patient opens on their phone says the same things, in the same order, as the
// paper they may also be holding. Nothing is summarised or reworded here.
//
// As everywhere else in the toolkit, the link is self-contained by default —
// the document rides inside it and nothing is uploaded. Shortening is a
// separate, deliberate press inside the share sheet.

import {
  businessToShare,
  type SharedAppointment,
  type SharedInvoice,
  type SharedPrescription,
  type ShareLineItem,
  type ShareRxMedicine,
} from "@/lib/toolkit/shareLink";
import { formatMoney, type Business } from "@/lib/pos/types";
import { formatAgeSex } from "@/lib/clinic/calc";
import {
  billLines,
  visitInvestigations,
  visitMedicines,
  visitVitals,
  FORM_SHORT,
  TIMING_LABELS,
  type Appointment,
  type Bill,
  type ClinicSettings,
  type Doctor,
  type Patient,
  type Visit,
} from "@/lib/clinic/types";

/** Vitals as the prescription prints them, so the two never drift apart. */
function vitalsLines(visit: Visit, settings: ClinicSettings): string[] {
  if (!settings.showVitalsOnRx) return [];
  const v = visitVitals(visit);
  return [
    v.bp ? `BP ${v.bp}` : "",
    v.pulse ? `Pulse ${v.pulse}/min` : "",
    v.tempF ? `Temp ${v.tempF}°F` : "",
    v.spo2 ? `SpO₂ ${v.spo2}%` : "",
    v.weightKg ? `Wt ${v.weightKg} kg` : "",
    v.heightCm ? `Ht ${v.heightCm} cm` : "",
    v.bmi ? `BMI ${v.bmi}` : "",
  ].filter(Boolean);
}

function medicineLines(visit: Visit): ShareRxMedicine[] {
  return visitMedicines(visit).map((line) => {
    const note = [line.timing ? TIMING_LABELS[line.timing] : "", line.instructions]
      .filter(Boolean)
      .join(" · ");
    return {
      n: [FORM_SHORT[line.form] ?? "", line.name, line.strength].filter(Boolean).join(" "),
      f: line.frequency || undefined,
      d: line.durationDays ? `${line.durationDays} days` : undefined,
      q: line.quantity ? String(line.quantity) : undefined,
      nt: note || undefined,
    };
  });
}

export function prescriptionDoc(
  business: Business | null,
  settings: ClinicSettings,
  doctor: Doctor | null,
  patient: Patient,
  visit: Visit
): SharedPrescription {
  const allergies = (patient.allergies ?? []).filter(Boolean);
  const vitals = vitalsLines(visit, settings);
  const investigations = visitInvestigations(visit).filter(Boolean);
  const age = formatAgeSex(patient, visit.date);

  return {
    t: "rx",
    b: businessToShare(business),
    pn: patient.name,
    cp: patient.phone || undefined,
    ag: age || undefined,
    fl: patient.code || undefined,
    dt: visit.date,
    // The header is suppressed on paper when printing onto a letterhead pad;
    // on a phone there is no letterhead, so the doctor is always named.
    dr: doctor?.name || undefined,
    drq: [doctor?.qualifications, doctor?.speciality].filter(Boolean).join(" · ") || undefined,
    reg: doctor?.registrationNo || undefined,
    vit: vitals.length > 0 ? vitals : undefined,
    alg: allergies.length > 0 ? allergies : undefined,
    dx: visit.diagnosis || undefined,
    med: medicineLines(visit),
    inv: investigations.length > 0 ? investigations : undefined,
    adv: visit.advice || undefined,
    fu: visit.followUpDays ?? undefined,
    ft: settings.rxFooterText || undefined,
  };
}

export function appointmentDoc(
  business: Business | null,
  patient: Patient,
  appointment: Appointment,
  doctor: Doctor | null
): SharedAppointment {
  return {
    t: "apt",
    b: businessToShare(business),
    cn: patient.name,
    cp: patient.phone || undefined,
    svc: doctor?.name ? `Consultation — ${doctor.name}` : "Consultation",
    dt: appointment.date,
    tm: appointment.startTime,
    dur: appointment.durationMinutes ?? undefined,
    note: appointment.reason || undefined,
  };
}

export function receiptDoc(
  business: Business | null,
  patient: Patient,
  bill: Bill,
  currency: string
): SharedInvoice {
  // Clinic charges are flat amounts, not rate × quantity, so each becomes a
  // single-unit line — which is exactly how the printed receipt reads.
  const items: ShareLineItem[] = billLines(bill).map((line) => ({
    n: line.label,
    q: 1,
    r: line.amount,
  }));
  const subtotal = items.reduce((sum, item) => sum + item.r, 0);
  const due = Math.max(0, bill.total - bill.paid);

  return {
    t: "inv",
    b: { ...businessToShare(business, currency), cur: currency },
    no: bill.receiptNo,
    dt: bill.date,
    cn: patient.name,
    cp: patient.phone || undefined,
    it: items,
    sub: subtotal,
    dis: bill.discount || undefined,
    tot: bill.total,
    // A partly-paid bill has to say so, or the patient reads it as settled.
    pm:
      due > 0
        ? `${bill.paymentMode} · ${formatMoney(due, currency)} due`
        : `Paid by ${bill.paymentMode}`,
  };
}
