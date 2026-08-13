"use client";

// Printing for prescriptions, investigation slips and chart exports.
//
// The markup is written into a hidden iframe as a standalone document rather
// than printed through an @media print stylesheet on the page — the same
// approach as FreeDine/printing.ts, for the same reason: the surrounding site
// (nav, footer, Tailwind's preflight) leaks into the sheet in ways that are
// miserable to debug on someone else's printer.
//
// Deliberately not html2canvas. A prescription rasterised to a bitmap prints
// soft, cannot be searched, and cannot be selected by a pharmacist reading it
// on screen. Real text goes to the printer; jsPDF is only for share-as-PDF.

import {
  FORM_SHORT,
  TIMING_LABELS,
  formatDate,
  visitInvestigations,
  visitMedicines,
  visitVitals,
  type ClinicSettings,
  type Doctor,
  type Patient,
  type RxPaperSize,
  type Visit,
} from "./types";
import { dosesPerDay, formatAgeSex, patientAge, formatAge } from "./calc";
import type { Business } from "@/lib/pos/types";

// ---------------------------------------------------------------------------
// Document styling
// ---------------------------------------------------------------------------

/**
 * One stylesheet, shared by the print document and the on-screen live preview,
 * so what the doctor sees in the Consult screen is what comes out of the tray.
 */
const DOC_RULES = `
  * { box-sizing: border-box; }
  .rx { color: #000; background: #fff; font-family: "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
  .rx h1, .rx h2, .rx h3, .rx p, .rx ul, .rx ol { margin: 0; padding: 0; }
  .rx .clinic-name { font-size: 17pt; font-weight: 700; letter-spacing: -0.01em; }
  .rx .clinic-meta { font-size: 8.5pt; color: #333; margin-top: 2px; }
  .rx .doctor-name { font-size: 11pt; font-weight: 700; }
  .rx .doctor-meta { font-size: 8.5pt; color: #333; }
  .rx .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
  .rx .head-right { text-align: right; }
  .rx .rule { border-top: 1.5px solid #000; margin: 8px 0; }
  .rx .thin-rule { border-top: 1px solid #999; margin: 7px 0; }
  .rx .patient { display: flex; flex-wrap: wrap; gap: 4px 20px; font-size: 9.5pt; }
  .rx .patient b { font-weight: 600; }
  .rx .vitals { display: flex; flex-wrap: wrap; gap: 3px 16px; font-size: 8.5pt; color: #222; margin-top: 5px; }
  .rx .allergy { margin-top: 6px; padding: 4px 8px; border: 1px solid #000; font-size: 9pt; font-weight: 700; }
  .rx .section { margin-top: 9px; }
  .rx .section-label { font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #444; }
  .rx .section-body { font-size: 9.5pt; white-space: pre-wrap; margin-top: 2px; }
  .rx .rx-symbol { font-size: 21pt; font-weight: 700; font-family: Georgia, "Times New Roman", serif; line-height: 1; }
  .rx table { width: 100%; border-collapse: collapse; margin-top: 4px; }
  .rx th { font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.05em; color: #444; text-align: left; padding: 3px 6px 3px 0; border-bottom: 1px solid #999; font-weight: 700; }
  .rx td { font-size: 9.5pt; padding: 5px 6px 5px 0; vertical-align: top; border-bottom: 1px solid #e5e5e5; }
  .rx td.num { width: 20px; color: #555; }
  .rx .med-name { font-weight: 600; }
  .rx .med-note { font-size: 8.5pt; color: #333; }
  .rx .nowrap { white-space: nowrap; }
  .rx ol.list { padding-left: 16px; font-size: 9.5pt; }
  .rx ol.list li { margin-bottom: 2px; }
  .rx .followup { margin-top: 9px; font-size: 10pt; font-weight: 700; }
  .rx .sign { margin-top: 22px; text-align: right; }
  .rx .sign img { max-height: 52px; max-width: 190px; display: inline-block; }
  .rx .sign-line { border-top: 1px solid #000; display: inline-block; padding-top: 3px; min-width: 175px; text-align: center; font-size: 8.5pt; }
  .rx .footer { margin-top: 14px; padding-top: 5px; border-top: 1px solid #ccc; font-size: 7.5pt; color: #555; text-align: center; }
  .rx .chart-visit { padding: 9px 0; border-bottom: 1px solid #ddd; page-break-inside: avoid; }
  .rx .chart-date { font-size: 10pt; font-weight: 700; }
  .rx .muted { color: #555; }
`;

export const PREVIEW_CLASS = "rx";

/** The live preview in the Consult screen renders under this stylesheet. */
export function previewStyleSheet(): string {
  return DOC_RULES;
}

