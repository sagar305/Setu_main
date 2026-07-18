"use client";

// Consent-gated access to shared workspace data (Principles 2 & 3).
// A tool calls this to DISCOVER whether a workspace exists on this device,
// then asks the user once before reading shared data. The grant is remembered
// per tool, so we never ask twice.

import { useCallback, useEffect, useState } from "react";
import {
  getBusiness,
  getCustomers,
  getProducts,
  grantConsent,
  hasConsent,
  hasWorkspace,
  type Business,
  type Customer,
  type Product,
} from "@/lib/toolkit/workspace";

export type WorkspaceConnection = {
  /** Discovery finished (IndexedDB answered or failed). */
  ready: boolean;
  /** A business workspace exists on this device. */
  exists: boolean;
  /** This tool has the user's permission to read shared data. */
  connected: boolean;
  /** Grant permission for this tool and load shared data. */
  connect: () => Promise<void>;
  business: Business | null;
  products: Product[];
  customers: Customer[];
  /** Re-read shared data (e.g. after this tool edits a shared entity). */
  reload: () => Promise<void>;
};

export function useWorkspaceConnection(tool: string): WorkspaceConnection {
  const [ready, setReady] = useState(false);
  const [exists, setExists] = useState(false);
  const [connected, setConnected] = useState(false);
  const [business, setBusiness] = useState<Business | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const load = useCallback(async () => {
    const [biz, prods, custs] = await Promise.all([
      getBusiness(),
      getProducts(),
      getCustomers(),
    ]);
    setBusiness(biz);
    setProducts(prods);
    setCustomers(custs);
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
        // No IndexedDB (private mode) — tool still works standalone.
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

  return { ready, exists, connected, connect, business, products, customers, reload: load };
}
