"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { dbBatch, dbClearAll, dbGetAll, type StoreName } from "./db";
import {
  buildBackupFromSheetPull,
  buildTabPayloads,
  isValidSyncUrl,
  pullFromSheet,
  pushToSheet,
  testSheetConnection,
  type WorkspaceSnapshot,
} from "./sheetSync";
import { calculateCartTotals } from "./calc";
import type { LedgerEntry } from "@/lib/toolkit/types";
import {
  createBackup,
  downloadBackupFile,
  restoreBackup,
  type PosBackup,
} from "./backup";
import {
  DEFAULT_PAYMENT_METHODS,
  DEFAULT_SETTINGS,
  formatInvoiceNumber,
  generateId,
  nowIso,
  type Business,
  type CartLine,
  type Category,
  type Customer,
  type HeldCart,
  type InventoryLog,
  type InventoryLogType,
  type Order,
  type OrderItem,
  SYNC_SLICES,
  type PaymentMethod,
  type PosSettings,
  type Product,
  type SyncDirtyRow,
  type SyncSlice,
} from "./types";

export type PosStatus = "loading" | "welcome" | "setup" | "ready" | "error";

export type ProductInput = {
  name: string;
  sellingPrice: number;
  sku: string;
  barcode: string;
  categoryId: string;
  costPrice: number | null;
  taxRate: number | null;
  taxInclusive: boolean;
  trackStock: boolean;
  stock: number;
  unit: string;
  imageDataUrl: string;
  description: string;
};

export type CustomerInput = {
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
};

export type CheckoutInput = {
  lines: CartLine[];
  discountType: "flat" | "percent";
  discountValue: number;
  customerId: string | null;
  paymentMethodId: string;
  /**
   * Udhaar sale: the total is recorded as credit in the shared Customer
   * Ledger instead of being paid now. Requires a SAVED customer — walk-ins
   * cannot take credit. When set, paymentMethodId is ignored.
   */
  creditSale?: boolean;
};

export type HoldCartInput = {
  lines: CartLine[];
  discountType: "flat" | "percent";
  discountValue: number;
  customerId: string | null;
  label: string;
};

type PosContextValue = {
  status: PosStatus;
  errorMessage: string;
  business: Business | null;
  settings: PosSettings;
  products: Product[];
  categories: Category[];
  customers: Customer[];
  orders: Order[];
  orderItems: OrderItem[];
  payments: PaymentMethod[];
  inventoryLogs: InventoryLog[];
  heldCarts: HeldCart[];

  startSetup: () => void;
  backToWelcome: () => void;
  createBusiness: (profile: Omit<Business, "id" | "createdAt">) => Promise<void>;
  updateBusiness: (updates: Partial<Omit<Business, "id" | "createdAt">>) => Promise<void>;

  createProduct: (input: ProductInput) => Promise<Product>;
  updateProduct: (id: string, input: ProductInput) => Promise<void>;
  duplicateProduct: (id: string) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  adjustStock: (productId: string, type: "add" | "reduce" | "adjust", quantity: number, note?: string) => Promise<void>;

  createCategory: (name: string) => Promise<Category>;
  renameCategory: (id: string, name: string) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;

  createCustomer: (input: CustomerInput) => Promise<Customer>;
  updateCustomer: (id: string, input: CustomerInput) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;

  addPaymentMethod: (name: string) => Promise<void>;
  deletePaymentMethod: (id: string) => Promise<void>;

  updateSettings: (updates: Partial<Omit<PosSettings, "id">>) => Promise<void>;

  checkout: (input: CheckoutInput) => Promise<Order>;
  cancelOrder: (orderId: string) => Promise<void>;

  holdCart: (input: HoldCartInput) => Promise<HeldCart>;
  removeHeldCart: (id: string) => Promise<void>;

  sheetSync: {
    url: string;
    dirtyCount: number;
    syncing: boolean;
    lastSyncAt: string | null;
    lastError: string;
  };
  connectSheet: (url: string) => Promise<void>;
  disconnectSheet: () => Promise<void>;
  syncSheetNow: () => Promise<void>;
  resyncSheetAll: () => Promise<void>;
  restoreFromSheet: (url: string) => Promise<void>;

  exportBackup: () => Promise<void>;
  applyRestoredBackup: (backup: PosBackup) => Promise<void>;
  resetAll: () => Promise<void>;
};

const PosContext = createContext<PosContextValue | null>(null);

