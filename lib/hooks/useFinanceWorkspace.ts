"use client";

// Consent-gated access to the WIDER slice of workspace data the finance tools
// need — business, customers, suppliers, products, and the transactional
// stores (orders, expenses, ledger, purchases, cash book). It mirrors
// useWorkspaceConnection's consent model exactly (discover → ask once →
// remember) but returns the superset. The return shape is a strict superset of
// WorkspaceConnection, so the same <WorkspaceBanner> works unchanged.

import { useCallback, useEffect, useState } from "react";
import {
  getBusiness,
  getCustomers,
  getProducts,
  getSuppliers,
  getOrders,
  getExpenses,
  getLedgerEntries,
  getPurchases,
  getCashEntries,
  grantConsent,
  hasConsent,
  hasWorkspace,
  type Business,
  type Customer,
  type Product,
  type Supplier,
  type Order,
  type Expense,
  type LedgerEntry,
  type Purchase,
  type CashEntry,
} from "@/lib/toolkit/workspace";

export type FinanceWorkspace = {
  ready: boolean;
  exists: boolean;
  connected: boolean;
  connect: () => Promise<void>;
  business: Business | null;
  products: Product[];
  customers: Customer[];
  suppliers: Supplier[];
  orders: Order[];
  expenses: Expense[];
  ledger: LedgerEntry[];
  purchases: Purchase[];
  cashEntries: CashEntry[];
  reload: () => Promise<void>;
};

export function useFinanceWorkspace(tool: string): FinanceWorkspace {
  const [ready, setReady] = useState(false);
  const [exists, setExists] = useState(false);
  const [connected, setConnected] = useState(false);
  const [business, setBusiness] = useState<Business | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [cashEntries, setCashEntries] = useState<CashEntry[]>([]);

  const load = useCallback(async () => {
    const [biz, prods, custs, sups, ords, exps, led, purch, cash] = await Promise.all([
      getBusiness(),
      getProducts(),
      getCustomers(),
      getSuppliers(),
      getOrders(),
      getExpenses(),
      getLedgerEntries(),
      getPurchases(),
      getCashEntries(),
    ]);
    setBusiness(biz);
    setProducts(prods);
    setCustomers(custs);
    setSuppliers(sups);
    setOrders(ords);
    setExpenses(exps);
    setLedger(led);
    setPurchases(purch);
    setCashEntries(cash);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const found = await hasWorkspace();
        if (cancelled) return;
        setExists(found);
        if (found && hasConsent(tool)) {
          setConnected(true);
          await load();
        }
      } catch {
        // No IndexedDB (private mode) — the tool still works standalone.
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tool, load]);

  const connect = useCallback(async () => {
    grantConsent(tool);
    setConnected(true);
    await load();
  }, [tool, load]);

  return {
    ready,
    exists,
    connected,
    connect,
    business,
    products,
    customers,
    suppliers,
    orders,
    expenses,
    ledger,
    purchases,
    cashEntries,
    reload: load,
  };
}
