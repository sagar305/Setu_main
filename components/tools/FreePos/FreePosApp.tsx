"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  LayoutDashboard,
  Maximize2,
  Minimize2,
  Package,
  Receipt,
  Search,
  Settings,
  ShoppingCart,
  Users,
  WifiOff,
} from "lucide-react";
import { PosProvider, usePos } from "@/lib/pos/store";
import type { NavigateFn, ScreenId } from "./nav";
import { WelcomeScreen } from "./WelcomeScreen";
import { SetupScreen } from "./SetupScreen";
import { DashboardScreen } from "./DashboardScreen";
import { BillingScreen } from "./BillingScreen";
import { ProductsScreen } from "./ProductsScreen";
import { OrdersScreen } from "./OrdersScreen";
import { CustomersScreen } from "./CustomersScreen";
import { ReportsScreen } from "./ReportsScreen";
import { SettingsScreen } from "./SettingsScreen";

const NAV_ITEMS: { id: ScreenId; label: string; icon: typeof Package }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "sell", label: "New Sale", icon: ShoppingCart },
  { id: "products", label: "Products", icon: Package },
  { id: "orders", label: "Orders", icon: Receipt },
  { id: "customers", label: "Customers", icon: Users },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
];

type QueryRequest = { screen: ScreenId; value: string; nonce: number };

