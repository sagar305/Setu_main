// Data model for the Free Repair Job Card (/products/free-repair-shop-software).
//
// The other apps here model money moving. This one models *custody*: somebody
// else's phone is sitting in a drawer behind the counter, and the two questions
// that matter are where it is and what condition it was in when it arrived.
// Everything else — parts, labour, the bill — hangs off that.
//
// So the load-bearing part of the model is `Job.conditionIn`, `intakePhotos`
// and `intakeSignatureDataUrl`, and the load-bearing rule is that none of the
// three can be edited after the job is saved. A record that can be revised
// after the argument starts is not evidence.

export type DeviceKind =
  | "mobile"
  | "laptop"
  | "desktop"
  | "tablet"
  | "tv"
  | "appliance"
  | "two-wheeler"
  | "watch"
  | "other";

export type JobStatus =
  | "received"
  | "diagnosing"
  | "estimate-sent"
  | "approved"
  | "in-repair"
  | "awaiting-parts"
  | "ready"
  | "delivered"
  | "returned-unrepaired"
  | "cancelled";

export type Customer = {
  id: string;
  name: string;
  phone: string;
  altPhone: string;
  address: string;
  /** Shops that serve businesses need this; blank for walk-ins. */
  companyName: string;
  gstin: string;
  createdAt: string;
  updatedAt: string;
};

/** The condition of the device as received. Evidence, not description. */
export type ConditionItem = {
  id: string;
  label: string; // "Screen cracked", "Dents on body", "Water damage"
  present: boolean;
  note: string;
};

export type Job = {
  id: string;
  jobNo: string; // "JC-0412"
  customerId: string;
  deviceKind: DeviceKind;
  brand: string;
  model: string;
  /** IMEI, serial number, chassis number — whatever identifies this unit. */
  serialNo: string;
  colour: string;
  /** Ticked from a per-device-kind checklist, plus free text. */
  reportedProblems: string[];
  problemNote: string;
  conditionIn: ConditionItem[];
  /** Photos taken at intake. The evidence. */
  intakePhotos: string[]; // data URLs
  accessories: string[]; // "Charger", "Cover", "SIM", "Memory card"
  /**
   * Device unlock code. Stored locally like everything else, but the UI must
   * warn the user and allow leaving it blank.
   */
  unlockCode: string;
  estimateAmount: number | null;
  estimateApprovedOn: string | null;
  promisedDate: string | null;
  status: JobStatus;
  technicianId: string | null;
  priority: "normal" | "urgent";
  /** Signature captured on a canvas at intake. */
  intakeSignatureDataUrl: string;
  /** Visible to the customer on printouts and messages. */
  customerNotes: string;
  /** Never printed, never sent. */
  internalNotes: string;
  partsUsed: PartUsage[];
  labourCharge: number;
  diagnosis: string;
  workDone: string;
  /** Warranty on this repair, in days, from delivery. 0 = none. */
  warrantyDays: number;
  deliveredOn: string | null;
  deliverySignatureDataUrl: string;
  /** Set when this job is a warranty claim against an earlier one. */
  warrantyClaimOfJobId: string | null;
  billId: string | null;
  statusHistory: StatusChange[];
  createdAt: string;
  updatedAt: string;
};

export type StatusChange = {
  id: string;
  from: JobStatus | null;
  to: JobStatus;
  at: string;
  note: string;
  notifiedAt: string | null;
};

export type PartUsage = {
  id: string;
  partId: string | null; // null = ad-hoc part not in stock
  name: string;
  quantity: number;
  costPrice: number; // what the shop paid — drives real margin
  sellingPrice: number; // what the customer is charged
  /** Warranty the part supplier gives, in days. */
  supplierWarrantyDays: number;
};

