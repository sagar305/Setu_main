// Printed output: the bill, the Schedule H/H1 register, the expiry removal
// list and the purchase return note.
//
// Everything prints through a hidden iframe rather than a new window, the same
// way the clinic's prescriptions and the rental book's challans do — a popup
// blocker cannot swallow it, and the machine the counter is standing at never
// navigates away.
//
// The bill is a simple GST bill: HSN and tax rate per line, a CGST/SGST split,
// the shop's GSTIN and drug licence in the header, and the amount in words. It
// is not a full statutory tax invoice — there is no place of supply, no
// HSN-wise summary table and no reverse-charge line — and the register carries
// a plain statement of the same limit, because a document that implies more
// compliance than it delivers is worse than one that claims none.

import { escapeHtml } from "@/lib/clinic/print";
import { amountInWordsIndian } from "@/lib/invoice";
import { formatMoney, type Business } from "@/lib/pos/types";
import { billTotals } from "./calc";
import type { RegisterRow } from "./reports";
import {
  PURCHASE_RETURN_REASON_LABELS,
  formatDate,
  formatExpiry,
  type Batch,
  type Customer,
  type Medicine,
  type PharmacySettings,
  type PurchaseReturn,
  type ReceiptPaperSize,
  type Sale,
  type Supplier,
} from "./types";

/** A4 for anything an inspector or a distributor reads; thermal for the bill. */
export type PaperSize = ReceiptPaperSize;

function pageRule(paper: PaperSize): string {
  switch (paper) {
    case "58mm":
      return "@page { size: 58mm auto; margin: 3mm; }";
    case "80mm":
      return "@page { size: 80mm auto; margin: 4mm; }";
    default:
      return "@page { size: A4 portrait; margin: 12mm; }";
  }
}

