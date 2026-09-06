// Building the link a bill is sent as.
//
// The whole bill is compressed into the fragment of /view, exactly like the POS
// invoice and the hire book's challan: nothing is uploaded, and the link keeps
// working on a phone with no signal. The shared viewer is the one every other
// Setu tool already uses, so a customer who has been sent a bill by one of them
// meets the same page here.
//
// What is deliberately not in the link: the condition checklist, the photos and
// the signature. A share link is forwarded, and the intake record is evidence
// held by the shop — it belongs on the printed slip the customer signed for,
// not in a URL that ends up in a group chat. The bill is the customer's copy;
// the record stays where it can be trusted.

import {
  buildShareUrl,
  businessToShare,
  type SharedDoc,
  type SharedInvoice,
} from "@/lib/toolkit/shareLink";
import type { Business } from "@/lib/pos/types";
import {
  deviceLabel,
  formatDate,
  type Bill,
  type Customer,
  type Job,
} from "./types";
import { billDue, warrantyEndOf } from "./calc";

/**
 * A repair bill as a shareable document.
 *
 * Labour rides as a line rather than as a separate field, because the shared
 * viewer prices `sub` off the lines it was given and a labour charge left out
 * of them would make the customer's copy fail to add up. The warranty end date
 * goes in the payment label — it is the one thing a customer looks this link up
 * again for weeks later, and there is no field on a shared invoice for it.
 */
export function billDoc(
  business: Business | null,
  job: Job,
  bill: Bill,
  customer: Customer | null
): SharedDoc {
  const currency = business?.currency ?? "INR";
  const balance = billDue(bill);
  const warrantyEnd = warrantyEndOf(job);

  const items = [
    ...bill.partLines.map((line) => ({
      n: line.label,
      q: line.quantity,
      r: line.unitPrice,
    })),
    ...(bill.labourCharge > 0
      ? [{ n: "Labour / service charge", q: 1, r: bill.labourCharge }]
      : []),
  ];

  const paymentLabel = [
    balance > 0
      ? `${bill.paymentMode || "Part paid"} — balance due`
      : bill.paymentMode || "Paid",
    warrantyEnd ? `Warranty until ${formatDate(warrantyEnd)}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const doc: SharedInvoice = {
    t: "inv",
    b: businessToShare(business, currency),
    no: bill.invoiceNo,
    dt: bill.date,
    cn: customer?.name || undefined,
    cp: customer?.phone || undefined,
    it: items.length > 0 ? items : [{ n: `Repair — ${deviceLabel(job)}`, q: 1, r: bill.total }],
    sub: items.reduce((sum, item) => sum + item.q * item.r, 0),
    dis: bill.discount || undefined,
    tax: bill.taxAmount || undefined,
    tot: bill.total,
    pm: paymentLabel || undefined,
  };
  return doc;
}

export function billShareUrl(
  business: Business | null,
  job: Job,
  bill: Bill,
  customer: Customer | null,
  origin: string
): string {
  return buildShareUrl(billDoc(business, job, bill, customer), origin);
}
