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

import type { BaseUnit } from "./units";

export type OrderType = "dine-in" | "takeaway" | "delivery";

export type FoodType = "veg" | "nonveg" | "egg";

export type PaperSize = "80mm" | "58mm" | "a4";

// ---------------------------------------------------------------------------
// Raw materials and recipes
// ---------------------------------------------------------------------------

/**
 * Something bought and stored, not sold: carrots, milk, ghee, paper cups.
 *
 * A restaurant's stock is raw material, not finished dishes — nobody has "12
 * Gajar Halwa" in a cupboard. Dishes consume materials through their recipe,
 * which is what makes the numbers survive a menu with sizes and add-ons.
 */
export type DineMaterial = {
  id: string;
  name: string;
  /** g, ml or pc — see lib/dine/units. */
  baseUnit: BaseUnit;
  /** How it is bought ("5 kg sack"); "" when it is only ever bought loose. */
  packLabel: string;
  /** Base units in one pack, stored scaled. 0 when there is no pack. */
  baseUnitsPerPack: number;
  /** On-hand quantity, in thousandths of the base unit. */
  stockQty: number;
  /** Warn at or below this. 0 = never warn. */
  reorderLevel: number;
  /** Weighted-average cost, in paise per COST_SCALE stored units. */
  costPerUnit: number;
  note: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * What a recipe line hangs off.
 *
 * Three levels, because consumption follows what the guest actually chose:
 *  - "item"      the dish's base recipe
 *  - "variation" replaces the base entirely when that size is ordered, since a
 *                half plate uses less rice but the same raita
 *  - "modifier"  a delta added on top, which may be negative ("no onion")
 */
export type RecipeOwnerType = "item" | "variation" | "modifier";

export type DineRecipeLine = {
  id: string;
  ownerType: RecipeOwnerType;
  ownerId: string;
  materialId: string;
  /** Per one unit of the dish, in thousandths of the material's base unit. */
  quantity: number;
  sortOrder: number;
};

/**
 * Every movement of stock, appended and never edited.
 *
 * A running total on its own cannot answer "why is the ghee down to 400 g",
 * which is the only question anyone actually asks it. The ledger can.
 */
export type StockMoveReason =
  | "opening"
  | "purchase"
  | "consume"
  | "wastage"
  | "adjust";

export type DineStockMove = {
  id: string;
  materialId: string;
  /** Denormalised so history survives the material being renamed or deleted. */
  materialName: string;
  reason: StockMoveReason;
  /** Signed: positive is stock in, negative is stock out. */
  change: number;
  balanceAfter: number;
  /** Cost per unit at the time, so history can be valued after prices move. */
  costPerUnit: number;
  /** Ticket, KOT or bill this came from, when it came from one. */
  refId: string;
  refLabel: string;
  note: string;
  businessDate: string;
  createdAt: string;
};

export const STOCK_MOVE_LABELS: Record<StockMoveReason, string> = {
  opening: "Opening stock",
  purchase: "Stock added",
  consume: "Used in orders",
  wastage: "Wastage",
  adjust: "Stock take",
};

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

  /** The booking this table was seated from, when it came from one. */
  reservationId?: string | null;
  /**
   * Booking advance already collected, in paise, waiting to come off the bill.
   *
   * Carried onto the ticket at seating rather than left on the reservation so
   * that whoever settles the bill sees it without having to know a booking
   * existed — the money is attached to the meal it belongs to.
   */
  advanceAmount?: number;
  advanceNote?: string;
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
  /** Kept so a sold line can be traced back to its recipe. */
  menuItemId?: string;
  variationId?: string | null;
  /**
   * What the ingredients cost when this was sold, per unit, in paise.
   *
   * Stored rather than recomputed: pricing a sale from March at today's
   * average cost would make last month's margin move every time a sack of
   * rice gets more expensive.
   */
  unitCost?: number;
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
  /**
   * Frozen from the method at the time, because it decides whether this tender
   * was cash in the drawer today. A method renamed or re-kinded next year must
   * not rewrite what last Tuesday's takings were.
   */
  kind?: PaymentMethodKind;
};

