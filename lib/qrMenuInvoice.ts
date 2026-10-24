import "server-only";

import { jsPDF } from "jspdf";
import type { Billing } from "@/lib/qrMenuCheckout";

// ---------------------------------------------------------------------------
// The PDF invoice attached to the license key email.
//
// Optional seller details, shown when set:
//   SETU_INVOICE_GSTIN     makes it a "Tax Invoice" with the GST inside an
//                          Indian price broken out as CGST + SGST
//   SETU_INVOICE_ADDRESS   registered address; use "\n" for line breaks
//
// Prices are GST-inclusive (content/en/pricing.json), so the total is always
// what was charged; a breakup only splits it, never adds to it.
//
// jsPDF's built-in fonts have no rupee glyph, so amounts use currency codes
// ("INR 499.00").
// ---------------------------------------------------------------------------

/** GST on software services. Only used to split an inclusive Indian price. */
const GST_RATE = 0.18;
/** SAC for online software services, printed beside the line item. */
const SAC_CODE = "998314";

const INDIGO: [number, number, number] = [38, 48, 107];
const INK: [number, number, number] = [26, 26, 26];
const MUTED: [number, number, number] = [110, 110, 110];
const LINE: [number, number, number] = [225, 222, 214];

export type InvoiceInput = {
  orderId: string;
  /** When the gateway created the order; the invoice date. */
  issuedAt: Date;
  billing: Billing;
  days: number;
  amount: number;
  currency: string;
  customerEmail: string;
  customerPhone?: string;
  /** The gateway's name, as in "Paid via PayPal". */
  paidVia: string;
};

/**
 * A stable invoice number for an order, so the webhook and the return page
 * (which may both email it) always print the same one.
 */
export function invoiceNumber(orderId: string, issuedAt: Date): string {
  const day = issuedAt.toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = orderId.replace(/[^A-Za-z0-9]/g, "").slice(-8).toUpperCase();
  return `SQM-${day}-${suffix}`;
}

export function formatMoney(amount: number, currency: string): string {
  return `${currency} ${amount.toFixed(2)}`;
}

/** Splits a GST-inclusive amount into taxable value and the two halves of GST. */
export function splitInclusiveGst(amount: number) {
  const taxable = Math.round((amount / (1 + GST_RATE)) * 100) / 100;
  const gst = Math.round((amount - taxable) * 100) / 100;
  const cgst = Math.round((gst / 2) * 100) / 100;
  return { taxable, cgst, sgst: Math.round((gst - cgst) * 100) / 100 };
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

export function buildInvoicePdf(input: InvoiceInput): Buffer {
  const gstin = process.env.SETU_INVOICE_GSTIN?.trim() || "";
  const address = (process.env.SETU_INVOICE_ADDRESS ?? "").replace(/\\n/g, "\n").trim();
  const showGst = Boolean(gstin) && input.currency === "INR";

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const width = doc.internal.pageSize.getWidth();
  const left = 48;
  const right = width - 48;

  // Header band, matching the indigo header of the emails.
  doc.setFillColor(...INDIGO);
  doc.rect(0, 0, width, 88, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Setu Technology", left, 52);
  doc.setFontSize(12);
  doc.text(gstin ? "TAX INVOICE" : "INVOICE", right, 52, { align: "right" });

  // Seller and invoice details.
  let y = 124;
  doc.setTextColor(...INK);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("From", left, y);
  doc.text("Invoice details", width / 2 + 20, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);

  const seller = [
    "Setu Technology",
    ...(address ? address.split("\n") : []),
    ...(gstin ? [`GSTIN: ${gstin}`] : []),
    "hello@setutechnology.com",
    "setutechnology.com",
  ];
  seller.forEach((line, index) => doc.text(line, left, y + 16 + index * 14));

  const details: [string, string][] = [
    ["Invoice no.", invoiceNumber(input.orderId, input.issuedAt)],
    ["Date", formatDate(input.issuedAt)],
    ["Order ID", input.orderId],
    ["Payment", `Paid via ${input.paidVia}`],
  ];
  details.forEach(([label, value], index) => {
    const rowY = y + 16 + index * 14;
    doc.text(label, width / 2 + 20, rowY);
    doc.setTextColor(...INK);
    // A full Cashfree order id is ~40 characters and would run into its label.
    doc.setFontSize(value.length > 24 ? 8 : 10);
    doc.text(value, right, rowY, { align: "right" });
    doc.setFontSize(10);
    doc.setTextColor(...MUTED);
  });

  y += 16 + Math.max(seller.length, details.length) * 14 + 20;

  // Buyer.
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.text("Billed to", left, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.text(input.customerEmail, left, y + 16);
  if (input.customerPhone) doc.text(input.customerPhone, left, y + 30);
  y += 60;

  // Line item table.
  doc.setFillColor(242, 241, 250);
  doc.rect(left, y, right - left, 26, "F");
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.text("Description", left + 10, y + 17);
  doc.text("Qty", right - 170, y + 17, { align: "right" });
  doc.text("Amount", right - 10, y + 17, { align: "right" });
  y += 26;

  const period = input.billing === "yearly" ? "Yearly" : "Monthly";
  doc.setFont("helvetica", "normal");
  doc.text(`Setu QR Menu premium - ${period} (${input.days} days)`, left + 10, y + 20);
  doc.setTextColor(...MUTED);
  doc.setFontSize(9);
  doc.text(
    `License key, redeemable once${showGst ? ` | SAC ${SAC_CODE}` : ""}`,
    left + 10,
    y + 34
  );
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  doc.text("1", right - 170, y + 20, { align: "right" });
  doc.text(formatMoney(input.amount, input.currency), right - 10, y + 20, { align: "right" });
  y += 48;
  doc.setDrawColor(...LINE);
  doc.line(left, y, right, y);

  // Totals.
  y += 22;
  const totalRow = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setTextColor(...(bold ? INK : MUTED));
    doc.text(label, right - 170, y, { align: "right" });
    doc.setTextColor(...INK);
    doc.text(value, right - 10, y, { align: "right" });
    y += 18;
  };
  if (showGst) {
    const { taxable, cgst, sgst } = splitInclusiveGst(input.amount);
    totalRow("Taxable value", formatMoney(taxable, input.currency));
    totalRow(`CGST @ ${(GST_RATE * 50).toFixed(0)}%`, formatMoney(cgst, input.currency));
    totalRow(`SGST @ ${(GST_RATE * 50).toFixed(0)}%`, formatMoney(sgst, input.currency));
  }
  totalRow("Total paid", formatMoney(input.amount, input.currency), true);

  y += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(
    showGst ? "Amount is inclusive of GST." : "All prices are inclusive of applicable taxes.",
    left,
    y
  );

  // Footer.
  const footerY = doc.internal.pageSize.getHeight() - 40;
  doc.setDrawColor(...LINE);
  doc.line(left, footerY - 16, right, footerY - 16);
  doc.text(
    "Thank you for choosing Setu QR Menu. This is a computer-generated invoice and needs no signature.",
    width / 2,
    footerY,
    { align: "center" }
  );

  return Buffer.from(doc.output("arraybuffer"));
}
