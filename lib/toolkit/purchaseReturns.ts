// Returns of goods to a supplier — the rules the Purchase Register, Supplier
// Ledger and P&L share.
//
// A purchase line can be marked returnable, with a last return date and how
// the supplier settles it (replacement or credit note). A return:
//   • takes the units out of stock (from that purchase's batch when batch
//     tracking is on);
//   • as a credit note, reduces what you owe the supplier by the units' cost
//     (or leaves the supplier owing you, if the bill was already paid);
//   • as a replacement, moves no money — it waits as "pending" until the new
//     goods arrive, which come back into stock as a fresh batch.

import type { Purchase, PurchaseItem, PurchaseReturn } from "@/lib/toolkit/types";

/** Days before the return deadline when the register starts warning. */
export const RETURN_WARNING_DAYS = 7;

const todayIso = () => new Date().toISOString().slice(0, 10);

export type ReturnWindow = "none" | "open" | "closing" | "closed";

/** Where an item stands against its return deadline. */
export function returnWindow(item: PurchaseItem, today = todayIso(), warnDays = RETURN_WARNING_DAYS): ReturnWindow {
  if (!item.returnable) return "none";
  if (!item.returnBy) return "open";
  if (item.returnBy < today) return "closed";
  const warn = new Date(`${today}T00:00:00Z`);
  warn.setUTCDate(warn.getUTCDate() + warnDays);
  return item.returnBy <= warn.toISOString().slice(0, 10) ? "closing" : "open";
}

/** Units already sent back, per line of a purchase. */
export function returnedQuantities(purchaseId: string, returns: PurchaseReturn[]): Map<number, number> {
  const out = new Map<number, number>();
  for (const r of returns) {
    if (r.purchaseId !== purchaseId) continue;
    for (const i of r.items) out.set(i.itemIndex, (out.get(i.itemIndex) ?? 0) + i.quantity);
  }
  return out;
}

export type ReturnableLine = {
  itemIndex: number;
  item: PurchaseItem;
  window: ReturnWindow;
  /** Units that can still be returned. */
  left: number;
};

/** Lines of a purchase that can still go back to the supplier today. */
export function returnableLines(purchase: Purchase, returns: PurchaseReturn[], today = todayIso()): ReturnableLine[] {
  const returned = returnedQuantities(purchase.id, returns);
  const lines: ReturnableLine[] = [];
  purchase.items.forEach((item, itemIndex) => {
    const window = returnWindow(item, today);
    if (window === "none" || window === "closed") return;
    const left = item.quantity - (returned.get(itemIndex) ?? 0);
    if (left > 0) lines.push({ itemIndex, item, window, left });
  });
  return lines;
}

/** Value of a return at the purchase cost. */
export function returnAmount(items: { quantity: number; unitCost: number }[]): number {
  return Math.round(items.reduce((s, i) => s + i.quantity * i.unitCost, 0) * 100) / 100;
}

/** Credit notes received — what reduces purchases and supplier balances. */
export function creditNoteTotal(returns: PurchaseReturn[], purchaseId?: string): number {
  return returns
    .filter((r) => r.mode === "credit-note" && (!purchaseId || r.purchaseId === purchaseId))
    .reduce((s, r) => s + r.amount, 0);
}

/** Returnable lines whose deadline is within the warning window, across all purchases. */
export function closingSoon(purchases: Purchase[], returns: PurchaseReturn[], today = todayIso()) {
  const out: { purchase: Purchase; line: ReturnableLine }[] = [];
  for (const purchase of purchases) {
    for (const line of returnableLines(purchase, returns, today)) {
      if (line.window === "closing") out.push({ purchase, line });
    }
  }
  return out.sort((a, b) => (a.line.item.returnBy ?? "").localeCompare(b.line.item.returnBy ?? ""));
}