export type DinePaymentMethod = {
  id: string;
  name: string;
  isDefault: boolean;
  sortOrder: number;
  createdAt: string;
  /** Absent on rows written before credit existed; read it through kindOf. */
  kind?: PaymentMethodKind;
  /**
   * Built in and undeletable. The khata and advance tenders are wired into the
   * billing logic by kind, so letting someone delete them from Settings would
   * silently break putting a bill on account.
   */
  builtIn?: boolean;
};

export function kindOf(method: Pick<DinePaymentMethod, "kind">): PaymentMethodKind {
  return method.kind ?? "normal";
}

export type DineCustomer = {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  createdAt: string;

  /**
   * May this diner eat now and pay later (khata)?
   *
   * Off for everyone by default. Credit is a decision an owner makes about a
   * particular person — a regular, a nearby office, a family account — and
   * defaulting it on would let any walk-in leave without paying by tapping the
   * wrong tender.
   */
  creditAllowed: boolean;
  /** Ceiling on what they may owe, in paise. 0 = no ceiling. */
  creditLimit: number;
  /**
   * What they owe right now, in paise. Positive = the restaurant is owed.
   *
   * Kept on the diner as well as in dine_credit_entries because the floor and
   * the payment screen need it on every render, and summing a year of entries
   * to draw a badge is the kind of thing that is fine in month one and slow in
   * month twelve. The ledger stays the record of truth; this is its running
   * total, updated in the same transaction as the entry that moves it.
   */
  creditBalance: number;
};

/** Why a diner's balance moved. */
export type CreditReason =
  | "bill"
  | "settlement"
  | "opening"
  | "adjustment"
  | "writeoff"
  | "deposit";

export const CREDIT_REASON_LABELS: Record<CreditReason, string> = {
  bill: "Bill on account",
  settlement: "Payment received",
  opening: "Opening balance",
  adjustment: "Adjustment",
  writeoff: "Written off",
  deposit: "Booking advance",
};

/**
 * One movement in a diner's khata.
 *
 * Double-entry in spirit: `change` is signed, positive when the diner owes
 * more. The sum of a diner's entries always equals their creditBalance, which
 * is what makes the running total safe to trust and a stock-take equivalent
 * possible if it ever drifts.
 */
export type DineCreditEntry = {
  id: string;
  customerId: string;
  /** Frozen at the time, so a renamed diner does not rewrite their history. */
  customerName: string;
  reason: CreditReason;
  /** Signed, in paise. Positive increases what the diner owes. */
  change: number;
  /** Set when this entry came from putting a bill on account. */
  billId: string | null;
  billLabel: string;
  /** How a settlement was taken (Cash, UPI); "" for charges. */
  methodId: string;
  methodName: string;
  note: string;
  businessDate: string;
  createdAt: string;
};

export type ReservationStatus = "booked" | "seated" | "completed" | "cancelled" | "no-show";

export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  booked: "Booked",
  seated: "Seated",
  completed: "Completed",
  cancelled: "Cancelled",
  "no-show": "No-show",
};

/** Bookings still holding a table. Cancelled and finished ones release it. */
export const ACTIVE_RESERVATION_STATUSES: ReservationStatus[] = ["booked", "seated"];

/**
 * A table booked ahead of time.
 *
 * Deposits are the reason this is not just a calendar. A booking may be free
 * (depositRequired = 0) or paid, and money taken to hold a table is not a sale
 * — it is money held against a meal that has not happened. So a deposit is
 * recorded here, never as a bill, and only becomes revenue when it is applied
 * to the ticket the party actually eats. Keeping the two apart is what stops
 * a Saturday of bookings inflating Friday's sales.
 */
