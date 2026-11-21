// The printed outputs of §6: the job card (customer and shop copies), the
// device tag, the estimate and the invoice.
//
// Everything prints through a hidden iframe rather than a new window, the same
// way the clinic's prescriptions and the hire book's challans do — a popup
// blocker cannot swallow it, and the machine at the counter never navigates
// away from the board.
//
// The customer's copy of the job card is the document this whole app exists to
// produce. It carries the condition checklist as it was recorded at intake, so
// the piece of paper the customer walks out with says the same thing as the
// record in the shop. That is what ends the argument three days later, and it
// is why the card prints the condition items that were *not* present as well as
// the ones that were: "screen not cracked when received" is the useful half.
//
// Layout follows the job card Indian service counters already use: a bordered
// sheet, the shop's letterhead, a title bar, the job number large, customer and
// device side by side, then the problem, accessories and condition in a ruled
// table, numbered terms and two signature boxes. Sizes are in points because
// this is paper — the old pixel sizes printed at 7–9pt, which is what shops
// complained about.

import QRCode from "qrcode";
import type { Business } from "@/lib/pos/types";
import { formatMoney } from "@/lib/pos/types";
import {
  DEFAULT_SLIP_TERMS,
  DEVICE_KIND_LABELS,
  addDays,
  dateKeyOf,
  deviceLabel,
  formatDate,
  formatDateTime,
  type Bill,
  type Customer,
  type Job,
  type OutsideRepair,
  type RepairSettings,
  type Technician,
  type Vendor,
} from "./types";
import { billTotals } from "./calc";
import { amountInWordsIndian } from "@/lib/invoice";

export type RepairPaperSize = "58mm" | "80mm" | "a5" | "a4";

/** How a sheet is laid out: a whole A4/A5 page, half an A4 page, or a roll. */
type Scale = "full" | "half" | "narrow";

function pageRule(paper: RepairPaperSize, twoCopy: boolean): string {
  switch (paper) {
    case "58mm":
      return "@page { size: 58mm auto; margin: 3mm; }";
    case "80mm":
      return "@page { size: 80mm auto; margin: 4mm; }";
    case "a5":
      return "@page { size: A5 portrait; margin: 8mm; }";
    default:
      return `@page { size: A4 portrait; margin: ${twoCopy ? "7mm 9mm" : "10mm"}; }`;
  }
}

function scaleFor(paper: RepairPaperSize, twoCopy: boolean): Scale {
  if (paper === "58mm" || paper === "80mm") return "narrow";
  if (paper === "a5" || twoCopy) return "half";
  return "full";
}

/** Font sizes per scale, in points. */
const SIZES: Record<Scale, Record<"base" | "biz" | "title" | "jobno" | "label" | "small", string>> = {
  full: { base: "10.5pt", biz: "17pt", title: "12.5pt", jobno: "17pt", label: "8.5pt", small: "8.5pt" },
  half: { base: "9.5pt", biz: "14pt", title: "11pt", jobno: "14pt", label: "7.5pt", small: "7.5pt" },
  narrow: { base: "8.5pt", biz: "11pt", title: "9.5pt", jobno: "13pt", label: "7pt", small: "7pt" },
};