export function PosProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<PosStatus>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [business, setBusiness] = useState<Business | null>(null);
  const [settings, setSettings] = useState<PosSettings>(DEFAULT_SETTINGS);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [payments, setPayments] = useState<PaymentMethod[]>([]);
  const [inventoryLogs, setInventoryLogs] = useState<InventoryLog[]>([]);
  const [heldCarts, setHeldCarts] = useState<HeldCart[]>([]);
  const [dirtySlices, setDirtySlices] = useState<SyncSlice[]>([]);
  const [sheetSyncing, setSheetSyncing] = useState(false);
  const [sheetLastSyncAt, setSheetLastSyncAt] = useState<string | null>(null);
  const [sheetLastError, setSheetLastError] = useState("");
  const flushingRef = useRef(false);

  // Latest workspace snapshot for the sync engine (avoids stale closures).
  const snapshotRef = useRef<WorkspaceSnapshot | null>(null);
  useEffect(() => {
    snapshotRef.current = {
      business,
      settings,
      categories,
      payments,
      products,
      customers,
      orders,
      orderItems,
    };
  });

  useEffect(() => {
    try {
      setSheetLastSyncAt(localStorage.getItem("pos_sheet_sync_last"));
    } catch {
      // localStorage unavailable — status just starts empty.
    }
  }, []);

  const markDirtyState = useCallback((slices: SyncSlice[]) => {
    if (slices.length === 0) return;
    setDirtySlices((prev) => Array.from(new Set([...prev, ...slices])));
  }, []);

  /** Run a DB write and mark the given sync slices dirty in the same transaction. */
  const batchWithSync = useCallback(
    async (
      writes: Partial<Record<StoreName, unknown[]>>,
      deletes: Partial<Record<StoreName, string[]>>,
      slices: SyncSlice[]
    ) => {
      const dirtyRows: SyncDirtyRow[] = slices.map((id) => ({ id, dirtyAt: nowIso() }));
      await dbBatch(
        slices.length ? { ...writes, sync_queue: dirtyRows } : writes,
        deletes
      );
      markDirtyState(slices);
    },
    [markDirtyState]
  );

  const loadAll = useCallback(async () => {
    const [
      businessRows,
      productRows,
      categoryRows,
      customerRows,
      orderRows,
      orderItemRows,
      paymentRows,
      inventoryRows,
      settingsRows,
      heldCartRows,
      dirtyRows,
    ] = await Promise.all([
      dbGetAll<Business>("business"),
      dbGetAll<Product>("products"),
      dbGetAll<Category>("categories"),
      dbGetAll<Customer>("customers"),
      dbGetAll<Order>("orders"),
      dbGetAll<OrderItem>("order_items"),
      dbGetAll<PaymentMethod>("payments"),
      dbGetAll<InventoryLog>("inventory"),
      dbGetAll<PosSettings>("settings"),
      dbGetAll<HeldCart>("held_carts"),
      dbGetAll<SyncDirtyRow>("sync_queue"),
    ]);

    const loadedBusiness = businessRows.find((b) => b.id === "main") ?? null;
    setBusiness(loadedBusiness);
    setProducts(productRows);
    setCategories(categoryRows.sort((a, b) => a.name.localeCompare(b.name)));
    setCustomers(customerRows);
    setOrders(orderRows.sort((a, b) => b.date.localeCompare(a.date)));
    setOrderItems(orderItemRows);
    setPayments(paymentRows.sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
    setInventoryLogs(inventoryRows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    setHeldCarts(heldCartRows.sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
    setDirtySlices(dirtyRows.map((row) => row.id));
    // Merge with defaults so records saved by older versions pick up new fields.
    const storedSettings = settingsRows.find((s) => s.id === "main");
    setSettings(storedSettings ? { ...DEFAULT_SETTINGS, ...storedSettings } : DEFAULT_SETTINGS);

    return loadedBusiness;
  }, []);

  useEffect(() => {
    let active = true;
    loadAll()
      .then((loadedBusiness) => {
        if (!active) return;
        setStatus(loadedBusiness ? "ready" : "welcome");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Could not open local storage. Please use a modern browser outside private mode."
        );
        setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [loadAll]);

  const startSetup = useCallback(() => setStatus("setup"), []);
  const backToWelcome = useCallback(() => setStatus("welcome"), []);

  const createBusiness = useCallback(
    async (profile: Omit<Business, "id" | "createdAt">) => {
      const newBusiness: Business = { ...profile, id: "main", createdAt: nowIso() };
      const seededPayments: PaymentMethod[] = DEFAULT_PAYMENT_METHODS.map((name, index) => ({
        id: generateId(),
        name,
        isDefault: true,
        createdAt: new Date(Date.now() + index).toISOString(),
      }));
      const newSettings: PosSettings = { ...DEFAULT_SETTINGS };

      await batchWithSync(
        {
          business: [newBusiness],
          payments: seededPayments,
          settings: [newSettings],
        },
        {},
        ["meta"]
      );

      setBusiness(newBusiness);
      setPayments(seededPayments);
      setSettings(newSettings);
      setStatus("ready");
    },
    []
  );

  const updateBusiness = useCallback(
    async (updates: Partial<Omit<Business, "id" | "createdAt">>) => {
      if (!business) return;
      const updated: Business = { ...business, ...updates };
      await batchWithSync({ business: [updated] }, {}, ["meta"]);
      setBusiness(updated);
    },
    [business]
  );

  const createProduct = useCallback(async (input: ProductInput) => {
    const now = nowIso();
    const product: Product = { ...input, id: generateId(), createdAt: now, updatedAt: now };
    const logs: InventoryLog[] = [];
    if (product.trackStock && product.stock !== 0) {
      logs.push({
        id: generateId(),
        productId: product.id,
        productName: product.name,
        type: "opening",
        change: product.stock,
        stockAfter: product.stock,
        note: "Opening stock",
        createdAt: now,
      });
    }
    await batchWithSync({ products: [product], inventory: logs }, {}, ["products"]);
    setProducts((prev) => [...prev, product]);
    if (logs.length) setInventoryLogs((prev) => [...logs, ...prev]);
    return product;
  }, []);

  const updateProduct = useCallback(
    async (id: string, input: ProductInput) => {
      const existing = products.find((p) => p.id === id);
      if (!existing) return;
      const updated: Product = { ...existing, ...input, updatedAt: nowIso() };
      const logs: InventoryLog[] = [];
      if (updated.trackStock && existing.stock !== updated.stock) {
        logs.push({
          id: generateId(),
          productId: id,
          productName: updated.name,
          type: existing.trackStock ? "adjust" : "opening",
          change: updated.stock - (existing.trackStock ? existing.stock : 0),
          stockAfter: updated.stock,
          note: existing.trackStock ? "Stock edited" : "Stock tracking enabled",
          createdAt: nowIso(),
        });
      }
      await batchWithSync({ products: [updated], inventory: logs }, {}, ["products"]);
      setProducts((prev) => prev.map((p) => (p.id === id ? updated : p)));
      if (logs.length) setInventoryLogs((prev) => [...logs, ...prev]);
    },
    [products]
  );

  const duplicateProduct = useCallback(
    async (id: string) => {
      const existing = products.find((p) => p.id === id);
      if (!existing) return;
      const now = nowIso();
      const copy: Product = {
        ...existing,
        id: generateId(),
        name: `${existing.name} (Copy)`,
        sku: "",
        barcode: "",
        stock: 0,
        createdAt: now,
        updatedAt: now,
      };
      await batchWithSync({ products: [copy] }, {}, ["products"]);
      setProducts((prev) => [...prev, copy]);
    },
    [products]
  );

  const deleteProduct = useCallback(async (id: string) => {
    await batchWithSync({}, { products: [id] }, ["products"]);
    setProducts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const adjustStock = useCallback(
    async (productId: string, type: "add" | "reduce" | "adjust", quantity: number, note = "") => {
      const product = products.find((p) => p.id === productId);
      if (!product) return;
      const change = type === "reduce" ? -Math.abs(quantity) : type === "add" ? Math.abs(quantity) : quantity - product.stock;
      const stockAfter = type === "adjust" ? quantity : product.stock + change;
      const updated: Product = { ...product, trackStock: true, stock: stockAfter, updatedAt: nowIso() };
      const log: InventoryLog = {
        id: generateId(),
        productId,
        productName: product.name,
        type: type === "adjust" ? "adjust" : type,
        change,
        stockAfter,
        note,
        createdAt: nowIso(),
      };
      await batchWithSync({ products: [updated], inventory: [log] }, {}, ["products"]);
      setProducts((prev) => prev.map((p) => (p.id === productId ? updated : p)));
      setInventoryLogs((prev) => [log, ...prev]);
    },
    [products]
  );

  const createCategory = useCallback(async (name: string) => {
    const category: Category = { id: generateId(), name: name.trim(), createdAt: nowIso() };
    await batchWithSync({ categories: [category] }, {}, ["meta"]);
    setCategories((prev) => [...prev, category].sort((a, b) => a.name.localeCompare(b.name)));
    return category;
  }, []);

  const renameCategory = useCallback(
    async (id: string, name: string) => {
      const existing = categories.find((c) => c.id === id);
      if (!existing) return;
      const updated: Category = { ...existing, name: name.trim() };
      await batchWithSync({ categories: [updated] }, {}, ["meta"]);
      setCategories((prev) =>
        prev.map((c) => (c.id === id ? updated : c)).sort((a, b) => a.name.localeCompare(b.name))
      );
    },
    [categories]
  );

  const deleteCategory = useCallback(
    async (id: string) => {
      const affected = products
        .filter((p) => p.categoryId === id)
        .map((p) => ({ ...p, categoryId: "" }));
      await batchWithSync({ products: affected }, { categories: [id] }, ["meta", "products"]);
      setCategories((prev) => prev.filter((c) => c.id !== id));
      if (affected.length) {
        setProducts((prev) =>
          prev.map((p) => (p.categoryId === id ? { ...p, categoryId: "" } : p))
        );
      }
    },
    [products]
  );

  const createCustomer = useCallback(async (input: CustomerInput) => {
    const customer: Customer = { ...input, id: generateId(), createdAt: nowIso() };
    await batchWithSync({ customers: [customer] }, {}, ["customers"]);
    setCustomers((prev) => [...prev, customer]);
    return customer;
  }, []);

  const updateCustomer = useCallback(
    async (id: string, input: CustomerInput) => {
      const existing = customers.find((c) => c.id === id);
      if (!existing) return;
      const updated: Customer = { ...existing, ...input };
      await batchWithSync({ customers: [updated] }, {}, ["customers"]);
      setCustomers((prev) => prev.map((c) => (c.id === id ? updated : c)));
    },
    [customers]
  );

  const deleteCustomer = useCallback(async (id: string) => {
    await batchWithSync({}, { customers: [id] }, ["customers"]);
    setCustomers((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const addPaymentMethod = useCallback(async (name: string) => {
    const method: PaymentMethod = {
      id: generateId(),
      name: name.trim(),
      isDefault: false,
      createdAt: nowIso(),
    };
    await batchWithSync({ payments: [method] }, {}, ["meta"]);
    setPayments((prev) => [...prev, method]);
  }, []);

  const deletePaymentMethod = useCallback(
    async (id: string) => {
      if (payments.length <= 1) {
        throw new Error("At least one payment method is required.");
      }
      await batchWithSync({}, { payments: [id] }, ["meta"]);
      setPayments((prev) => prev.filter((p) => p.id !== id));
    },
    [payments]
  );

  const updateSettings = useCallback(
    async (updates: Partial<Omit<PosSettings, "id">>) => {
      const updated: PosSettings = { ...settings, ...updates, id: "main" };
      await batchWithSync({ settings: [updated] }, {}, ["meta"]);
      setSettings(updated);
    },
    [settings]
  );

  const checkout = useCallback(
    async (input: CheckoutInput) => {
      if (input.lines.length === 0) {
        throw new Error("The cart is empty.");
      }
      for (const line of input.lines) {
        if (!line.name.trim()) throw new Error("Cart contains an item without a name.");
        if (!Number.isFinite(line.price) || line.price < 0) {
          throw new Error(`"${line.name}" has an invalid price.`);
        }
        if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
          throw new Error(`"${line.name}" has an invalid quantity.`);
        }
      }
      const paymentMethod = payments.find((p) => p.id === input.paymentMethodId);
      if (!input.creditSale && !paymentMethod) {
        throw new Error("Please choose a payment method.");
      }

      const totals = calculateCartTotals(
        input.lines,
        input.discountType,
        input.discountValue,
        settings.taxEnabled
      );

      // Guarantee a unique invoice number even if the counter drifted
      // (e.g. after restoring an older backup).
      const usedNumbers = new Set(orders.map((o) => o.invoiceNumber));
      let counter = settings.nextInvoiceNumber;
      let invoiceNumber = formatInvoiceNumber(settings.invoicePrefix, counter);
      while (usedNumbers.has(invoiceNumber)) {
        counter += 1;
        invoiceNumber = formatInvoiceNumber(settings.invoicePrefix, counter);
      }

      const customer = input.customerId
        ? customers.find((c) => c.id === input.customerId) ?? null
        : null;
      if (input.creditSale && !customer) {
        throw new Error("Credit sales need a saved customer — pick one from the customer list.");
      }

      const now = nowIso();
      const order: Order = {
        id: generateId(),
        invoiceNumber,
        date: now,
        customerId: customer?.id ?? null,
        customerName: customer?.name ?? "",
        subtotal: totals.subtotal,
        discountType: input.discountType,
        discountValue: input.discountValue,
        discountAmount: totals.discountAmount,
        taxAmount: totals.taxAmount,
        includedTaxAmount: totals.includedTaxAmount,
        total: totals.total,
        paymentMethodId: input.creditSale ? "credit" : paymentMethod!.id,
        paymentMethodName: input.creditSale ? "Customer Credit" : paymentMethod!.name,
        status: "completed",
        createdAt: now,
      };

      // Udhaar sale: record the credit in the shared Customer Ledger, in the
      // same transaction as the order, so the Customer Ledger tool shows the
      // balance immediately.
      const ledgerEntries: LedgerEntry[] = input.creditSale
        ? [
            {
              id: generateId(),
              customerId: customer!.id,
              customerName: customer!.name,
              type: "credit",
              amount: totals.total,
              note: `POS sale ${invoiceNumber}`,
              date: now.slice(0, 10),
              createdByTool: "browser-pos",
              createdAt: now,
            },
          ]
        : [];

      const items: OrderItem[] = input.lines.map((line) => ({
        id: generateId(),
        orderId: order.id,
        productId: line.productId || null,
        name: line.name,
        price: line.price,
        quantity: line.quantity,
        unit: line.unit,
        taxRate: line.taxRate,
        taxInclusive: line.taxInclusive,
        lineSubtotal: Math.round(line.price * line.quantity * 100) / 100,
      }));

      const updatedProducts: Product[] = [];
      const logs: InventoryLog[] = [];
      for (const line of input.lines) {
        const product = products.find((p) => p.id === line.productId);
        if (product && product.trackStock) {
          const stockAfter = product.stock - line.quantity;
          updatedProducts.push({ ...product, stock: stockAfter, updatedAt: now });
          logs.push({
            id: generateId(),
            productId: product.id,
            productName: product.name,
            type: "sale",
            change: -line.quantity,
            stockAfter,
            note: `Sale ${invoiceNumber}`,
            createdAt: now,
          });
        }
      }

      const updatedSettings: PosSettings = { ...settings, nextInvoiceNumber: counter + 1 };

      await batchWithSync(
        {
          orders: [order],
          order_items: items,
          products: updatedProducts,
          inventory: logs,
          settings: [updatedSettings],
          ledger: ledgerEntries,
        },
        {},
        ["orders", "products", "meta"]
      );

      setOrders((prev) => [order, ...prev]);
      setOrderItems((prev) => [...prev, ...items]);
      if (updatedProducts.length) {
        setProducts((prev) =>
          prev.map((p) => updatedProducts.find((u) => u.id === p.id) ?? p)
        );
      }
      if (logs.length) setInventoryLogs((prev) => [...logs, ...prev]);
      setSettings(updatedSettings);

      return order;
    },
    [customers, orders, payments, products, settings]
  );

  const cancelOrder = useCallback(
    async (orderId: string) => {
      const order = orders.find((o) => o.id === orderId);
      if (!order || order.status === "cancelled") return;

      const now = nowIso();
      const cancelled: Order = { ...order, status: "cancelled" };
      const items = orderItems.filter((item) => item.orderId === orderId);

      const updatedProducts: Product[] = [];
      const logs: InventoryLog[] = [];
      for (const item of items) {
        const product = item.productId
          ? products.find((p) => p.id === item.productId)
          : undefined;
        if (product && product.trackStock) {
          const stockAfter = product.stock + item.quantity;
          updatedProducts.push({ ...product, stock: stockAfter, updatedAt: now });
          logs.push({
            id: generateId(),
            productId: product.id,
            productName: product.name,
            type: "restock",
            change: item.quantity,
            stockAfter,
            note: `Cancelled ${order.invoiceNumber}`,
            createdAt: now,
          });
        }
      }

      await batchWithSync(
        { orders: [cancelled], products: updatedProducts, inventory: logs },
        {},
        ["orders", "products"]
      );

      setOrders((prev) => prev.map((o) => (o.id === orderId ? cancelled : o)));
      if (updatedProducts.length) {
        setProducts((prev) =>
          prev.map((p) => updatedProducts.find((u) => u.id === p.id) ?? p)
        );
      }
      if (logs.length) setInventoryLogs((prev) => [...logs, ...prev]);
    },
    [orderItems, orders, products]
  );

  const holdCart = useCallback(
    async (input: HoldCartInput) => {
      if (input.lines.length === 0) {
        throw new Error("The cart is empty.");
      }
      const customer = input.customerId
        ? customers.find((c) => c.id === input.customerId) ?? null
        : null;
      const held: HeldCart = {
        id: generateId(),
        label: input.label.trim() || customer?.name || "",
        lines: input.lines.map((line) => ({ ...line })),
        discountType: input.discountType,
        discountValue: input.discountValue,
        customerId: customer?.id ?? null,
        createdAt: nowIso(),
      };
      await dbBatch({ held_carts: [held] });
      setHeldCarts((prev) => [...prev, held]);
      return held;
    },
    [customers]
  );

  const removeHeldCart = useCallback(async (id: string) => {
    await dbBatch({}, { held_carts: [id] });
    setHeldCarts((prev) => prev.filter((h) => h.id !== id));
  }, []);

  // ---- Google Sheet sync engine -------------------------------------------

  const runSheetFlush = useCallback(async () => {
    const snapshot = snapshotRef.current;
    const url = snapshot?.settings.sheetSyncUrl;
    if (!snapshot || !url || flushingRef.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    const queued = await dbGetAll<SyncDirtyRow>("sync_queue");
    if (queued.length === 0) return;

    flushingRef.current = true;
    setSheetSyncing(true);
    try {
      const tabs = buildTabPayloads(queued.map((row) => row.id), snapshot);
      await pushToSheet(url, tabs);

      // Only clear flags that weren't re-dirtied while the push was in flight.
      const current = await dbGetAll<SyncDirtyRow>("sync_queue");
      const clearable = queued
        .filter((row) =>
          current.some((c) => c.id === row.id && c.dirtyAt === row.dirtyAt)
        )
        .map((row) => row.id);
      if (clearable.length) {
        await dbBatch({}, { sync_queue: clearable });
      }
      const remaining = await dbGetAll<SyncDirtyRow>("sync_queue");
      setDirtySlices(remaining.map((row) => row.id));

      const now = nowIso();
      setSheetLastSyncAt(now);
      setSheetLastError("");
      try {
        localStorage.setItem("pos_sheet_sync_last", now);
      } catch {
        // Status display only.
      }
    } catch (error) {
      setSheetLastError(
        error instanceof Error ? error.message : "Could not sync to the sheet."
      );
    } finally {
      flushingRef.current = false;
      setSheetSyncing(false);
    }
  }, []);

  // Debounced auto-flush whenever something is dirty and a sheet is connected.
  useEffect(() => {
    if (status !== "ready" || !settings.sheetSyncUrl || dirtySlices.length === 0) return;
    const timer = setTimeout(() => {
      void runSheetFlush();
    }, 1500);
    return () => clearTimeout(timer);
  }, [status, settings.sheetSyncUrl, dirtySlices, runSheetFlush]);

  // Coming back online flushes anything that queued up while offline.
  useEffect(() => {
    const onOnline = () => {
      void runSheetFlush();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [runSheetFlush]);

  const connectSheet = useCallback(
    async (url: string) => {
      const trimmed = url.trim();
      if (!isValidSyncUrl(trimmed)) {
        throw new Error("Paste the full https:// web app URL from Apps Script.");
      }
      const test = await testSheetConnection(trimmed);
      if (!test.ok) {
        throw new Error(test.error || "Could not connect to the script.");
      }
      await updateSettings({ sheetSyncUrl: trimmed });
      // First sync sends the whole workspace.
      await batchWithSync({}, {}, SYNC_SLICES);
    },
    [updateSettings, batchWithSync]
  );

  const disconnectSheet = useCallback(async () => {
    await updateSettings({ sheetSyncUrl: "" });
    setSheetLastError("");
  }, [updateSettings]);

  const syncSheetNow = useCallback(async () => {
    await runSheetFlush();
  }, [runSheetFlush]);

  const resyncSheetAll = useCallback(async () => {
    await batchWithSync({}, {}, SYNC_SLICES);
    await runSheetFlush();
  }, [batchWithSync, runSheetFlush]);

  const restoreFromSheet = useCallback(
    async (url: string) => {
      const trimmed = url.trim();
      if (!isValidSyncUrl(trimmed)) {
        throw new Error("Paste the full https:// web app URL from Apps Script.");
      }
      const pull = await pullFromSheet(trimmed);
      const backup = buildBackupFromSheetPull(pull, trimmed);
      await restoreBackup(backup);
      const loadedBusiness = await loadAll();
      setStatus(loadedBusiness ? "ready" : "welcome");
    },
    [loadAll]
  );

  const exportBackup = useCallback(async () => {
    const backup = await createBackup();
    downloadBackupFile(backup);
    const updated: PosSettings = { ...settings, lastBackupAt: nowIso() };
    await batchWithSync({ settings: [updated] }, {}, ["meta"]);
    setSettings(updated);
  }, [settings]);

  const applyRestoredBackup = useCallback(
    async (backup: PosBackup) => {
      await restoreBackup(backup);
      // The restored data is the new truth — push all of it on next flush.
      await dbBatch({
        sync_queue: SYNC_SLICES.map((id) => ({ id, dirtyAt: nowIso() })),
      });
      const loadedBusiness = await loadAll();
      setStatus(loadedBusiness ? "ready" : "welcome");
    },
    [loadAll]
  );

  const resetAll = useCallback(async () => {
    await dbClearAll();
    setBusiness(null);
    setProducts([]);
    setCategories([]);
    setCustomers([]);
    setOrders([]);
    setOrderItems([]);
    setPayments([]);
    setInventoryLogs([]);
    setHeldCarts([]);
    setDirtySlices([]);
    setSheetLastError("");
    setSettings(DEFAULT_SETTINGS);
    setStatus("welcome");
  }, []);

  const sheetSync = useMemo(
    () => ({
      url: settings.sheetSyncUrl,
      dirtyCount: dirtySlices.length,
      syncing: sheetSyncing,
      lastSyncAt: sheetLastSyncAt,
      lastError: sheetLastError,
    }),
    [settings.sheetSyncUrl, dirtySlices.length, sheetSyncing, sheetLastSyncAt, sheetLastError]
  );

  const value = useMemo<PosContextValue>(
    () => ({
      status,
      errorMessage,
      business,
      settings,
      products,
      categories,
      customers,
      orders,
      orderItems,
      payments,
      inventoryLogs,
      heldCarts,
      startSetup,
      backToWelcome,
      createBusiness,
      updateBusiness,
      createProduct,
      updateProduct,
      duplicateProduct,
      deleteProduct,
      adjustStock,
      createCategory,
      renameCategory,
      deleteCategory,
      createCustomer,
      updateCustomer,
      deleteCustomer,
      addPaymentMethod,
      deletePaymentMethod,
      updateSettings,
      checkout,
      cancelOrder,
      holdCart,
      removeHeldCart,
      sheetSync,
      connectSheet,
      disconnectSheet,
      syncSheetNow,
      resyncSheetAll,
      restoreFromSheet,
      exportBackup,
      applyRestoredBackup,
      resetAll,
    }),
    [
      status,
      errorMessage,
      business,
      settings,
      products,
      categories,
      customers,
      orders,
      orderItems,
      payments,
      inventoryLogs,
      heldCarts,
      startSetup,
      backToWelcome,
      createBusiness,
      updateBusiness,
      createProduct,
      updateProduct,
      duplicateProduct,
      deleteProduct,
      adjustStock,
      createCategory,
      renameCategory,
      deleteCategory,
      createCustomer,
      updateCustomer,
      deleteCustomer,
      addPaymentMethod,
      deletePaymentMethod,
      updateSettings,
      checkout,
      cancelOrder,
      holdCart,
      removeHeldCart,
      sheetSync,
      connectSheet,
      disconnectSheet,
      syncSheetNow,
      resyncSheetAll,
      restoreFromSheet,
      exportBackup,
      applyRestoredBackup,
      resetAll,
    ]
  );

  return <PosContext.Provider value={value}>{children}</PosContext.Provider>;
}

export function usePos(): PosContextValue {
  const context = useContext(PosContext);
  if (!context) {
    throw new Error("usePos must be used inside a PosProvider.");
  }
  return context;
}
