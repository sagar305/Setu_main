// Data model for the Offline Browser POS (/free-pos).
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
  lastBackupAt: string | null;
};

export type CartLine = {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  unit: string;
  taxRate: number;
  taxInclusive: boolean;
};

export const CURRENCIES = [
  { code: "INR", symbol: "₹", label: "Indian Rupee (₹)" },
  { code: "USD", symbol: "$", label: "US Dollar ($)" },
  { code: "EUR", symbol: "€", label: "Euro (€)" },
  { code: "GBP", symbol: "£", label: "British Pound (£)" },
  { code: "AED", symbol: "د.إ", label: "UAE Dirham (د.إ)" },
  { code: "SGD", symbol: "S$", label: "Singapore Dollar (S$)" },
] as const;

export function currencySymbol(code: string): string {
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? code;
}

export function formatMoney(value: number, currency: string): string {
  const symbol = currencySymbol(currency);
  if (!Number.isFinite(value)) return `${symbol}0.00`;
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString(currency === "INR" ? "en-IN" : "en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${value < 0 ? "-" : ""}${symbol}${formatted}`;
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
  lastBackupAt: null,
};

export const DEFAULT_PAYMENT_METHODS = ["Cash", "UPI", "Card"];

export function formatInvoiceNumber(prefix: string, n: number): string {
  return `${prefix}${String(n).padStart(5, "0")}`;
}
