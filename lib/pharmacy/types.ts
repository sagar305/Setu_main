// Data model for the Free Pharmacy POS (/products/free-pharmacy-software).
//
// A fork of the Browser Based POS with one structural change that ripples
// everywhere: stock is held per BATCH, never per medicine. A chemist does not
// have "40 Crocin" — they have 12 of batch J4213 expiring 2026-08 and 28 of
// batch K1180 expiring 2027-02, bought at different rates, and the difference
// between those two is the difference between a sale and a write-off.
//
// Everything is stored client-side in IndexedDB: no backend, no login.

import type { Customer } from "@/lib/pos/types";

export type { Customer };

// ---------------------------------------------------------------------------
// Medicines and stock
// ---------------------------------------------------------------------------

/**
 * Drug schedule under the Drugs and Cosmetics Rules.
 *
 * "" is the honest default: a great many things on a chemist's shelf are not
 * scheduled at all, and forcing a class on them would put a prescription
 * requirement where none exists.
 */
export type ScheduleClass = "" | "H" | "H1" | "X" | "G" | "OTC";

export const SCHEDULE_CLASSES: ScheduleClass[] = ["", "OTC", "G", "H", "H1", "X"];

export const SCHEDULE_LABELS: Record<ScheduleClass, string> = {
  "": "Unscheduled",
  OTC: "OTC",
  G: "Schedule G",
  H: "Schedule H",
  H1: "Schedule H1",
  X: "Schedule X",
};

export type MedicineForm =
  | "tablet"
  | "capsule"
  | "syrup"
  | "injection"
  | "drops"
  | "ointment"
  | "inhaler"
  | "sachet"
  | "other";

export const MEDICINE_FORMS: MedicineForm[] = [
  "tablet",
  "capsule",
  "syrup",
  "injection",
  "drops",
  "ointment",
  "inhaler",
  "sachet",
  "other",
];

export const FORM_LABELS: Record<MedicineForm, string> = {
  tablet: "Tablet",
  capsule: "Capsule",
  syrup: "Syrup",
  injection: "Injection",
  drops: "Drops",
  ointment: "Ointment",
  inhaler: "Inhaler",
  sachet: "Sachet",
  other: "Other",
};

