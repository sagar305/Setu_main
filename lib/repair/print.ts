// The printed outputs of §6: the job slip in both copies, the estimate and the
// invoice.
//
// Everything prints through a hidden iframe rather than a new window, the same
// way the clinic's prescriptions and the hire book's challans do — a popup
// blocker cannot swallow it, and the machine at the counter never navigates
// away from the board.
//
// The customer's copy of the job slip is the document this whole app exists to
// produce. It carries the condition checklist as it was recorded at intake, so
// the piece of paper the customer walks out with says the same thing as the
// record in the shop. That is what ends the argument three days later, and it
// is why the slip prints the condition items that were *not* present as well as
// the ones that were: "screen not cracked when received" is the useful half.

import type { Business } from "@/lib/pos/types";
import { formatMoney } from "@/lib/pos/types";
import {
  DEVICE_KIND_LABELS,
  addDays,
  dateKeyOf,
  deviceLabel,
  formatDate,
  type Bill,
  type Customer,
  type Job,
  type RepairSettings,
  type Technician,
} from "./types";
import { billTotals } from "./calc";

/** A5 joins the receipt sizes: §6 prints the job slip at 58mm or A5. */
export type RepairPaperSize = "58mm" | "80mm" | "a5" | "a4";

function pageRule(paper: RepairPaperSize): string {
  switch (paper) {
    case "58mm":
      return "@page { size: 58mm auto; margin: 3mm; }";
    case "80mm":
      return "@page { size: 80mm auto; margin: 4mm; }";
    case "a5":
      return "@page { size: A5 portrait; margin: 10mm; }";
    default:
      return "@page { size: A4 portrait; margin: 12mm; }";
  }
}

function documentStyles(paper: RepairPaperSize): string {
  const narrow = paper === "58mm" || paper === "80mm";
  return `
    ${pageRule(paper)}
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Sora", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
      color: #0E1124;
      font-size: ${narrow ? "10.5px" : "12px"};
      line-height: 1.45;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .doc { width: ${paper === "58mm" ? "52mm" : paper === "80mm" ? "72mm" : "100%"}; }
    h1 { font-size: ${narrow ? "13px" : "18px"}; margin: 0; letter-spacing: -0.01em; }
    h2 { font-size: ${narrow ? "11px" : "12.5px"}; margin: 0 0 1.5mm; text-transform: uppercase; letter-spacing: 0.05em; }
    .muted { color: #5F6478; }
    .center { text-align: center; }
    .right { text-align: right; }
    .row { display: flex; justify-content: space-between; gap: 4mm; }
    .rule { border-top: 1px dashed #B9BED0; margin: 2.5mm 0; }
    .head { display: flex; justify-content: space-between; gap: 6mm; align-items: flex-start; }
    .biz { font-weight: 800; font-size: ${narrow ? "12px" : "15px"}; }
    .badge {
      display: inline-block; border: 1px solid #0E1124; border-radius: 2mm;
      padding: 0.6mm 2mm; font-size: ${narrow ? "9px" : "10px"}; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.04em;
    }
    .label { font-size: ${narrow ? "9px" : "10px"}; text-transform: uppercase; letter-spacing: 0.06em; color: #5F6478; }
    .grid2 { display: flex; gap: 6mm; }
    .grid2 > div { flex: 1; }
    table { width: 100%; border-collapse: collapse; margin-top: 3mm; }
    th, td { text-align: left; padding: ${narrow ? "1mm 0" : "1.4mm 1mm"}; vertical-align: top; }
    th { font-size: ${narrow ? "9px" : "10px"}; text-transform: uppercase; letter-spacing: 0.05em; color: #5F6478; border-bottom: 1px solid #0E1124; }
    tbody td { border-bottom: 1px dotted #C9CDDC; }
    .totals { margin-top: 3mm; }
    .totals td { border: 0; padding: 0.8mm 0; }
    .totals .grand td { border-top: 1px solid #0E1124; font-weight: 800; padding-top: 1.5mm; }
    .cond { margin: 0; padding: 0; list-style: none; }
    .cond li { padding: 0.6mm 0; }
    .cond .yes { font-weight: 700; }
    .cond .no { color: #5F6478; }
    .box { border: 1px solid #C9CDDC; border-radius: 2mm; padding: 2.5mm; margin-top: 3mm; }
    .photos { display: flex; flex-wrap: wrap; gap: 2mm; margin-top: 2mm; }
    .photos img { width: ${narrow ? "22mm" : "34mm"}; border: 1px solid #C9CDDC; border-radius: 1.5mm; }
    .sign { margin-top: ${narrow ? "6mm" : "10mm"}; display: flex; gap: 8mm; }
    .sign > div { flex: 1; }
    .sign .line { border-top: 1px solid #0E1124; margin-top: ${narrow ? "8mm" : "12mm"}; padding-top: 1.2mm; font-size: ${narrow ? "8.5px" : "10px"}; }
    .sign img { height: ${narrow ? "10mm" : "14mm"}; object-fit: contain; display: block; }
    .terms { margin-top: 4mm; font-size: ${narrow ? "8.5px" : "9.5px"}; color: #5F6478; white-space: pre-wrap; }
    .tag { text-align: center; }
    .tag .jobno { font-size: 24px; font-weight: 800; letter-spacing: 0.02em; }
    .tag .device { font-size: 12px; font-weight: 700; margin-top: 1mm; }
  `;
}