export function documentStyles(paper: RepairPaperSize, twoCopy = false): string {
  const scale = scaleFor(paper, twoCopy);
  const size = SIZES[scale];
  const narrow = scale === "narrow";
  return `
    ${pageRule(paper, twoCopy)}
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: "Sora", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Arial, sans-serif;
      color: #000;
      font-size: ${size.base};
      line-height: 1.35;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .doc { width: ${paper === "58mm" ? "52mm" : paper === "80mm" ? "72mm" : "100%"}; }
    .sheet { border: ${narrow ? "0" : "1.2pt solid #000"}; display: flex; flex-direction: column; }
    .sheet .grow { flex: 1; }
    ${
      // A whole page reads as a printed form: the sheet's border runs to the
      // foot of the page, with the slack taken up above the signatures.
      paper === "a4" && !twoCopy
        ? ".doc > .sheet { min-height: 272mm; }"
        : paper === "a5"
          ? ".doc > .sheet { min-height: 190mm; }"
          : ""
    }
    /* Each half of a two-copy A4 sheet. FIT_SCRIPT shrinks a copy that would
       not fit, rather than letting it spill and push the other onto page two. */
    .half { height: 136mm; overflow: hidden; }
    .half > .sheet { min-height: 100%; transform-origin: top left; }
    .cut {
      border-top: 1pt dashed #000; margin: 3.5mm 0; position: relative; height: 0;
    }
    .cut span {
      position: absolute; left: 50%; top: -2.2mm; transform: translateX(-50%);
      background: #fff; padding: 0 2mm; font-size: 7pt; letter-spacing: 0.08em;
    }

    .hdr { display: flex; gap: 3mm; align-items: center; padding: ${narrow ? "0 0 1.5mm" : scale === "half" ? "1.5mm 2.5mm" : "2.5mm 3mm"}; ${
      narrow ? "flex-direction: column; text-align: center;" : ""
    } }
    .hdr img.logo { height: ${scale === "full" ? "16mm" : narrow ? "9mm" : "12mm"}; max-width: 30mm; object-fit: contain; }
    .hdr .who { flex: 1; }
    .biz { font-weight: 800; font-size: ${size.biz}; line-height: 1.15; }
    .hdr .line { font-size: ${size.small}; }
    .hdr .qr { text-align: center; font-size: 6.5pt; }
    .hdr .qr img { width: ${scale === "full" ? "20mm" : "16mm"}; height: auto; display: block; margin: 0 auto 0.5mm; }

    .titlebar {
      display: flex; justify-content: space-between; align-items: center;
      background: #000; color: #fff; padding: ${narrow ? "1mm 1.5mm" : "1.3mm 3mm"};
      font-weight: 800; font-size: ${size.title}; letter-spacing: 0.06em; text-transform: uppercase;
    }
    .titlebar .copy { font-size: ${size.label}; letter-spacing: 0.1em; font-weight: 700; }

    table { width: 100%; border-collapse: collapse; }
    .grid td, .grid th {
      border: 0.75pt solid #000; padding: ${narrow ? "0.8mm 1mm" : scale === "half" ? "0.7mm 2mm" : "1.2mm 2mm"}; vertical-align: top; text-align: left;
    }
    ${
      narrow
        ? ""
        : `/* Inside the bordered sheet: no outer edges, and no top edge, so stacked
         tables share one rule instead of printing a double line. */
    .sheet table.grid td, .sheet table.grid th { border-left-width: 0; border-top-width: 0; }
    .sheet table.grid td:last-child, .sheet table.grid th:last-child { border-right-width: 0; }`
    }
    .grid th {
      font-size: ${size.label}; text-transform: uppercase; letter-spacing: 0.05em; background: #EDEDED;
    }
    .lbl {
      display: block; font-size: ${size.label}; text-transform: uppercase; letter-spacing: 0.05em; color: #333; margin-bottom: 0.3mm;
    }
    td.k { width: ${narrow ? "34%" : "26%"}; font-weight: 700; font-size: ${size.small}; text-transform: uppercase; letter-spacing: 0.03em; background: #F5F5F5; }
    .jobno { font-size: ${size.jobno}; font-weight: 800; letter-spacing: 0.02em; }
    .strong { font-weight: 700; }
    .right { text-align: right !important; }
    .center { text-align: center; }
    .badge { display: inline-block; border: 1pt solid #000; padding: 0.2mm 1.5mm; font-size: ${size.label}; font-weight: 800; letter-spacing: 0.06em; }
    .muted { color: #444; }

    .terms { padding: ${narrow ? "1.5mm 0" : scale === "half" ? "1.2mm 2.5mm" : "1.8mm 3mm"}; font-size: ${size.small}; }
    .terms ol { margin: 0.5mm 0 0; padding-left: 4.5mm; }
    .terms li { margin: 0.2mm 0; }

    .sign { display: flex; border-top: ${narrow ? "0" : "0.75pt solid #000"}; ${narrow ? "flex-direction: column; gap: 3mm; margin-top: 3mm;" : ""} }
    .sign > div { flex: 1; padding: ${narrow ? "0" : "1.5mm 3mm"}; display: flex; flex-direction: column; justify-content: flex-end; min-height: ${
      scale === "full" ? "22mm" : narrow ? "14mm" : "13mm"
    }; }
    .sign > div + div { border-left: ${narrow ? "0" : "0.75pt solid #000"}; }
    .sign img { height: ${scale === "full" ? "13mm" : "9mm"}; object-fit: contain; align-self: flex-start; }
    .sign .who { border-top: 0.75pt solid #000; padding-top: 0.8mm; font-size: ${size.small}; font-weight: 700; }

    table.grid { table-layout: fixed; }
    td, th { overflow-wrap: anywhere; }
    .sumrow { display: flex; gap: 4mm; align-items: flex-start; padding: ${narrow ? "0" : "1.5mm 3mm 0"}; }
    .sumrow .words { flex: 1; padding-top: 1mm; }
    .sumrow .sums { width: ${scale === "full" ? "44%" : "52%"}; }
    .receipt { font-size: ${size.base}; }
    .receipt .row { display: flex; justify-content: space-between; gap: 2mm; }
    .receipt .row > span:last-child { text-align: right; white-space: nowrap; }
    .receipt .rtitle { margin: 1.5mm 0; font-weight: 800; letter-spacing: 0.1em; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 0.6mm 0; }
    .receipt .rrule { border-top: 1px dashed #000; margin: 1.5mm 0; }
    .receipt .rline { margin: 0.8mm 0; }
    .receipt .rgrand { font-weight: 800; font-size: ${size.title}; border-top: 1px solid #000; padding-top: 0.8mm; margin-top: 0.5mm; }
    .receipt .rsig { height: 12mm; object-fit: contain; display: block; margin-top: 2mm; }
    .money td { border: 0; border-top: 0.5pt solid #BBB; padding: ${narrow ? "0.6mm 0" : "1mm 2mm"}; }
    .money .grand td { border-top: 1.2pt solid #000; font-weight: 800; font-size: ${size.title}; }

    .tag { text-align: center; }
    .tag .jobno { font-size: 24px; }
    .tag .device { font-size: 12px; font-weight: 700; margin-top: 1mm; }
    .tag .rule { border-top: 1px dashed #000; margin: 2mm 0; }
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

/** Escape, then keep the line breaks a shop typed. */
function multiline(value: string): string {
  return escapeHtml(value).replace(/\n/g, "<br>");
}

/**
 * Render HTML in a hidden frame and open the print dialog on it.
 *
 * Returns false when the frame could not be created, so the caller can say so
 * rather than appearing to do nothing.
 */
export function printHtml(
  html: string,
  paper: RepairPaperSize,
  title: string,
  twoCopy = false
): boolean {
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
  frameDocument.write(wrapDocument(html, paper, title, twoCopy));
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

  if (frameDocument.readyState === "complete") window.setTimeout(run, 150);
  else frame.onload = () => window.setTimeout(run, 150);
  return true;
}

/** The full HTML document a print is made from. Exported for tests and previews. */
export function wrapDocument(
  html: string,
  paper: RepairPaperSize,
  title: string,
  twoCopy = false
): string {
  return (
    `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>` +
    `<style>${documentStyles(paper, twoCopy)}</style></head><body><div class="doc">${html}</div>` +
    (twoCopy ? `<script>${FIT_SCRIPT}</script>` : "") +
    `</body></html>`
  );
}

/**
 * Shrinks each copy of a two-copy sheet to fit its half page.
 *
 * A job with a long condition list or a long set of terms is taller than half
 * of A4 at a readable size. Clipping it would cut off the signatures; letting
 * it run on would push the shop copy onto a second sheet. Scaling just that
 * copy keeps both on one page, and a typical job needs no scaling at all.
 */
const FIT_SCRIPT = `
  document.querySelectorAll(".half").forEach(function (half) {
    var sheet = half.firstElementChild;
    if (!sheet) return;
    var room = half.clientHeight;
    var need = sheet.scrollHeight;
    if (need > room) {
      var ratio = Math.max(0.6, room / need);
      sheet.style.minHeight = "0";
      sheet.style.width = (100 / ratio) + "%";
      sheet.style.height = (room / ratio) + "px";
      sheet.style.transform = "scale(" + ratio + ")";
    }
  });
`;

export type PrintContext = {
  business: Business | null;
  job: Job;
  customer: Customer | null;
  technician: Technician | null;
  settings: RepairSettings;
  bill?: Bill | null;
  /** A QR image (data URL) of the job's tracking link; filled in by the print functions. */
  trackingQr?: string;
};

function money(value: number, context: PrintContext): string {
  return formatMoney(value, context.business?.currency || "INR");
}

/** The paper the job card and estimate print on. */
export function slipPaperOf(settings: RepairSettings): "a4" | "a5" {
  return settings.slipPaperSize === "a4" ? "a4" : "a5";
}

/** Whether a job card prints as customer + shop copy on one A4 sheet. */
export function isTwoCopy(settings: RepairSettings): boolean {
  return slipPaperOf(settings) === "a4" && (settings.slipA4Layout ?? "two-copy") === "two-copy";
}

/** The shop's terms as a list, falling back to the defaults when left blank. */
export function slipTermsOf(settings: RepairSettings): string[] {
  const text = (settings.slipTerms ?? "").trim() || DEFAULT_SLIP_TERMS;
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/** The tracking link a job's QR points at, when tracking is on and a link exists. */
export function trackingUrlFor(job: Job, settings: RepairSettings): string {
  return settings.trackingEnabled && job.tracking?.url ? job.tracking.url : "";
}

async function withTrackingQr(context: PrintContext): Promise<PrintContext> {
  const url = trackingUrlFor(context.job, context.settings);
  if (!url || context.trackingQr) return context;
  try {
    const trackingQr = await QRCode.toDataURL(url, { margin: 0, width: 240 });
    return { ...context, trackingQr };
  } catch {
    return context;
  }
}

// ---------------------------------------------------------------------------
// Shared building blocks
// ---------------------------------------------------------------------------

function letterhead(context: PrintContext, withQr: boolean): string {
  const { business } = context;
  const contact = [
    business?.phone ? `Ph: ${business.phone}` : "",
    business?.email || "",
  ].filter(Boolean);
  return `
    <div class="hdr">
      ${business?.logoDataUrl ? `<img class="logo" src="${business.logoDataUrl}" alt="" />` : ""}
      <div class="who">
        <div class="biz">${escapeHtml(business?.name || "Repair shop")}</div>
        ${business?.address ? `<div class="line">${multiline(business.address)}</div>` : ""}
        ${contact.length ? `<div class="line">${escapeHtml(contact.join("  ·  "))}</div>` : ""}
        ${business?.taxNumber ? `<div class="line strong">GSTIN: ${escapeHtml(business.taxNumber)}</div>` : ""}
      </div>
      ${
        withQr && context.trackingQr
          ? `<div class="qr"><img src="${context.trackingQr}" alt="" />Scan to track</div>`
          : ""
      }
    </div>
  `;
}

function titleBar(title: string, copyLabel?: string): string {
  return `<div class="titlebar"><span>${escapeHtml(title)}</span>${
    copyLabel ? `<span class="copy">${escapeHtml(copyLabel)}</span>` : ""
  }</div>`;
}

function cell(label: string, value: string, extraClass = ""): string {
  return `<td class="${extraClass}"><span class="lbl">${escapeHtml(label)}</span>${value || "—"}</td>`;
}

function row(label: string, value: string): string {
  return `<tr><td class="k">${escapeHtml(label)}</td><td>${value || "—"}</td></tr>`;
}

function jobMetaRow(context: PrintContext): string {
  const { job } = context;
  return `
    <table class="grid">
      <tr>
        <td style="width:34%"><span class="lbl">Job no.</span><span class="jobno">${escapeHtml(job.jobNo)}</span>${
          job.priority === "urgent" ? ` <span class="badge">URGENT</span>` : ""
        }</td>
        ${cell("Received on", escapeHtml(formatDateTime(job.createdAt) || formatDate(dateKeyOf(job.createdAt))))}
        ${cell("Expected delivery", escapeHtml(job.promisedDate ? formatDate(job.promisedDate) : ""))}
      </tr>
    </table>
  `;
}

function customerLines(customer: Customer | null, withPhone: boolean): string {
  if (!customer) return "—";
  const lines = [
    `<div class="strong">${escapeHtml(customer.name || "—")}</div>`,
    withPhone && customer.phone
      ? `<div>Mob: ${escapeHtml(customer.phone)}${customer.altPhone ? ` / ${escapeHtml(customer.altPhone)}` : ""}</div>`
      : "",
    customer.companyName ? `<div>${escapeHtml(customer.companyName)}</div>` : "",
    customer.address ? `<div>${multiline(customer.address)}</div>` : "",
    customer.gstin ? `<div>GSTIN: ${escapeHtml(customer.gstin)}</div>` : "",
  ];
  return lines.filter(Boolean).join("");
}

function deviceLines(job: Job): string {
  return [
    `<div class="strong">${escapeHtml(deviceLabel(job))}</div>`,
    `<div>${escapeHtml(DEVICE_KIND_LABELS[job.deviceKind])}${job.colour ? ` · ${escapeHtml(job.colour)}` : ""}</div>`,
    job.serialNo ? `<div>Serial / IMEI: <span class="strong">${escapeHtml(job.serialNo)}</span></div>` : "",
  ]
    .filter(Boolean)
    .join("");
}

function partyRow(context: PrintContext): string {
  return `
    <table class="grid">
      <tr>
        ${cell("Customer details", customerLines(context.customer, true), "")}
        ${cell("Device details", deviceLines(context.job))}
      </tr>
    </table>
  `;
}

function problemText(job: Job): string {
  const problems = job.reportedProblems.join(", ");
  return [
    problems ? escapeHtml(problems) : "",
    job.problemNote ? `<div class="muted">${multiline(job.problemNote)}</div>` : "",
  ]
    .filter(Boolean)
    .join("");
}

/**
 * The condition checklist as recorded, both halves.
 *
 * Absent items are printed too. A card that lists only the damage looks like a
 * complaint; a card that lists what was checked and found sound is a record,
 * and it is the line that says "back panel — no damage" that a customer cannot
 * argue with later.
 */
function conditionRows(job: Job): string {
  if (job.conditionIn.length === 0) return "";
  const found = job.conditionIn.filter((item) => item.present);
  const fine = job.conditionIn.filter((item) => !item.present);
  const describe = (items: typeof found) =>
    items
      .map((item) => `${escapeHtml(item.label)}${item.note ? ` (${escapeHtml(item.note)})` : ""}`)
      .join(", ");
  return [
    row("Physical condition", found.length ? `<span class="strong">${describe(found)}</span>` : "No damage found"),
    fine.length ? row("Checked — no issue", describe(fine)) : "",
  ].join("");
}

function accessoriesText(job: Job): string {
  return job.accessories.length > 0 ? escapeHtml(job.accessories.join(", ")) : "None";
}

function termsBlock(context: PrintContext): string {
  const terms = slipTermsOf(context.settings);
  if (terms.length === 0) return "";
  return `
    <div class="terms">
      <span class="lbl">Terms &amp; conditions</span>
      <ol>${terms.map((term) => `<li>${escapeHtml(term)}</li>`).join("")}</ol>
    </div>
  `;
}

function signatureRow(
  left: { label: string; image?: string },
  right: { label: string; image?: string }
): string {
  const box = (side: { label: string; image?: string }) => `
    <div>
      ${side.image ? `<img src="${side.image}" alt="" />` : ""}
      <div class="who">${escapeHtml(side.label)}</div>
    </div>`;
  return `<div class="sign">${box(left)}${box(right)}</div>`;
}

function shopSignLabel(context: PrintContext): string {
  return `For ${context.business?.name || "the shop"}`;
}

// ---------------------------------------------------------------------------
// Job card — customer copy
// ---------------------------------------------------------------------------

function customerCopy(context: PrintContext, copyLabel: string): string {
  const { job, technician } = context;
  const rows = [
    row("Reported problem", problemText(job)),
    row("Accessories received", accessoriesText(job)),
    conditionRows(job),
    job.estimateAmount !== null
      ? row("Estimated charge", `<span class="strong">${escapeHtml(money(job.estimateAmount, context))}</span> <span class="muted">(final amount told before work)</span>`)
      : "",
    technician ? row("Engineer", escapeHtml(technician.name)) : "",
    job.customerNotes ? row("Remarks", multiline(job.customerNotes)) : "",
  ].join("");

  return `
    <div class="sheet">
      ${letterhead(context, true)}
      ${titleBar("Job card · Service receipt", copyLabel)}
      ${jobMetaRow(context)}
      ${partyRow(context)}
      <table class="grid">${rows}</table>
      <div class="grow">${termsBlock(context)}</div>
      ${signatureRow(
        { label: "Customer's signature", image: job.intakeSignatureDataUrl },
        { label: shopSignLabel(context) }
      )}
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Job card — shop copy
// ---------------------------------------------------------------------------

/**
 * The half that stays with the device.
 *
 * It carries the two things the customer copy never does: the unlock code and
 * the internal notes. It drops the terms (the shop knows them) to make room for
 * a hand-over line, so whoever takes the device to the bench signs for it.
 */
function shopCopy(context: PrintContext): string {
  const { job, technician } = context;
  const rows = [
    row("Reported problem", problemText(job)),
    row("Accessories received", accessoriesText(job)),
    conditionRows(job),
    row("Password / pattern", job.unlockCode ? `<span class="strong">${escapeHtml(job.unlockCode)}</span>` : "Not given"),
    job.estimateAmount !== null
      ? row("Estimate told", escapeHtml(money(job.estimateAmount, context)))
      : "",
    job.internalNotes ? row("Internal notes", multiline(job.internalNotes)) : "",
  ].join("");

  return `
    <div class="sheet">
      ${letterhead(context, false)}
      ${titleBar("Job card", "Shop copy")}
      ${jobMetaRow(context)}
      ${partyRow(context)}
      <table class="grid">${rows}</table>
      <div class="grow"></div>
      <table class="grid">
        <tr>
          ${cell("Handed over to engineer", escapeHtml(technician?.name ?? ""))}
          ${cell("Date", "")}
          ${cell("Engineer's signature", "")}
        </tr>
      </table>
      ${signatureRow(
        { label: "Customer's signature", image: job.intakeSignatureDataUrl },
        { label: "Received by (shop)" }
      )}
    </div>
  `;
}

export type SlipCopy = "customer" | "shop";

/**
 * The job card as HTML.
 *
 * Two-copy A4 puts the customer copy on the top half and the shop copy on the
 * bottom. Otherwise one copy fills the page — the customer's unless the shop
 * copy is asked for.
 */
export function buildJobSlipHtml(context: PrintContext, copy?: SlipCopy): string {
  if (!copy && isTwoCopy(context.settings)) {
    return `
      <div class="half">${customerCopy(context, "Customer copy")}</div>
      <div class="cut"><span>✂ CUT HERE</span></div>
      <div class="half">${shopCopy(context)}</div>
    `;
  }
  return copy === "shop" ? shopCopy(context) : customerCopy(context, "Customer copy");
}

/**
 * Print the job card on the shop's chosen paper.
 *
 * `copy` forces one copy on its own page; leave it out to print what the
 * settings say (both halves on A4 two-copy, the customer copy otherwise).
 */
export async function printJobSlip(context: PrintContext, copy?: SlipCopy): Promise<boolean> {
  const ready = await withTrackingQr(context);
  const paper = slipPaperOf(context.settings);
  const twoCopy = !copy && isTwoCopy(context.settings);
  return printHtml(
    buildJobSlipHtml(ready, copy),
    paper,
    `Job card ${context.job.jobNo}`,
    twoCopy
  );
}

// ---------------------------------------------------------------------------
// Device tag
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
      <div class="strong">${escapeHtml(customer?.name || "—")}</div>
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

/** One priced line in the estimate or invoice table. */
function priceRow(label: string, quantity: number, rate: string, amount: string): string {
  return `<tr><td>${escapeHtml(label)}</td><td class="right">${quantity}</td><td class="right">${rate}</td><td class="right">${amount}</td></tr>`;
}

function totalsTable(lines: [label: string, value: string, grand?: boolean][]): string {
  return `
    <table class="money">
      ${lines
        .map(
          ([label, value, grand]) =>
            `<tr class="${grand ? "grand" : ""}"><td>${label}</td><td class="right">${value}</td></tr>`
        )
        .join("")}
    </table>
  `;
}

/** The itemised estimate of §6, in the job card's letterhead. */
export function buildEstimateHtml(context: PrintContext): string {
  const { job, settings } = context;
  const totals = billTotals(job, settings);
  const validUntil = addDays(dateKeyOf(job.createdAt) || "", ESTIMATE_VALID_DAYS);

  const partRows =
    job.partsUsed.length > 0
      ? job.partsUsed
          .map((part) =>
            priceRow(
              part.name,
              part.quantity,
              escapeHtml(money(part.sellingPrice, context)),
              escapeHtml(money(part.sellingPrice * part.quantity, context))
            )
          )
          .join("")
      : `<tr><td colspan="4" class="muted">To be confirmed after diagnosis</td></tr>`;

  const grand = totals.total > 0 ? totals.total : (job.estimateAmount ?? 0);

  return `
    <div class="sheet">
      ${letterhead(context, true)}
      ${titleBar("Estimate")}
      ${jobMetaRow(context)}
      ${partyRow(context)}
      <table class="grid">
        ${row("Reported problem", problemText(job))}
        ${job.diagnosis ? row("Diagnosis", multiline(job.diagnosis)) : ""}
      </table>
      <table class="grid">
        <thead><tr><th>Part / service</th><th class="right">Qty</th><th class="right">Rate</th><th class="right">Amount</th></tr></thead>
        <tbody>${partRows}</tbody>
      </table>
      ${totalsTable([
        ["Parts", escapeHtml(money(totals.partsTotal, context))],
        ["Labour", escapeHtml(money(totals.labourCharge, context))],
        ...(totals.taxAmount
          ? ([[`Tax (${totals.taxRate}%)`, escapeHtml(money(totals.taxAmount, context))]] as [string, string][])
          : []),
        ["Estimated total", escapeHtml(money(grand, context)), true],
      ])}
      <div class="terms grow">This estimate is valid until <span class="strong">${escapeHtml(
        formatDate(validUntil)
      )}</span>. Work begins only once you approve it. If the fault turns out to be different once the device is opened, we will tell you the revised figure before going ahead.</div>
      ${signatureRow({ label: "Approved by (customer)" }, { label: shopSignLabel(context) })}
    </div>
  `;
}

export async function printEstimate(context: PrintContext): Promise<boolean> {
  const ready = await withTrackingQr(context);
  return printHtml(
    buildEstimateHtml(ready),
    slipPaperOf(context.settings),
    `Estimate ${context.job.jobNo}`
  );
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
/** The paper the invoice prints on: the job card's (A4/A5) unless a roll is chosen. */
export function invoicePaperOf(settings: RepairSettings): RepairPaperSize {
  const chosen = settings.invoicePaper ?? "slip";
  return chosen === "slip" ? slipPaperOf(settings) : chosen;
}

/** The total in words, Indian numbering — what Indian invoices carry under the total. */
export function amountInWords(amount: number, currency: string): string {
  if (currency !== "INR") return "";
  // "Three Thousand Five Hundred Rupees Only" (paise are left off, as on most bills).
  return amountInWordsIndian(Math.round(amount));
}

type InvoiceParts = {
  lines: { label: string; quantity: number; rate: string; amount: string }[];
  totals: [string, string, boolean?][];
  due: number;
  warrantyEnd: string;
  words: string;
};

function invoiceParts(context: PrintContext): InvoiceParts | null {
  const { job, bill } = context;
  if (!bill) return null;
  const lines = bill.partLines.map((line) => ({
    label: line.label,
    quantity: line.quantity,
    rate: money(line.unitPrice, context),
    amount: money(line.amount, context),
  }));
  if (bill.labourCharge) {
    lines.push({
      label: "Labour / service charge",
      quantity: 1,
      rate: money(bill.labourCharge, context),
      amount: money(bill.labourCharge, context),
    });
  }
  const gross = bill.partLines.reduce((sum, line) => sum + line.amount, 0) + bill.labourCharge;
  const due = Math.max(0, bill.total - bill.paid);
  const totals: [string, string, boolean?][] = [];
  if (bill.discount || bill.taxAmount) totals.push(["Sub-total", escapeHtml(money(gross, context))]);
  if (bill.discount) totals.push(["Discount", `− ${escapeHtml(money(bill.discount, context))}`]);
  if (bill.taxAmount) totals.push([`Tax (${bill.taxRate}%)`, escapeHtml(money(bill.taxAmount, context))]);
  totals.push(["Total", escapeHtml(money(bill.total, context)), true]);
  totals.push([
    `Paid${bill.paymentMode ? ` (${escapeHtml(bill.paymentMode)})` : ""}`,
    escapeHtml(money(bill.paid, context)),
  ]);
  if (due > 0) totals.push(["<strong>Balance due</strong>", `<strong>${escapeHtml(money(due, context))}</strong>`]);
  return {
    lines,
    totals,
    due,
    warrantyEnd: job.warrantyDays > 0 && job.deliveredOn ? addDays(job.deliveredOn, job.warrantyDays) : "",
    words: amountInWords(bill.total, context.business?.currency || "INR"),
  };
}

function warrantyText(job: Job, warrantyEnd: string): string {
  return warrantyEnd
    ? `This repair is covered for <span class="strong">${job.warrantyDays} days</span>, until <span class="strong">${escapeHtml(
        formatDate(warrantyEnd)
      )}</span>.`
    : "No warranty is offered on this repair.";
}

const WARRANTY_SMALL_PRINT =
  "Cover applies to the same fault and the parts replaced here. It does not cover physical damage, liquid damage, or a device opened elsewhere after this repair. Please bring this invoice when making a claim.";

/**
 * The bill, with the warranty terms and expiry on it.
 *
 * The warranty line is not decoration: it is the thing the customer will come
 * back holding, and printing the actual expiry date rather than "90 days"
 * removes the argument about when the clock started.
 *
 * A4/A5 get the full invoice; a thermal roll gets a receipt laid out for its
 * width — one column, each line with its quantity and rate underneath — since
 * a four-column table cannot fit in 48mm of print.
 */
export function buildInvoiceHtml(context: PrintContext, paper: RepairPaperSize = "a4"): string {
  const parts = invoiceParts(context);
  if (!parts || !context.bill) return "";
  if (paper === "58mm" || paper === "80mm") return buildInvoiceReceiptHtml(context, parts);
  const { job, bill, settings } = context;

  const rows = parts.lines
    .map((line, index) =>
      `<tr><td class="center">${index + 1}</td><td>${escapeHtml(line.label)}</td><td class="right">${line.quantity}</td><td class="right">${escapeHtml(
        line.rate
      )}</td><td class="right">${escapeHtml(line.amount)}</td></tr>`
    )
    .join("");

  return `
    <div class="sheet">
      ${letterhead(context, false)}
      ${titleBar(settings.taxEnabled ? "Tax invoice" : "Invoice", settings.taxEnabled ? "" : "Bill of supply")}
      <table class="grid">
        <tr>
          ${cell("Invoice no.", `<span class="jobno">${escapeHtml(bill.invoiceNo)}</span>`)}
          ${cell("Invoice date", escapeHtml(formatDate(bill.date)))}
          ${cell("Job no.", `<span class="strong">${escapeHtml(job.jobNo)}</span>`)}
        </tr>
      </table>
      <table class="grid">
        <tr>
          ${cell("Bill to", customerLines(context.customer, true))}
          ${cell("Device repaired", deviceLines(job))}
        </tr>
      </table>
      ${job.workDone ? `<table class="grid">${row("Work done", multiline(job.workDone))}</table>` : ""}
      <table class="grid items">
        <thead><tr><th class="center" style="width:8%">#</th><th>Description</th><th class="right" style="width:9%">Qty</th><th class="right" style="width:18%">Rate</th><th class="right" style="width:20%">Amount</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="5" class="muted">No charge</td></tr>`}</tbody>
      </table>
      <div class="sumrow">
        <div class="words">
          ${parts.words ? `<span class="lbl">Amount in words</span><div class="strong">${escapeHtml(parts.words)}</div>` : ""}
        </div>
        <div class="sums">${totalsTable(parts.totals)}</div>
      </div>
      <div class="terms grow">
        <span class="lbl">Warranty</span>
        <div>${warrantyText(job, parts.warrantyEnd)}</div>
        <div class="muted">${WARRANTY_SMALL_PRINT}</div>
      </div>
      ${signatureRow(
        { label: "Received by (customer)", image: job.deliverySignatureDataUrl },
        { label: `Authorised signatory · ${shopSignLabel(context)}` }
      )}
    </div>
  `;
}

/** The invoice as a till receipt, for 58mm / 80mm rolls. */
function buildInvoiceReceiptHtml(context: PrintContext, parts: InvoiceParts): string {
  const { job, bill, customer, business, settings } = context;
  if (!bill) return "";
  const lines = parts.lines
    .map(
      (line) => `
        <div class="rline">
          <div class="row"><span>${escapeHtml(line.label)}</span><span class="strong">${escapeHtml(line.amount)}</span></div>
          <div class="muted">${line.quantity} × ${escapeHtml(line.rate)}</div>
        </div>`
    )
    .join("");
  return `
    <div class="receipt">
      <div class="center">
        <div class="biz">${escapeHtml(business?.name || "Repair shop")}</div>
        ${business?.address ? `<div>${multiline(business.address)}</div>` : ""}
        ${business?.phone ? `<div>Ph: ${escapeHtml(business.phone)}</div>` : ""}
        ${business?.taxNumber ? `<div>GSTIN: ${escapeHtml(business.taxNumber)}</div>` : ""}
        <div class="rtitle">${settings.taxEnabled ? "TAX INVOICE" : "INVOICE"}</div>
      </div>
      <div class="row"><span>Invoice</span><span class="strong">${escapeHtml(bill.invoiceNo)}</span></div>
      <div class="row"><span>Date</span><span>${escapeHtml(formatDate(bill.date))}</span></div>
      <div class="row"><span>Job</span><span>${escapeHtml(job.jobNo)}</span></div>
      <div class="rrule"></div>
      <div class="strong">${escapeHtml(customer?.name || "—")}</div>
      ${customer?.phone ? `<div>${escapeHtml(customer.phone)}</div>` : ""}
      <div>${escapeHtml(deviceLabel(job))}${job.serialNo ? ` · ${escapeHtml(job.serialNo)}` : ""}</div>
      <div class="rrule"></div>
      ${lines || `<div class="muted">No charge</div>`}
      <div class="rrule"></div>
      ${parts.totals
        .map(
          ([label, value, grand]) =>
            `<div class="row${grand ? " rgrand" : ""}"><span>${label}</span><span>${value}</span></div>`
        )
        .join("")}
      ${parts.words ? `<div class="muted" style="margin-top:1mm">${escapeHtml(parts.words)}</div>` : ""}
      <div class="rrule"></div>
      <div>${warrantyText(job, parts.warrantyEnd)}</div>
      <div class="muted">${WARRANTY_SMALL_PRINT}</div>
      ${
        job.deliverySignatureDataUrl
          ? `<img class="rsig" src="${job.deliverySignatureDataUrl}" alt="" /><div class="muted">Customer's signature</div>`
          : ""
      }
      <div class="center" style="margin-top:2mm">Thank you!</div>
    </div>
  `;
}

export function printInvoice(context: PrintContext, paper?: RepairPaperSize): boolean {
  if (!context.bill) return false;
  const chosen = paper ?? invoicePaperOf(context.settings);
  return printHtml(buildInvoiceHtml(context, chosen), chosen, `Invoice ${context.bill.invoiceNo}`);
}

// ---------------------------------------------------------------------------
// Outward challan — a device (or part) going to an outside vendor
// ---------------------------------------------------------------------------

/**
 * The delivery challan that travels with a device sent for outside repair.
 *
 * It is a returnable challan, not a sale: it says so, because a laptop in a
 * courier bag with no paper is the one that gets stopped, and a vendor holding
 * nothing signed can say it never arrived. Customer details are deliberately
 * absent — the vendor repairs for the shop, and the customer is the shop's.
 */
export function buildOutsideChallanHtml(context: PrintContext, trip: OutsideRepair, vendor: Vendor | null): string {
  const { job } = context;
  const vendorLines = [
    `<div class="strong">${escapeHtml(vendor?.name || trip.vendorName)}</div>`,
    vendor?.contactPerson ? `<div>Attn: ${escapeHtml(vendor.contactPerson)}</div>` : "",
    vendor?.address ? `<div>${multiline(vendor.address)}</div>` : "",
    (vendor?.city || trip.vendorCity) ? `<div>${escapeHtml(vendor?.city || trip.vendorCity)}</div>` : "",
    vendor?.phone ? `<div>Ph: ${escapeHtml(vendor.phone)}</div>` : "",
    vendor?.gstin ? `<div>GSTIN: ${escapeHtml(vendor.gstin)}</div>` : "",
  ]
    .filter(Boolean)
    .join("");

  const rows = [
    row("Item sent", `<span class="strong">${escapeHtml(trip.sentWhat || "Whole device")}</span>`),
    row("Device", `${escapeHtml(deviceLabel(job))} · ${escapeHtml(DEVICE_KIND_LABELS[job.deviceKind])}${
      job.colour ? ` · ${escapeHtml(job.colour)}` : ""
    }`),
    job.serialNo ? row("Serial / IMEI", `<span class="strong">${escapeHtml(job.serialNo)}</span>`) : "",
    row("Repair required", multiline(trip.problem || job.diagnosis || job.reportedProblems.join(", "))),
    job.conditionIn.some((item) => item.present)
      ? row(
          "Condition when sent",
          escapeHtml(
            job.conditionIn
              .filter((item) => item.present)
              .map((item) => item.label + (item.note ? ` (${item.note})` : ""))
              .join(", ")
          )
        )
      : "",
    row("Sent via", escapeHtml([trip.sentVia, trip.docketNo ? `Docket ${trip.docketNo}` : ""].filter(Boolean).join(" · "))),
    trip.quotedCharge !== null ? row("Quoted charge", escapeHtml(money(trip.quotedCharge, context))) : "",
    trip.expectedBackOn ? row("Expected back by", escapeHtml(formatDate(trip.expectedBackOn))) : "",
    trip.note ? row("Note", multiline(trip.note)) : "",
  ].join("");

  return `
    <div class="sheet">
      ${letterhead(context, false)}
      ${titleBar("Delivery challan · For repair & return", "Not for sale")}
      <table class="grid">
        <tr>
          ${cell("Challan no.", `<span class="jobno">${escapeHtml(trip.challanNo)}</span>`)}
          ${cell("Date", escapeHtml(formatDate(trip.sentOn)))}
          ${cell("Our job no.", `<span class="strong">${escapeHtml(job.jobNo)}</span>`)}
        </tr>
      </table>
      <table class="grid"><tr>${cell("Sent to", vendorLines)}</tr></table>
      <table class="grid">${rows}</table>
      <div class="terms grow">
        <ol>
          <li>The item above is sent for repair only and remains the property of ${escapeHtml(
            context.business?.name || "the sender"
          )}. It is not a sale; no consideration is involved.</li>
          <li>Please return it with this challan number quoted on your bill.</li>
          <li>Do not replace parts or charge beyond the quote without our approval.</li>
        </ol>
      </div>
      ${signatureRow({ label: "Received by (vendor)" }, { label: shopSignLabel(context) })}
    </div>
  `;
}

export function printOutsideChallan(
  context: PrintContext,
  trip: OutsideRepair,
  vendor: Vendor | null
): boolean {
  return printHtml(
    buildOutsideChallanHtml(context, trip, vendor),
    slipPaperOf(context.settings),
    `Challan ${trip.challanNo}`
  );
}
