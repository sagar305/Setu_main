// Data model for the Browser Based POS (/products/browser-based-pos).
// Everything is stored client-side in IndexedDB — no backend, no login.

export type Business = {
  id: "main";
  name: string;
  phone: string;
  address: string;
  currency: string; // ISO code, e.g. "INR"
  email: string;
  taxNumber: string;
  logoDataUrl: string;
  /** UPI ID for payments (e.g. "shop@okhdfcbank"). Optional. */
  upiId?: string;
  /** IANA zone, e.g. "Asia/Kolkata". Optional: pre-toolkit records lack it. */
  timezone?: string;
  createdAt: string;
};

export type Category = {
  id: string;
  name: string;
  createdAt: string;
};

export type Product = {
  id: string;
  name: string;
  sellingPrice: number;
  sku: string;
  barcode: string;
  categoryId: string;
  costPrice: number | null;
  taxRate: number | null; // null = use default tax from settings
  taxInclusive: boolean; // true = selling price already includes tax
  trackStock: boolean;
  stock: number;
  unit: string;
  imageDataUrl: string;
  description: string;
  createdAt: string;
  updatedAt: string;
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  createdAt: string;
};

export type PaymentMethod = {
  id: string;
  name: string;
  isDefault: boolean; // Cash / UPI / Card seeded on setup
  createdAt: string;
};

export type OrderStatus = "completed" | "cancelled";

export type Order = {
  id: string;
  invoiceNumber: string;
  date: string; // ISO datetime of sale
  customerId: string | null;
  customerName: string;
  subtotal: number;
  discountType: "flat" | "percent";
  discountValue: number;
  discountAmount: number;
  taxAmount: number; // tax added on top of the price
  includedTaxAmount: number; // tax already contained in item prices
  total: number;
  paymentMethodId: string;
  paymentMethodName: string;
  status: OrderStatus;
  createdAt: string;
};

export type OrderItem = {
  id: string;
  orderId: string;
  productId: string | null;
  name: string;
  price: number;
  quantity: number;
  unit: string;
  taxRate: number;
  taxInclusive: boolean;
  lineSubtotal: number; // price * quantity, before discount/tax
};

export type InventoryLogType = "opening" | "add" | "reduce" | "sale" | "restock" | "adjust";

export type InventoryLog = {
  id: string;
  productId: string;
  productName: string;
  type: InventoryLogType;
  change: number; // positive = stock in, negative = stock out
  stockAfter: number;
  note: string;
  createdAt: string;
};

export type ReceiptPaperSize = "80mm" | "58mm" | "a4";

export type PosSettings = {
  id: "main";
  invoicePrefix: string;
  nextInvoiceNumber: number;
  taxEnabled: boolean;
  defaultTaxRate: number;
  receiptFooter: string;
  showBusinessInfoOnReceipt: boolean;
  receiptPaperSize: ReceiptPaperSize;
  /** Saved Receipt Designer template to print with; "" = built-in default. */
  receiptTemplateId?: string;
  lastBackupAt: string | null;
  /** Google Apps Script web-app URL for Sheet sync; "" = not connected. */
  sheetSyncUrl: string;
};

/** Which slices of the workspace can be marked dirty for Sheet sync. */
export type SyncSlice = "meta" | "products" | "customers" | "orders";

export const SYNC_SLICES: SyncSlice[] = ["meta", "products", "customers", "orders"];

export type SyncDirtyRow = { id: SyncSlice; dirtyAt: string };

export type CartLine = {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  unit: string;
  taxRate: number;
  taxInclusive: boolean;
};

/** A parked (held) sale that can be recalled later on the billing screen. */
export type HeldCart = {
  id: string;
  label: string;
  lines: CartLine[];
  discountType: "flat" | "percent";
  discountValue: number;
  customerId: string | null;
  createdAt: string;
};

/** Compact starter list kept for POS setup fallback; the Business Profile
 * offers every ISO currency via lib/toolkit/preferences.allCurrencies(). */
export const CURRENCIES = [
  { code: "INR", symbol: "₹", label: "Indian Rupee (₹)" },
  { code: "USD", symbol: "$", label: "US Dollar ($)" },
  { code: "EUR", symbol: "€", label: "Euro (€)" },
  { code: "GBP", symbol: "£", label: "British Pound (£)" },
  { code: "AED", symbol: "د.إ", label: "UAE Dirham (د.إ)" },
  { code: "SGD", symbol: "S$", label: "Singapore Dollar (S$)" },
] as const;

export function currencySymbol(code: string): string {
  const known = CURRENCIES.find((c) => c.code === code)?.symbol;
  if (known) return known;
  try {
    const parts = new Intl.NumberFormat("en", {
      style: "currency",
      currency: code,
      currencyDisplay: "narrowSymbol",
    }).formatToParts(1);
    return parts.find((p) => p.type === "currency")?.value ?? code;
  } catch {
    return code;
  }
}

export function formatMoney(value: number, currency: string): string {
  const safe = Number.isFinite(value) ? value : 0;
  try {
    return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
    }).format(safe);
  } catch {
    return `${currencySymbol(currency)}${safe.toFixed(2)}`;
  }
}

export function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export const DEFAULT_SETTINGS: PosSettings = {
  id: "main",
  invoicePrefix: "INV-",
  nextInvoiceNumber: 1,
  taxEnabled: false,
  defaultTaxRate: 0,
  receiptFooter: "Thank you for your business!",
  showBusinessInfoOnReceipt: true,
  receiptPaperSize: "80mm",
  receiptTemplateId: "",
  lastBackupAt: null,
  sheetSyncUrl: "",
};

export const DEFAULT_PAYMENT_METHODS = ["Cash", "UPI", "Card"];

export function formatInvoiceNumber(prefix: string, n: number): string {
  return `${prefix}${String(n).padStart(5, "0")}`;
}
