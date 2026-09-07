// The arithmetic and the stock rules of the pharmacy.
//
// Two things live here that the POS has no equivalent of: FEFO allocation,
// which decides which physical strip a sale comes off, and the expiry bucketing
// that turns a shelf full of dates into a number the owner can act on. The rest
// is cart maths adapted for a trade where the printed MRP already includes tax.

import {
  CREDIT_MODE,
  daysToExpiry,
  expiryLastDay,
  isExpired,
  round2,
  todayKey,
  type Batch,
  type Medicine,
  type PharmacyCartLine,
  type PharmacySettings,
  type PurchaseLine,
  type Sale,
  type SaleLine,
} from "./types";

// ---------------------------------------------------------------------------
// Line and bill totals
// ---------------------------------------------------------------------------

/** What one line comes to after its own discount, before any bill discount. */
export function lineAmount(line: {
  rate: number;
  quantity: number;
  discountPct: number;
}): number {
  const gross = (line.rate || 0) * (line.quantity || 0);
  const pct = Math.min(Math.max(line.discountPct || 0, 0), 100);
  return round2(gross * (1 - pct / 100));
}

export type BillTotals = {
  subtotal: number;
  discount: number;
  /** Tax contained in (inclusive) or added to (exclusive) the bill. */
  taxTotal: number;
  cgst: number;
  sgst: number;
  total: number;
  itemCount: number;
  /** Tax broken down by rate, for the GST summary and the printed bill. */
  byRate: { rate: number; taxable: number; tax: number; cgst: number; sgst: number }[];
};

/**
 * Bill maths.
 *
 * The bill discount is a flat rupee figure — the spec gives `discount` as a
 * single number, and a chemist knocking off the change on a ₹247 bill is
 * thinking "make it 245", not "give me 0.81%". It is spread across the lines in
 * proportion to their value so that each tax rate is reduced fairly, which
 * matters because a bill routinely mixes 5% and 12% items.
 *
 * When `taxInclusive` — the pharma default, because MRP is a printed
 * tax-inclusive price — tax is BACKED OUT of the line amounts rather than added
 * to them. The customer pays the MRP either way; what changes is what the GST
 * return has to show.
 */
export function billTotals(
  lines: { rate: number; quantity: number; discountPct: number; taxRate: number }[],
  discount: number,
  taxInclusive: boolean
): BillTotals {
  const amounts = lines.map((line) => lineAmount(line));
  const subtotal = round2(amounts.reduce((sum, amount) => sum + amount, 0));
  const billDiscount = round2(Math.min(Math.max(discount || 0, 0), subtotal));
  const discountRatio = subtotal > 0 ? billDiscount / subtotal : 0;

  const buckets = new Map<number, { taxable: number; tax: number }>();
  for (const [index, line] of lines.entries()) {
    const rate = line.taxRate || 0;
    const net = amounts[index] * (1 - discountRatio);
    const bucket = buckets.get(rate) ?? { taxable: 0, tax: 0 };
    if (rate > 0) {
      if (taxInclusive) {
        const tax = (net * rate) / (100 + rate);
        bucket.tax += tax;
        bucket.taxable += net - tax;
      } else {
        bucket.tax += (net * rate) / 100;
        bucket.taxable += net;
      }
    } else {
      bucket.taxable += net;
    }
    buckets.set(rate, bucket);
  }

  const byRate = [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([rate, bucket]) => {
      const tax = round2(bucket.tax);
      const half = round2(tax / 2);
      return {
        rate,
        taxable: round2(bucket.taxable),
        tax,
        cgst: half,
        // The second half absorbs the rounding, so CGST + SGST is always the
        // tax figure printed on the bill rather than a paisa off it.
        sgst: round2(tax - half),
      };
    });

  const taxTotal = round2(byRate.reduce((sum, row) => sum + row.tax, 0));
  const cgst = round2(byRate.reduce((sum, row) => sum + row.cgst, 0));
  const sgst = round2(taxTotal - cgst);
  const total = round2(taxInclusive ? subtotal - billDiscount : subtotal - billDiscount + taxTotal);
  const itemCount = lines.reduce((sum, line) => sum + (line.quantity || 0), 0);

  return { subtotal, discount: billDiscount, taxTotal, cgst, sgst, total, itemCount, byRate };
}

export function cartTotals(
  lines: PharmacyCartLine[],
  discount: number,
  settings: PharmacySettings
): BillTotals {
  return billTotals(lines, discount, settings.taxInclusive);
}

