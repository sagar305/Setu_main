// Setu Business Toolkit — Shared Entities & Ownership Model
// ---------------------------------------------------------------------------
// This file is the code-level source of truth for Chapter 4 (Business Objects)
// and the ownership rules in Chapter 5 of docs/setu-business-toolkit.md.
//
// Core rule: shared entities are owned by the WORKSPACE, never by a tool.
// A tool may be the *primary editor* of an entity (the richest UI for it), but
// every other tool reads the same records and may edit them within the
// permission model below. This is the "Google Contacts, not Gmail's contacts"
// principle: the store is shared; tools are just views onto it.
//
// The canonical record shapes already live in lib/pos/types.ts (the POS created
// the IndexedDB that doubles as the workspace). We re-export them here so the
// rest of the toolkit imports entities from one ecosystem-level module instead
// of reaching into POS internals.

import type {
  Business,
  Category,
  Customer,
  InventoryLog,
  Order,
  OrderItem,
  PaymentMethod,
  PosSettings,
  Product,
} from "@/lib/pos/types";
import type { StoreName } from "@/lib/pos/db";
import type { ToolSlug } from "@/lib/toolkit/registry";

export type {
  Business,
  Category,
  Customer,
  InventoryLog,
  Order,
  OrderItem,
  PaymentMethod,
  PosSettings,
  Product,
};

// ---------------------------------------------------------------------------
// Ecosystem metadata standard
// ---------------------------------------------------------------------------
// Every NEW shared object created from here on carries this envelope so we
// always know who created it, when it changed, and which schema version it was
// written against (Chapter 5, "Data Ownership"). Existing POS entities predate
// this and will adopt it through the migration layer — see migration.ts.

export type EntityMeta = {
  /** Slug of the tool that first created this record. */
  createdByTool: ToolSlug;
  createdAt: string;
  updatedAt: string;
  /** Per-record schema version, bumped by migrations. */
  schemaVersion: number;
};

// ---------------------------------------------------------------------------
// Entity registry
// ---------------------------------------------------------------------------

/** Every shared entity the workspace can hold. */
export type EntityName =
  | "business"
  | "products"
  | "categories"
  | "customers"
  | "suppliers"
  | "orders"
  | "order_items"
  | "invoices"
  | "quotations"
  | "receipt_templates"
  | "expenses"
  | "cashbook"
  | "appointments"
  | "ledger"
  | "purchases"
  | "inventory"
  | "payments"
  | "assets"
  | "settings";

/**
 * Permission tiers a tool holds against an entity it does not own (Chapter 5,
 * Q5). "read" and "update" are silent; "dangerous" operations must route
 * through a confirmation the workspace layer enforces — a tool cannot opt out.
 */
export type Permission = "read" | "update" | "dangerous";

export type EntityDescriptor = {
  name: EntityName;
  label: string;
  /** Entities are always workspace-owned; recorded explicitly for clarity. */
  ownedBy: "workspace";
  /** The tool that ships the richest editor for this entity. */
  primaryEditor: ToolSlug;
  /** IndexedDB store backing it today, or null if not yet persisted. */
  store: StoreName | null;
  /**
   * Operations any tool must gate behind a confirmation prompt. Everything not
   * listed here is a plain "update" a tool may perform silently.
   */
  dangerousOps: string[];
  /** Whether the store exists in code today or is still on the roadmap. */
  status: "live" | "planned";
};

