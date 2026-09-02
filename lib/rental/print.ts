// Printed output: quotation, picking list, delivery challan, settlement note
// and the invoice.
//
// Everything prints through a hidden iframe rather than a new window, the same
// way the clinic's prescriptions and the queue's token slips do — a popup
// blocker cannot swallow it, and the page the owner is standing in front of
// never navigates away.
//
// Five documents, three audiences, and they are deliberately not the same
// paper. The picking list carries no prices at all: it goes out to the loading
// crew and to the customer's own staff at the venue, and a hire rate on a sheet
// of paper in a marquee is a negotiation nobody asked for.

import { escapeHtml } from "@/lib/clinic/print";
import { formatMoney } from "@/lib/pos/types";
import type { Business } from "@/lib/pos/types";
import { bookingTotals, requiredAdvanceFor, type Settlement } from "./calc";
import {
  BOOKING_STATUS_LABELS,
  RATE_BASIS_SUFFIX,
  formatDate,
  formatDateWindow,
  type Booking,
  type Customer,
  type RentalItem,
  type RentalSettings,
} from "./types";

export type RentalPaperSize = "58mm" | "80mm" | "a4" | "a5";

function pageRule(paper: RentalPaperSize): string {
  switch (paper) {
    case "58mm":
      return "@page { size: 58mm auto; margin: 3mm; }";
    case "80mm":
      return "@page { size: 80mm auto; margin: 4mm; }";
    case "a5":
      return "@page { size: A5 portrait; margin: 10mm; }";
    default:
      return "@page { size: A4 portrait; margin: 14mm; }";
  }
}

function documentStyles(paper: RentalPaperSize): string {
  const narrow = paper === "58mm" || paper === "80mm";
  return `
    ${pageRule(paper)}
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Sora", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
      color: #0E1124;
      font-size: ${narrow ? "11px" : "12px"};
      line-height: 1.5;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .doc { width: ${paper === "58mm" ? "52mm" : paper === "80mm" ? "72mm" : "100%"}; }
    h1 { font-size: ${narrow ? "14px" : "20px"}; margin: 0; letter-spacing: -0.01em; }
    h2 { font-size: ${narrow ? "12px" : "14px"}; margin: 0 0 2mm; }
    .muted { color: #5F6478; }
    .right { text-align: right; }
    .center { text-align: center; }
    .head { display: flex; justify-content: space-between; gap: 8mm; align-items: flex-start; }
    .head .biz { font-size: ${narrow ? "12px" : "16px"}; font-weight: 800; }
    .badge {
      display: inline-block; border: 1px solid #0E1124; border-radius: 3px;
      padding: 0.5mm 2mm; font-size: 10px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .rule { border-top: 1px solid #D9D2C2; margin: 4mm 0; }
    .dashed { border-top: 1px dashed #B7AE99; margin: 3mm 0; }
    .grid2 { display: flex; gap: 8mm; }
    .grid2 > div { flex: 1; }
    .label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; color: #5F6478; }
    table { width: 100%; border-collapse: collapse; margin-top: 3mm; }
    th, td { padding: 1.6mm 2mm; text-align: left; vertical-align: top; }
    th {
      font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em;
      color: #5F6478; border-bottom: 1px solid #D9D2C2;
    }
    td { border-bottom: 1px solid #EFEAE0; }
    tfoot td { border: 0; padding-top: 1mm; }
    .totals { margin-left: auto; width: ${narrow ? "100%" : "70mm"}; }
    .totals td { border: 0; padding: 0.8mm 0; }
    .totals .grand td { border-top: 1px solid #0E1124; font-weight: 800; padding-top: 1.5mm; }
    .tick { width: 8mm; height: 5mm; border: 1px solid #0E1124; display: inline-block; }
    .sign { margin-top: 12mm; display: flex; gap: 10mm; }
    .sign > div { flex: 1; }
    .sign .line { border-top: 1px solid #0E1124; margin-top: 14mm; padding-top: 1.5mm; font-size: 10px; }
    .sign img { height: 14mm; object-fit: contain; display: block; }
    .note { margin-top: 4mm; font-size: 10px; color: #5F6478; white-space: pre-wrap; }
    .terms { margin-top: 6mm; font-size: 9.5px; color: #5F6478; }
    .big { font-size: ${narrow ? "18px" : "22px"}; font-weight: 800; }
  `;
}

