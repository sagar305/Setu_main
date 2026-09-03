// Report builders.
//
// Every one of these takes the raw stores and returns rows the screen renders
// and the CSV export writes, so the number on screen and the number in the
// downloaded file can never disagree.

import {
  SCHEDULE_LABELS,
  formatExpiry,
  isExpired,
  round2,
  todayKey,
  type Batch,
  type Customer,
  type Medicine,
  type PharmacySettings,
  type Purchase,
  type PurchaseReturn,
  type Sale,
  type SaleReturn,
  type Supplier,
} from "./types";
import { billTotals, saleDue, sellableStock } from "./calc";

export type DateRange = { from: string; to: string };

export function withinRange(date: string, range: DateRange): boolean {
  return date >= range.from && date <= range.to;
}

export function salesInRange(sales: Sale[], range: DateRange): Sale[] {
  return sales.filter((sale) => withinRange(sale.date, range));
}

// ---------------------------------------------------------------------------
// Sales
// ---------------------------------------------------------------------------

export type SalesByDayRow = {
  date: string;
  bills: number;
  items: number;
  discount: number;
  tax: number;
  total: number;
};

export function salesByDay(sales: Sale[], range: DateRange): SalesByDayRow[] {
  const days = new Map<string, SalesByDayRow>();
  for (const sale of salesInRange(sales, range)) {
    const row = days.get(sale.date) ?? {
      date: sale.date,
      bills: 0,
      items: 0,
      discount: 0,
      tax: 0,
      total: 0,
    };
    row.bills += 1;
    row.items += sale.lines.reduce((sum, line) => sum + line.quantity, 0);
    row.discount = round2(row.discount + sale.discount);
    row.tax = round2(row.tax + sale.taxTotal);
    row.total = round2(row.total + sale.total);
    days.set(sale.date, row);
  }
  return [...days.values()].sort((a, b) => b.date.localeCompare(a.date));
}

export function salesByMonth(sales: Sale[], range: DateRange): SalesByDayRow[] {
  const months = new Map<string, SalesByDayRow>();
  for (const sale of salesInRange(sales, range)) {
    const key = sale.date.slice(0, 7);
    const row = months.get(key) ?? {
      date: key,
      bills: 0,
      items: 0,
      discount: 0,
      tax: 0,
      total: 0,
    };
    row.bills += 1;
    row.items += sale.lines.reduce((sum, line) => sum + line.quantity, 0);
    row.discount = round2(row.discount + sale.discount);
    row.tax = round2(row.tax + sale.taxTotal);
    row.total = round2(row.total + sale.total);
    months.set(key, row);
  }
  return [...months.values()].sort((a, b) => b.date.localeCompare(a.date));
}

export type PaymentModeRow = { mode: string; bills: number; total: number; collected: number };

export function salesByPaymentMode(sales: Sale[], range: DateRange): PaymentModeRow[] {
  const modes = new Map<string, PaymentModeRow>();
  for (const sale of salesInRange(sales, range)) {
    const row = modes.get(sale.paymentMode) ?? {
      mode: sale.paymentMode || "—",
      bills: 0,
      total: 0,
      collected: 0,
    };
    row.bills += 1;
    row.total = round2(row.total + sale.total);
    row.collected = round2(row.collected + (sale.paid || 0));
    modes.set(sale.paymentMode, row);
  }
  return [...modes.values()].sort((a, b) => b.total - a.total);
}

// ---------------------------------------------------------------------------
// Margin and movers
// ---------------------------------------------------------------------------

export type MarginRow = {
  medicineId: string;
  name: string;
  quantity: number;
  revenue: number;
  cost: number;
  margin: number;
  marginPct: number;
};

/**
 * Margin per medicine, over a window.
 *
 * Cost comes off the batch the line actually sold from, which is the whole
 * point of holding stock per batch: the same strip bought on two invoices at
 * two rates has two different margins, and averaging them would hide the one
 * the shop is losing money on.
 *
 * A batch deleted since the sale contributes zero cost rather than dropping the
 * row — a missing cost overstates margin, but a missing sale understates
 * revenue, and the revenue figure is the one that gets checked against the till.
 */
export function marginByMedicine(
  sales: Sale[],
  batches: Batch[],
  range: DateRange
): MarginRow[] {
  const batchById = new Map(batches.map((batch) => [batch.id, batch]));
  const rows = new Map<string, MarginRow>();

  for (const sale of salesInRange(sales, range)) {
    // The bill discount is spread across lines in proportion to value, the same
    // way tax is, so a heavy discount does not land entirely on one medicine.
    const gross = sale.lines.reduce((sum, line) => sum + line.amount, 0);
    const ratio = gross > 0 ? sale.discount / gross : 0;
    for (const line of sale.lines) {
      const row = rows.get(line.medicineId) ?? {
        medicineId: line.medicineId,
        name: line.name,
        quantity: 0,
        revenue: 0,
        cost: 0,
        margin: 0,
        marginPct: 0,
      };
      row.quantity += line.quantity;
      row.revenue = round2(row.revenue + line.amount * (1 - ratio));
      row.cost = round2(row.cost + (batchById.get(line.batchId)?.effectiveRate ?? 0) * line.quantity);
      rows.set(line.medicineId, row);
    }
  }

  return [...rows.values()]
    .map((row) => {
      const margin = round2(row.revenue - row.cost);
      return {
        ...row,
        margin,
        marginPct: row.revenue > 0 ? round2((margin / row.revenue) * 100) : 0,
      };
    })
    .sort((a, b) => b.margin - a.margin);
}

