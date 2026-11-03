// Batch & expiry tracking for the Browser POS (optional, off by default).
//
// When PosSettings.batchTracking is off nothing here runs and the POS works
// exactly as before: one stock number and one cost price per product.
//
// When it is on, a tracked product's stock is split into batches — each with
// its own batch number, expiry and cost. Two rules keep the data honest:
//
//   1. product.stock stays the single stock number every screen and tool
//      reads. Batches only say WHICH units those are.
//   2. The sum of a product's batch quantities is kept equal to its stock by
//      reconcileBatches(). Anything that changes stock without naming a batch
//      (an older tool, a sheet restore, a manual edit) is absorbed: extra units
//      land in an "Opening stock" batch, missing units come out of the batch
//      that expires first. So the two numbers can never drift apart for long.
//
// Sales take stock from the batch that expires first (FEFO), unless the
// cashier picked a batch, and the order line records which batches it used
// and what they cost — that is what makes per-batch cost of goods possible.
//
// Everything here is pure: it takes records in and hands back the records to
// write, so it can be unit tested without IndexedDB.

import { generateId, nowIso, type Product } from "./types";

export type StockBatch = {
  id: string;
  productId: string;
  /** Supplier's batch / lot number; "" when not known. */
  batchNo: string;
  /** Expiry date "yyyy-mm-dd"; "" = no expiry. */
  expiry: string;
  /** Cost per unit for this batch; null = use the product's cost price. */
  costPrice: number | null;
  /** Units of this batch still in stock. */
  quantity: number;
  /** Day the batch came in, "yyyy-mm-dd". */
  receivedAt: string;
  /** Purchase Register entry that brought it in, if any. */
  purchaseId: string | null;
  /** True for the catch-all batch that holds stock with no batch details. */
  opening?: boolean;
  /** Selling price for units of this batch; null/absent = product's selling price. */
  sellingPrice?: number | null;
  /** Tax % on this batch's selling price; null/absent = product's tax. */
  taxRate?: number | null;
  /** Whether that selling price already includes the tax. */
  taxInclusive?: boolean;
  /** Supplier takes it back until this day ("yyyy-mm-dd"), from the purchase. */
  returnBy?: string;
  returnType?: "replacement" | "credit-note";
  note: string;
  createdAt: string;
  updatedAt: string;
};

/** Which batch units of an order line came from. Saved on the order item. */
export type BatchAllocation = {
  batchId: string;
  batchNo: string;
  expiry: string;
  quantity: number;
  /** Cost per unit at the time of sale; null when neither batch nor product had one. */
  unitCost: number | null;
};

export type NewBatchInput = {
  batchNo?: string;
  expiry?: string;
  costPrice?: number | null;
  receivedAt?: string;
  purchaseId?: string | null;
  note?: string;
  sellingPrice?: number | null;
  taxRate?: number | null;
  taxInclusive?: boolean;
  returnBy?: string;
  returnType?: "replacement" | "credit-note";
};

export const EXPIRY_SOON_DAYS = 30;

const todayIso = () => new Date().toISOString().slice(0, 10);

/** Batches in the order stock should leave: earliest expiry first, no-expiry last, then oldest. */
export function sortFefo(batches: StockBatch[]): StockBatch[] {
  return [...batches].sort((a, b) => {
    if (a.expiry !== b.expiry) {
      if (!a.expiry) return 1;
      if (!b.expiry) return -1;
      return a.expiry.localeCompare(b.expiry);
    }
    return (
      a.receivedAt.localeCompare(b.receivedAt) || a.createdAt.localeCompare(b.createdAt)
    );
  });
}

/** In-stock batches of one product, in FEFO order. */
export function batchesFor(batches: StockBatch[], productId: string): StockBatch[] {
  return sortFefo(batches.filter((b) => b.productId === productId && b.quantity > 0));
}

export function batchTotal(batches: StockBatch[], productId: string): number {
  return batches.reduce((s, b) => (b.productId === productId && b.quantity > 0 ? s + b.quantity : s), 0);
}