export function escapeHtml(value: string): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Render HTML in a hidden frame and open the print dialog on it.
 *
 * Returns false when the frame could not be created, so the caller can say so
 * rather than appearing to do nothing.
 */
export function printHtml(html: string, paper: RepairPaperSize, title: string): boolean {
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
      `<style>${documentStyles(paper)}</style></head><body><div class="doc">${html}</div></body></html>`
  );
  frameDocument.close();

  const run = () => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } catch {
      // Printing is best-effort; nothing on screen depends on it working.
    }
    window.setTimeout(() => {
      if (frame.parentNode) document.body.removeChild(frame);
    }, 1000);
  };

  if (frameDocument.readyState === "complete") window.setTimeout(run, 50);
  else frame.onload = () => window.setTimeout(run, 50);
  return true;
}

export type PrintContext = {
  business: Business | null;
  job: Job;
  customer: Customer | null;
  technician: Technician | null;
  settings: RepairSettings;
  bill?: Bill | null;
};

function money(value: number, context: PrintContext): string {
  return formatMoney(value, context.business?.currency || "INR");
}

function header(context: PrintContext, title: string, badge?: string): string {
  const { business, job } = context;
  return `
    <div class="head">
      <div>
        <div class="biz">${escapeHtml(business?.name || "Repair shop")}</div>
        ${business?.address ? `<div class="muted">${escapeHtml(business.address)}</div>` : ""}
        <div class="muted">${escapeHtml(
          [business?.phone, business?.taxNumber ? `GSTIN ${business.taxNumber}` : ""]
            .filter(Boolean)
            .join(" · ")
        )}</div>
      </div>
      <div class="right">
        <h1>${escapeHtml(title)}</h1>
        <div class="muted">${escapeHtml(job.jobNo)}</div>
        ${badge ? `<div class="badge" style="margin-top:2mm">${escapeHtml(badge)}</div>` : ""}
      </div>
    </div>
  `;
}

function partyBlock(context: PrintContext): string {
  const { job, customer } = context;
  return `
    <div class="grid2" style="margin-top:4mm">
      <div>
        <div class="label">Customer</div>
        <div><strong>${escapeHtml(customer?.name || "—")}</strong></div>
        ${customer?.phone ? `<div class="muted">${escapeHtml(customer.phone)}</div>` : ""}
        ${customer?.companyName ? `<div class="muted">${escapeHtml(customer.companyName)}</div>` : ""}
        ${customer?.gstin ? `<div class="muted">GSTIN ${escapeHtml(customer.gstin)}</div>` : ""}
      </div>
      <div>
        <div class="label">Device</div>
        <div><strong>${escapeHtml(deviceLabel(job))}</strong></div>
        <div class="muted">${escapeHtml(DEVICE_KIND_LABELS[job.deviceKind])}${
          job.colour ? ` · ${escapeHtml(job.colour)}` : ""
        }</div>
        ${job.serialNo ? `<div class="muted">IMEI / Sl. ${escapeHtml(job.serialNo)}</div>` : ""}
      </div>
    </div>
  `;
}