export function marginTotals(rows: MarginRow[]) {
  const revenue = round2(rows.reduce((sum, row) => sum + row.revenue, 0));
  const cost = round2(rows.reduce((sum, row) => sum + row.cost, 0));
  const margin = round2(revenue - cost);
  return {
    revenue,
    cost,
    margin,
    marginPct: revenue > 0 ? round2((margin / revenue) * 100) : 0,
  };
}

/** Fast and slow movers: units sold over the window, per medicine. */
export function movers(sales: Sale[], range: DateRange): { medicineId: string; name: string; quantity: number; revenue: number }[] {
  const rows = new Map<string, { medicineId: string; name: string; quantity: number; revenue: number }>();
  for (const sale of salesInRange(sales, range)) {
    for (const line of sale.lines) {
      const row = rows.get(line.medicineId) ?? {
        medicineId: line.medicineId,
        name: line.name,
        quantity: 0,
        revenue: 0,
      };
      row.quantity += line.quantity;
      row.revenue = round2(row.revenue + line.amount);
      rows.set(line.medicineId, row);
    }
  }
  return [...rows.values()].sort((a, b) => b.quantity - a.quantity);
}

/** Units of one medicine sold over the last `days` days — the velocity figure. */
export function velocity(sales: Sale[], medicineId: string, days: number, today = todayKey()): number {
  const from = new Date(today);
  from.setDate(from.getDate() - days);
  const fromKey = `${from.getFullYear()}-${`${from.getMonth() + 1}`.padStart(2, "0")}-${`${from.getDate()}`.padStart(2, "0")}`;
  return sales
    .filter((sale) => sale.date >= fromKey && sale.date <= today)
    .reduce(
      (sum, sale) =>
        sum +
        sale.lines
          .filter((line) => line.medicineId === medicineId)
          .reduce((lineSum, line) => lineSum + line.quantity, 0),
      0
    );
}

// ---------------------------------------------------------------------------
// Stock
// ---------------------------------------------------------------------------

export type ReorderRow = {
  medicine: Medicine;
  available: number;
  /** Where it was last bought, so the order list can be grouped. */
  supplierId: string | null;
  soldLast30: number;
};

/**
 * What to order, grouped by who to order it from.
 *
 * The supplier is taken from the medicine's most recent batch rather than a
 * field on the medicine, because that is the only record of who actually
 * supplies it — and a chemist who switched distributor last month wants the new
 * one on the list, not the one on file from a year ago.
 */
export function reorderList(
  medicines: Medicine[],
  batches: Batch[],
  sales: Sale[],
  settings: PharmacySettings,
  today = todayKey()
): ReorderRow[] {
  const latestSupplier = new Map<string, string | null>();
  for (const batch of [...batches].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    latestSupplier.set(batch.medicineId, batch.supplierId);
  }

  return medicines
    .filter((medicine) => medicine.active)
    .map((medicine) => ({
      medicine,
      available: sellableStock(batches, medicine.id, settings, today),
      supplierId: latestSupplier.get(medicine.id) ?? null,
      soldLast30: velocity(sales, medicine.id, 30, today),
    }))
    .filter((row) => row.available <= (row.medicine.lowStockAt || 0))
    .sort((a, b) => a.available - b.available);
}

// ---------------------------------------------------------------------------
// GST
// ---------------------------------------------------------------------------

export type GstRow = { rate: number; taxable: number; cgst: number; sgst: number; tax: number };

/**
 * GST summary by rate, for the return.
 *
 * Rebuilt from each bill's own lines rather than from its stored tax total, so
 * a settings change between then and now cannot retrospectively move a figure
 * that has already been filed against.
 */
export function gstSummary(sales: Sale[], range: DateRange, taxInclusive: boolean): GstRow[] {
  const rows = new Map<number, GstRow>();
  for (const sale of salesInRange(sales, range)) {
    const totals = billTotals(sale.lines, sale.discount, taxInclusive);
    for (const bucket of totals.byRate) {
      const row = rows.get(bucket.rate) ?? {
        rate: bucket.rate,
        taxable: 0,
        cgst: 0,
        sgst: 0,
        tax: 0,
      };
      row.taxable = round2(row.taxable + bucket.taxable);
      row.cgst = round2(row.cgst + bucket.cgst);
      row.sgst = round2(row.sgst + bucket.sgst);
      row.tax = round2(row.tax + bucket.tax);
      rows.set(bucket.rate, row);
    }
  }
  return [...rows.values()].sort((a, b) => a.rate - b.rate);
}

// ---------------------------------------------------------------------------
// Schedule H / H1 register
// ---------------------------------------------------------------------------