export type Part = {
  id: string;
  name: string;
  sku: string;
  compatibleWith: string; // "iPhone 11, iPhone 11 Pro"
  costPrice: number;
  sellingPrice: number;
  stock: number;
  lowStockAt: number;
  supplierName: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Technician = {
  id: string;
  name: string;
  phone: string;
  speciality: string;
  active: boolean;
  createdAt: string;
};

export type Bill = {
  id: string;
  invoiceNo: string;
  jobId: string;
  customerId: string;
  date: string;
  partLines: { label: string; quantity: number; unitPrice: number; amount: number }[];
  labourCharge: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  paid: number;
  paymentMode: string;
  createdAt: string;
};

export type RepairSettings = {
  id: "main";
  jobPrefix: string;
  nextJobNumber: number;
  invoicePrefix: string;
  nextInvoiceNumber: number;
  deviceKinds: DeviceKind[]; // which to show; a phone shop hides the rest
  /** Per device kind: the intake checklists. */
  problemPresets: Record<string, string[]>;
  conditionPresets: Record<string, string[]>;
  accessoryPresets: Record<string, string[]>;
  defaultWarrantyDays: number; // 90
  /** Job goes amber after this many days, red after the second. */
  agingAmberDays: number; // 3
  agingRedDays: number; // 7
  /** Nag interval for devices ready but not collected. */
  uncollectedNagDays: number; // 3
  taxEnabled: boolean;
  defaultTaxRate: number;
  paymentModes: string[];
  captureUnlockCode: boolean; // default false
  messageTemplates: Record<RepairTemplateKey, string>;
  receiptPaperSize: "58mm" | "80mm" | "a4";
  lastBackupAt: string | null;
  sheetSyncUrl: string;
  pinHash?: string;
  pinSalt?: string;
  autoLockMinutes?: number;
};

export type RepairTemplateKey =
  | "received"
  | "estimateRequest"
  | "inRepair"
  | "awaitingParts"
  | "ready"
  | "uncollected"
  | "delivered";

export type ReceiptPaperSize = RepairSettings["receiptPaperSize"];

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

export const DEVICE_KIND_LABELS: Record<DeviceKind, string> = {
  mobile: "Mobile",
  laptop: "Laptop",
  desktop: "Desktop",
  tablet: "Tablet",
  tv: "TV",
  appliance: "Appliance",
  "two-wheeler": "Two-wheeler",
  watch: "Watch",
  other: "Other",
};

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  received: "Received",
  diagnosing: "Diagnosing",
  "estimate-sent": "Estimate sent",
  approved: "Approved",
  "in-repair": "In repair",
  "awaiting-parts": "Awaiting parts",
  ready: "Ready",
  delivered: "Delivered",
  "returned-unrepaired": "Returned unrepaired",
  cancelled: "Cancelled",
};

/**
 * The board's columns, in order.
 *
 * Eight of the ten statuses. `returned-unrepaired` and `cancelled` are endings
 * rather than stages — a device that went back untouched is not waiting for
 * anybody — so they are reachable from the board's filter instead of taking a
 * ninth and tenth column that would be empty in most shops on most days.
 *
 * OPEN QUESTION (spec §3.1 lists 8 columns for 10 statuses, without saying
 * where the other two live): confirm the filter is the right home for them.
 */
export const BOARD_STATUSES: JobStatus[] = [
  "received",
  "diagnosing",
  "estimate-sent",
  "approved",
  "in-repair",
  "awaiting-parts",
  "ready",
  "delivered",
];

/** Statuses that mean the device has left the shop, one way or another. */
export const CLOSED_STATUSES: JobStatus[] = [
  "delivered",
  "returned-unrepaired",
  "cancelled",
];

/** The device is physically in the shop and somebody is answerable for it. */
export const IN_SHOP_STATUSES: JobStatus[] = [
  "received",
  "diagnosing",
  "estimate-sent",
  "approved",
  "in-repair",
  "awaiting-parts",
  "ready",
];

/** Which template a move into each status offers to send. */
export const STATUS_TEMPLATE: Partial<Record<JobStatus, RepairTemplateKey>> = {
  received: "received",
  "estimate-sent": "estimateRequest",
  "in-repair": "inRepair",
  "awaiting-parts": "awaitingParts",
  ready: "ready",
  delivered: "delivered",
};