function GlobalSearch({ onNavigate }: { onNavigate: NavigateFn }) {
  const { products, customers, orders } = usePos();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return {
      products: products
        .filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.sku.toLowerCase().includes(q) ||
            p.barcode.toLowerCase().includes(q)
        )
        .slice(0, 4),
      customers: customers
        .filter((c) => c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q))
        .slice(0, 4),
      orders: orders.filter((o) => o.invoiceNumber.toLowerCase().includes(q)).slice(0, 4),
    };
  }, [query, products, customers, orders]);

  const pick = (screen: ScreenId, value: string) => {
    onNavigate(screen, value);
    setQuery("");
    setOpen(false);
  };

  const hasResults =
    results &&
    (results.products.length > 0 || results.customers.length > 0 || results.orders.length > 0);

  return (
    <div ref={wrapRef} className="relative w-full max-w-xs">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted/60" />
      <input
        type="search"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search everything…"
        aria-label="Search products, customers and orders"
        className="w-full rounded-full border border-muted-line/40 bg-white py-2 pl-9 pr-3 text-sm text-ink placeholder:text-muted/60 focus:border-indigo focus:outline-none"
      />
      {open && results && (
        <div className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-xl border border-muted-line/30 bg-white shadow-lg">
          {!hasResults ? (
            <p className="px-4 py-3 text-sm text-muted">No matches found.</p>
          ) : (
            <>
              {results.products.length > 0 && (
                <div>
                  <p className="bg-cream-paper px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-muted">
                    Products
                  </p>
                  {results.products.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => pick("products", p.name)}
                      className="block w-full px-4 py-2 text-left text-sm text-ink hover:bg-cream-paper"
                    >
                      {p.name}
                      {p.sku && <span className="ml-2 text-xs text-muted">SKU {p.sku}</span>}
                    </button>
                  ))}
                </div>
              )}
              {results.customers.length > 0 && (
                <div>
                  <p className="bg-cream-paper px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-muted">
                    Customers
                  </p>
                  {results.customers.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => pick("customers", c.name)}
                      className="block w-full px-4 py-2 text-left text-sm text-ink hover:bg-cream-paper"
                    >
                      {c.name}
                      {c.phone && <span className="ml-2 text-xs text-muted">{c.phone}</span>}
                    </button>
                  ))}
                </div>
              )}
              {results.orders.length > 0 && (
                <div>
                  <p className="bg-cream-paper px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-muted">
                    Orders
                  </p>
                  {results.orders.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => pick("orders", o.invoiceNumber)}
                      className="block w-full px-4 py-2 text-left text-sm text-ink hover:bg-cream-paper"
                    >
                      {o.invoiceNumber}
                      <span className="ml-2 text-xs text-muted">
                        {o.customerName || "Walk-in"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function PosShell({
  fullscreen,
  onToggleFullscreen,
}: {
  fullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  const { business } = usePos();
  const [screen, setScreen] = useState<ScreenId>("dashboard");
  const [queryRequest, setQueryRequest] = useState<QueryRequest | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    setOffline(!navigator.onLine);
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  const navigate: NavigateFn = (target, query) => {
    setScreen(target);
    if (query !== undefined) {
      setQueryRequest((prev) => ({ screen: target, value: query, nonce: (prev?.nonce ?? 0) + 1 }));
    }
  };

  const queryFor = (target: ScreenId) =>
    queryRequest && queryRequest.screen === target ? queryRequest : null;

  return (
    <div>
      <div className="flex flex-col gap-3 border-b border-muted-line/20 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-ink">{business?.name}</h2>
          {offline && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-saffron/15 px-2.5 py-1 text-xs font-semibold text-ink">
              <WifiOff className="h-3.5 w-3.5 text-saffron" />
              Offline — sales still work
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <GlobalSearch onNavigate={navigate} />
          <button
            type="button"
            onClick={onToggleFullscreen}
            aria-label={fullscreen ? "Exit full screen" : "Enter full screen"}
            title={fullscreen ? "Exit full screen" : "Full screen POS"}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-muted-line/40 bg-white text-muted transition hover:border-indigo/40 hover:text-indigo"
          >
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <nav
        className="-mx-1 mt-4 flex gap-1 overflow-x-auto pb-1"
        aria-label="POS sections"
      >
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => navigate(item.id)}
            aria-current={screen === item.id ? "page" : undefined}
            className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
              screen === item.id
                ? "bg-indigo text-white"
                : "text-muted hover:bg-white hover:text-indigo"
            }`}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </button>
        ))}
      </nav>

      {/* Screens stay mounted so in-progress carts and searches survive tab switches. */}
      <div className="mt-6">
        <div className={screen === "dashboard" ? "" : "hidden"}>
          <DashboardScreen onNavigate={navigate} />
        </div>
        <div className={screen === "sell" ? "" : "hidden"}>
          <BillingScreen onNavigate={navigate} />
        </div>
        <div className={screen === "products" ? "" : "hidden"}>
          <ProductsScreen externalQuery={queryFor("products")} />
        </div>
        <div className={screen === "orders" ? "" : "hidden"}>
          <OrdersScreen externalQuery={queryFor("orders")} />
        </div>
        <div className={screen === "customers" ? "" : "hidden"}>
          <CustomersScreen externalQuery={queryFor("customers")} onNavigate={navigate} />
        </div>
        <div className={screen === "reports" ? "" : "hidden"}>
          <ReportsScreen />
        </div>
        <div className={screen === "settings" ? "" : "hidden"}>
          <SettingsScreen />
        </div>
      </div>
    </div>
  );
}

function PosRouter({
  fullscreen,
  onToggleFullscreen,
}: {
  fullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  const { status, errorMessage } = usePos();

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm text-muted">Opening your POS…</p>
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h2 className="text-lg font-bold text-ink">Couldn&apos;t open local storage</h2>
        <p className="mt-2 text-sm text-muted">
          {errorMessage ||
            "This POS stores data in your browser (IndexedDB). Private/incognito windows and some very old browsers block it."}
        </p>
      </div>
    );
  }
  if (status === "welcome") return <WelcomeScreen />;
  if (status === "setup") return <SetupScreen />;
  return <PosShell fullscreen={fullscreen} onToggleFullscreen={onToggleFullscreen} />;
}

export function FreePosApp() {
  const [fullscreen, setFullscreen] = useState(false);

  // Cache the page for offline use once the browser is idle.
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/pos-sw.js").catch(() => {
      // Offline caching is best-effort; the POS still works without it.
    });
  }, []);

  const toggleFullscreen = () => {
    const next = !fullscreen;
    setFullscreen(next);
    // Also ask the browser for real full screen (hides its chrome) where
    // supported; the fixed overlay below works even where it isn't (iOS).
    try {
      if (next) {
        document.documentElement.requestFullscreen?.()?.catch?.(() => {});
      } else if (document.fullscreenElement) {
        document.exitFullscreen?.()?.catch?.(() => {});
      }
    } catch {
      // Full screen is best-effort.
    }
  };

  // Leaving browser full screen (e.g. via Esc) also leaves POS full screen.
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setFullscreen(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Stop the page behind the overlay from scrolling.
  useEffect(() => {
    if (!fullscreen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [fullscreen]);

  return (
    <PosProvider>
      <div
        className={
          fullscreen
            ? "pos-fullscreen fixed inset-0 z-[60] overflow-y-auto bg-cream-paper p-4 sm:p-6"
            : "rounded-3xl border border-muted-line/30 bg-cream-paper p-4 shadow-sm sm:p-6"
        }
      >
        <PosRouter fullscreen={fullscreen} onToggleFullscreen={toggleFullscreen} />
      </div>
    </PosProvider>
  );
}
