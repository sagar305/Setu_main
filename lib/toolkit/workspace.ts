// Setu Business Toolkit — Workspace Access Facade (Chapters 3 & 5)
// ---------------------------------------------------------------------------
// The single entry point a tool uses to touch shared data. It re-exports the
// existing read API (lib/workspace, backed by the POS IndexedDB) and adds the
// ecosystem rules on top: consent before connecting, and the permission model
// for writes to entities a tool does not own.
//
// A tool should:
//   1. Call hasWorkspace() to discover whether shared data exists.
//   2. Ask the user before reading it (consent — never silent, never forced).
//   3. Read through these getters; write through the permission-checked path.

export {
  getBusiness,
  hasWorkspace,
  getProducts,
  getCategories,
  getCustomers,
  getOrders,
  getOrderItems,
  getInventory,
  getPaymentMethods,
  getSettings,
  updateStock,
} from "@/lib/workspace";

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
} from "@/lib/workspace";

import { isDangerousOp, type EntityName, type Permission } from "@/lib/toolkit/entities";
import { dbDelete, dbGetAll, dbPut, type StoreName } from "@/lib/pos/db";
import { updateStock } from "@/lib/workspace";
import type {
  Appointment,
  CashEntry,
  Expense,
  LedgerEntry,
  Purchase,
  ReceiptTemplate,
  Supplier,
  WorkspaceAsset,
} from "@/lib/toolkit/types";

export type { EntityName, Permission };
export { isDangerousOp };
export type {
  Appointment,
  CashEntry,
  Expense,
  LedgerEntry,
  Purchase,
  ReceiptTemplate,
  Supplier,
  WorkspaceAsset,
};

// ---------------------------------------------------------------------------
// Typed CRUD over the toolkit stores (POS_DATABASE v4)
// ---------------------------------------------------------------------------

export const getSuppliers = () => dbGetAll<Supplier>("suppliers");
export const saveSupplier = (s: Supplier) => dbPut<Supplier>("suppliers", s);
export const deleteSupplier = (id: string) => dbDelete("suppliers", id);

export const getExpenses = () => dbGetAll<Expense>("expenses");
export const saveExpense = (e: Expense) => dbPut<Expense>("expenses", e);
export const deleteExpense = (id: string) => dbDelete("expenses", id);

export const getCashEntries = () => dbGetAll<CashEntry>("cashbook");
export const saveCashEntry = (e: CashEntry) => dbPut<CashEntry>("cashbook", e);
export const deleteCashEntry = (id: string) => dbDelete("cashbook", id);

export const getAppointments = () => dbGetAll<Appointment>("appointments");
export const saveAppointment = (a: Appointment) => dbPut<Appointment>("appointments", a);
export const deleteAppointment = (id: string) => dbDelete("appointments", id);

export const getLedgerEntries = () => dbGetAll<LedgerEntry>("ledger");
export const saveLedgerEntry = (e: LedgerEntry) => dbPut<LedgerEntry>("ledger", e);
export const deleteLedgerEntry = (id: string) => dbDelete("ledger", id);

export const getReceiptTemplates = () => dbGetAll<ReceiptTemplate>("receipt_templates");
export const saveReceiptTemplate = (t: ReceiptTemplate) =>
  dbPut<ReceiptTemplate>("receipt_templates", t);
export const deleteReceiptTemplate = (id: string) => dbDelete("receipt_templates", id);

export const getPurchases = () => dbGetAll<Purchase>("purchases");
export const savePurchase = (p: Purchase) => dbPut<Purchase>("purchases", p);
export const deletePurchase = (id: string) => dbDelete("purchases", id);

export const getAssets = () => dbGetAll<WorkspaceAsset>("assets");
export const saveAsset = (a: WorkspaceAsset) => dbPut<WorkspaceAsset>("assets", a);
export const deleteAsset = (id: string) => dbDelete("assets", id);

/** Generic list read used by the shared useEntityList hook. */
export const listStore = <T,>(store: StoreName) => dbGetAll<T>(store);
export const putRecord = <T,>(store: StoreName, record: T) => dbPut<T>(store, record);
export const deleteRecord = (store: StoreName, id: string) => dbDelete(store, id);

/**
 * Apply a confirmed purchase to product stock (dangerous op — caller MUST have
 * shown the confirmation first). Each linked line increases stock and records
 * an inventory log entry.
 */
export async function applyPurchaseToStock(purchase: Purchase): Promise<void> {
  for (const item of purchase.items) {
    if (!item.productId || item.quantity <= 0) continue;
    await updateStock(
      item.productId,
      item.quantity,
      `Purchase ${purchase.billNumber || purchase.id.slice(0, 6)}`
    );
  }
}

/**
 * A tool's declared intent to use the workspace. Consent is per-tool and
 * remembered so we honour "never ask twice" (Principle 3).
 */
export type WorkspaceConsent = {
  tool: string;
  grantedAt: string;
};

const CONSENT_KEY = "setu:workspace:consent";

/** Has the user already allowed this tool to connect to the workspace? */
export function hasConsent(tool: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY);
    const grants: WorkspaceConsent[] = raw ? JSON.parse(raw) : [];
    return grants.some((g) => g.tool === tool);
  } catch {
    return false;
  }
}

/** Record that the user allowed this tool to connect. Call after they confirm. */
export function grantConsent(tool: string): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY);
    const grants: WorkspaceConsent[] = raw ? JSON.parse(raw) : [];
    if (!grants.some((g) => g.tool === tool)) {
      grants.push({ tool, grantedAt: new Date().toISOString() });
      window.localStorage.setItem(CONSENT_KEY, JSON.stringify(grants));
    }
  } catch {
    // Consent is best-effort; a failed write just means we ask again.
  }
}

/**
 * Guard a write from a tool against an entity it may not own. Returns whether
 * the caller must show a confirmation first. The workspace layer — not the
 * individual tool — decides what counts as "dangerous", so behaviour stays
 * consistent across the whole ecosystem (Q5).
 */
export function requiresConfirmation(entity: EntityName, op: string): boolean {
  return isDangerousOp(entity, op);
}