/**
 * The condition checklist as recorded, both halves.
 *
 * Absent items are printed too, greyed. A slip that lists only the damage looks
 * like a complaint; a slip that lists what was checked and found sound is a
 * record, and it is the line that says "back panel — no damage" that a customer
 * cannot argue with later.
 */
function conditionBlock(job: Job): string {
  if (job.conditionIn.length === 0) return "";
  return `
    <div class="box">
      <h2>Condition when received</h2>
      <ul class="cond">
        ${job.conditionIn
          .map(
            (item) => `<li class="${item.present ? "yes" : "no"}">${
              item.present ? "✗" : "○"
            } ${escapeHtml(item.label)}${item.note ? ` — ${escapeHtml(item.note)}` : ""}</li>`
          )
          .join("")}
      </ul>
    </div>
  `;
}

function problemBlock(job: Job): string {
  const problems = job.reportedProblems.join(", ");
  if (!problems && !job.problemNote) return "";
  return `
    <div style="margin-top:3mm">
      <div class="label">Reported problem</div>
      <div>${escapeHtml(problems || "—")}</div>
      ${job.problemNote ? `<div class="muted">${escapeHtml(job.problemNote)}</div>` : ""}
    </div>
  `;
}

function accessoriesBlock(job: Job): string {
  return `
    <div style="margin-top:3mm">
      <div class="label">Accessories received</div>
      <div>${job.accessories.length > 0 ? escapeHtml(job.accessories.join(", ")) : "None"}</div>
    </div>
  `;
}

function signatureBlock(
  label: string,
  dataUrl: string,
  secondLabel = "For the shop"
): string {
  return `
    <div class="sign">
      <div>
        ${dataUrl ? `<img src="${dataUrl}" alt="" />` : ""}
        <div class="line">${escapeHtml(label)}</div>
      </div>
      <div><div class="line">${escapeHtml(secondLabel)}</div></div>
    </div>
  `;
}

const SLIP_TERMS = [
  "Devices not collected within 90 days of being ready may be disposed of to recover charges.",
  "Data loss can occur during any repair. Please keep your own backup — we are not responsible for data.",
  "The estimate is indicative. Any change will be told to you before the work is done.",
  "This slip must be produced when collecting the device.",
].join("\n");

// ---------------------------------------------------------------------------
// Job slip — customer copy
// ---------------------------------------------------------------------------

export function buildJobSlipHtml(context: PrintContext): string {
  const { job, technician } = context;
  return `
    ${header(context, "Job card", job.priority === "urgent" ? "Urgent" : undefined)}
    <div class="rule"></div>
    <div class="row">
      <div><span class="label">Received</span> ${escapeHtml(formatDate(dateKeyOf(job.createdAt)))}</div>
      <div class="right"><span class="label">Promised</span> ${escapeHtml(
        job.promisedDate ? formatDate(job.promisedDate) : "—"
      )}</div>
    </div>
    ${partyBlock(context)}
    ${problemBlock(job)}
    ${conditionBlock(job)}
    ${accessoriesBlock(job)}
    ${
      job.estimateAmount !== null
        ? `<div style="margin-top:3mm"><span class="label">Estimate</span> <strong>${escapeHtml(
            money(job.estimateAmount, context)
          )}</strong></div>`
        : ""
    }
    ${
      technician
        ? `<div style="margin-top:2mm"><span class="label">Technician</span> ${escapeHtml(
            technician.name
          )}</div>`
        : ""
    }
    ${
      job.customerNotes
        ? `<div style="margin-top:3mm"><span class="label">Notes</span><div>${escapeHtml(
            job.customerNotes
          )}</div></div>`
        : ""
    }
    <div class="terms">${escapeHtml(SLIP_TERMS)}</div>
    ${signatureBlock("Customer's signature", job.intakeSignatureDataUrl)}
  `;
}

export function printJobSlip(
  context: PrintContext,
  paper: RepairPaperSize = "a5"
): boolean {
  return printHtml(buildJobSlipHtml(context), paper, `Job card ${context.job.jobNo}`);
}

// ---------------------------------------------------------------------------
// Job slip — shop copy / device tag
// ---------------------------------------------------------------------------

/**
 * The sticker that goes on the device.
 *
 * Job number as large as 58mm will carry, because it is read across a workbench
 * covered in identical black phones, and the whole point is telling them apart
 * without picking each one up. Everything else on it is the minimum needed to
 * find the customer if the tag ends up separated from its device.
 */