function documentStyles(paper: PaperSize): string {
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
    h2 { font-size: ${narrow ? "11px" : "13px"}; margin: 0 0 2mm; text-transform: uppercase; letter-spacing: 0.04em; }
    .muted { color: #5A6072; }
    .center { text-align: center; }
    .right { text-align: right; }
    .row { display: flex; justify-content: space-between; gap: 4mm; }
    .rule { border-top: 1px dashed #B9BED0; margin: 2mm 0; }
    .solid { border-top: 1px solid #0E1124; margin: 2mm 0; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: ${narrow ? "0.8mm 0" : "1.6mm 2mm"}; vertical-align: top; }
    th { font-size: ${narrow ? "9px" : "10px"}; text-transform: uppercase; letter-spacing: 0.04em; color: #5A6072; }
    .grid th, .grid td { border-bottom: 1px solid #E3E6EF; }
    .grid thead th { border-bottom: 1px solid #0E1124; }
    .total-row td { font-weight: 700; font-size: ${narrow ? "12px" : "14px"}; }
    .foot { margin-top: 3mm; font-size: ${narrow ? "9px" : "10px"}; color: #5A6072; }
    .badge { display: inline-block; border: 1px solid #0E1124; border-radius: 2mm; padding: 0.5mm 1.5mm; font-size: ${narrow ? "8.5px" : "9.5px"}; }
  `;
}

/**
 * Print an HTML string as a standalone document.
 *
 * Returns false when the iframe could not be created, so the caller can leave
 * the on-screen copy up rather than silently appearing to do nothing.
 */
export function printHtml(html: string, paper: PaperSize, title: string): boolean {
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
      // Printing is best-effort; the on-screen copy is still readable.
    }
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

function shopHeader(business: Business | null, settings: PharmacySettings): string {
  const lines = [
    business?.address ? escapeHtml(business.address) : "",
    business?.phone ? `Ph ${escapeHtml(business.phone)}` : "",
    settings.drugLicenceNo ? `D.L. No. ${escapeHtml(settings.drugLicenceNo)}` : "",
    settings.gstin ? `GSTIN ${escapeHtml(settings.gstin)}` : "",
  ].filter(Boolean);
  return `
    <div class="center">
      <h1>${escapeHtml(business?.name || "Pharmacy")}</h1>
      ${lines.map((line) => `<div class="muted">${line}</div>`).join("")}
    </div>
  `;
}

// ---------------------------------------------------------------------------
// The bill
// ---------------------------------------------------------------------------

export type BillContext = {
  sale: Sale;
  business: Business | null;
  settings: PharmacySettings;
  customer: Customer | null;
  medicines: Medicine[];
  currency: string;
};

export function billHtml(context: BillContext): string {
  const { sale, business, settings, customer, medicines, currency } = context;
  const narrow = settings.receiptPaperSize !== "a4";
  const money = (value: number) => escapeHtml(formatMoney(value, currency));
  const hsnFor = (medicineId: string) =>
    medicines.find((medicine) => medicine.id === medicineId)?.hsnCode ?? "";
  const totals = billTotals(sale.lines, sale.discount, settings.taxInclusive);
  const balance = Math.max(0, sale.total - (sale.paid || 0));

  const rows = sale.lines
    .map((line) => {
      const detail = [
        `B/No ${escapeHtml(line.batchNo || "—")}`,
        `Exp ${escapeHtml(formatExpiry(line.expiry))}`,
        hsnFor(line.medicineId) ? `HSN ${escapeHtml(hsnFor(line.medicineId))}` : "",
        line.taxRate ? `GST ${line.taxRate}%` : "",
      ]
        .filter(Boolean)
        .join(" · ");
      if (narrow) {
        return `
          <tr>
            <td colspan="3"><strong>${escapeHtml(line.name)}</strong><br>
              <span class="muted" style="font-size:9px">${detail}</span></td>
          </tr>
          <tr>
            <td class="muted">${line.quantity} × ${money(line.rate)}${
              line.discountPct ? ` −${line.discountPct}%` : ""
            }</td>
            <td></td>
            <td class="right"><strong>${money(line.amount)}</strong></td>
          </tr>`;
      }
      return `
        <tr>
          <td><strong>${escapeHtml(line.name)}</strong><br><span class="muted">${detail}</span></td>
          <td class="right">${money(line.mrp)}</td>
          <td class="right">${line.quantity}</td>
          <td class="right">${money(line.rate)}</td>
          <td class="right">${line.discountPct ? `${line.discountPct}%` : "—"}</td>
          <td class="right"><strong>${money(line.amount)}</strong></td>
        </tr>`;
    })
    .join("");

  const head = narrow
    ? ""
    : `<thead><tr>
         <th>Medicine</th><th class="right">MRP</th><th class="right">Qty</th>
         <th class="right">Rate</th><th class="right">Disc</th><th class="right">Amount</th>
       </tr></thead>`;

  const taxRows = totals.byRate
    .filter((bucket) => bucket.rate > 0)
    .map(
      (bucket) =>
        `<div class="row"><span class="muted">CGST ${bucket.rate / 2}% + SGST ${
          bucket.rate / 2
        }% on ${money(bucket.taxable)}</span><span>${money(bucket.tax)}</span></div>`
    )
    .join("");

  return `
    ${shopHeader(business, settings)}
    <div class="solid"></div>
    <div class="row">
      <div><strong>Bill ${escapeHtml(sale.invoiceNo)}</strong></div>
      <div class="muted">${escapeHtml(formatDate(sale.date))}</div>
    </div>
    ${
      customer
        ? `<div class="muted">${escapeHtml(customer.name)}${
            customer.phone ? ` · ${escapeHtml(customer.phone)}` : ""
          }</div>`
        : ""
    }
    ${
      sale.prescription
        ? `<div class="muted">Rx: ${escapeHtml(sale.prescription.patientName)} · Dr ${escapeHtml(
            sale.prescription.doctorName
          )}${
            sale.prescription.doctorRegNo
              ? ` (Reg ${escapeHtml(sale.prescription.doctorRegNo)})`
              : ""
          }</div>`
        : ""
    }
    <div class="rule"></div>
    <table class="${narrow ? "" : "grid"}">${head}<tbody>${rows}</tbody></table>
    <div class="rule"></div>
    <div class="row"><span class="muted">Subtotal</span><span>${money(totals.subtotal)}</span></div>
    ${
      totals.discount > 0
        ? `<div class="row"><span class="muted">Discount</span><span>−${money(
            totals.discount
          )}</span></div>`
        : ""
    }
    ${taxRows}
    ${
      settings.taxInclusive
        ? `<div class="muted" style="font-size:9px">Tax shown above is included in the prices.</div>`
        : ""
    }
    <div class="solid"></div>
    <div class="row total-row"><span>Total</span><span>${money(sale.total)}</span></div>
    <div class="row"><span class="muted">${escapeHtml(sale.paymentMode || "Paid")}</span><span>${money(
      sale.paid || 0
    )}</span></div>
    ${
      balance > 0
        ? `<div class="row"><span class="muted">Balance due</span><span><strong>${money(
            balance
          )}</strong></span></div>`
        : ""
    }
    <div class="foot">${escapeHtml(amountInWordsIndian(Math.round(sale.total)))}</div>
    <div class="foot center">
      Medicines once sold are not returnable except as permitted by law.<br>
      Thank you — get well soon.
    </div>
  `;
}

export function printBill(context: BillContext): boolean {
  return printHtml(
    billHtml(context),
    context.settings.receiptPaperSize,
    `Bill ${context.sale.invoiceNo}`
  );
}

// ---------------------------------------------------------------------------
// Schedule H / H1 register
// ---------------------------------------------------------------------------

/**
 * The scheduled-sales register.
 *
 * Printed on A4 regardless of the receipt paper setting: this is a document
 * that gets filed, not handed across a counter. The footer states plainly what
 * it is — a record kept by the shop from its own billing — because describing
 * it as a statutory register would be a claim nobody here is in a position to
 * make.
 */
export function printScheduleRegister(
  rows: RegisterRow[],
  range: { from: string; to: string },
  business: Business | null,
  settings: PharmacySettings
): boolean {
  const body = rows
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(formatDate(row.date))}</td>
          <td>${escapeHtml(row.invoiceNo)}</td>
          <td>${escapeHtml(row.patientName || "—")}</td>
          <td>${escapeHtml(row.doctorName || "—")}<br><span class="muted">${escapeHtml(
            row.doctorRegNo || ""
          )}</span></td>
          <td>${escapeHtml(row.medicine)}<br><span class="muted">${escapeHtml(
            row.schedule
          )}</span></td>
          <td>${escapeHtml(row.batchNo || "—")}</td>
          <td>${escapeHtml(row.expiry)}</td>
          <td class="right">${row.quantity}</td>
        </tr>`
    )
    .join("");

  const html = `
    ${shopHeader(business, settings)}
    <div class="solid"></div>
    <h2>Register of scheduled medicines sold</h2>
    <div class="muted">${escapeHtml(formatDate(range.from))} to ${escapeHtml(
      formatDate(range.to)
    )} · ${rows.length} entries</div>
    <div class="rule"></div>
    <table class="grid">
      <thead><tr>
        <th>Date</th><th>Bill</th><th>Patient</th><th>Prescriber</th>
        <th>Medicine</th><th>Batch</th><th>Expiry</th><th class="right">Qty</th>
      </tr></thead>
      <tbody>${body || `<tr><td colspan="8" class="muted">No scheduled sales in this period.</td></tr>`}</tbody>
    </table>
    <div class="foot">
      This register is generated from this shop's own billing records for its
      internal use. It is not certified as a statutory record, and it does not
      replace any register the shop is required to maintain under the Drugs and
      Cosmetics Rules. Verify entries against your bills before relying on them.
    </div>
    <div class="foot" style="margin-top:10mm">Signature of the registered pharmacist: ____________________________</div>
  `;
  return printHtml(html, "a4", "Schedule register");
}

// ---------------------------------------------------------------------------
// Expiry removal list
// ---------------------------------------------------------------------------

/**
 * The physical removal list.
 *
 * Sorted by rack, not by date or by value, because the person holding this
 * sheet is walking the shop pulling strips off shelves — and a list in shelf
 * order is walked once instead of three times.
 */
export function printExpiryList(
  batches: Batch[],
  medicines: Medicine[],
  title: string,
  business: Business | null,
  settings: PharmacySettings,
  currency: string
): boolean {
  const medicineById = new Map(medicines.map((medicine) => [medicine.id, medicine]));
  const sorted = [...batches].sort((a, b) => {
    const rackA = medicineById.get(a.medicineId)?.rack ?? "";
    const rackB = medicineById.get(b.medicineId)?.rack ?? "";
    return rackA.localeCompare(rackB) || a.expiry.localeCompare(b.expiry);
  });
  const value = sorted.reduce((sum, batch) => sum + batch.effectiveRate * batch.quantity, 0);

  const body = sorted
    .map((batch) => {
      const medicine = medicineById.get(batch.medicineId);
      return `
        <tr>
          <td>${escapeHtml(medicine?.rack || "—")}</td>
          <td>${escapeHtml(medicine?.name || "—")}<br><span class="muted">${escapeHtml(
            medicine?.packLabel || ""
          )}</span></td>
          <td>${escapeHtml(batch.batchNo || "—")}</td>
          <td>${escapeHtml(formatExpiry(batch.expiry))}</td>
          <td class="right">${batch.quantity}</td>
          <td class="right">${escapeHtml(
            formatMoney(batch.effectiveRate * batch.quantity, currency)
          )}</td>
          <td style="width:18mm"></td>
        </tr>`;
    })
    .join("");

  const html = `
    ${shopHeader(business, settings)}
    <div class="solid"></div>
    <h2>${escapeHtml(title)}</h2>
    <div class="muted">${sorted.length} batches · ${escapeHtml(
      formatMoney(value, currency)
    )} at cost · in rack order</div>
    <div class="rule"></div>
    <table class="grid">
      <thead><tr>
        <th>Rack</th><th>Medicine</th><th>Batch</th><th>Expiry</th>
        <th class="right">Qty</th><th class="right">Value</th><th>Pulled ✓</th>
      </tr></thead>
      <tbody>${body || `<tr><td colspan="7" class="muted">Nothing in this bucket.</td></tr>`}</tbody>
    </table>
    <div class="foot">Checked by: ____________________  Date: ____________</div>
  `;
  return printHtml(html, "a4", title);
}

// ---------------------------------------------------------------------------
// Purchase return note
// ---------------------------------------------------------------------------

export function printPurchaseReturn(
  record: PurchaseReturn,
  supplier: Supplier | null,
  batches: Batch[],
  medicines: Medicine[],
  business: Business | null,
  settings: PharmacySettings,
  currency: string
): boolean {
  const batchById = new Map(batches.map((batch) => [batch.id, batch]));
  const medicineById = new Map(medicines.map((medicine) => [medicine.id, medicine]));

  const body = record.lines
    .map((line) => {
      const batch = batchById.get(line.batchId);
      const medicine = batch ? medicineById.get(batch.medicineId) : undefined;
      return `
        <tr>
          <td>${escapeHtml(medicine?.name || "—")}<br><span class="muted">${escapeHtml(
            medicine?.packLabel || ""
          )}</span></td>
          <td>${escapeHtml(batch?.batchNo || "—")}</td>
          <td>${escapeHtml(formatExpiry(batch?.expiry || ""))}</td>
          <td class="right">${line.quantity}</td>
          <td class="right">${escapeHtml(formatMoney(line.rate, currency))}</td>
          <td class="right">${escapeHtml(formatMoney(line.amount, currency))}</td>
        </tr>`;
    })
    .join("");

  const html = `
    ${shopHeader(business, settings)}
    <div class="solid"></div>
    <h2>Purchase return note ${escapeHtml(record.noteNo)}</h2>
    <div class="row">
      <div>
        <strong>${escapeHtml(supplier?.name || "Supplier")}</strong><br>
        <span class="muted">${escapeHtml(supplier?.address || "")}</span><br>
        <span class="muted">${supplier?.gstin ? `GSTIN ${escapeHtml(supplier.gstin)}` : ""}</span>
      </div>
      <div class="right">
        <span class="muted">${escapeHtml(formatDate(record.date))}</span><br>
        <span class="badge">${escapeHtml(
          PURCHASE_RETURN_REASON_LABELS[record.reason]
        )}</span>
      </div>
    </div>
    <div class="rule"></div>
    <table class="grid">
      <thead><tr>
        <th>Medicine</th><th>Batch</th><th>Expiry</th>
        <th class="right">Qty</th><th class="right">Rate</th><th class="right">Amount</th>
      </tr></thead>
      <tbody>${body}</tbody>
    </table>
    <div class="solid"></div>
    <div class="row total-row"><span>Total</span><span>${escapeHtml(
      formatMoney(record.total, currency)
    )}</span></div>
    <div class="foot">${escapeHtml(amountInWordsIndian(Math.round(record.total)))}</div>
    <div class="foot" style="margin-top:12mm">
      <div class="row">
        <span>Goods returned by: ____________________</span>
        <span>Received by: ____________________</span>
      </div>
    </div>
  `;
  return printHtml(html, "a4", `Return note ${record.noteNo}`);
}