function documentStyles(paper: RxPaperSize): string {
  return `
    @page { size: ${paper === "a5" ? "A5" : "A4"}; margin: ${paper === "a5" ? "8mm" : "12mm"}; }
    html, body {
      margin: 0; padding: 0; background: #fff; color: #000;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    ${DOC_RULES}
  `;
}

// ---------------------------------------------------------------------------
// Printing
// ---------------------------------------------------------------------------

/**
 * Print an HTML string as a standalone document.
 *
 * Returns false when the iframe could not be created, so the caller can leave
 * the on-screen preview up rather than silently appearing to do nothing.
 */
export function printHtml(html: string, paper: RxPaperSize, title: string): boolean {
  if (typeof document === "undefined") return false;

  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  document.body.appendChild(frame);

  const frameDocument = frame.contentWindow?.document;
  if (!frameDocument) {
    document.body.removeChild(frame);
    return false;
  }

  frameDocument.open();
  frameDocument.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>` +
      `<style>${documentStyles(paper)}</style></head><body><div class="rx">${html}</div></body></html>`
  );
  frameDocument.close();

  const run = () => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } catch {
      // Printing is best-effort; the on-screen copy is still readable.
    }
    // Give the print dialog time to take its snapshot before tearing down.
    window.setTimeout(() => {
      if (frame.parentNode) document.body.removeChild(frame);
    }, 1000);
  };

  if (frameDocument.readyState === "complete") {
    window.setTimeout(run, 50);
  } else {
    frame.onload = () => window.setTimeout(run, 50);
  }
  return true;
}

export function escapeHtml(value: string): string {
  return (value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Escape, then turn newlines into <br> for free-text blocks. */
function multiline(value: string): string {
  return escapeHtml(value).replace(/\n/g, "<br>");
}

// ---------------------------------------------------------------------------
// Prescription
// ---------------------------------------------------------------------------

export type RxContext = {
  business: Business | null;
  settings: ClinicSettings;
  doctor: Doctor | null;
  patient: Patient;
  visit: Visit;
};

function headerBlock(ctx: RxContext): string {
  // Suppressed when printing onto a pre-printed letterhead pad.
  if (!ctx.settings.printClinicHeader) return "";
  const { business, doctor } = ctx;
  const clinicLines = [business?.address, business?.phone].filter(Boolean).join(" · ");
  const doctorLines = [doctor?.qualifications, doctor?.speciality].filter(Boolean).join(" · ");
  return `
    <div class="head">
      <div>
        <div class="clinic-name">${escapeHtml(business?.name ?? "")}</div>
        ${clinicLines ? `<div class="clinic-meta">${escapeHtml(clinicLines)}</div>` : ""}
      </div>
      <div class="head-right">
        <div class="doctor-name">${escapeHtml(doctor?.name ?? "")}</div>
        ${doctorLines ? `<div class="doctor-meta">${escapeHtml(doctorLines)}</div>` : ""}
        ${
          doctor?.registrationNo
            ? `<div class="doctor-meta">Reg. No: ${escapeHtml(doctor.registrationNo)}</div>`
            : ""
        }
      </div>
    </div>
    <div class="rule"></div>
  `;
}

function patientBlock(ctx: RxContext, showVitals: boolean): string {
  const { patient, visit, settings } = ctx;
  const age = formatAgeSex(patient, visit.date);
  const cells = [
    `<span><b>${escapeHtml(patient.name)}</b></span>`,
    age ? `<span>${escapeHtml(age)}</span>` : "",
    patient.code ? `<span>File: ${escapeHtml(patient.code)}</span>` : "",
    `<span>Date: ${escapeHtml(formatDate(visit.date))}</span>`,
  ]
    .filter(Boolean)
    .join("");

  const allergies = (patient.allergies ?? []).filter(Boolean);
  const allergyBanner = allergies.length
    ? `<div class="allergy">ALLERGIES: ${escapeHtml(allergies.join(", "))}</div>`
    : "";

  let vitalsRow = "";
  if (showVitals && settings.showVitalsOnRx) {
    const v = visitVitals(visit);
    const parts = [
      v.bp ? `BP ${v.bp}` : "",
      v.pulse ? `Pulse ${v.pulse}/min` : "",
      v.tempF ? `Temp ${v.tempF}°F` : "",
      v.spo2 ? `SpO₂ ${v.spo2}%` : "",
      v.weightKg ? `Wt ${v.weightKg} kg` : "",
      v.heightCm ? `Ht ${v.heightCm} cm` : "",
      v.bmi ? `BMI ${v.bmi}` : "",
    ].filter(Boolean);
    if (parts.length) {
      vitalsRow = `<div class="vitals">${parts
        .map((part) => `<span>${escapeHtml(part)}</span>`)
        .join("")}</div>`;
    }
  }

  return `<div class="patient">${cells}</div>${vitalsRow}${allergyBanner}<div class="thin-rule"></div>`;
}

function textSection(label: string, value: string): string {
  if (!value || !value.trim()) return "";
  return `
    <div class="section">
      <div class="section-label">${escapeHtml(label)}</div>
      <div class="section-body">${multiline(value.trim())}</div>
    </div>
  `;
}

function medicinesBlock(visit: Visit): string {
  const lines = visitMedicines(visit);
  if (lines.length === 0) return "";
  const rows = lines
    .map((line, index) => {
      const title = [FORM_SHORT[line.form] ?? "", line.name, line.strength]
        .filter(Boolean)
        .join(" ");
      const notes = [
        line.timing ? TIMING_LABELS[line.timing] : "",
        line.instructions,
      ]
        .filter(Boolean)
        .join(" · ");
      const duration = line.durationDays ? `${line.durationDays} days` : "";
      const quantity = line.quantity ? `${line.quantity}` : "";
      return `
        <tr>
          <td class="num">${index + 1}.</td>
          <td>
            <div class="med-name">${escapeHtml(title)}</div>
            ${notes ? `<div class="med-note">${escapeHtml(notes)}</div>` : ""}
          </td>
          <td class="nowrap">${escapeHtml(line.frequency)}</td>
          <td class="nowrap">${escapeHtml(duration)}</td>
          <td class="nowrap">${escapeHtml(quantity)}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <div class="section">
      <div class="rx-symbol">℞</div>
      <table>
        <thead>
          <tr>
            <th></th><th>Medicine</th><th>Dosage</th><th>Duration</th><th>Qty</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function investigationsBlock(visit: Visit): string {
  const items = visitInvestigations(visit).filter(Boolean);
  if (items.length === 0) return "";
  return `
    <div class="section">
      <div class="section-label">Investigations advised</div>
      <ol class="list">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>
    </div>
  `;
}

function followUpBlock(visit: Visit): string {
  if (!visit.followUpDays) return "";
  return `<div class="followup">Review after ${visit.followUpDays} days</div>`;
}

function signatureBlock(doctor: Doctor | null): string {
  const signature = doctor?.signatureDataUrl
    ? `<div><img src="${doctor.signatureDataUrl}" alt=""></div>`
    : "";
  const caption = [doctor?.name, doctor?.registrationNo ? `Reg. No: ${doctor.registrationNo}` : ""]
    .filter(Boolean)
    .join(" · ");
  return `
    <div class="sign">
      ${signature}
      <div class="sign-line">${escapeHtml(caption)}</div>
    </div>
  `;
}

function footerBlock(settings: ClinicSettings): string {
  if (!settings.rxFooterText) return "";
  return `<div class="footer">${escapeHtml(settings.rxFooterText)}</div>`;
}

/** The full prescription, in the order spec §7 lists it. */
export function buildPrescriptionHtml(ctx: RxContext): string {
  const { visit } = ctx;
  return [
    headerBlock(ctx),
    patientBlock(ctx, true),
    textSection("Complaints", visit.complaints),
    textSection("Findings", visit.findings),
    textSection("Diagnosis", visit.diagnosis),
    medicinesBlock(visit),
    investigationsBlock(visit),
    textSection("Advice", visit.advice),
    followUpBlock(visit),
    signatureBlock(ctx.doctor),
    footerBlock(ctx.settings),
  ].join("");
}

export function printPrescription(ctx: RxContext): boolean {
  return printHtml(
    buildPrescriptionHtml(ctx),
    ctx.settings.rxPaperSize,
    `Prescription — ${ctx.patient.name}`
  );
}

// ---------------------------------------------------------------------------
// Investigation slip
// ---------------------------------------------------------------------------

/** Always A5 — it is a slip, not a sheet (spec §7). */
export function buildInvestigationSlipHtml(ctx: RxContext): string {
  const items = visitInvestigations(ctx.visit).filter(Boolean);
  return [
    headerBlock(ctx),
    patientBlock(ctx, false),
    `<div class="section">
      <div class="section-label">Investigations advised</div>
      <ol class="list">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>
    </div>`,
    signatureBlock(ctx.doctor),
    footerBlock(ctx.settings),
  ].join("");
}

export function printInvestigationSlip(ctx: RxContext): boolean {
  return printHtml(
    buildInvestigationSlipHtml(ctx),
    "a5",
    `Investigations — ${ctx.patient.name}`
  );
}

// ---------------------------------------------------------------------------
// Patient chart export
// ---------------------------------------------------------------------------

/** Full visit history on A4, for a referral or a handover. */
export function buildChartHtml(
  business: Business | null,
  settings: ClinicSettings,
  patient: Patient,
  visits: Visit[],
  doctors: Doctor[]
): string {
  const doctorName = (id: string) => doctors.find((d) => d.id === id)?.name ?? "";
  const age = patientAge(patient);
  const header = `
    <div class="head">
      <div>
        <div class="clinic-name">${escapeHtml(business?.name ?? "")}</div>
        <div class="clinic-meta">Patient record</div>
      </div>
      <div class="head-right">
        <div class="doctor-name">${escapeHtml(patient.name)}</div>
        <div class="doctor-meta">${escapeHtml(
          [patient.code, formatAge(age), patient.sex, patient.phone].filter(Boolean).join(" · ")
        )}</div>
      </div>
    </div>
    <div class="rule"></div>
  `;

  const alerts = [
    (patient.allergies ?? []).length
      ? `ALLERGIES: ${(patient.allergies ?? []).join(", ")}`
      : "",
    (patient.chronicConditions ?? []).length
      ? `CHRONIC: ${(patient.chronicConditions ?? []).join(", ")}`
      : "",
  ].filter(Boolean);
  const alertBlock = alerts.length
    ? `<div class="allergy">${escapeHtml(alerts.join("  |  "))}</div>`
    : "";

  const body = visits.length
    ? visits
        .map((visit) => {
          const v = visitVitals(visit);
          const vitals = [
            v.bp ? `BP ${v.bp}` : "",
            v.pulse ? `Pulse ${v.pulse}` : "",
            v.tempF ? `Temp ${v.tempF}°F` : "",
            v.weightKg ? `Wt ${v.weightKg} kg` : "",
            v.bmi ? `BMI ${v.bmi}` : "",
          ]
            .filter(Boolean)
            .join(" · ");
          const meds = visitMedicines(visit)
            .map((line) =>
              [FORM_SHORT[line.form] ?? "", line.name, line.strength, line.frequency]
                .filter(Boolean)
                .join(" ")
            )
            .join("; ");
          return `
            <div class="chart-visit">
              <div class="chart-date">${escapeHtml(formatDate(visit.date))} — ${escapeHtml(
                doctorName(visit.doctorId)
              )}</div>
              ${vitals ? `<div class="med-note">${escapeHtml(vitals)}</div>` : ""}
              ${
                visit.complaints
                  ? `<div class="section-body"><b>Complaints:</b> ${multiline(visit.complaints)}</div>`
                  : ""
              }
              ${
                visit.diagnosis
                  ? `<div class="section-body"><b>Diagnosis:</b> ${multiline(visit.diagnosis)}</div>`
                  : ""
              }
              ${meds ? `<div class="section-body"><b>Rx:</b> ${escapeHtml(meds)}</div>` : ""}
              ${
                visit.advice
                  ? `<div class="section-body"><b>Advice:</b> ${multiline(visit.advice)}</div>`
                  : ""
              }
            </div>
          `;
        })
        .join("")
    : `<div class="section-body muted">No consultations recorded yet.</div>`;

  return [
    header,
    alertBlock,
    `<div class="section"><div class="section-label">Consultation history (${visits.length})</div>${body}</div>`,
    footerBlock(settings),
  ].join("");
}

export function printChart(
  business: Business | null,
  settings: ClinicSettings,
  patient: Patient,
  visits: Visit[],
  doctors: Doctor[]
): boolean {
  return printHtml(
    buildChartHtml(business, settings, patient, visits, doctors),
    "a4",
    `Patient record — ${patient.name}`
  );
}

// ---------------------------------------------------------------------------
// Share as PDF
// ---------------------------------------------------------------------------

/**
 * The share path, as distinct from the print path. jsPDF is loaded on demand
 * so the Consult screen does not carry it until someone actually shares.
 */
export async function prescriptionToPdfBlob(ctx: RxContext): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const paper = ctx.settings.rxPaperSize === "a5" ? "a5" : "a4";
  const doc = new jsPDF({ unit: "mm", format: paper });
  const html = `<div class="rx" style="width:${paper === "a5" ? 132 : 186}mm">${buildPrescriptionHtml(
    ctx
  )}</div><style>${DOC_RULES}</style>`;

  await doc.html(html, {
    x: paper === "a5" ? 8 : 12,
    y: paper === "a5" ? 8 : 12,
    width: paper === "a5" ? 132 : 186,
    windowWidth: paper === "a5" ? 500 : 700,
  });
  return doc.output("blob");
}

/** Rough per-day dose count, surfaced next to the quantity field in the pad. */
export function describeFrequency(frequency: string): string {
  const perDay = dosesPerDay(frequency);
  if (perDay === null) return "";
  return `${perDay} per day`;
}
