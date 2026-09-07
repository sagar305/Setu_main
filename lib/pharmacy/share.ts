// Building the link a bill is sent as.
//
// The whole bill is compressed into the fragment of /view, exactly like the
// POS invoice and the rental challan: nothing is uploaded, and the link keeps
// working on a phone with no signal. The shared viewer is the one every other
// Setu tool already uses, so a customer who has been sent a bill by one of them
// meets the same page here.
//
// A pharmacy line carries a batch and an expiry that a plain invoice line does
// not, so both are folded into the line's description rather than adding a
// field the shared viewer would not know how to render. That is what a customer
// asking "which batch was this?" three weeks later needs to be able to read.

import {
  businessToShare,
  type SharedDoc,
  type SharedInvoice,
} from "@/lib/toolkit/shareLink";
import type { Business } from "@/lib/pos/types";
import { formatMoney } from "@/lib/pos/types";
import {
  formatExpiry,
  type Customer,
  type PharmacySettings,
  type Sale,
} from "./types";
import { saleDue } from "./calc";

/** "Crocin Advance · B/No J4213 · Exp Jun 2027" */
export function shareLineName(line: {
  name: string;
  batchNo: string;
  expiry: string;
}): string {
  return [
    line.name,
    line.batchNo ? `B/No ${line.batchNo}` : "",
    line.expiry ? `Exp ${formatExpiry(line.expiry)}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * A bill as a shareable document.
 *
 * The tax fields are the subtle part. The shared viewer prices a line as
 * `qty × rate × (1 + tax/100)` — right for a shop whose prices exclude tax, and
 * wrong for a pharmacy, where MRP already contains it. Sending the rate for an
 * inclusive bill would show the customer a line of ₹22.40 above a total of ₹20,
 * so an inclusive bill is shared without per-line tax and without a tax row:
 * every figure on the shared copy is then the money that actually changed
 * hands, and it adds up. The GST breakdown lives on the printed bill, which is
 * the tax document; this link is the customer's copy.
 *
 * The payment label carries the balance when there is one, because a customer
 * who paid part of a bill should not have to work it out from two other
 * numbers. One limit worth knowing: the viewer's "pay by UPI" button offers the
 * bill total, since a shared invoice has no balance field — chase a part-paid
 * bill with the balance reminder on the Customers screen instead.
 */
export function saleDoc(
  business: Business | null,
  sale: Sale,
  customer: Customer | null,
  settings: PharmacySettings
): SharedDoc {
  const currency = business?.currency ?? "INR";
  const balance = saleDue(sale);
  const inclusive = settings.taxInclusive;

  const doc: SharedInvoice = {
    t: "inv",
    b: businessToShare(business, currency),
    no: sale.invoiceNo,
    dt: sale.date,
    cn: customer?.name || undefined,
    cp: customer?.phone || undefined,
    it: sale.lines.map((line) => ({
      n: shareLineName(line),
      q: line.quantity,
      r: line.rate,
      x: inclusive ? undefined : line.taxRate || undefined,
    })),
    sub: sale.lines.reduce((sum, line) => sum + line.amount, 0),
    dis: sale.discount || undefined,
    tax: inclusive ? undefined : sale.taxTotal || undefined,
    tot: sale.total,
    pm: balance > 0
      ? `${sale.paymentMode || "Part paid"} — ${formatMoney(balance, currency)} balance due`
      : sale.paymentMode || undefined,
  };
  return doc;
}
