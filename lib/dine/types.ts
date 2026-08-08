// Data model for Free Dine (/products/free-restaurant-pos).
//
// Free Dine is a standalone product with its own IndexedDB database. It shares
// no stores with the Browser Based POS: a retail till and a dining-room till
// have different customers, different menus and different numbering, and
// merging them would mean one product's reset or restore could destroy the
// other's data.
//
// MONEY: every amount here is an integer in the currency's minor unit (paise).
// See lib/dine/money.ts — no field on this page is ever a rupee float.

export type OrderType = "dine-in" | "takeaway" | "delivery";

export type FoodType = "veg" | "nonveg" | "egg";

export type PaperSize = "80mm" | "58mm" | "a4";

export type DineBusiness = {
  id: "main";
  name: string;
  phone: string;
  address: string;
  email: string;
  /** ISO currency code, e.g. "INR". */
  currency: string;
  gstin: string;
  logoDataUrl: string;
  /** UPI ID printed on the bill for payment, e.g. "restaurant@okaxis". */
  upiId: string;
  /** IANA zone, e.g. "Asia/Kolkata". */
  timezone: string;
  createdAt: string;
};

export type DineCategory = {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: string;
};

export type DineArea = {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: string;
};

export type DineTable = {
  id: string;
  areaId: string;
  name: string;
  seats: number;
  sortOrder: number;
  createdAt: string;
};