export type Medicine = {
  id: string;
  name: string; // brand name, "Crocin Advance"
  /** Salt/generic — powers substitute search. "Paracetamol 500mg" */
  composition: string;
  manufacturer: string;
  strength: string;
  form: MedicineForm;
  /** Units in a strip/pack; billing is per unit but stock arrives per pack. */
  packSize: number;
  packLabel: string; // "strip of 10", "100 ml bottle"
  hsnCode: string;
  taxRate: number; // 0, 5, 12, 18
  schedule: ScheduleClass;
  /** Physical location in the shop — the single biggest time-saver at the counter. */
  rack: string;
  barcode: string;
  lowStockAt: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

/**
 * Stock is held here, never on Medicine.
 *
 * Two rate fields, deliberately. `purchaseRate` is what the distributor's
 * invoice says was paid per unit, so a batch can always be reconciled against
 * the paper it arrived with. `effectiveRate` is that cost blended over the free
 * goods that came with it — the number margin and stock-value reporting has to
 * use, because ten strips bought and one free did not cost what the invoice
 * rate implies.
 */
export type Batch = {
  id: string;
  medicineId: string;
  batchNo: string;
  /** "YYYY-MM" — pharma expiry is month precision. Indexed. */
  expiry: string;
  mrp: number;
  /** Purchase rate per unit as billed by the distributor. */
  purchaseRate: number;
  /** Blended cost per unit: total paid ÷ (quantity + freeQuantity). */
  effectiveRate: number;
  sellingRate: number;
  /** Units currently in hand. */
  quantity: number;
  supplierId: string | null;
  purchaseId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Supplier = {
  id: string;
  name: string;
  phone: string;
  gstin: string;
  address: string;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Purchases
// ---------------------------------------------------------------------------

export type PurchaseLine = {
  id: string;
  medicineId: string;
  batchNo: string;
  expiry: string;
  /** Paid-for units. */
  quantity: number;
  /** Scheme goods — added to stock, cost zero. "10+1" means free = 1. */
  freeQuantity: number;
  purchaseRate: number;
  mrp: number;
  sellingRate: number;
  discountPct: number;
  taxRate: number;
};

export type Purchase = {
  id: string;
  invoiceNo: string; // the distributor's invoice number
  supplierId: string;
  date: string;
  lines: PurchaseLine[];
  discount: number;
  taxTotal: number;
  total: number;
  paid: number;
  createdAt: string;
};

/** Stock going back to the distributor — usually expiry or damage. */
export type PurchaseReturnReason = "expiry" | "damage" | "wrong-supply" | "other";

export const PURCHASE_RETURN_REASONS: PurchaseReturnReason[] = [
  "expiry",
  "damage",
  "wrong-supply",
  "other",
];

export const PURCHASE_RETURN_REASON_LABELS: Record<PurchaseReturnReason, string> = {
  expiry: "Expiry",
  damage: "Damage",
  "wrong-supply": "Wrong supply",
  other: "Other",
};

export type PurchaseReturnLine = {
  batchId: string;
  quantity: number;
  rate: number;
  amount: number;
};

export type PurchaseReturn = {
  id: string;
  /** Return note number, so the shop and the distributor can refer to one thing. */
  noteNo: string;
  supplierId: string;
  date: string;
  lines: PurchaseReturnLine[];
  reason: PurchaseReturnReason;
  total: number;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Sales
// ---------------------------------------------------------------------------

export type SaleLine = {
  id: string;
  medicineId: string;
  batchId: string; // always a specific batch
  name: string;
  batchNo: string;
  expiry: string;
  quantity: number;
  mrp: number;
  rate: number;
  discountPct: number;
  taxRate: number;
  amount: number;
};

export type PrescriptionRef = {
  doctorName: string;
  doctorRegNo: string;
  patientName: string;
  date: string;
  photoDataUrl: string; // optional scan of the Rx
};

export type Sale = {
  id: string;
  invoiceNo: string;
  date: string;
  customerId: string | null;
  lines: SaleLine[];
  discount: number;
  taxTotal: number;
  total: number;
  paid: number;
  paymentMode: string;
  /** Required when any line is a Schedule H/H1 medicine. */
  prescription: PrescriptionRef | null;
  createdAt: string;
};

export type SaleReturnLine = {
  saleLineId: string;
  batchId: string;
  quantity: number;
  amount: number;
};

export type SaleReturn = {
  id: string;
  saleId: string;
  /** Denormalised so the returns list reads without joining every sale. */
  saleInvoiceNo: string;
  date: string;
  lines: SaleReturnLine[];
  reason: string;
  total: number;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Stock movement log
// ---------------------------------------------------------------------------

/**
 * Why a batch's quantity changed.
 *
 * The spec's rule is that only sales, returns, purchases and explicit
 * adjustments move stock, and every one of them writes a row. This is that row:
 * batch-level, because a movement that does not name a batch cannot be traced
 * back to the strip it came off.
 */
export type StockMovementType =
  | "purchase"
  | "sale"
  | "sale-return"
  | "purchase-return"
  | "adjust";

export const STOCK_MOVEMENT_LABELS: Record<StockMovementType, string> = {
  purchase: "Purchase",
  sale: "Sale",
  "sale-return": "Sale return",
  "purchase-return": "Purchase return",
  adjust: "Adjustment",
};

export type StockLog = {
  id: string;
  batchId: string;
  medicineId: string;
  /** Denormalised for a readable ledger after a medicine is renamed or deleted. */
  medicineName: string;
  batchNo: string;
  expiry: string;
  type: StockMovementType;
  /** Positive = stock in, negative = stock out. */
  change: number;
  quantityAfter: number;
  /** Id of the sale / purchase / return that caused it; "" for an adjustment. */
  referenceId: string;
  note: string;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Refill reminders
// ---------------------------------------------------------------------------

export type RefillReminder = {
  id: string;
  customerId: string;
  medicineId: string;
  /** Days of supply dispensed; the reminder fires this many days after the sale. */
  daysSupply: number;
  lastSaleId: string;
  nextDueOn: string;
  active: boolean;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Cart
// ---------------------------------------------------------------------------

/**
 * A line in the counter's cart.
 *
 * Carries the batch, not just the medicine — which is why the POS `CartLine`
 * could not be reused as-is. Everything needed to print the line is copied onto
 * it at add-time, so a bill already rung up does not change under the operator
 * if a batch is edited mid-sale.
 */
export type PharmacyCartLine = {
  id: string;
  medicineId: string;
  batchId: string;
  name: string;
  batchNo: string;
  expiry: string;
  quantity: number;
  mrp: number;
  rate: number;
  discountPct: number;
  taxRate: number;
  schedule: ScheduleClass;
  packSize: number;
  /** Optional days of supply, which creates a refill reminder on save. */
  daysSupply: number;
};

/** A parked bill that can be recalled later on the Sell screen. */
export type HeldPharmacyCart = {
  id: string;
  label: string;
  lines: PharmacyCartLine[];
  discount: number;
  customerId: string | null;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export type ReceiptPaperSize = "58mm" | "80mm" | "a4";

export type PharmacySettings = {
  id: "main";
  invoicePrefix: string;
  nextInvoiceNumber: number;
  returnNotePrefix: string;
  nextReturnNoteNumber: number;
  /** Expiry dashboard buckets, in days. */
  expiryBuckets: number[];
  /** Refuse to bill a batch expiring within this many days. 0 = warn only. */
  blockExpiryWithinDays: number;
  /** Force prescription capture for these classes. */
  prescriptionRequiredFor: ScheduleClass[];
  taxInclusive: boolean; // pharma MRP is inclusive; default true
  paymentModes: string[];
  drugLicenceNo: string; // prints on the invoice
  gstin: string;
  receiptPaperSize: ReceiptPaperSize;
  messageTemplates: Record<"refillDue" | "duesReminder", string>;
  lastBackupAt: string | null;
  sheetSyncUrl: string;
  lastSyncAt: string | null;
  pinHash?: string;
  pinSalt?: string;
  autoLockMinutes?: number;
};

export const DEFAULT_MESSAGE_TEMPLATES: PharmacySettings["messageTemplates"] = {
  refillDue:
    "Hello {customer}, your {medicine} is due for a refill around {date}. We have it in stock at {shop}. — {shop}",
  duesReminder:
    "Hello {customer}, a balance of {amount} is pending against bill {invoice} at {shop}. Kindly settle at your convenience. Thank you.",
};

export const DEFAULT_PHARMACY_SETTINGS: PharmacySettings = {
  id: "main",
  invoicePrefix: "PH-",
  nextInvoiceNumber: 1,
  returnNotePrefix: "PR-",
  nextReturnNoteNumber: 1,
  expiryBuckets: [30, 60, 90],
  // Warn, do not block. A chemist selling a strip that expires in three weeks
  // to someone taking a five-day course is doing nothing wrong, and an app that
  // refuses the sale by default would be turned off within the week.
  blockExpiryWithinDays: 0,
  prescriptionRequiredFor: ["H", "H1", "X"],
  taxInclusive: true,
  paymentModes: ["Cash", "UPI", "Card", "Credit"],
  drugLicenceNo: "",
  gstin: "",
  receiptPaperSize: "80mm",
  messageTemplates: DEFAULT_MESSAGE_TEMPLATES,
  lastBackupAt: null,
  sheetSyncUrl: "",
  lastSyncAt: null,
  pinHash: "",
  pinSalt: "",
  autoLockMinutes: 0,
};

/** The payment mode that means "not paid yet" — it drives the dues reports. */
export const CREDIT_MODE = "Credit";

export const TAX_RATES = [0, 5, 12, 18] as const;

// ---------------------------------------------------------------------------
// Small shared helpers
// ---------------------------------------------------------------------------

export function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function round2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Local "YYYY-MM-DD". Never toISOString() — that silently shifts the day in IST. */
export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayKey(): string {
  return toDateKey(new Date());
}

/** Parse "YYYY-MM-DD" as local midnight. */
export function fromDateKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

export function addDays(key: string, days: number): string {
  const date = fromDateKey(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

/** Whole days from `a` to `b`, negative when b is earlier. */
export function daysBetween(a: string, b: string): number {
  const ms = fromDateKey(b).getTime() - fromDateKey(a).getTime();
  return Math.round(ms / 86_400_000);
}

export function formatDate(key: string): string {
  if (!key) return "";
  return fromDateKey(key).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateShort(key: string): string {
  if (!key) return "";
  return fromDateKey(key).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

// ---------------------------------------------------------------------------
// Expiry — month precision, and the one rule everything else depends on
// ---------------------------------------------------------------------------

/**
 * The last day a "YYYY-MM" batch is sellable.
 *
 * A batch marked 2026-08 is good through 31 August 2026 and expired from
 * 1 September. Getting this off by a month either throws away saleable stock or
 * sells expired medicine, so it lives in one function that everything calls.
 */
export function expiryLastDay(expiry: string): string {
  const [year, month] = (expiry || "").split("-").map(Number);
  if (!year || !month) return "";
  // Day 0 of the next month is the last day of this one.
  return toDateKey(new Date(year, month, 0));
}

/** Days from `today` until the batch stops being sellable. Negative = expired. */
export function daysToExpiry(expiry: string, today: string = todayKey()): number {
  const last = expiryLastDay(expiry);
  if (!last) return Number.POSITIVE_INFINITY;
  return daysBetween(today, last);
}

export function isExpired(expiry: string, today: string = todayKey()): boolean {
  const last = expiryLastDay(expiry);
  return Boolean(last) && last < today;
}

/** "Aug 2026" from "2026-08". */
export function formatExpiry(expiry: string): string {
  const [year, month] = (expiry || "").split("-").map(Number);
  if (!year || !month) return "—";
  return new Date(year, month - 1, 1).toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
  });
}

/** "YYYY-MM" for the current month, for defaulting an expiry input. */
export function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Numbering and messaging
// ---------------------------------------------------------------------------

export function invoiceNumberFrom(prefix: string, next: number): string {
  return `${prefix}${String(next).padStart(5, "0")}`;
}

export function returnNoteNumberFrom(prefix: string, next: number): string {
  return `${prefix}${String(next).padStart(4, "0")}`;
}

/** Digits only, for wa.me. Indian numbers get the country code they omit. */
export function whatsAppNumber(phone: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

/** Does this medicine need a prescription under the current settings? */
export function needsPrescription(
  schedule: ScheduleClass,
  requiredFor: ScheduleClass[]
): boolean {
  return Boolean(schedule) && requiredFor.includes(schedule);
}