/** Render HTML in a hidden frame and open the print dialog on it. */
export function printHtml(html: string, paper: RentalPaperSize, title: string): boolean {
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
  booking: Booking;
  customer: Customer | undefined;
  itemById: Map<string, RentalItem>;
  settings: RentalSettings;
};

function currencyOf(context: PrintContext): string {
  return context.business?.currency || "INR";
}

function money(value: number, context: PrintContext): string {
  return formatMoney(value, currencyOf(context));
}

function header(context: PrintContext, title: string, badge?: string): string {
  const { business, booking } = context;
  return `
    <div class="head">
      <div>
        <div class="biz">${escapeHtml(business?.name || "Rental")}</div>
        ${business?.address ? `<div class="muted">${escapeHtml(business.address)}</div>` : ""}
        <div class="muted">${escapeHtml(
          [business?.phone, business?.taxNumber ? `GSTIN ${business.taxNumber}` : ""]
            .filter(Boolean)
            .join(" · ")
        )}</div>
      </div>
      <div class="right">
        <h1>${escapeHtml(title)}</h1>
        <div class="muted">${escapeHtml(booking.bookingNo)}</div>
        ${badge ? `<div class="badge" style="margin-top:2mm">${escapeHtml(badge)}</div>` : ""}
      </div>
    </div>
  `;
}

function partyBlock(context: PrintContext): string {
  const { booking, customer } = context;
  return `
    <div class="grid2" style="margin-top:5mm">
      <div>
        <div class="label">Customer</div>
        <div><strong>${escapeHtml(customer?.name || "—")}</strong></div>
        ${customer?.phone ? `<div class="muted">${escapeHtml(customer.phone)}</div>` : ""}
        ${customer?.address ? `<div class="muted">${escapeHtml(customer.address)}</div>` : ""}
      </div>
      <div>
        <div class="label">Hire period</div>
        <div><strong>${escapeHtml(formatDateWindow(booking.fromDate, booking.toDate))}</strong></div>
        ${
          booking.fromTime || booking.toTime
            ? `<div class="muted">${escapeHtml(
                [booking.fromTime, booking.toTime].filter(Boolean).join(" – ")
              )}</div>`
            : ""
        }
        ${booking.eventName ? `<div class="muted">${escapeHtml(booking.eventName)}</div>` : ""}
        ${
          booking.venue
            ? `<div class="muted">${escapeHtml(booking.venue)}${
                booking.venueContact ? ` · ${escapeHtml(booking.venueContact)}` : ""
              }</div>`
            : ""
        }
      </div>
    </div>
  `;
}

function pricedRows(context: PrintContext): string {
  return context.booking.lines
    .map(
      (line) => `
      <tr>
        <td>${escapeHtml(line.name)}</td>
        <td class="right">${line.quantity}</td>
        <td class="right">${escapeHtml(money(line.rate, context))}${escapeHtml(
          RATE_BASIS_SUFFIX[line.rateBasis]
        )}</td>
        <td class="right">${line.chargeableUnits}</td>
        <td class="right">${escapeHtml(money(line.amount, context))}</td>
      </tr>`
    )
    .join("");
}

function totalsBlock(context: PrintContext): string {
  const totals = bookingTotals(context.booking, context.settings);
  const { booking } = context;
  const row = (label: string, value: number, cls = "") =>
    `<tr class="${cls}"><td>${escapeHtml(label)}</td><td class="right">${escapeHtml(
      money(value, context)
    )}</td></tr>`;

  return `
    <table class="totals">
      ${row("Rent", totals.subtotal)}
      ${booking.transportCharge ? row("Transport", booking.transportCharge) : ""}
      ${booking.labourCharge ? row("Labour", booking.labourCharge) : ""}
      ${booking.discount ? row("Discount", -booking.discount) : ""}
      ${totals.taxAmount ? row(`Tax (${booking.taxRate}%)`, totals.taxAmount) : ""}
      ${row("Total", totals.total, "grand")}
      ${totals.depositTotal ? row("Refundable deposit", totals.depositTotal) : ""}
      ${booking.paid ? row("Received", booking.paid) : ""}
    </table>
  `;
}

