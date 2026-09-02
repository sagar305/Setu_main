// Shareable document links (Chapter 13 Export Strategy + Integration Catalog).
//
// A whole document is compressed into a URL fragment (#d=<payload>) exactly
// like the QR Menu does — the data lives in the hash, so it never reaches a
// server. The /view page decodes it and renders it read-only, with a UPI
// "Pay now" button + QR when an amount is owed.
//
// Wire keys are kept short so links stay small even before compression.

import LZString from "lz-string";
import type { Business } from "@/lib/pos/types";

export const VIEW_PATH = "/view";

/**
 * Map a workspace Business to the compact share header. The logo is
 * deliberately omitted — a data-URL logo would bloat the link and can break
 * WhatsApp's URL handling; the viewer shows the business name prominently.
 */
export function businessToShare(business: Business | null, fallbackCurrency = "INR"): ShareBusiness {
  return {
    n: business?.name || "Business",
    a: business?.address || undefined,
    p: business?.phone || undefined,
    g: business?.taxNumber || undefined,
    u: business?.upiId || undefined,
    cur: business?.currency || fallbackCurrency,
  };
}

export type ShareBusiness = {
  n: string; // name
  a?: string; // address
  p?: string; // phone
  g?: string; // gstin / tax number
  u?: string; // upi id
  cur: string; // currency code
  logo?: string; // small logo data URL (optional; omitted to keep links tiny)
};

export type ShareLineItem = {
  n: string; // name / description
  q: number; // quantity
  r: number; // rate / unit price
  x?: number; // tax rate percent (optional)
};

export type SharedInvoice = {
  t: "inv";
  b: ShareBusiness;
  no: string; // invoice number
  dt: string; // date (ISO)
  cn?: string; // customer name
  cp?: string; // customer phone
  it: ShareLineItem[];
  sub: number;
  dis?: number; // discount amount
  tax?: number;
  tot: number;
  pm?: string; // payment method / status label
};

export type SharedQuotation = {
  t: "quo";
  b: ShareBusiness;
  no: string;
  dt: string;
  vu?: string; // valid until
  cn?: string;
  cp?: string;
  ca?: string; // client address
  it: ShareLineItem[];
  sub: number;
  tax?: number;
  tot: number;
  note?: string;
};

export type SharedLedger = {
  t: "led";
  b: ShareBusiness;
  cn: string; // customer name
  cp?: string; // customer phone
  bal: number; // outstanding balance owed
  note?: string;
};

export type SharedAppointment = {
  t: "apt";
  b: ShareBusiness;
  cn: string; // customer name
  cp?: string;
  svc: string; // service
  dt: string; // date
  tm: string; // time
  dur?: number; // duration minutes
  note?: string;
  fee?: number; // optional advance / booking fee to collect
};

/** Fee payment receipt from the Tuition Class Manager. */
export type SharedFeeReceipt = {
  t: "fee";
  b: ShareBusiness;
  no: string; // receipt number
  dt: string; // date (ISO)
  sn: string; // student name
  cp?: string; // parent phone
  cls?: string; // class / grade
  amt: number; // amount received
  mode?: string; // payment mode
  tw?: string[]; // what the payment was towards
  bal?: number; // balance still pending, if any
};

/** Test result shared with a parent. */
export type SharedMarks = {
  t: "mrk";
  b: ShareBusiness;
  sn: string; // student name
  cp?: string;
  tn: string; // test name
  sub?: string; // subject
  dt: string; // test date
  mk: number | null; // null = did not appear
  max: number;
  avg?: number; // class average
  rnk?: number; // rank
  outOf?: number; // students who appeared
  rem?: string; // teacher's remark
};

/**
 * One prescribed medicine, pre-composed for display.
 *
 * The name arrives already joined ("TAB Paracetamol 500mg") because the clinic
 * print layout composes it the same way — the viewer is meant to match the
 * paper the patient may also be holding, not to re-derive it.
 */
export type ShareRxMedicine = {
  n: string; // form + name + strength, already joined
  f?: string; // frequency, e.g. "1-0-1"
  d?: string; // duration, e.g. "5 days"
  q?: string; // quantity
  nt?: string; // timing and instructions
};

/**
 * A prescription shared with the patient.
 *
 * Mirrors lib/clinic/print.ts so the screen and the printout say the same
 * things in the same order. Clinical free text (diagnosis, advice) is carried
 * as written; nothing is summarised or reworded on the way.
 */
export type SharedPrescription = {
  t: "rx";
  b: ShareBusiness;
  pn: string; // patient name
  cp?: string; // patient phone
  ag?: string; // age / sex line as the printout renders it
  fl?: string; // file number
  dt: string; // visit date (ISO)
  dr?: string; // doctor name
  drq?: string; // qualifications · speciality
  reg?: string; // registration number
  vit?: string[]; // vitals, pre-formatted
  alg?: string[]; // allergies
  dx?: string; // diagnosis
  med: ShareRxMedicine[];
  inv?: string[]; // investigations advised
  adv?: string; // advice
  fu?: number; // follow-up in days
  ft?: string; // clinic footer line
};