export const PRIORITY_LABELS: Record<Job["priority"], string> = {
  normal: "Normal",
  urgent: "Urgent",
};

// ---------------------------------------------------------------------------
// Intake presets
// ---------------------------------------------------------------------------
//
// Presets are what make intake take ninety seconds instead of five minutes, and
// they are per-trade: a list that tries to cover a phone and a washing machine
// at once covers neither. Mobile and laptop ship filled in — the two largest
// trades by search volume — and every other kind starts empty for the shop to
// fill in Settings, which is honest about the fact that nobody here has stood
// behind a two-wheeler counter.

export const MOBILE_PROBLEMS = [
  "Screen broken / not displaying",
  "Touch not working",
  "Battery draining fast",
  "Not charging",
  "Charging port loose",
  "No network / SIM not detected",
  "Speaker / earpiece not working",
  "Mic not working",
  "Camera not working",
  "Water damaged",
  "Dead — not switching on",
  "Hanging / restarting",
  "Software / update issue",
  "Buttons not working",
];

export const LAPTOP_PROBLEMS = [
  "Not switching on",
  "No display",
  "Screen cracked",
  "Keyboard keys not working",
  "Touchpad not working",
  "Battery not charging",
  "Overheating / fan noise",
  "Slow / hanging",
  "Hard disk failure",
  "Operating system issue",
  "Virus / malware",
  "Wi-Fi not working",
  "Ports not working",
  "Hinge broken",
];

export const MOBILE_CONDITIONS = [
  "Screen cracked",
  "Body dented / scratched",
  "Back panel damaged",
  "Camera glass broken",
  "Bent frame",
  "Water damage marks",
  "Already opened / repaired before",
  "Buttons loose",
];

export const LAPTOP_CONDITIONS = [
  "Screen scratched / cracked",
  "Body dented / scratched",
  "Hinge loose",
  "Keys missing",
  "Screws missing",
  "Already opened / repaired before",
  "Liquid marks inside",
  "Battery swollen",
];

export const MOBILE_ACCESSORIES = ["Charger", "Cable", "Cover", "SIM", "Memory card", "Earphones", "Box"];

export const LAPTOP_ACCESSORIES = ["Charger / adapter", "Bag", "Mouse", "Battery", "Hard disk", "Box"];

export const DEFAULT_PROBLEM_PRESETS: Record<string, string[]> = {
  mobile: MOBILE_PROBLEMS,
  laptop: LAPTOP_PROBLEMS,
};

export const DEFAULT_CONDITION_PRESETS: Record<string, string[]> = {
  mobile: MOBILE_CONDITIONS,
  laptop: LAPTOP_CONDITIONS,
};

export const DEFAULT_ACCESSORY_PRESETS: Record<string, string[]> = {
  mobile: MOBILE_ACCESSORIES,
  laptop: LAPTOP_ACCESSORIES,
};

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export const DEFAULT_MESSAGE_TEMPLATES: Record<RepairTemplateKey, string> = {
  received:
    "{{shopName}}: received your {{device}} — job {{jobNo}}. We will update you. Est. ready {{promisedDate}}.",
  estimateRequest:
    "{{shopName}}: your {{device}} ({{jobNo}}) needs {{workSummary}}. Estimate ₹{{amount}}. Reply YES to approve.",
  inRepair: "{{shopName}}: repair started on your {{device}} ({{jobNo}}).",
  awaitingParts:
    "{{shopName}}: we are waiting for a part for your {{device}} ({{jobNo}}). New estimated date: {{promisedDate}}.",
  ready:
    "{{shopName}}: your {{device}} is ready for pickup. Job {{jobNo}}, amount ₹{{amount}}. Pay by UPI: {{upiId}}",
  uncollected:
    "{{shopName}}: your {{device}} ({{jobNo}}) has been ready since {{readyDate}}. Please collect it.",
  delivered:
    "{{shopName}}: thank you. Your {{device}} is covered by warranty until {{warrantyEnd}}. Invoice {{invoiceNo}}.",
};

