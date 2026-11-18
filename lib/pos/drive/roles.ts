// What each team role may do in the Browser Based POS.
//
// Checked in three places: the UI hides what a role can't use, Drive
// permissions stop non-owners writing shop.json, and merge.ts drops any
// operation outside its author's role (so a hand-edited changes file can't
// slip in a price change).

import type { Order } from "../types";
import {
  DEFAULT_CASHIER_PERMISSIONS,
  type Member,
  type MemberPermissions,
  type Op,
  type OpType,
  type Role,
} from "./ops";

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  cashier: "Cashier",
};

const ROLE_OPS: Record<Role, ReadonlySet<OpType>> = {
  owner: new Set<OpType>([
    "order.create",
    "order.cancel",
    "customer.create",
    "customer.update",
    "product.upsert",
    "product.delete",
    "stock.move",
    "record.put",
    "record.delete",
  ]),
  cashier: new Set<OpType>(["order.create", "customer.create", "stock.move"]),
};

export type PosScreen =
  | "billing"
  | "orders"
  | "customers"
  | "products"
  | "reports"
  | "dashboard"
  | "tools"
  | "settings"
  | "team";

const ROLE_SCREENS: Record<Role, ReadonlySet<PosScreen>> = {
  owner: new Set<PosScreen>([
    "billing",
    "orders",
    "customers",
    "products",
    "reports",
    "dashboard",
    "tools",
    "settings",
    "team",
  ]),
  cashier: new Set<PosScreen>(["billing", "customers"]),
};

export function canUseOp(role: Role, type: OpType): boolean {
  return ROLE_OPS[role].has(type);
}

export function canSeeScreen(role: Role, screen: PosScreen): boolean {
  return ROLE_SCREENS[role].has(screen);
}

/**
 * Role check on the operation type plus its content. A cashier may only move
 * stock out for a sale; restocks and corrections are the owner's.
 */
export function roleAllows(role: Role, op: Op): boolean {
  if (!canUseOp(role, op.type)) return false;
  if (role === "cashier" && op.type === "stock.move") {
    return op.move.logType === "sale" && op.move.change < 0 && !!op.move.orderId;
  }
  return true;
}

export function permissionsOf(member: Member): MemberPermissions {
  return { ...DEFAULT_CASHIER_PERMISSIONS, ...member.permissions };
}

/** Discount on a bill as % of its subtotal (0 when there is no subtotal). */
export function discountPercent(order: Pick<Order, "subtotal" | "discountAmount">): number {
  if (!(order.subtotal > 0)) return 0;
  return (order.discountAmount / order.subtotal) * 100;
}

export type SaleCheck = { ok: true } | { ok: false; reason: "discount-over-limit" | "credit-not-allowed" };

/**
 * A member's own limits on a sale. Used before checkout (to stop the bill on
 * the cashier's device) and again in the merge (so an edited file can't
 * bypass it). The owner has no limits.
 */
export function checkSale(
  member: Member,
  order: Pick<Order, "subtotal" | "discountAmount" | "paymentMethodId">,
): SaleCheck {
  if (member.role === "owner") return { ok: true };
  const limits = permissionsOf(member);
  // A little slack (0.005 points) for rounding in percent discounts.
  if (discountPercent(order) > limits.maxDiscountPercent + 0.005) {
    return { ok: false, reason: "discount-over-limit" };
  }
  if (order.paymentMethodId === "credit" && !limits.allowCredit) {
    return { ok: false, reason: "credit-not-allowed" };
  }
  return { ok: true };
}

/** Cashiers see only their own sales; the owner sees everything. */
export function canSeeOrder(member: Member, orderAuthorCode: string | undefined): boolean {
  return member.role === "owner" || orderAuthorCode === member.code;
}
