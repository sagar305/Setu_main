// Data model for the Free Rental & Hire Book (/products/free-rental-software).
//
// Every other app here models a transaction. This one models a *constraint*:
// the same 200 chairs cannot be promised to two weddings on the same Saturday.
// So the axis everything hangs off is the booking window — `fromDate`/`toDate`
// — and the only question the app really answers is how much of an item is
// still free across a range of days. See availability.ts; it is the product.

export type ItemCategory = {
  id: string;
  name: string; // "Seating", "Lighting", "Cameras", "Scaffolding"
  sortOrder: number;
  createdAt: string;
};

export type RateBasis = "per-day" | "per-event" | "per-hour";

export type RentalItem = {
  id: string;
  name: string; // "Plastic chair – white", "Canon R6 body"
  categoryId: string;
  /** Bulk items are fungible and counted; serialised items are individually tracked. */
  tracking: "bulk" | "serialised";
  /** Total units owned. For serialised items this equals the unit count. */
  totalQuantity: number;
  rateBasis: RateBasis;
  rate: number;
  /**
   * Fewest units that may go out on one booking.
   *
   * Nobody sends a lorry across town with one chair on it. The floor is a
   * property of the item rather than the booking because it is about what is
   * worth loading: one marquee is a job, one plate is not.
   */
  minOrderQuantity: number;
  /**
   * Advance this item needs before its stock is committed, as a share of the
   * line. Null falls back to the book-wide figure in Settings — most items do,
   * and the override exists for the marquee that nobody holds without money.
   */
  minAdvancePercent: number | null;
  /** Deposit taken per unit, refunded at return. */
  depositPerUnit: number;
  /** Charged per unit per day when returned late. */
  lateFeePerUnitPerDay: number;
  /** What a lost unit costs the customer. */
  replacementValue: number;
  purchaseCost: number;
  purchasedOn: string;
  imageDataUrl: string;
  active: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

/** Individually tracked units, for serialised items only. */
export type ItemUnit = {
  id: string;
  itemId: string;
  serialNo: string;
  condition: "good" | "needs-repair" | "retired";
  /** Set when out on a booking. */
  currentBookingId: string | null;
  createdAt: string;
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  altPhone: string;
  address: string;
  idProofKind: string;
  idProofNumber: string;
  idProofPhoto: string;
  /** Repeat event customers: caterers, decorators, production houses. */
  isTrade: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type BookingStatus =
  | "enquiry"
  | "confirmed"
  | "dispatched"
  | "returned"
  | "closed"
  | "cancelled";

export type BookingLine = {
  id: string;
  itemId: string;
  name: string;
  /** Requested count for bulk items; unit count for serialised. */
  quantity: number;
  /** Serialised items only — which physical units are allocated. */
  unitIds: string[];
  rateBasis: RateBasis;
  rate: number;
  /** Chargeable days/hours/events, computed from the booking window. */
  chargeableUnits: number;
  amount: number;
  depositPerUnit: number;
  /** Filled at return. */
  returnedQuantity: number;
  damagedQuantity: number;
  lostQuantity: number;
  damageCharge: number;
  lossCharge: number;
  returnNote: string;
};

/**
 * One money movement against a booking.
 *
 * The spec carries `advancePaid` and `paid` as running totals, and those stay —
 * every screen reads them. But a total cannot answer "what did I collect
 * today", which the Today screen is asked for, and it cannot tell an advance
 * apart from a deposit when a refund has to be worked out. So the movements are
 * kept as well, and the totals are derived from them on every write.
 */
export type BookingPayment = {
  id: string;
  /** "YYYY-MM-DD". */
  date: string;
  amount: number;
  mode: string;
  kind: "advance" | "deposit" | "settlement" | "refund";
  note: string;
  createdAt: string;
};

export type Booking = {
  id: string;
  bookingNo: string; // "BK-0231"
  customerId: string;
  status: BookingStatus;
  /** The window the stock is committed for — this is what the calendar reserves. */
  fromDate: string;
  toDate: string;
  fromTime: string;
  toTime: string;
  /** Event context, for the delivery team. */
  eventName: string;
  venue: string;
  venueContact: string;
  lines: BookingLine[];
  transportCharge: number;
  labourCharge: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  /** Rent + charges + tax, before deposits. */
  total: number;
  depositTotal: number;
  advancePaid: number;
  /**
   * The owner knowingly booked past what is free — sub-hire, or stock coming
   * back early. Recorded so the conflict list can stop flagging a decision that
   * has already been made, and so it is still visible that it was made.
   */
  overCommitted: boolean;
  /** Filled at return/settlement. */
  actualReturnedOn: string | null;
  lateDays: number;
  lateFee: number;
  damageTotal: number;
  lossTotal: number;
  depositRefunded: number;
  finalPayable: number;
  paid: number;
  paymentMode: string;
  payments: BookingPayment[];
  dispatchedOn: string | null;
  dispatchSignature: string;
  returnSignature: string;
  /** Set when a tax invoice is raised at settlement. */
  invoiceNo: string | null;
  invoicedOn: string | null;
  note: string;
  createdAt: string;
  updatedAt: string;
};

export type MaintenanceLog = {
  id: string;
  itemId: string;
  unitId: string | null;
  /**
   * How many units this covers. Serialised repairs are always one unit; a bulk
   * item has no units to name, and "20 chairs at the welder" is the whole
   * reason the availability table has a maintenance column at all.
   */
  quantity: number;
  date: string;
  kind: "repair" | "service" | "cleaning" | "retired";
  description: string;
  cost: number;
  /** Days the item was unavailable — excluded from availability. */
  outOfServiceFrom: string | null;
  outOfServiceTo: string | null;
  createdAt: string;
};

export type RentalTemplateKey =
  | "quotation"
  | "confirmed"
  | "dispatchReminder"
  | "returnDue"
  | "overdue"
  | "settlement";

export type RentalSettings = {
  id: "main";
  bookingPrefix: string;
  nextBookingNumber: number;
  invoicePrefix: string;
  nextInvoiceNumber: number;
  /** Buffer days after a booking before the stock is available again — cleaning, transport. */
  bufferDays: number;
  /** Whether the return day is chargeable. */
  countReturnDay: boolean;
  defaultLateFeeBasis: "item-rate" | "fixed";
  /** Flat late fee per day for the whole booking, when the basis is "fixed". */
  fixedLateFeePerDay: number;
  /**
   * Advance required before a booking may be confirmed, as a percentage of its
   * value. Items can ask for more of their own line; this is the floor for
   * everything else, and for the transport, labour and tax on top.
   *
   * Zero — the default — means no advance is required, which is the only
   * honest starting point: how much money to take before holding stock is a
   * commercial decision, not one an app should make on an owner's behalf.
   */
  minAdvancePercent: number;
  /** Days a quotation stays valid — the figure the quotation message quotes. */
  quotationValidDays: number;
  taxEnabled: boolean;
  defaultTaxRate: number;
  paymentModes: string[];
  damagePresets: string[]; // "Torn", "Stained", "Broken leg", "Missing part"
  /** Offered at return as a share of replacement value; the owner can still type a figure. */
  damagePercentOptions: number[];
  messageTemplates: Record<RentalTemplateKey, string>;
  receiptPaperSize: "58mm" | "80mm" | "a4";
  lastBackupAt: string | null;
  sheetSyncUrl: string;
  sheetAutoSync?: boolean;
  lastSyncAt?: string | null;
  pinHash?: string;
  pinSalt?: string;
  autoLockMinutes?: number;
};

// ---------------------------------------------------------------------------
// Labels and defaults
// ---------------------------------------------------------------------------

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  enquiry: "Enquiry",
  confirmed: "Confirmed",
  dispatched: "Dispatched",
  returned: "Returned",
  closed: "Closed",
  cancelled: "Cancelled",
};

export const RATE_BASIS_LABELS: Record<RateBasis, string> = {
  "per-day": "Per day",
  "per-event": "Per event",
  "per-hour": "Per hour",
};

export const RATE_BASIS_SUFFIX: Record<RateBasis, string> = {
  "per-day": "/day",
  "per-event": "/event",
  "per-hour": "/hour",
};

export const MAINTENANCE_KIND_LABELS: Record<MaintenanceLog["kind"], string> = {
  repair: "Repair",
  service: "Service",
  cleaning: "Cleaning",
  retired: "Retired",
};

export const UNIT_CONDITION_LABELS: Record<ItemUnit["condition"], string> = {
  good: "Good",
  "needs-repair": "Needs repair",
  retired: "Retired",
};

/**
 * Statuses that hold stock.
 *
 * An enquiry is a quote and commits nothing — quoting for a date must never
 * make that date look full. A returned booking has its stock physically back,
 * so it releases even though the money is not settled yet.
 */
export const COMMITTING_STATUSES: BookingStatus[] = ["confirmed", "dispatched"];

/** Bookings that are still live work: they appear on Today and in the pipeline. */
export const OPEN_STATUSES: BookingStatus[] = [
  "enquiry",
  "confirmed",
  "dispatched",
  "returned",
];

export const DEFAULT_MESSAGE_TEMPLATES: Record<RentalTemplateKey, string> = {
  quotation:
    "{{businessName}}: quote for {{eventName}} on {{fromDate}} — ₹{{amount}}. Valid {{validDays}} days. Booking no {{bookingNo}}. {{link}}",
  confirmed:
    "{{businessName}}: booking {{bookingNo}} confirmed for {{fromDate}} to {{toDate}}, {{venue}}. Advance ₹{{advance}} received. {{link}}",
  dispatchReminder:
    "{{businessName}}: your order for {{eventName}} dispatches on {{fromDate}}. Venue contact: {{venueContact}}. {{link}}",
  returnDue:
    "{{businessName}}: items for booking {{bookingNo}} are due back on {{toDate}}. Please arrange return.",
  overdue:
    "{{businessName}}: booking {{bookingNo}} is {{lateDays}} days overdue. Late fee ₹{{lateFee}} is accruing.",
  settlement:
    "{{businessName}}: booking {{bookingNo}} settled. Deposit refunded ₹{{refund}}. Thank you. {{link}}",
};

export const MESSAGE_PLACEHOLDERS: { token: string; meaning: string }[] = [
  { token: "{{businessName}}", meaning: "Your business name" },
  { token: "{{customerName}}", meaning: "Customer's name" },
  { token: "{{bookingNo}}", meaning: "Booking number, e.g. BK-0231" },
  { token: "{{eventName}}", meaning: "Event name" },
  { token: "{{venue}}", meaning: "Venue" },
  { token: "{{venueContact}}", meaning: "Venue contact number" },
  { token: "{{fromDate}}", meaning: "Start date" },
  { token: "{{toDate}}", meaning: "Return date" },
  { token: "{{amount}}", meaning: "Booking total" },
  { token: "{{advance}}", meaning: "Advance received" },
  { token: "{{balance}}", meaning: "Balance still due" },
  { token: "{{deposit}}", meaning: "Deposit held" },
  { token: "{{lateDays}}", meaning: "Days overdue" },
  { token: "{{lateFee}}", meaning: "Late fee accrued" },
  { token: "{{refund}}", meaning: "Deposit refunded at settlement" },
  { token: "{{validDays}}", meaning: "Days a quotation stays valid" },
  { token: "{{link}}", meaning: "Shareable link to the quote / receipt" },
];

export const DEFAULT_PAYMENT_MODES = ["Cash", "UPI", "Bank transfer", "Card", "Cheque"];

export const DEFAULT_DAMAGE_PRESETS = [
  "Torn",
  "Stained",
  "Broken leg",
  "Missing part",
  "Dented",
  "Water damage",
];

export const DEFAULT_SETTINGS: RentalSettings = {
  id: "main",
  bookingPrefix: "BK-",
  nextBookingNumber: 1,
  invoicePrefix: "INV-",
  nextInvoiceNumber: 1,
  bufferDays: 0,
  countReturnDay: true,
  defaultLateFeeBasis: "item-rate",
  fixedLateFeePerDay: 0,
  minAdvancePercent: 0,
  quotationValidDays: 7,
  taxEnabled: false,
  defaultTaxRate: 18,
  paymentModes: DEFAULT_PAYMENT_MODES,
  damagePresets: DEFAULT_DAMAGE_PRESETS,
  damagePercentOptions: [25, 50, 75, 100],
  messageTemplates: DEFAULT_MESSAGE_TEMPLATES,
  receiptPaperSize: "a4",
  lastBackupAt: null,
  sheetSyncUrl: "",
  sheetAutoSync: false,
  lastSyncAt: null,
};

/**
 * How far ahead the availability calendar strip looks.
 *
 * Sixty days covers the wedding and exhibition seasons people actually book
 * against, and is short enough that a strip of day cells still fits a phone
 * when scrolled sideways.
 */
export const CALENDAR_DAYS = 60;

/** Chip colours for categories — the same eight the rest of the site uses. */
export const CATEGORY_COLOURS = [
  "#26306B", // indigo
  "#F2A03D", // saffron
  "#0F766E", // teal
  "#B91C1C", // red
  "#6D28D9", // violet
  "#0369A1", // blue
  "#4D7C0F", // olive
  "#9A3412", // rust
] as const;

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

/** Every "YYYY-MM-DD" from `from` to `to`, inclusive. */
export function dateRange(from: string, to: string): string[] {
  if (!from || !to || to < from) return from ? [from] : [];
  const days: string[] = [];
  for (let key = from; key <= to; key = addDays(key, 1)) days.push(key);
  return days;
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

/** "12 Feb – 15 Feb 2026", collapsing the parts both ends share. */
export function formatDateWindow(from: string, to: string): string {
  if (!from) return "";
  if (!to || to === from) return formatDate(from);
  return `${formatDateShort(from)} – ${formatDate(to)}`;
}

/** Digits only, for wa.me. Indian numbers get the country code they omit. */
export function whatsAppNumber(phone: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export function bookingNumberFrom(prefix: string, next: number): string {
  return `${prefix}${String(next).padStart(4, "0")}`;
}

export function invoiceNumberFrom(prefix: string, next: number): string {
  return `${prefix}${String(next).padStart(4, "0")}`;
}