/** Cart lines frozen into the sale lines that get stored and printed. */
export function toSaleLines(lines: PharmacyCartLine[]): SaleLine[] {
  return lines.map((line) => ({
    id: line.id,
    medicineId: line.medicineId,
    batchId: line.batchId,
    name: line.name,
    batchNo: line.batchNo,
    expiry: line.expiry,
    quantity: line.quantity,
    mrp: line.mrp,
    rate: line.rate,
    discountPct: line.discountPct,
    taxRate: line.taxRate,
    amount: lineAmount(line),
  }));
}

// ---------------------------------------------------------------------------
// Batches: what is sellable, and FEFO
// ---------------------------------------------------------------------------

/** Why a batch cannot be billed, or "" when it can. */
export function batchBlockReason(
  batch: Batch,
  settings: PharmacySettings,
  today: string = todayKey()
): "" | "expired" | "near-expiry" | "empty" {
  if (batch.quantity <= 0) return "empty";
  // Already-expired stock is never sellable, whatever the settings say.
  if (isExpired(batch.expiry, today)) return "expired";
  const block = settings.blockExpiryWithinDays || 0;
  if (block > 0 && daysToExpiry(batch.expiry, today) < block) return "near-expiry";
  return "";
}

/**
 * FEFO order: first expiry, first out.
 *
 * Tie-broken by the older batch, so two lots that expire the same month leave
 * the shelf in the order they arrived on it.
 */
