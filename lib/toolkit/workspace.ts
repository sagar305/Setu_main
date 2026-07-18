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

export type { EntityName, Permission };
export { isDangerousOp };

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
