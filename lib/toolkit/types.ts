// Record shapes for Business Toolkit entities (workspace stores added in
// POS_DATABASE v4). Canonical POS shapes stay in lib/pos/types.ts; these are
// the newer workspace-owned entities created by toolkit tools. All of them
// carry createdByTool so ownership is always known (Chapter 4).

import type { ToolSlug } from "@/lib/toolkit/registry";

export type Supplier = {
  id: string;
  name: string;
  phone: string;
  email: string;
  gstin: string;
  address: string;
  notes: string;
  createdByTool: ToolSlug;
  createdAt: string;
  updatedAt: string;
};

export type Expense = {
  id: string;
  date: string; // ISO date (yyyy-mm-dd)
  category: string;
  description: string;
  amount: number;
  paymentMode: string; // Cash / UPI / Card / Bank
  supplierId: string | null;
  createdByTool: ToolSlug;
  createdAt: string;
  updatedAt: string;
};

export const EXPENSE_CATEGORIES = [
  "Rent",
  "Salaries",
  "Electricity",
  "Purchases",
  "Transport",
  "Marketing",
  "Maintenance",
  "Other",
] as const;

export type CashEntryType = "in" | "out";

export type CashEntry = {
  id: string;
  date: string; // ISO date (yyyy-mm-dd)
  type: CashEntryType;
  amount: number;
  description: string;
  createdByTool: ToolSlug;
  createdAt: string;
};

export type AppointmentStatus = "scheduled" | "completed" | "cancelled" | "no-show";

export type Appointment = {
  id: string;
  customerId: string | null; // linked workspace customer, if any
  customerName: string;
  phone: string;
  service: string;
  date: string; // ISO date (yyyy-mm-dd)
  time: string; // HH:mm
  durationMins: number;
  status: AppointmentStatus;
  notes: string;
  createdByTool: ToolSlug;
  createdAt: string;
  updatedAt: string;
};

export type LedgerEntryType = "credit" | "payment";

/** One udhaar movement: "credit" = customer owes more, "payment" = they paid. */
export type LedgerEntry = {
  id: string;
  customerId: string;
  customerName: string;
  type: LedgerEntryType;
  amount: number;
  note: string;
  date: string; // ISO date (yyyy-mm-dd)
  createdByTool: ToolSlug;
  createdAt: string;
};

export type ReceiptTemplate = {
  id: string;
  name: string;
  paperSize: "80mm" | "58mm" | "a4";
  accentColor: string;
  headerText: string;
  footerText: string;
  showLogo: boolean;
  showBusinessInfo: boolean;
  showGstin: boolean;
  boldTotals: boolean;
  separator: "dashed" | "solid" | "none";
  createdByTool: ToolSlug;
  createdAt: string;
  updatedAt: string;
};

export type PurchaseItem = {
  productId: string | null; // linked workspace product, if any
  name: string;
  quantity: number;
  unitCost: number;
};

export type Purchase = {
  id: string;
  supplierId: string | null;
  supplierName: string;
  billNumber: string;
  date: string; // ISO date (yyyy-mm-dd)
  items: PurchaseItem[];
  total: number;
  paymentMode: string;
  /** Whether the user confirmed applying this purchase to product stock. */
  stockApplied: boolean;
  /** Id of the linked Expense record, when this purchase was also logged as an expense. */
  expenseId?: string;
  notes: string;
  createdByTool: ToolSlug;
  createdAt: string;
};

export type QuotationItem = {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  taxRate: number; // percent
};

export type QuotationStatus = "draft" | "sent" | "accepted" | "declined";

export type Quotation = {
  id: string;
  number: string; // e.g. "QUO-00001"
  date: string; // ISO date
  validUntil: string; // ISO date
  clientName: string;
  clientPhone: string;
  clientAddress: string;
  customerId: string | null; // linked workspace customer, if any
  items: QuotationItem[];
  notes: string;
  subtotal: number;
  taxTotal: number;
  total: number;
  status: QuotationStatus;
  createdByTool: ToolSlug;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceAsset = {
  id: string;
  kind: "logo" | "image" | "qr-design";
  name: string;
  dataUrl: string;
  createdByTool: ToolSlug;
  createdAt: string;
};