export type RegisterRow = {
  date: string;
  invoiceNo: string;
  patientName: string;
  doctorName: string;
  doctorRegNo: string;
  medicine: string;
  schedule: string;
  batchNo: string;
  expiry: string;
  quantity: number;
};

/**
 * Every scheduled sale in a window, one row per medicine.
 *
 * Only medicines whose class is in `classes` appear — an inspector asking for
 * the H1 register does not want the whole day's paracetamol in it. Bills whose
 * prescription was never captured still appear, with the doctor columns empty,
 * because a register that quietly omits them would hide exactly the gap it
 * exists to reveal.
 */
export function scheduleRegister(
  sales: Sale[],
  medicines: Medicine[],
  range: DateRange,
  classes: string[]
): RegisterRow[] {
  const medicineById = new Map(medicines.map((medicine) => [medicine.id, medicine]));
  const rows: RegisterRow[] = [];
  for (const sale of salesInRange(sales, range)) {
    for (const line of sale.lines) {
      const schedule = medicineById.get(line.medicineId)?.schedule ?? "";
      if (!schedule || !classes.includes(schedule)) continue;
      rows.push({
        date: sale.date,
        invoiceNo: sale.invoiceNo,
        patientName: sale.prescription?.patientName ?? "",
        doctorName: sale.prescription?.doctorName ?? "",
        doctorRegNo: sale.prescription?.doctorRegNo ?? "",
        medicine: line.name,
        schedule: SCHEDULE_LABELS[schedule],
        batchNo: line.batchNo,
        expiry: formatExpiry(line.expiry),
        quantity: line.quantity,
      });
    }
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date) || a.invoiceNo.localeCompare(b.invoiceNo));
}

// ---------------------------------------------------------------------------
// Suppliers and customers
// ---------------------------------------------------------------------------

export type SupplierRow = {
  supplier: Supplier | null;
  purchases: number;
  purchased: number;
  paid: number;
  returned: number;
  outstanding: number;
};

/**
 * Supplier-wise purchases and what is still owed.
 *
 * Purchase returns net off the outstanding, because stock sent back to a
 * distributor is settled against the next invoice rather than refunded — which
 * is how the shop's own ledger with them actually works.
 */
export function supplierSummary(
  suppliers: Supplier[],
  purchases: Purchase[],
  purchaseReturns: PurchaseReturn[],
  range: DateRange
): SupplierRow[] {
  const rows = new Map<string, SupplierRow>();
  const rowFor = (id: string) =>
    rows.get(id) ?? {
      supplier: suppliers.find((supplier) => supplier.id === id) ?? null,
      purchases: 0,
      purchased: 0,
      paid: 0,
      returned: 0,
      outstanding: 0,
    };

  for (const purchase of purchases) {
    if (!withinRange(purchase.date, range)) continue;
    const row = rowFor(purchase.supplierId);
    row.purchases += 1;
    row.purchased = round2(row.purchased + purchase.total);
    row.paid = round2(row.paid + purchase.paid);
    rows.set(purchase.supplierId, row);
  }
  for (const record of purchaseReturns) {
    if (!withinRange(record.date, range)) continue;
    const row = rowFor(record.supplierId);
    row.returned = round2(row.returned + record.total);
    rows.set(record.supplierId, row);
  }

  return [...rows.values()]
    .map((row) => ({
      ...row,
      outstanding: round2(Math.max(0, row.purchased - row.paid - row.returned)),
    }))
    .sort((a, b) => b.outstanding - a.outstanding);
}

export type CustomerDueRow = {
  customer: Customer;
  bills: number;
  billed: number;
  paid: number;
  returned: number;
  due: number;
};

/** What each customer still owes, net of anything they brought back. */
export function customerDues(
  customers: Customer[],
  sales: Sale[],
  saleReturns: SaleReturn[]
): CustomerDueRow[] {
  const returnBySale = new Map<string, number>();
  for (const record of saleReturns) {
    returnBySale.set(record.saleId, (returnBySale.get(record.saleId) ?? 0) + record.total);
  }

  return customers
    .map((customer) => {
      const own = sales.filter((sale) => sale.customerId === customer.id);
      const billed = round2(own.reduce((sum, sale) => sum + sale.total, 0));
      const paid = round2(own.reduce((sum, sale) => sum + (sale.paid || 0), 0));
      const returned = round2(
        own.reduce((sum, sale) => sum + (returnBySale.get(sale.id) ?? 0), 0)
      );
      return {
        customer,
        bills: own.length,
        billed,
        paid,
        returned,
        due: round2(Math.max(0, billed - paid - returned)),
      };
    })
    .sort((a, b) => b.due - a.due);
}

/** One customer's bills, newest first — the ledger view. */
export function customerLedger(sales: Sale[], customerId: string) {
  return sales
    .filter((sale) => sale.customerId === customerId)
    .map((sale) => ({ sale, due: saleDue(sale) }))
    .sort((a, b) => b.sale.date.localeCompare(a.sale.date));
}

/** Batches whose stock is dead: expired and still on the shelf. */
export function expiredStock(batches: Batch[], today = todayKey()): Batch[] {
  return batches.filter((batch) => batch.quantity > 0 && isExpired(batch.expiry, today));
}