// ---------------------------------------------------------------------------
// Quotation
// ---------------------------------------------------------------------------

export function buildQuotationHtml(context: PrintContext): string {
  const { settings } = context;
  const advanceDue = Math.max(
    0,
    requiredAdvanceFor(context.booking, settings, context.itemById) - context.booking.advancePaid
  );
  return `
    ${header(context, "Quotation")}
    ${partyBlock(context)}
    <table>
      <thead>
        <tr>
          <th>Item</th><th class="right">Qty</th><th class="right">Rate</th>
          <th class="right">Units</th><th class="right">Amount</th>
        </tr>
      </thead>
      <tbody>${pricedRows(context)}</tbody>
    </table>
    ${totalsBlock(context)}
    ${context.booking.note ? `<div class="note">${escapeHtml(context.booking.note)}</div>` : ""}
    <div class="terms">
      Quotation valid for ${settings.quotationValidDays} days.
      ${
        advanceDue > 0
          ? `Stock is held once an advance of <strong>${escapeHtml(
              money(advanceDue, context)
            )}</strong> is received.`
          : "Stock is held only once the booking is confirmed."
      }
      Deposit is refundable at return, less any late, damage or loss charges.
    </div>
  `;
}

export function printQuotation(context: PrintContext): boolean {
  return printHtml(buildQuotationHtml(context), "a4", `Quotation ${context.booking.bookingNo}`);
}

// ---------------------------------------------------------------------------
// Picking list — for the loading crew. No prices.
// ---------------------------------------------------------------------------

export function buildPickingListHtml(context: PrintContext): string {
  const { booking } = context;
  const rows = booking.lines
    .map(
      (line) => `
      <tr>
        <td><span class="tick"></span></td>
        <td>${escapeHtml(line.name)}</td>
        <td class="right"><strong>${line.quantity}</strong></td>
        <td class="muted">${escapeHtml(line.unitIds.length ? `${line.unitIds.length} units allocated` : "")}</td>
      </tr>`
    )
    .join("");

  return `
    ${header(context, "Picking list", "Loading crew")}
    <div class="grid2" style="margin-top:5mm">
      <div>
        <div class="label">Event</div>
        <div><strong>${escapeHtml(booking.eventName || "—")}</strong></div>
        <div class="muted">${escapeHtml(booking.venue)}</div>
        <div class="muted">${escapeHtml(booking.venueContact)}</div>
      </div>
      <div>
        <div class="label">Dispatch</div>
        <div><strong>${escapeHtml(formatDate(booking.fromDate))}</strong> ${escapeHtml(
          booking.fromTime
        )}</div>
        <div class="muted">Back by ${escapeHtml(formatDate(booking.toDate))} ${escapeHtml(
          booking.toTime
        )}</div>
      </div>
    </div>
    <table>
      <thead>
        <tr><th></th><th>Item</th><th class="right">Qty</th><th>Notes</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="sign">
      <div><div class="line">Picked by</div></div>
      <div><div class="line">Checked by</div></div>
    </div>
  `;
}

export function printPickingList(context: PrintContext): boolean {
  return printHtml(
    buildPickingListHtml(context),
    "a4",
    `Picking list ${context.booking.bookingNo}`
  );
}

// ---------------------------------------------------------------------------
// Delivery challan
// ---------------------------------------------------------------------------