/** Monthly attendance summary shared with a parent. */
export type SharedAttendance = {
  t: "att";
  b: ShareBusiness;
  sn: string;
  cp?: string;
  pd: string; // period label, e.g. "Aug 2026"
  prs: number; // classes attended
  tot: number; // classes held
  pct: number; // percentage
  abs?: string[]; // dates missed
};

/**
 * A hire, shared with the customer.
 *
 * One shape covers the quotation, the confirmation and the settled note,
 * because they are the same document at three moments and a customer who saved
 * the first link should recognise the third. `st` says which moment it is, and
 * the settlement figures are simply absent until there are any.
 */
export type SharedRental = {
  t: "rnt";
  b: ShareBusiness;
  /** quote · confirmed · settled */
  st: "quote" | "confirmed" | "settled";
  no: string; // booking number
  dt: string; // issued date (ISO)
  cn?: string; // customer name
  cp?: string; // customer phone
  ev?: string; // event name
  vn?: string; // venue
  fd: string; // from date
  td: string; // to date
  ft?: string; // from time
  tt?: string; // to time
  it: ShareLineItem[];
  sub: number;
  trn?: number; // transport
  lab?: number; // labour
  dis?: number; // discount
  tax?: number;
  tot: number; // hire total
  dep?: number; // deposit held
  adv?: number; // advance / payments received
  /** Settlement only. */
  ld?: number; // late days
  lf?: number; // late fee
  dmg?: number; // damage charges
  los?: number; // loss charges
  ref?: number; // deposit refunded
  due?: number; // still payable
  vu?: string; // quote valid until
  note?: string;
};

export type SharedDoc =
  | SharedInvoice
  | SharedQuotation
  | SharedLedger
  | SharedAppointment
  | SharedFeeReceipt
  | SharedMarks
  | SharedAttendance
  | SharedPrescription
  | SharedRental;

// ---------------------------------------------------------------------------
// Encode / decode
// ---------------------------------------------------------------------------

export function encodeDoc(doc: SharedDoc): string {
  return LZString.compressToEncodedURIComponent(JSON.stringify(doc));
}

export function decodeDoc(raw: string): SharedDoc | null {
  let payload = raw.replace(/^[#?]/, "");
  if (payload.includes("=")) {
    const params = new URLSearchParams(payload);
    payload = params.get("d") ?? params.get("data") ?? payload;
  }
  if (!payload) return null;
  try {
    const json = LZString.decompressFromEncodedURIComponent(payload);
    if (!json) return null;
    const doc = JSON.parse(json) as SharedDoc;
    if (!doc || typeof doc !== "object" || !("t" in doc) || !doc.b) return null;
    return doc;
  } catch {
    return null;
  }
}

/** Full shareable URL: {origin}/view#d=<payload>. Data stays in the fragment. */
export function buildShareUrl(doc: SharedDoc, origin: string): string {
  return `${origin}${VIEW_PATH}#d=${encodeDoc(doc)}`;
}

// ---------------------------------------------------------------------------
// Presentation helpers
// ---------------------------------------------------------------------------

export function docTitle(doc: SharedDoc): string {
  switch (doc.t) {
    case "inv":
      return `Invoice ${doc.no}`;
    case "quo":
      return `Quotation ${doc.no}`;
    case "led":
      return `Payment reminder`;
    case "apt":
      return `Appointment`;
    case "fee":
      return `Fee receipt ${doc.no}`;
    case "mrk":
      return `Test result`;
    case "att":
      return `Attendance report`;
    case "rx":
      return `Prescription`;
    case "rnt":
      return doc.st === "quote"
        ? `Quotation ${doc.no}`
        : doc.st === "settled"
          ? `Settlement ${doc.no}`
          : `Booking ${doc.no}`;
  }
}

/** Amount the recipient can pay via UPI, or 0 when nothing is collectable. */
export function payableAmount(doc: SharedDoc): number {
  switch (doc.t) {
    case "inv":
      return doc.tot;
    case "quo":
      return doc.tot;
    case "led":
      return doc.bal;
    case "apt":
      return doc.fee ?? 0;
    // A receipt offers "pay now" only for whatever is still pending.
    case "fee":
      return doc.bal ?? 0;
    // A quote asks for the whole figure; a live booking asks for the balance
    // after the advance; a settled one asks for whatever the deposit did not
    // cover. A refund due to the customer is not something to collect.
    case "rnt":
      if (doc.st === "quote") return doc.tot;
      if (doc.st === "settled") return Math.max(0, doc.due ?? 0);
      return Math.max(0, doc.tot - (doc.adv ?? 0));
    case "mrk":
    case "att":
    // A prescription is never something to collect money against.
    case "rx":
      return 0;
  }
}

export function recipientPhone(doc: SharedDoc): string | undefined {
  return "cp" in doc ? doc.cp : undefined;
}
