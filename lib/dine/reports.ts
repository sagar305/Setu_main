// Reports for Free Dine (FR-9).
//
// One outlet, one device, four numbers an owner actually wants at midnight.
// Everything here is a pure function over the bills already in the database, so
// a report can never disagree with the bills it is built from (AC-6).
//
// Cancelled bills are excluded from every revenue figure and counted separately
// — an owner needs to see that ₹4,000 was voided, not have it quietly vanish.

import { valueOf } from "./units";
import {
  businessDateOf,
  type DineBill,
  type DineBillItem,
  type DineBillPayment,
  type DineMaterial,
  type DineStockMove,
} from "./types";

export type DaySummary = {
  businessDate: string;
  totalSales: number;
  billCount: number;
  averageBill: number;
  guestCount: number;
  byPaymentMethod: { methodName: string; amount: number; count: number }[];
  taxCollected: number;
  serviceCharge: number;
  discountsGiven: number;
  cancelledCount: number;
  cancelledValue: number;
};

export function billsForDate(bills: DineBill[], businessDate: string): DineBill[] {
  return bills.filter((bill) => bill.businessDate === businessDate);
}

export function billsInRange(bills: DineBill[], from: string, to: string): DineBill[] {
  return bills.filter((bill) => bill.businessDate >= from && bill.businessDate <= to);
}

export function summarise(
  bills: DineBill[],
  payments: DineBillPayment[],
  items: DineBillItem[],
  businessDate = ""
): DaySummary {
  const paid = bills.filter((bill) => bill.status === "paid");
  const cancelled = bills.filter((bill) => bill.status === "cancelled");
  const paidIds = new Set(paid.map((bill) => bill.id));

  const totalSales = paid.reduce((sum, bill) => sum + bill.total, 0);

  const methodTotals = new Map<string, { amount: number; count: number }>();
  for (const payment of payments) {
    if (!paidIds.has(payment.billId)) continue;
    const entry = methodTotals.get(payment.methodName) ?? { amount: 0, count: 0 };
    entry.amount += payment.amount;
    entry.count += 1;
    methodTotals.set(payment.methodName, entry);
  }

  const guestCount = items
    .filter((item) => paidIds.has(item.billId))
    .reduce((sum, item) => sum + item.quantity, 0);

  return {
    businessDate,
    totalSales,
    billCount: paid.length,
    averageBill: paid.length ? Math.round(totalSales / paid.length) : 0,
    guestCount,
    byPaymentMethod: Array.from(methodTotals.entries())
      .map(([methodName, entry]) => ({ methodName, ...entry }))
      .sort((a, b) => b.amount - a.amount),
    taxCollected: paid.reduce((sum, bill) => sum + bill.addedTax + bill.includedTax, 0),
    serviceCharge: paid.reduce((sum, bill) => sum + bill.serviceCharge, 0),
    discountsGiven: paid.reduce((sum, bill) => sum + bill.discountAmount, 0),
    cancelledCount: cancelled.length,
    cancelledValue: cancelled.reduce((sum, bill) => sum + bill.total, 0),
  };
}

export type ItemReportRow = {
  name: string;
  quantity: number;
  revenue: number;
  /** Ingredient cost of what was sold, in paise. 0 when nothing is costed. */
  cost: number;
};

/**
 * Quantity and revenue per menu item — the menu-engineering input (FR-9.2).
 *
 * Variations are reported separately ("Chicken Biryani (Half)") because a
 * kitchen deciding what to drop needs to know which size actually sells.
 */
export function itemReport(bills: DineBill[], items: DineBillItem[]): ItemReportRow[] {
  const paidIds = new Set(bills.filter((bill) => bill.status === "paid").map((bill) => bill.id));
  const rows = new Map<string, ItemReportRow>();

  for (const item of items) {
    if (!paidIds.has(item.billId)) continue;
    const name = item.variationName ? `${item.name} (${item.variationName})` : item.name;
    const row = rows.get(name) ?? { name, quantity: 0, revenue: 0, cost: 0 };
    row.quantity += item.quantity;
    row.revenue += item.lineTotal;
    row.cost += (item.unitCost ?? 0) * item.quantity;
    rows.set(name, row);
  }

  return Array.from(rows.values()).sort((a, b) => b.revenue - a.revenue);
}

export type HourlyRow = { hour: number; bills: number; revenue: number };

