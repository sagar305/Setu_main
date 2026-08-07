// Reports for Free Dine (FR-9).
//
// One outlet, one device, four numbers an owner actually wants at midnight.
// Everything here is a pure function over the bills already in the database, so
// a report can never disagree with the bills it is built from (AC-6).
//
// Cancelled bills are excluded from every revenue figure and counted separately
// — an owner needs to see that ₹4,000 was voided, not have it quietly vanish.

import { businessDateOf, type DineBill, type DineBillItem, type DineBillPayment } from "./types";

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
    const row = rows.get(name) ?? { name, quantity: 0, revenue: 0 };
    row.quantity += item.quantity;
    row.revenue += item.lineTotal;
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
