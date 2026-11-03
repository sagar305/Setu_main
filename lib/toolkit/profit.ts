// Shared profit rules for the Profit Dashboard.
//
// Stock bought through the Purchase Register is inventory, not an expense: its
// cost reaches profit only as cost of goods, when the stock is sold through the
// POS. Expenses are what the Expense Tracker records. Keeping the two apart is
// what stops a purchase being charged twice (once as an expense when bought,
// and again as cost of goods when sold).

import type { Expense, Purchase } from "@/lib/toolkit/types";

type CostedProduct = { id: string; costPrice?: number | null };

/**
 * Whether an expense row is a mirror of a Purchase Register entry. Older
 * versions of the Purchase Register copied every purchase into the expenses
 * store; those rows are cost of goods and must not be counted as expenses.
 */
export function isPurchaseMirror(expense: Expense, linkedExpenseIds: ReadonlySet<string>): boolean {
  return expense.createdByTool === "purchase-register" || linkedExpenseIds.has(expense.id);
}

/** Expenses that count as operating expenses — everything except purchase mirrors. */
export function operatingExpenses(expenses: Expense[], purchases: Purchase[]): Expense[] {
  const linked = new Set(purchases.map((p) => p.expenseId).filter((id): id is string => !!id));
  return expenses.filter((e) => !isPurchaseMirror(e, linked));
}

/**
 * Unit cost of a product on a given sale date. The Purchase Register is the
 * source of truth: the most recent purchase of that product on or before the
 * sale date. With no such purchase it falls back to the product's cost price,
 * then to the earliest recorded purchase, then to zero.
 */
export function buildUnitCostLookup(
  products: CostedProduct[],
  purchases: Purchase[],
): (productId: string | null, saleDate: string) => number {
  const costPrice = new Map(products.map((p) => [p.id, p.costPrice ?? 0]));

  // productId → purchase costs, oldest first.
  const history = new Map<string, { date: string; unitCost: number }[]>();
  for (const purchase of purchases) {
    for (const item of purchase.items) {
      if (!item.productId || item.quantity <= 0 || !(item.unitCost > 0)) continue;
      const list = history.get(item.productId) ?? [];
      list.push({ date: purchase.date, unitCost: item.unitCost });
      history.set(item.productId, list);
    }
  }
  history.forEach((list) => list.sort((a, b) => a.date.localeCompare(b.date)));

  return (productId, saleDate) => {
    if (!productId) return 0;
    const list = history.get(productId);
    if (list && list.length > 0) {
      for (let i = list.length - 1; i >= 0; i--) {
        if (list[i].date <= saleDate) return list[i].unitCost;
      }
    }
    const fromProduct = costPrice.get(productId) ?? 0;
    if (fromProduct > 0) return fromProduct;
    return list && list.length > 0 ? list[0].unitCost : 0;
  };
}