/** Sales by hour of the clock, so an owner can see the rush (FR-9.3). */
export function hourlySales(bills: DineBill[]): HourlyRow[] {
  const hours: HourlyRow[] = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    bills: 0,
    revenue: 0,
  }));
  for (const bill of bills) {
    if (bill.status !== "paid") continue;
    const at = new Date(bill.paidAt ?? bill.createdAt);
    if (Number.isNaN(at.getTime())) continue;
    const row = hours[at.getHours()];
    row.bills += 1;
    row.revenue += bill.total;
  }
  return hours;
}

/** Every business date that has at least one bill, newest first. */
export function businessDates(bills: DineBill[]): string[] {
  return Array.from(new Set(bills.map((bill) => bill.businessDate)))
    .filter(Boolean)
    .sort((a, b) => b.localeCompare(a));
}

/** Today's business date, honouring the configured day-start hour. */
export function todayBusinessDate(dayStartHour: number): string {
  return businessDateOf(new Date().toISOString(), dayStartHour);
}

export type TaxSlabRow = { rate: number; taxable: number; cgst: number; sgst: number };

/** GST slab totals across a set of bills, for the Z-report (FR-9.5). */
export function taxSlabTotals(bills: DineBill[]): TaxSlabRow[] {
  const slabs = new Map<number, TaxSlabRow>();
  for (const bill of bills) {
    if (bill.status !== "paid") continue;
    for (const line of bill.taxBreakup) {
      const slab = slabs.get(line.rate) ?? { rate: line.rate, taxable: 0, cgst: 0, sgst: 0 };
      slab.taxable += line.taxable;
      slab.cgst += line.cgst;
      slab.sgst += line.sgst;
      slabs.set(line.rate, slab);
    }
  }
  return Array.from(slabs.values()).sort((a, b) => a.rate - b.rate);
}


export type MaterialUsageRow = {
  materialId: string;
  name: string;
  unit: DineMaterial["baseUnit"];
  /** Consumed by orders, as a positive quantity. */
  used: number;
  /** Thrown away, as a positive quantity. */
  wasted: number;
  /** Received in the period. */
  received: number;
  /** Stock-take correction: negative means the shelf held less than the books. */
  variance: number;
  /** Value of what was used and wasted, in paise. */
  cost: number;
};

/**
 * What the kitchen actually got through, from the stock ledger rather than
 * from the recipes.
 *
 * Deriving usage by multiplying dishes sold by their recipes would only ever
 * restate what the recipes claim. Reading the ledger instead means a stock
 * take that came up short shows as a variance rather than quietly disappearing
 * — which is the whole reason an owner turns this on.
 */
export function materialUsage(
  moves: DineStockMove[],
  materials: DineMaterial[],
  from: string,
  to: string
): MaterialUsageRow[] {
  const byId = new Map(materials.map((material) => [material.id, material]));
  const rows = new Map<string, MaterialUsageRow>();

  for (const move of moves) {
    if (move.businessDate < from || move.businessDate > to) continue;
    const material = byId.get(move.materialId);
    const row =
      rows.get(move.materialId) ??
      ({
        materialId: move.materialId,
        name: move.materialName,
        unit: material?.baseUnit ?? "g",
        used: 0,
        wasted: 0,
        received: 0,
        variance: 0,
        cost: 0,
      } satisfies MaterialUsageRow);

    if (move.reason === "consume") row.used -= move.change;
    else if (move.reason === "wastage") row.wasted -= move.change;
    else if (move.reason === "purchase" || move.reason === "opening") row.received += move.change;
    else if (move.reason === "adjust") row.variance += move.change;

    rows.set(move.materialId, row);
  }

  for (const row of rows.values()) {
    const material = byId.get(row.materialId);
    row.cost = material ? valueOf(row.used + row.wasted, material.costPerUnit) : 0;
  }

  return Array.from(rows.values())
    .filter((row) => row.used !== 0 || row.wasted !== 0 || row.received !== 0 || row.variance !== 0)
    .sort((a, b) => b.cost - a.cost);
}

/** Total wastage value in a period, in paise — the number worth watching. */
export function wastageValue(rows: MaterialUsageRow[], materials: DineMaterial[]): number {
  const byId = new Map(materials.map((material) => [material.id, material]));
  return rows.reduce((sum, row) => {
    const material = byId.get(row.materialId);
    return sum + (material ? valueOf(row.wasted, material.costPerUnit) : 0);
  }, 0);
}