export type DineMenuItem = {
  id: string;
  name: string;
  categoryId: string;
  /** Base price in paise. Variations override it. */
  price: number;
  /** null = inherit the default rate from settings. */
  taxRate: number | null;
  taxInclusive: boolean;
  foodType: FoodType;
  available: boolean;
  description: string;
  imageDataUrl: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

/** Half/Full, Small/Medium/Large — an item with variations must have one chosen. */
export type DineVariation = {
  id: string;
  menuItemId: string;
  name: string;
  /** Absolute price in paise, replacing the item's base price. */
  price: number;
  sortOrder: number;
};

export type DineModifierGroup = {
  id: string;
  menuItemId: string;
  name: string;
  /** 0 = optional group; >=1 = the guest must pick at least this many. */
  minSelect: number;
  /** 1 = single-select (radio); >1 = multi-select up to this many. */
  maxSelect: number;
  sortOrder: number;
};

export type DineModifier = {
  id: string;
  groupId: string;
  name: string;
  /** Added to the line's unit price, in paise. May be 0 ("no onion"). */
  priceDelta: number;
  sortOrder: number;
};

/** A modifier as captured on a ticket line — denormalised so history is stable. */
export type AppliedModifier = {
  id: string;
  name: string;
  priceDelta: number;
};

export type TicketStatus = "open" | "billed" | "settled" | "cancelled";

export type DineTicket = {
  id: string;
  ticketNumber: number;
  orderType: OrderType;
  /** Required for dine-in, null otherwise. */
  tableId: string | null;
  customerId: string | null;
  customerName: string;
  /** Delivery address, captured on the ticket so history survives edits. */
  deliveryAddress: string;
  status: TicketStatus;
  /** Rounds fired so far; the next round to fire is roundsFired + 1. */
  roundsFired: number;
  /** Ticket-level discount, applied before service charge and tax. */
  discountType: "flat" | "percent";
  discountValue: number;
  discountReason: string;
  serviceChargeOn: boolean;
  note: string;
  openedAt: string;
  settledAt: string | null;
  /** Set when this ticket was absorbed into another by a merge (FR-6.6). */
  mergedIntoId: string | null;
  createdAt: string;
};

export type DineTicketItem = {
  id: string;
  ticketId: string;
  menuItemId: string;
  variationId: string | null;
  /** Denormalised name at time of ordering ("Paneer Tikka"). */
  name: string;
  variationName: string;
  /** Unit price in paise, excluding modifiers. */
  price: number;
  quantity: number;
  modifiers: AppliedModifier[];
  note: string;
  taxRate: number;
  taxInclusive: boolean;
  /** Which round this item belongs to. Round N fires as KOT N. */
  roundNumber: number;
  /** Set when the round was sent to the kitchen; null = still editable. */
  firedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string;
  /** Which bill claimed this item, once the ticket is split or billed. */
  billId: string | null;
  createdAt: string;
};

/**
 * Where a fired round has got to in the kitchen.
 *
 * Only meaningful when someone is watching the kitchen screen. A restaurant
 * that just prints slips never touches it, and every KOT simply stays "new" —
 * which is why nothing in billing or reporting reads this field.
 */
export type KotStatus = "new" | "preparing" | "ready" | "served";

export type DineKot = {
  id: string;
  ticketId: string;
  kotNumber: number;
  /** Human-readable, e.g. "KOT-0042". */
  kotLabel: string;
  roundNumber: number;
  /** Business day this KOT belongs to (YYYY-MM-DD), for the daily reset. */
  businessDate: string;
  printedAt: string;
  reprintCount: number;
  /** Set when this KOT is a cancellation notice for pulled items. */
  isCancellation: boolean;
  /** Undefined on rounds fired before the kitchen screen existed. */
  status?: KotStatus;
  statusAt?: string;
  createdAt: string;
};

export const KOT_STATUS_LABELS: Record<KotStatus, string> = {
  new: "New",
  preparing: "Cooking",
  ready: "Ready",
  served: "Served",
};

export function kotStatusOf(kot: Pick<DineKot, "status">): KotStatus {
  return kot.status ?? "new";
}

/** One tax slab's worth of a bill, so the GST breakup prints per rate. */
export type DineTaxLine = {
  rate: number;
  /** Taxable value in paise (net of discount, tax removed for inclusive lines). */
  taxable: number;
  cgst: number;
  sgst: number;
};

export type SplitMode = "full" | "items" | "amount" | "equal";

export type BillStatus = "unpaid" | "paid" | "cancelled";

export type DineBill = {
  id: string;
  ticketId: string;
  billNumber: number;
  billLabel: string;
  /** 1-based position among the ticket's bills, and how many there are. */
  splitIndex: number;
  splitCount: number;
  splitMode: SplitMode;
  status: BillStatus;
  orderType: OrderType;
  tableName: string;
  areaName: string;
  customerId: string | null;
  customerName: string;
  /** Business day (YYYY-MM-DD) this bill counts towards. */
  businessDate: string;

  subtotal: number;
  discountType: "flat" | "percent";
  discountValue: number;
  discountAmount: number;
  serviceChargeRate: number;
  serviceCharge: number;
  serviceChargeTax: number;
  taxBreakup: DineTaxLine[];
  /** Tax added on top of prices (exclusive lines + service charge). */
  addedTax: number;
  /** Tax already contained in inclusive prices — reported, not added. */
  includedTax: number;
  total: number;

  createdAt: string;
  paidAt: string | null;
  cancelledAt: string | null;
  cancelReason: string;
};

/** A frozen copy of a ticket line at the moment it was billed. */
export type DineBillItem = {
  id: string;
  billId: string;
  ticketItemId: string | null;
  name: string;
  variationName: string;
  modifiers: AppliedModifier[];
  note: string;
  /** Unit price including modifier deltas, in paise. */
  unitPrice: number;
  quantity: number;
  taxRate: number;
  taxInclusive: boolean;
  lineTotal: number;
  sortOrder: number;
};

/** One tender against a bill. A bill may have several (₹500 cash + ₹300 UPI). */
export type DineBillPayment = {
  id: string;
  billId: string;
  methodId: string;
  methodName: string;
  amount: number;
  note: string;
  createdAt: string;
};

export type DinePaymentMethod = {
  id: string;
  name: string;
  isDefault: boolean;
  sortOrder: number;
  createdAt: string;
};

export type DineCustomer = {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  createdAt: string;
};

export type DineSettings = {
  id: "main";
  taxEnabled: boolean;
  /** Applied to menu items whose own taxRate is null. */
  defaultTaxRate: number;
  pricesIncludeTaxByDefault: boolean;

  serviceChargeRate: number;
  /** FR-6.3: service charge is voluntary in India, so this defaults to false. */
  serviceChargeDefaultOn: boolean;
  /** GST applies to the service charge as part of the taxable supply. */
  serviceChargeTaxRate: number;

  kotPrefix: string;
  nextKotNumber: number;
  /** Business date the KOT counter belongs to; a new date resets it to 1. */
  kotSeriesDate: string;
  kotPaperSize: PaperSize;

  billPrefix: string;
  nextBillNumber: number;
  billPaperSize: PaperSize;

  nextTicketNumber: number;
  defaultOrderType: OrderType;

  receiptFooter: string;
  showBusinessInfoOnBill: boolean;

  /**
   * Hour (0-23, local) at which the business day rolls over. A restaurant that
   * closes at 2am wants 1am orders counted against the previous day, so its
   * day-end report and KOT numbering match the shift the staff actually worked.
   */
  dayStartHour: number;

  lastBackupAt: string | null;
  /** Google Apps Script web-app URL for Sheet sync; "" = not connected. */
  sheetSyncUrl: string;

  /**
   * Publish diners into the shared Business Workspace so the Customer Ledger
   * and the other toolkit tools see the same people.
   *
   * One-way on purpose. Free Dine keeps its own dine_customers as the record
   * it relies on, and copies each one across; that way the Ledger gets a
   * complete contact list, while a reset or restore in another tool can never
   * take the restaurant's regulars with it.
   */
  shareCustomersWithLedger: boolean;

  pinHash: string;
  pinSalt: string;
  /** Lock after this many idle minutes; 0 = never. */
  autoLockMinutes: number;

  /**
   * Kiosk lock for the kitchen screen, set from the counter.
   *
   * Lives in settings rather than in the kitchen tab's own storage so the
   * counter can lock and unlock the pass without walking over to it — the
   * change reaches the kitchen tab through the same live sync as everything
   * else. Unlocking needs the counter PIN.
   */
  kitchenLocked: boolean;
};

export const DEFAULT_DINE_SETTINGS: DineSettings = {
  id: "main",
  taxEnabled: true,
  defaultTaxRate: 5,
  pricesIncludeTaxByDefault: true,

  serviceChargeRate: 10,
  serviceChargeDefaultOn: false,
  serviceChargeTaxRate: 5,

  kotPrefix: "KOT-",
  nextKotNumber: 1,
  kotSeriesDate: "",
  kotPaperSize: "80mm",

  billPrefix: "BILL-",
  nextBillNumber: 1,
  billPaperSize: "80mm",

  nextTicketNumber: 1,
  defaultOrderType: "dine-in",

  receiptFooter: "Thank you for dining with us!",
  showBusinessInfoOnBill: true,

  dayStartHour: 0,

  lastBackupAt: null,
  sheetSyncUrl: "",
  shareCustomersWithLedger: true,

  pinHash: "",
  pinSalt: "",
  autoLockMinutes: 0,
  kitchenLocked: false,
};

export const DEFAULT_PAYMENT_METHODS = ["Cash", "UPI", "Card"];

/**
 * Slices of the workspace that can be marked dirty for Sheet sync.
 *
 * Open tickets and KOTs are deliberately absent: they are work in progress,
 * they churn every few seconds during service, and pushing them would burn the
 * sync on data nobody reports on. The JSON backup is the complete copy; the
 * Sheet carries the configuration and the settled sales.
 */
export type DineSyncSlice = "meta" | "menu" | "customers" | "bills";

export const DINE_SYNC_SLICES: DineSyncSlice[] = ["meta", "menu", "customers", "bills"];

export type DineSyncDirtyRow = { id: DineSyncSlice; dirtyAt: string };

export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  "dine-in": "Dine-in",
  takeaway: "Takeaway",
  delivery: "Delivery",
};

