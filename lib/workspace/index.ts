// Shared Business Workspace API (Business Toolkit ecosystem).
//
// Every tool on the site (Invoice Generator, QR Menu, UPI QR, calculators…)
// should read business data through this layer instead of importing POS
// internals — the POS is the primary data creator, but tools stay
// independent and must keep working when no workspace exists yet.
//
// Backed by the same IndexedDB database the POS created (POS_DATABASE);
// that database *is* the workspace store. Tools should ask the user before
// connecting (permission-based access), then call these functions.

import { dbBatch, dbGetAll } from "@/lib/pos/db";
import {
  DEFAULT_SETTINGS,
  generateId,
  nowIso,
  type Business,
  type Category,
  type Customer,
  type InventoryLog,
  type Order,
  type OrderItem,
  type PaymentMethod,
  type PosSettings,
  type Product,
} from "@/lib/pos/types";

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
};

export async function getBusiness(): Promise<Business | null> {
  const rows = await dbGetAll<Business>("business");
  return rows.find((b) => b.id === "main") ?? null;
}

/** True when a business workspace has been set up on this device. */
export async function hasWorkspace(): Promise<boolean> {
  return (await getBusiness()) !== null;
}

export async function getProducts(): Promise<Product[]> {
  return dbGetAll<Product>("products");
}

export async function getCategories(): Promise<Category[]> {
  return dbGetAll<Category>("categories");
}

export async function getCustomers(): Promise<Customer[]> {
  return dbGetAll<Customer>("customers");
}

export async function getOrders(): Promise<Order[]> {
  return dbGetAll<Order>("orders");
}

export async function getOrderItems(): Promise<OrderItem[]> {
  return dbGetAll<OrderItem>("order_items");
}

export async function getInventory(): Promise<InventoryLog[]> {
  return dbGetAll<InventoryLog>("inventory");
}

export async function getPaymentMethods(): Promise<PaymentMethod[]> {
  return dbGetAll<PaymentMethod>("payments");
}

export async function getSettings(): Promise<PosSettings> {
  const rows = await dbGetAll<PosSettings>("settings");
  const stored = rows.find((s) => s.id === "main");
  return stored ? { ...DEFAULT_SETTINGS, ...stored } : DEFAULT_SETTINGS;
}

/**
 * Adjust a product's stock from outside the POS (e.g. an invoice tool
 * recording a sale). Records the movement in the inventory log.
 */
export async function updateStock(
  productId: string,
  change: number,
  note = ""
): Promise<void> {
  const products = await getProducts();
  const product = products.find((p) => p.id === productId);
  if (!product) throw new Error("Product not found in the workspace.");
  const stockAfter = product.stock + change;
  const updated: Product = { ...product, trackStock: true, stock: stockAfter, updatedAt: nowIso() };
  const log: InventoryLog = {
    id: generateId(),
    productId,
    productName: product.name,
    type: change >= 0 ? "add" : "reduce",
    change,
    stockAfter,
    note,
    createdAt: nowIso(),
  };
  await dbBatch({ products: [updated], inventory: [log] });
}