export function buildChallanHtml(context: PrintContext): string {
  const { booking } = context;
  const rows = booking.lines
    .map(
      (line) => `
      <tr>
        <td>${escapeHtml(line.name)}</td>
        <td class="right">${line.quantity}</td>
        <td class="muted">${escapeHtml(
          line.unitIds.length
            ? line.unitIds
                .map((id) => id.slice(0, 6))
                .join(", ")
            : ""
        )}</td>
      </tr>`
    )
    .join("");

  return `
    ${header(context, "Delivery challan", "Not a tax invoice")}
    ${partyBlock(context)}
    <table>
      <thead><tr><th>Item</th><th class="right">Qty dispatched</th><th>Units</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${
      booking.depositTotal
        ? `<p style="margin-top:4mm">Refundable deposit held: <strong>${escapeHtml(
            money(booking.depositTotal, context)
          )}</strong></p>`
        : ""
    }
    <div class="terms">
      Goods are on hire and remain the property of ${escapeHtml(
        context.business?.name || "the hirer"
      )}. Please check counts at delivery — shortages reported later cannot be adjusted.
      Items are due back on ${escapeHtml(formatDate(booking.toDate))}; late returns are charged
      per day.
    </div>
    <div class="sign">
      <div>
        ${
          booking.dispatchSignature
            ? `<img src="${booking.dispatchSignature}" alt="" />`
            : ""
        }
        <div class="line">Received by (customer)</div>
      </div>
      <div><div class="line">Dispatched by</div></div>
    </div>
  `;
}

export function printChallan(context: PrintContext, paper: RentalPaperSize = "a4"): boolean {
  return printHtml(buildChallanHtml(context), paper, `Challan ${context.booking.bookingNo}`);
}

// ---------------------------------------------------------------------------
// Return / settlement note
// ---------------------------------------------------------------------------

export function buildSettlementHtml(context: PrintContext, settlement: Settlement): string {
  const { booking } = context;
  const rows = booking.lines
    .map(
      (line) => `
      <tr>
        <td>${escapeHtml(line.name)}</td>
        <td class="right">${line.quantity}</td>
        <td class="right">${line.returnedQuantity}</td>
        <td class="right">${line.damagedQuantity || ""}</td>
        <td class="right">${line.lostQuantity || ""}</td>
        <td class="right">${escapeHtml(
          line.damageCharge + line.lossCharge ? money(line.damageCharge + line.lossCharge, context) : ""
        )}</td>
      </tr>`
    )
    .join("");

  const row = (label: string, value: number, cls = "") =>
    `<tr class="${cls}"><td>${escapeHtml(label)}</td><td class="right">${escapeHtml(
      money(value, context)
    )}</td></tr>`;

  return `
    ${header(context, "Return & settlement", BOOKING_STATUS_LABELS[booking.status])}
    ${partyBlock(context)}
    <p style="margin-top:4mm" class="muted">
      Returned on <strong>${escapeHtml(formatDate(booking.actualReturnedOn ?? ""))}</strong>
      ${settlement.lateDays > 0 ? ` · ${settlement.lateDays} day(s) late` : " · on time"}
    </p>
    <table>
      <thead>
        <tr>
          <th>Item</th><th class="right">Out</th><th class="right">Back</th>
          <th class="right">Damaged</th><th class="right">Lost</th><th class="right">Charge</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <table class="totals">
      ${row("Hire total", settlement.total)}
      ${settlement.lateFee ? row(`Late fee (${settlement.lateDays} days)`, settlement.lateFee) : ""}
      ${settlement.damageTotal ? row("Damage", settlement.damageTotal) : ""}
      ${settlement.lossTotal ? row("Loss", settlement.lossTotal) : ""}
      ${row("Total charges", settlement.charges, "grand")}
      ${settlement.paidTowardsCharges ? row("Already paid", -settlement.paidTowardsCharges) : ""}
      ${settlement.depositTotal ? row("Deposit held", -settlement.depositTotal) : ""}
      ${
        settlement.depositRefunded
          ? row("Deposit refunded", settlement.depositRefunded)
          : ""
      }
      ${row(settlement.finalPayable > 0 ? "Balance payable" : "Nothing due", settlement.finalPayable, "grand")}
    </table>
    <div class="sign">
      <div>
        ${booking.returnSignature ? `<img src="${booking.returnSignature}" alt="" />` : ""}
        <div class="line">Customer</div>
      </div>
      <div><div class="line">For ${escapeHtml(context.business?.name || "us")}</div></div>
    </div>
  `;
}