export const FOOD_TYPE_LABELS: Record<FoodType, string> = {
  veg: "Veg",
  nonveg: "Non-veg",
  egg: "Egg",
};

/** Starter list for setup; the profile screen offers every ISO currency. */
export const CURRENCIES = [
  { code: "INR", symbol: "₹", label: "Indian Rupee (₹)" },
  { code: "USD", symbol: "$", label: "US Dollar ($)" },
  { code: "EUR", symbol: "€", label: "Euro (€)" },
  { code: "GBP", symbol: "£", label: "British Pound (£)" },
  { code: "AED", symbol: "د.إ", label: "UAE Dirham (د.إ)" },
  { code: "SGD", symbol: "S$", label: "Singapore Dollar (S$)" },
] as const;

export function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function formatSeriesNumber(prefix: string, n: number): string {
  return `${prefix}${String(n).padStart(4, "0")}`;
}

/**
 * The business date a timestamp belongs to, honouring `dayStartHour`.
 *
 * With dayStartHour = 4, an order rung up at 01:30 on the 8th belongs to the
 * 7th — the night the staff actually worked. Returns YYYY-MM-DD in local time.
 */
export function businessDateOf(iso: string, dayStartHour: number): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const shifted = new Date(date.getTime() - dayStartHour * 60 * 60 * 1000);
  const year = shifted.getFullYear();
  const month = String(shifted.getMonth() + 1).padStart(2, "0");
  const day = String(shifted.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** The effective tax rate for a line, resolving the item's null to the default. */
export function effectiveTaxRate(itemRate: number | null, settings: DineSettings): number {
  if (!settings.taxEnabled) return 0;
  return itemRate === null ? settings.defaultTaxRate : itemRate;
}

/** Unit price including modifier deltas, in paise. */
export function lineUnitPrice(item: Pick<DineTicketItem, "price" | "modifiers">): number {
  return item.price + item.modifiers.reduce((sum, mod) => sum + mod.priceDelta, 0);
}

/** Gross value of a ticket line before discount, in paise. */
export function lineTotal(item: Pick<DineTicketItem, "price" | "modifiers" | "quantity">): number {
  return lineUnitPrice(item) * item.quantity;
}

/** Ticket lines that count towards a bill — cancelled ones never do. */
export function isBillable(item: DineTicketItem): boolean {
  return item.cancelledAt === null;
}