export function fefoSort(batches: Batch[]): Batch[] {
  return [...batches].sort((a, b) => {
    const byExpiry = (a.expiry || "9999-99").localeCompare(b.expiry || "9999-99");
    if (byExpiry !== 0) return byExpiry;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

export function batchesForMedicine(batches: Batch[], medicineId: string): Batch[] {
  return fefoSort(batches.filter((batch) => batch.medicineId === medicineId));
}

/** Batches with stock left that this sale is allowed to draw from. */
export function sellableBatches(
  batches: Batch[],
  medicineId: string,
  settings: PharmacySettings,
  today: string = todayKey()
): Batch[] {
  return batchesForMedicine(batches, medicineId).filter(
    (batch) => batchBlockReason(batch, settings, today) === ""
  );
}

/** Units in hand across every batch of a medicine, expired stock included. */
export function totalStock(batches: Batch[], medicineId: string): number {
  return batches
    .filter((batch) => batch.medicineId === medicineId)
    .reduce((sum, batch) => sum + Math.max(0, batch.quantity), 0);
}

/** Units actually available to sell today. */
export function sellableStock(
  batches: Batch[],
  medicineId: string,
  settings: PharmacySettings,
  today: string = todayKey()
): number {
  return sellableBatches(batches, medicineId, settings, today).reduce(
    (sum, batch) => sum + batch.quantity,
    0
  );
}

export type FefoAllocation = { batch: Batch; quantity: number };

export type FefoResult = {
  allocations: FefoAllocation[];
  /** Units that could not be sourced from any sellable batch. */
  shortfall: number;
};

/**
 * Spread a quantity down the FEFO order, one allocation per batch.
 *
 * A counter asking for 20 tablets when the oldest batch has 12 left is the
 * normal case, not an edge case — strips get cut. Rather than make the operator
 * notice and split the line by hand, the allocation cascades: 12 off the batch
 * expiring first, 8 off the next, each landing as its own cart line carrying its
 * own batch number and expiry, because that is what has to print on the bill.
 *
 * `committed` is what the cart already holds per batch, so adding the same
 * medicine twice does not promise the same twelve tablets to both lines.
 */
export function allocateFefo(
  batches: Batch[],
  medicineId: string,
  quantity: number,
  settings: PharmacySettings,
  committed: Map<string, number> = new Map(),
  today: string = todayKey()
): FefoResult {
  let remaining = Math.max(0, Math.floor(quantity));
  const allocations: FefoAllocation[] = [];

  for (const batch of sellableBatches(batches, medicineId, settings, today)) {
    if (remaining <= 0) break;
    const free = batch.quantity - (committed.get(batch.id) ?? 0);
    if (free <= 0) continue;
    const take = Math.min(free, remaining);
    allocations.push({ batch, quantity: take });
    remaining -= take;
  }

  return { allocations, shortfall: remaining };
}

/** How much of each batch a set of cart lines has already claimed. */
export function committedByBatch(lines: PharmacyCartLine[]): Map<string, number> {
  const committed = new Map<string, number>();
  for (const line of lines) {
    committed.set(line.batchId, (committed.get(line.batchId) ?? 0) + line.quantity);
  }
  return committed;
}

// ---------------------------------------------------------------------------
// Purchase costing
// ---------------------------------------------------------------------------

/** What a purchase line actually costs after its discount, for the paid units. */
export function purchaseLineNet(line: PurchaseLine): number {
  const gross = (line.purchaseRate || 0) * (line.quantity || 0);
  const pct = Math.min(Math.max(line.discountPct || 0, 0), 100);
  return round2(gross * (1 - pct / 100));
}

/**
 * Blended cost per unit once the scheme goods are counted.
 *
 * "10+1" means eleven strips on the shelf and ten on the invoice. Reporting
 * margin against the invoice rate would understate it on every fast-moving line
 * in the shop, which is exactly where the scheme goods are. The rate as paid is
 * kept on the batch as well, so the invoice can still be reconciled.
 */
export function effectiveRate(line: PurchaseLine): number {
  const units = (line.quantity || 0) + (line.freeQuantity || 0);
  if (units <= 0) return 0;
  return round2(purchaseLineNet(line) / units);
}

export type PurchaseTotals = {
  subtotal: number;
  discount: number;
  taxTotal: number;
  total: number;
  /** Units added to stock, free goods included. */
  units: number;
};

/**
 * Distributor invoice totals.
 *
 * Purchase tax is always added on top: a distributor bills at rate plus GST,
 * whatever the shop's own MRP convention is. The running total exists so the
 * operator can check it against the paper invoice before saving, and a mismatch
 * there is nearly always a typo in a rate.
 */
export function purchaseTotals(lines: PurchaseLine[], discount: number): PurchaseTotals {
  const subtotal = round2(lines.reduce((sum, line) => sum + purchaseLineNet(line), 0));
  const billDiscount = round2(Math.min(Math.max(discount || 0, 0), subtotal));
  const discountRatio = subtotal > 0 ? billDiscount / subtotal : 0;
  const taxTotal = round2(
    lines.reduce((sum, line) => {
      const net = purchaseLineNet(line) * (1 - discountRatio);
      return sum + (net * (line.taxRate || 0)) / 100;
    }, 0)
  );
  const units = lines.reduce(
    (sum, line) => sum + (line.quantity || 0) + (line.freeQuantity || 0),
    0
  );
  return {
    subtotal,
    discount: billDiscount,
    taxTotal,
    total: round2(subtotal - billDiscount + taxTotal),
    units,
  };
}

// ---------------------------------------------------------------------------
// Expiry — the differentiator
// ---------------------------------------------------------------------------

export type ExpiryBucket = {
  /** Days ahead this bucket covers; -1 is the already-expired bucket. */
  days: number;
  label: string;
  batches: Batch[];
  /** Money at risk, at what the stock actually cost. */
  valueAtCost: number;
  valueAtMrp: number;
  units: number;
};

/**
 * Group stock into "expired", then each configured window.
 *
 * Buckets are exclusive and ordered, so a batch expiring in 20 days lands in
 * "30 days" and nowhere else — a batch counted in three buckets at once turns
 * "₹18,400 at risk" into a number nobody trusts.
 */
export function expiryBuckets(
  batches: Batch[],
  windows: number[],
  today: string = todayKey()
): ExpiryBucket[] {
  const sorted = [...windows].filter((days) => days > 0).sort((a, b) => a - b);
  const buckets: ExpiryBucket[] = [
    { days: -1, label: "Already expired", batches: [], valueAtCost: 0, valueAtMrp: 0, units: 0 },
    ...sorted.map((days) => ({
      days,
      label: `Expiring in ${days} days`,
      batches: [] as Batch[],
      valueAtCost: 0,
      valueAtMrp: 0,
      units: 0,
    })),
  ];

  for (const batch of batches) {
    if (batch.quantity <= 0) continue;
    const target = isExpired(batch.expiry, today)
      ? buckets[0]
      : buckets.find((bucket) => bucket.days > 0 && daysToExpiry(batch.expiry, today) <= bucket.days);
    if (!target) continue;
    target.batches.push(batch);
    target.units += batch.quantity;
    target.valueAtCost += batch.effectiveRate * batch.quantity;
    target.valueAtMrp += batch.mrp * batch.quantity;
  }

  for (const bucket of buckets) {
    bucket.batches = fefoSort(bucket.batches);
    bucket.valueAtCost = round2(bucket.valueAtCost);
    bucket.valueAtMrp = round2(bucket.valueAtMrp);
  }
  return buckets;
}

export type SupplierExpiryGroup = {
  supplierId: string | null;
  batches: Batch[];
  valueAtCost: number;
  units: number;
};

/**
 * Regroup a bucket by supplier, because returns go back supplier-wise.
 *
 * A distributor takes back what they sold and nothing else, so an expiry list
 * sorted by date is a list nobody can act on. Sorted by supplier it is a stack
 * of return notes.
 */
export function bySupplier(batches: Batch[]): SupplierExpiryGroup[] {
  const groups = new Map<string, SupplierExpiryGroup>();
  for (const batch of batches) {
    const key = batch.supplierId ?? "";
    const group = groups.get(key) ?? {
      supplierId: batch.supplierId,
      batches: [],
      valueAtCost: 0,
      units: 0,
    };
    group.batches.push(batch);
    group.units += batch.quantity;
    group.valueAtCost = round2(group.valueAtCost + batch.effectiveRate * batch.quantity);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => b.valueAtCost - a.valueAtCost);
}

// ---------------------------------------------------------------------------
// Sale-level helpers the screens and reports share
// ---------------------------------------------------------------------------

/** Unpaid balance on a bill. Credit sales are the ones that carry one. */
export function saleDue(sale: Sale): number {
  return round2(Math.max(0, sale.total - (sale.paid || 0)));
}

export function isCreditSale(sale: Sale): boolean {
  return sale.paymentMode === CREDIT_MODE || saleDue(sale) > 0;
}

/** Cost of goods on a bill, for margin. Falls back to 0 for a deleted batch. */
export function saleCost(sale: Sale, batchById: Map<string, Batch>): number {
  return round2(
    sale.lines.reduce((sum, line) => {
      const batch = batchById.get(line.batchId);
      return sum + (batch?.effectiveRate ?? 0) * line.quantity;
    }, 0)
  );
}

/** Stock value on hand. Expired stock is counted separately — it is not value. */
export function stockValue(batches: Batch[], today: string = todayKey()) {
  let atCost = 0;
  let atMrp = 0;
  let expiredAtCost = 0;
  for (const batch of batches) {
    if (batch.quantity <= 0) continue;
    if (isExpired(batch.expiry, today)) {
      expiredAtCost += batch.effectiveRate * batch.quantity;
      continue;
    }
    atCost += batch.effectiveRate * batch.quantity;
    atMrp += batch.mrp * batch.quantity;
  }
  return {
    atCost: round2(atCost),
    atMrp: round2(atMrp),
    expiredAtCost: round2(expiredAtCost),
  };
}

/** Medicines at or below their low-stock mark, counting sellable units only. */
export function lowStockMedicines(
  medicines: Medicine[],
  batches: Batch[],
  settings: PharmacySettings,
  today: string = todayKey()
): { medicine: Medicine; available: number }[] {
  return medicines
    .filter((medicine) => medicine.active)
    .map((medicine) => ({
      medicine,
      available: sellableStock(batches, medicine.id, settings, today),
    }))
    .filter((row) => row.available <= (row.medicine.lowStockAt || 0))
    .sort((a, b) => a.available - b.available);
}

/** Substitutes: same salt, different brand, with stock to offer. */
export function substitutesFor(
  medicine: Medicine,
  medicines: Medicine[],
  batches: Batch[],
  settings: PharmacySettings,
  today: string = todayKey()
): { medicine: Medicine; available: number; mrp: number }[] {
  const salt = medicine.composition.trim().toLowerCase();
  if (!salt) return [];
  return medicines
    .filter(
      (other) =>
        other.id !== medicine.id &&
        other.active &&
        other.composition.trim().toLowerCase() === salt
    )
    .map((other) => {
      const options = sellableBatches(batches, other.id, settings, today);
      return {
        medicine: other,
        available: options.reduce((sum, batch) => sum + batch.quantity, 0),
        mrp: options[0]?.mrp ?? 0,
      };
    })
    .sort((a, b) => b.available - a.available);
}

/** The last day a batch can be sold, for display next to an expiry month. */
export { expiryLastDay };