export function makeBatch(product: Product, quantity: number, input: NewBatchInput = {}): StockBatch {
  const now = nowIso();
  return {
    id: generateId(),
    productId: product.id,
    batchNo: (input.batchNo ?? "").trim(),
    expiry: input.expiry ?? "",
    costPrice: input.costPrice ?? product.costPrice ?? null,
    quantity,
    receivedAt: input.receivedAt ?? now.slice(0, 10),
    purchaseId: input.purchaseId ?? null,
    note: input.note ?? "",
    ...(input.sellingPrice != null ? { sellingPrice: input.sellingPrice } : {}),
    ...(input.taxRate != null ? { taxRate: input.taxRate, taxInclusive: input.taxInclusive ?? false } : {}),
    ...(input.returnBy ? { returnBy: input.returnBy } : {}),
    ...(input.returnType ? { returnType: input.returnType } : {}),
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Take `quantity` units of a product out of its batches. A picked batch goes
 * first, then FEFO. Returns the allocations, the batches to write back, and
 * how many units no batch could cover (stock may already be below zero).
 */
export function allocate(
  batches: StockBatch[],
  product: Product,
  quantity: number,
  preferredBatchId?: string | null,
): { allocations: BatchAllocation[]; updated: StockBatch[]; shortfall: number } {
  const own = batchesFor(batches, product.id);
  const ordered = preferredBatchId
    ? [...own.filter((b) => b.id === preferredBatchId), ...own.filter((b) => b.id !== preferredBatchId)]
    : own;

  const allocations: BatchAllocation[] = [];
  const updated: StockBatch[] = [];
  let left = quantity;
  const now = nowIso();
  for (const batch of ordered) {
    if (left <= 0) break;
    const take = Math.min(batch.quantity, left);
    if (take <= 0) continue;
    left -= take;
    allocations.push({
      batchId: batch.id,
      batchNo: batch.batchNo,
      expiry: batch.expiry,
      quantity: take,
      unitCost: batch.costPrice ?? product.costPrice ?? null,
    });
    updated.push({ ...batch, quantity: batch.quantity - take, updatedAt: now });
  }
  return { allocations, updated, shortfall: left };
}

/** Put units back into the batches they came from (a cancelled sale). */
export function restoreAllocations(
  batches: StockBatch[],
  product: Product,
  allocations: BatchAllocation[],
): StockBatch[] {
  const now = nowIso();
  const out: StockBatch[] = [];
  for (const a of allocations) {
    const existing = out.find((b) => b.id === a.batchId) ?? batches.find((b) => b.id === a.batchId);
    if (existing) {
      const next = { ...existing, quantity: existing.quantity + a.quantity, updatedAt: now };
      const i = out.findIndex((b) => b.id === a.batchId);
      if (i >= 0) out[i] = next;
      else out.push(next);
    } else {
      // The batch was deleted since the sale — bring it back with its details.
      out.push({
        ...makeBatch(product, a.quantity, {
          batchNo: a.batchNo,
          expiry: a.expiry,
          costPrice: a.unitCost,
          note: "Returned from a cancelled sale",
        }),
        id: a.batchId,
      });
    }
  }
  return out;
}

/** Weighted cost per unit of an allocation set; null when nothing had a cost. */
export function allocationUnitCost(allocations: BatchAllocation[], fallback: number | null): number | null {
  const qty = allocations.reduce((s, a) => s + a.quantity, 0);
  if (qty <= 0) return fallback;
  let total = 0;
  for (const a of allocations) {
    const cost = a.unitCost ?? fallback;
    if (cost === null) return fallback;
    total += cost * a.quantity;
  }
  return Math.round((total / qty) * 10000) / 10000;
}

/**
 * Bring a product's batches back in line with its stock. Returns only the
 * batches that changed. Untracked products and products with no stock need
 * no batches, so nothing is created for them.
 */
export function reconcileBatches(product: Product, batches: StockBatch[]): StockBatch[] {
  if (!product.trackStock) return [];
  const target = Math.max(product.stock, 0);
  const own = batches.filter((b) => b.productId === product.id);
  const total = own.reduce((s, b) => s + Math.max(b.quantity, 0), 0);
  if (total === target) return [];

  if (total < target) {
    const diff = target - total;
    const opening = own.find((b) => b.opening);
    if (opening) {
      return [{ ...opening, quantity: Math.max(opening.quantity, 0) + diff, updatedAt: nowIso() }];
    }
    return [{ ...makeBatch(product, diff, { note: "Opening stock" }), opening: true }];
  }

  return allocate(batches, product, total - target).updated;
}

/** Reconcile every product at once (turning the feature on, after a restore). */
export function reconcileAll(products: Product[], batches: StockBatch[]): StockBatch[] {
  const changes: StockBatch[] = [];
  for (const product of products) changes.push(...reconcileBatches(product, batches));
  return changes;
}

export type ExpiryStatus = "expired" | "soon" | "ok" | "none";

export function expiryStatus(expiry: string, today = todayIso(), soonDays = EXPIRY_SOON_DAYS): ExpiryStatus {
  if (!expiry) return "none";
  if (expiry < today) return "expired";
  const soon = new Date(`${today}T00:00:00Z`);
  soon.setUTCDate(soon.getUTCDate() + soonDays);
  return expiry <= soon.toISOString().slice(0, 10) ? "soon" : "ok";
}

/** Short label for a batch in pickers and lists. */
export function batchLabel(batch: Pick<StockBatch, "batchNo" | "expiry" | "opening">): string {
  const name = batch.batchNo || (batch.opening ? "Opening stock" : "No batch no.");
  return batch.expiry ? `${name} · exp ${batch.expiry}` : name;
}

/** Apply a list of changed batches to the current list (by id). */
export function mergeBatches(current: StockBatch[], changed: StockBatch[]): StockBatch[] {
  if (changed.length === 0) return current;
  const byId = new Map(changed.map((b) => [b.id, b]));
  const merged = current.map((b) => byId.get(b.id) ?? b);
  for (const b of changed) if (!current.some((c) => c.id === b.id)) merged.push(b);
  return merged;
}