export type DineReservation = {
  id: string;
  /** Linked diner, when they are a known one. */
  customerId: string | null;
  guestName: string;
  phone: string;
  partySize: number;
  /** Held table; null means "any table", decided on arrival. */
  tableId: string | null;
  tableName: string;
  areaName: string;
  /** Local ISO timestamp of the booking. */
  startsAt: string;
  durationMinutes: number;
  status: ReservationStatus;

  /** Advance asked for, in paise. 0 = a free booking. */
  depositRequired: number;
  /** Advance actually taken, in paise. */
  depositPaid: number;
  depositMethodId: string;
  depositMethodName: string;
  depositPaidAt: string | null;
  /**
   * What happened to a paid advance when the booking ended without a meal.
   * "" while it is still in play, "applied" once it has come off a bill.
   */
  depositOutcome: "" | "applied" | "refunded" | "forfeited";

  /** The ticket opened when the party was seated. */
  ticketId: string | null;
  occasion: string;
  note: string;
  cancelReason: string;
  /** Business day the booking falls on, for the day sheet. */
  businessDate: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * What a tender actually is.
 *
 * "normal" moves money now (cash, UPI, card). The other two do not, and the
 * difference matters: "credit" settles a bill by adding to what a diner owes,
 * and "advance" settles it with money already taken as a booking deposit.
 * Both must still appear as tenders so a bill's payments add up to its total,
 * but neither is cash in the drawer today.
 */
export type PaymentMethodKind = "normal" | "credit" | "advance";

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
   * A layout designed in the Receipt Designer, applied to the bill.
   *
   * Templates live in the shared workspace alongside the Customer Ledger's
   * contacts — they are a toolkit tool's output, not the retail POS's data, so
   * a restaurant can design one look and use it everywhere. "" = the built-in
   * layout.
   */
  billTemplateId: string;

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

  /**
   * Track raw materials and recipes.
   *
   * Off by default. A restaurant that only wants to bill should never be shown
   * a low-stock warning for a cupboard it never told us about, and turning
   * this on is a real commitment — recipes have to be entered before any of
   * the numbers mean anything.
   */
  inventoryEnabled: boolean;

  /**
   * Let diners eat now and pay later (khata).
   *
   * Off by default, like stock. Turning it on adds an "On account" tender to
   * the payment screen and a Khata screen to the nav; leaving it off keeps a
   * cash-only restaurant from ever seeing a way to let someone walk out
   * without paying.
   */
  creditEnabled: boolean;

  /** Book tables ahead, with or without an advance. Off by default. */
  reservationsEnabled: boolean;
  /** Minutes a booking is expected to run, pre-filled on the form. */
  reservationDefaultMinutes: number;
  /** Advance pre-filled on a new booking, in paise. 0 = free by default. */
  reservationDefaultDeposit: number;
  /**
   * How long a table is held either side of a booking.
   *
   * Used twice, deliberately: a free table starts showing as reserved this
   * many minutes before the booking, and a party is flagged late this many
   * minutes after it. One number the owner has to reason about, not two.
   */
  reservationHoldMinutes: number;
  /**
   * Dial code prefixed to a local number when opening WhatsApp.
   *
   * Diners' phone numbers get typed as ten digits at a counter, and wa.me
   * needs the country on the front or it opens an empty chat. Only applied to
   * numbers that do not already carry one.
   */
  whatsappDialCode: string;

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
  billTemplateId: "",

  dayStartHour: 0,

  lastBackupAt: null,
  sheetSyncUrl: "",
  shareCustomersWithLedger: true,
  inventoryEnabled: false,

  creditEnabled: false,

  reservationsEnabled: false,
  reservationDefaultMinutes: 90,
  reservationDefaultDeposit: 0,
  reservationHoldMinutes: 30,
  whatsappDialCode: "91",

  pinHash: "",
  pinSalt: "",
  autoLockMinutes: 0,
  kitchenLocked: false,
};

export const DEFAULT_PAYMENT_METHODS = ["Cash", "UPI", "Card"];

/** Reserved tender names. Created on demand, never editable, never deletable. */
export const CREDIT_METHOD_NAME = "On account (khata)";
export const ADVANCE_METHOD_NAME = "Booking advance";

/**
 * Slices of the workspace that can be marked dirty for Sheet sync.
 *
 * Open tickets and KOTs are deliberately absent: they are work in progress,
 * they churn every few seconds during service, and pushing them would burn the
 * sync on data nobody reports on. The JSON backup is the complete copy; the
 * Sheet carries the configuration and the settled sales.
 */
export type DineSyncSlice =
  | "meta"
  | "menu"
  | "customers"
  | "bills"
  | "inventory"
  | "reservations";

export const DINE_SYNC_SLICES: DineSyncSlice[] = [
  "meta",
  "menu",
  "customers",
  "bills",
  "inventory",
  "reservations",
];

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