export function printSettlement(context: PrintContext, settlement: Settlement): boolean {
  return printHtml(
    buildSettlementHtml(context, settlement),
    "a4",
    `Settlement ${context.booking.bookingNo}`
  );
}

// ---------------------------------------------------------------------------
// Invoice / receipt
// ---------------------------------------------------------------------------

export function buildInvoiceHtml(context: PrintContext, settlement: Settlement | null): string {
  const { booking } = context;
  const narrow = context.settings.receiptPaperSize !== "a4";
  const totals = bookingTotals(booking, context.settings);

  const lines = booking.lines
    .map(
      (line) =>
        `<tr><td>${escapeHtml(line.name)}<div class="muted">${line.quantity} × ${escapeHtml(
          money(line.rate, context)
        )}${escapeHtml(RATE_BASIS_SUFFIX[line.rateBasis])} × ${line.chargeableUnits}</div></td>` +
        `<td class="right">${escapeHtml(money(line.amount, context))}</td></tr>`
    )
    .join("");

  const row = (label: string, value: number, cls = "") =>
    `<tr class="${cls}"><td>${escapeHtml(label)}</td><td class="right">${escapeHtml(
      money(value, context)
    )}</td></tr>`;

  const charges = settlement ?? null;

  return `
    ${
      narrow
        ? `<div class="center">
             <div class="big">${escapeHtml(context.business?.name || "Rental")}</div>
             <div class="muted">${escapeHtml(context.business?.phone ?? "")}</div>
             <div class="dashed"></div>
             <div><strong>${escapeHtml(booking.invoiceNo || booking.bookingNo)}</strong></div>
             <div class="muted">${escapeHtml(
               formatDateWindow(booking.fromDate, booking.toDate)
             )}</div>
             <div class="muted">${escapeHtml(context.customer?.name ?? "")}</div>
             <div class="dashed"></div>
           </div>`
        : `${header(context, booking.invoiceNo ? "Invoice" : "Receipt")}${partyBlock(context)}`
    }
    <table>
      ${narrow ? "" : "<thead><tr><th>Item</th><th class=\"right\">Amount</th></tr></thead>"}
      <tbody>${lines}</tbody>
    </table>
    <table class="totals">
      ${row("Rent", totals.subtotal)}
      ${booking.transportCharge ? row("Transport", booking.transportCharge) : ""}
      ${booking.labourCharge ? row("Labour", booking.labourCharge) : ""}
      ${booking.discount ? row("Discount", -booking.discount) : ""}
      ${totals.taxAmount ? row(`Tax (${booking.taxRate}%)`, totals.taxAmount) : ""}
      ${charges?.lateFee ? row("Late fee", charges.lateFee) : ""}
      ${charges?.damageTotal ? row("Damage", charges.damageTotal) : ""}
      ${charges?.lossTotal ? row("Loss", charges.lossTotal) : ""}
      ${row("Total", charges ? charges.charges : totals.total, "grand")}
      ${booking.paid ? row("Paid", booking.paid) : ""}
      ${
        charges && charges.depositRefunded
          ? row("Deposit refunded", charges.depositRefunded)
          : ""
      }
      ${
        charges
          ? row(charges.finalPayable > 0 ? "Balance due" : "Settled", charges.finalPayable, "grand")
          : ""
      }
    </table>
    ${booking.paymentMode ? `<p class="muted" style="margin-top:3mm">Paid by ${escapeHtml(booking.paymentMode)}</p>` : ""}
    <div class="${narrow ? "center note" : "terms"}">Thank you.</div>
  `;
}

export function printInvoice(context: PrintContext, settlement: Settlement | null): boolean {
  return printHtml(
    buildInvoiceHtml(context, settlement),
    context.settings.receiptPaperSize,
    `${context.booking.invoiceNo || context.booking.bookingNo}`
  );
}