export const MESSAGE_PLACEHOLDERS: { token: string; meaning: string }[] = [
  { token: "{{shopName}}", meaning: "Your shop's name" },
  { token: "{{customerName}}", meaning: "Customer's name" },
  { token: "{{device}}", meaning: "Brand and model, e.g. Redmi Note 12" },
  { token: "{{jobNo}}", meaning: "Job number, e.g. JC-0412" },
  { token: "{{promisedDate}}", meaning: "Date promised to the customer" },
  { token: "{{amount}}", meaning: "Estimate, or the bill total once billed" },
  { token: "{{workSummary}}", meaning: "Diagnosis, or the reported problems" },
  { token: "{{readyDate}}", meaning: "Date the device became ready" },
  { token: "{{warrantyEnd}}", meaning: "Date the repair warranty expires" },
  { token: "{{invoiceNo}}", meaning: "Invoice number" },
  { token: "{{upiId}}", meaning: "Your UPI ID, from the business profile" },
];

export const DEFAULT_PAYMENT_MODES = ["Cash", "UPI", "Card", "Bank transfer"];

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_SETTINGS: RepairSettings = {
  id: "main",
  jobPrefix: "JC-",
  nextJobNumber: 1,
  invoicePrefix: "INV-",
  nextInvoiceNumber: 1,
  deviceKinds: ["mobile", "laptop"],
  problemPresets: DEFAULT_PROBLEM_PRESETS,
  conditionPresets: DEFAULT_CONDITION_PRESETS,
  accessoryPresets: DEFAULT_ACCESSORY_PRESETS,
  defaultWarrantyDays: 90,
  agingAmberDays: 3,
  agingRedDays: 7,
  uncollectedNagDays: 3,
  taxEnabled: false,
  defaultTaxRate: 18,
  paymentModes: DEFAULT_PAYMENT_MODES,
  captureUnlockCode: false,
  messageTemplates: DEFAULT_MESSAGE_TEMPLATES,
  receiptPaperSize: "58mm",
  lastBackupAt: null,
  sheetSyncUrl: "",
};

/**
 * How many photos one job may carry, and how big each is kept.
 *
 * Photos are the bulk of this database — a shop doing fifteen jobs a day fills
 * more space with intake photos in a month than every other Setu tool holds in
 * a year. Four at 1024px and quality 0.7 lands each around 100–150 KB, which is
 * enough to show a hairline crack and small enough that a year of jobs still
 * fits and still backs up.
 */
export const MAX_INTAKE_PHOTOS = 4;
export const PHOTO_MAX_EDGE = 1024;
export const PHOTO_QUALITY = 0.7;

/** Window in which a second visit on the same serial counts as a repeat failure. */
export const REPEAT_FAILURE_DAYS = 90;

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

/** The "YYYY-MM-DD" an ISO timestamp falls on, in the device's own zone. */
export function dateKeyOf(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : toDateKey(date);
}

export function addDays(key: string, days: number): string {
  const date = fromDateKey(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

/** Whole days from `a` to `b`, negative when b is earlier. */
export function daysBetween(a: string, b: string): number {
  if (!a || !b) return 0;
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

export function formatDateTime(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Digits only, for wa.me. Indian numbers get the country code they omit. */
export function whatsAppNumber(phone: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

/** "JC-0412". Four digits to match the spec's own example; wider once past 9999. */
export function jobNumberFrom(prefix: string, next: number): string {
  return `${prefix}${String(next).padStart(4, "0")}`;
}

export function invoiceNumberFrom(prefix: string, next: number): string {
  return `${prefix}${String(next).padStart(4, "0")}`;
}

/** "Samsung Galaxy M31", or the device kind when the shop skipped both. */
export function deviceLabel(job: Pick<Job, "brand" | "model" | "deviceKind">): string {
  const named = [job.brand, job.model].filter(Boolean).join(" ").trim();
  return named || DEVICE_KIND_LABELS[job.deviceKind];
}

/** The presets for a kind, falling back to an empty list rather than to mobile's. */
export function presetsFor(
  presets: Record<string, string[]>,
  kind: DeviceKind
): string[] {
  return presets[kind] ?? [];
}
