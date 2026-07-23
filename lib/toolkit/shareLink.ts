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

export type SharedDoc =
  | SharedInvoice
  | SharedQuotation
  | SharedLedger
  | SharedAppointment;

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
  }
}

export function recipientPhone(doc: SharedDoc): string | undefined {
  return "cp" in doc ? doc.cp : undefined;
}