export function buildDeviceTagHtml(context: PrintContext): string {
  const { job, customer, business } = context;
  return `
    <div class="tag">
      <div class="muted">${escapeHtml(business?.name || "")}</div>
      <div class="jobno">${escapeHtml(job.jobNo)}</div>
      <div class="device">${escapeHtml(deviceLabel(job))}</div>
      ${job.colour ? `<div class="muted">${escapeHtml(job.colour)}</div>` : ""}
      <div class="rule"></div>
      <div><strong>${escapeHtml(customer?.name || "—")}</strong></div>
      ${customer?.phone ? `<div>${escapeHtml(customer.phone)}</div>` : ""}
      ${
        job.serialNo
          ? `<div class="muted" style="margin-top:1mm">${escapeHtml(job.serialNo)}</div>`
          : ""
      }
      <div class="muted" style="margin-top:1mm">In ${escapeHtml(
        formatDate(dateKeyOf(job.createdAt))
      )}${job.priority === "urgent" ? " · URGENT" : ""}</div>
    </div>
  `;
}

export function printDeviceTag(context: PrintContext): boolean {
  return printHtml(buildDeviceTagHtml(context), "58mm", `Tag ${context.job.jobNo}`);
}

// ---------------------------------------------------------------------------
// Estimate
// ---------------------------------------------------------------------------

const ESTIMATE_VALID_DAYS = 7;

/**
 * The itemised estimate of §6.
 *
 * §3.3's action list does not name a "print estimate" action, but §6 requires
 * the document, so it is offered from the job's actions alongside the slip.
 * OPEN QUESTION: confirm the estimate belongs on the job's action list.
 */
export function buildEstimateHtml(context: PrintContext): string {
  const { job, settings } = context;
  const totals = billTotals(job, settings);
  const validUntil = addDays(dateKeyOf(job.createdAt) || "", ESTIMATE_VALID_DAYS);

  const partRows =
    job.partsUsed.length > 0
      ? job.partsUsed
          .map(
            (part) => `
        <tr>
          <td>${escapeHtml(part.name)}</td>
          <td class="right">${part.quantity}</td>
          <td class="right">${escapeHtml(money(part.sellingPrice, context))}</td>
          <td class="right">${escapeHtml(
            money(part.sellingPrice * part.quantity, context)
          )}</td>
        </tr>`
          )
          .join("")
      : `<tr><td colspan="4" class="muted">To be confirmed after diagnosis</td></tr>`;

  return `
    ${header(context, "Estimate")}
    <div class="rule"></div>
    ${partyBlock(context)}
    ${problemBlock(job)}
    ${
      job.diagnosis
        ? `<div style="margin-top:3mm"><span class="label">Diagnosis</span><div>${escapeHtml(
            job.diagnosis
          )}</div></div>`
        : ""
    }
    <table>
      <thead>
        <tr><th>Part</th><th class="right">Qty</th><th class="right">Rate</th><th class="right">Amount</th></tr>
      </thead>
      <tbody>${partRows}</tbody>
    </table>
    <table class="totals">
      <tr><td>Parts</td><td class="right">${escapeHtml(money(totals.partsTotal, context))}</td></tr>
      <tr><td>Labour</td><td class="right">${escapeHtml(money(totals.labourCharge, context))}</td></tr>
      ${
        totals.taxAmount
          ? `<tr><td>Tax (${totals.taxRate}%)</td><td class="right">${escapeHtml(
              money(totals.taxAmount, context)
            )}</td></tr>`
          : ""
      }
      <tr class="grand"><td>Estimated total</td><td class="right">${escapeHtml(
        money(
          totals.total > 0 ? totals.total : (job.estimateAmount ?? 0),
          context
        )
      )}</td></tr>
    </table>
    <div class="terms">This estimate is valid until ${escapeHtml(
      formatDate(validUntil)
    )}. Work begins only once you approve it. If the fault turns out to be different once the device is opened, we will tell you the revised figure before going ahead.</div>
  `;
}

export function printEstimate(context: PrintContext): boolean {
  return printHtml(buildEstimateHtml(context), "a5", `Estimate ${context.job.jobNo}`);
}