export const ENTITIES: Record<EntityName, EntityDescriptor> = {
  business: {
    name: "business",
    label: "Business Profile",
    ownedBy: "workspace",
    primaryEditor: "browser-pos",
    store: "business",
    dangerousOps: ["delete", "change-gst-settings"],
    status: "live",
  },
  products: {
    name: "products",
    label: "Products",
    ownedBy: "workspace",
    primaryEditor: "browser-pos",
    store: "products",
    dangerousOps: ["delete", "change-stock", "change-tax-rate"],
    status: "live",
  },
  categories: {
    name: "categories",
    label: "Categories",
    ownedBy: "workspace",
    primaryEditor: "browser-pos",
    store: "categories",
    dangerousOps: ["delete"],
    status: "live",
  },
  customers: {
    name: "customers",
    label: "Customers",
    ownedBy: "workspace",
    primaryEditor: "browser-pos",
    store: "customers",
    dangerousOps: ["delete"],
    status: "live",
  },
  suppliers: {
    name: "suppliers",
    label: "Suppliers",
    ownedBy: "workspace",
    primaryEditor: "supplier-book",
    store: "suppliers",
    dangerousOps: ["delete"],
    status: "live",
  },
  orders: {
    name: "orders",
    label: "Orders / Sales",
    ownedBy: "workspace",
    primaryEditor: "browser-pos",
    store: "orders",
    dangerousOps: ["delete", "cancel"],
    status: "live",
  },
  order_items: {
    name: "order_items",
    label: "Order Line Items",
    ownedBy: "workspace",
    primaryEditor: "browser-pos",
    store: "order_items",
    dangerousOps: ["delete"],
    status: "live",
  },
  invoices: {
    name: "invoices",
    label: "Invoices",
    ownedBy: "workspace",
    primaryEditor: "invoice-generator",
    store: null,
    dangerousOps: ["delete"],
    status: "planned",
  },
  quotations: {
    name: "quotations",
    label: "Quotations",
    ownedBy: "workspace",
    primaryEditor: "quotation-generator",
    store: "quotations",
    dangerousOps: ["delete"],
    status: "live",
  },
  receipt_templates: {
    name: "receipt_templates",
    label: "Receipt Templates",
    ownedBy: "workspace",
    primaryEditor: "receipt-designer",
    store: "receipt_templates",
    dangerousOps: ["delete"],
    status: "live",
  },
  expenses: {
    name: "expenses",
    label: "Expenses",
    ownedBy: "workspace",
    primaryEditor: "expense-tracker",
    store: "expenses",
    dangerousOps: ["delete"],
    status: "live",
  },
  cashbook: {
    name: "cashbook",
    label: "Cash Book Entries",
    ownedBy: "workspace",
    primaryEditor: "cash-book",
    store: "cashbook",
    dangerousOps: ["delete"],
    status: "live",
  },
  appointments: {
    name: "appointments",
    label: "Appointments",
    ownedBy: "workspace",
    primaryEditor: "appointment-book",
    store: "appointments",
    dangerousOps: ["delete", "cancel"],
    status: "live",
  },
  ledger: {
    name: "ledger",
    label: "Customer Ledger (Udhaar)",
    ownedBy: "workspace",
    primaryEditor: "customer-ledger",
    store: "ledger",
    dangerousOps: ["delete", "adjust-balance"],
    status: "live",
  },
  purchases: {
    name: "purchases",
    label: "Purchases",
    ownedBy: "workspace",
    primaryEditor: "purchase-register",
    store: "purchases",
    dangerousOps: ["delete"],
    status: "live",
  },
  inventory: {
    name: "inventory",
    label: "Inventory Log",
    ownedBy: "workspace",
    primaryEditor: "browser-pos",
    store: "inventory",
    dangerousOps: ["adjust"],
    status: "live",
  },
  payments: {
    name: "payments",
    label: "Payment Methods",
    ownedBy: "workspace",
    primaryEditor: "browser-pos",
    store: "payments",
    dangerousOps: ["delete"],
    status: "live",
  },
  assets: {
    name: "assets",
    label: "Shared Assets (Logo, QR designs)",
    ownedBy: "workspace",
    primaryEditor: "logo-manager",
    store: "assets",
    dangerousOps: ["delete"],
    status: "live",
  },
  settings: {
    name: "settings",
    label: "Workspace Settings & Preferences",
    ownedBy: "workspace",
    primaryEditor: "browser-pos",
    store: "settings",
    dangerousOps: ["change-gst-settings", "reset"],
    status: "live",
  },
};

/** True when `op` on `entity` requires a confirmation prompt. */
export function isDangerousOp(entity: EntityName, op: string): boolean {
  return ENTITIES[entity].dangerousOps.includes(op);
}

/** The tool that owns the primary editing UI for an entity. */
export function primaryEditorOf(entity: EntityName): ToolSlug {
  return ENTITIES[entity].primaryEditor;
}