// ---------------------------------------------------------------------------
// Invoice
// ---------------------------------------------------------------------------

/**
 * The bill, with the warranty terms and expiry on it.
 *
 * The warranty line is not decoration: it is the thing the customer will come
 * back holding, and printing the actual expiry date rather than "90 days"
 * removes the argument about when the clock started.
 */
export function buildInvoiceHtml(context: PrintContext): string {
  const { job, bill, settings } = context;
  if (!bill) return "";

  const warrantyEnd = job.warrantyDays > 0 && job.deliveredOn
    ? addDays(job.deliveredOn, job.warrantyDays)
    : "";
  const due = Math.max(0, bill.total - bill.paid);

  const rows = [
    ...bill.partLines.map(
      (line) => `
        <tr>
          <td>${escapeHtml(line.label)}</td>
          <td class="right">${line.quantity}</td>
          <td class="right">${escapeHtml(money(line.unitPrice, context))}</td>
          <td class="right">${escapeHtml(money(line.amount, context))}</td>
        </tr>`
    ),
    bill.labourCharge
      ? `<tr><td>Labour / service charge</td><td class="right">1</td><td class="right">${escapeHtml(
          money(bill.labourCharge, context)
        )}</td><td class="right">${escapeHtml(money(bill.labourCharge, context))}</td></tr>`
      : "",
  ].join("");

  return `
    ${header(context, "Invoice", bill.invoiceNo)}
    <div class="rule"></div>
    <div class="row">
      <div><span class="label">Date</span> ${escapeHtml(formatDate(bill.date))}</div>
      <div class="right"><span class="label">Job</span> ${escapeHtml(job.jobNo)}</div>
    </div>
    ${partyBlock(context)}
    ${
      job.workDone
        ? `<div style="margin-top:3mm"><span class="label">Work done</span><div>${escapeHtml(
            job.workDone
          )}</div></div>`
        : ""
    }
    <table>
      <thead>
        <tr><th>Description</th><th class="right">Qty</th><th class="right">Rate</th><th class="right">Amount</th></tr>
      </thead>
      <tbody>${rows || `<tr><td colspan="4" class="muted">No charge</td></tr>`}</tbody>
    </table>
    <table class="totals">
      ${
        bill.discount
          ? `<tr><td>Discount</td><td class="right">− ${escapeHtml(
              money(bill.discount, context)
            )}</td></tr>`
          : ""
      }
      ${
        bill.taxAmount
          ? `<tr><td>Tax (${bill.taxRate}%)</td><td class="right">${escapeHtml(
              money(bill.taxAmount, context)
            )}</td></tr>`
          : ""
      }
      <tr class="grand"><td>Total</td><td class="right">${escapeHtml(
        money(bill.total, context)
      )}</td></tr>
      <tr><td>Paid${bill.paymentMode ? ` (${escapeHtml(bill.paymentMode)})` : ""}</td><td class="right">${escapeHtml(
        money(bill.paid, context)
      )}</td></tr>
      ${
        due > 0
          ? `<tr><td><strong>Balance due</strong></td><td class="right"><strong>${escapeHtml(
              money(due, context)
            )}</strong></td></tr>`
          : ""
      }
    </table>
    <div class="box">
      <h2>Warranty</h2>
      ${
        warrantyEnd
          ? `<div>This repair is covered for <strong>${job.warrantyDays} days</strong>, until <strong>${escapeHtml(
              formatDate(warrantyEnd)
            )}</strong>.</div>`
          : `<div>No warranty is offered on this repair.</div>`
      }
      <div class="muted" style="margin-top:1.5mm">Cover applies to the same fault and the parts replaced here. It does not cover physical damage, liquid damage, or a device opened elsewhere after this repair. Please bring this invoice when making a claim.</div>
    </div>
    ${
      settings.taxEnabled
        ? ""
        : `<div class="terms">This is a bill of supply for your records.</div>`
    }
    ${signatureBlock("Received by (customer)", job.deliverySignatureDataUrl)}
  `;
}

export function printInvoice(context: PrintContext, paper?: RepairPaperSize): boolean {
  if (!context.bill) return false;
  return printHtml(
    buildInvoiceHtml(context),
    paper ?? context.settings.receiptPaperSize,
    `Invoice ${context.bill.invoiceNo}`
  );
}
