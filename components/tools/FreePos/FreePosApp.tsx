"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  LineChart,
  Printer,
  LayoutDashboard,
  Lock,
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
import { isToolEnabled } from "@/lib/pos/posTools";
import { useWhatsNew } from "@/lib/hooks/useWhatsNew";
import type { AppUpdate } from "@/lib/whatsNew";
import { translate } from "@/lib/i18n/translate";
import { NewDot } from "@/components/whatsNew/NewPill";
import { WhatsNewProvider } from "@/components/whatsNew/WhatsNewContext";
import { LockScreen } from "./LockScreen";
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
import { ToolScreen, tabTools, toolScreenId, toolSlugOf } from "./ToolsScreen";
import type { PosToolCategory } from "@/lib/pos/posTools";
import type { PosScreen } from "@/lib/pos/drive/roles";
import { decodeInvite } from "@/lib/pos/drive/engine";
import { TeamSyncProvider, timeAgo, useTeam } from "./team/TeamSyncContext";
import { JoinScreen } from "./team/JoinScreen";

/** Which role rule covers each POS screen. */
function rolesScreen(id: ScreenId): PosScreen {
  if (id === "sell") return "billing";
  if (id.startsWith("tool:")) return "tools";
  return id as PosScreen;
}

/** Small "Synced 20 sec ago" chip for the header while in a team. */
function TeamChip({ onOpen }: { onOpen: () => void }) {
  const { team, syncing } = useTeam();
  const [, tick] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => tick((n) => n + 1), 15_000);
    return () => window.clearInterval(timer);
  }, []);
  if (!team) return null;
  const problem = team.removed || team.needsSignIn || Boolean(team.lastError);
  const label = team.removed
    ? "Removed from team"
    : team.needsSignIn
      ? "Reconnect Google"
      : team.lastError
        ? "Sync problem"
        : syncing
          ? "Syncing…"
          : `Synced ${timeAgo(team.lastSyncAt)}`;
  return (
    <button
      type="button"
      onClick={onOpen}
      title="Google Drive team sync"
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
        problem ? "bg-saffron/20 text-ink" : "bg-emerald-50 text-emerald-700"
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${problem ? "bg-saffron" : "bg-emerald-500"}`} />
      {label}
    </button>
  );
}

const TOOL_ICONS: Record<PosToolCategory, typeof Package> = {
  "Sales & billing": Printer,
  "Money in": ArrowDownLeft,
  "Money out": ArrowUpRight,
  "Reports & analysis": LineChart,
};

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
  const { products: allProducts, customers, orders } = usePos();
  const { canSee } = useTeam();
  // Search only leads to screens this person can open.
  const products = canSee("products") ? allProducts : [];
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
  const { business, settings, reload } = usePos();
  const { canSee, isCashier } = useTeam();
  const [screen, setScreen] = useState<ScreenId>("dashboard");

  // Connected tools the owner chose to show as tabs, just before Settings.
  const tools = tabTools(settings.connectedTools, settings.toolTabs);
  const navItems = useMemo(() => {
    const toolItems = tools.map((tool) => ({
      id: toolScreenId(tool.slug) as ScreenId,
      label: tool.name,
      icon: TOOL_ICONS[tool.category],
    }));
    const settingsItem = NAV_ITEMS[NAV_ITEMS.length - 1];
    return [...NAV_ITEMS.slice(0, -1), ...toolItems, settingsItem].filter((item) =>
      canSee(rolesScreen(item.id))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tools.map((t) => t.slug).join(","), canSee]);

  // A cashier starts on billing; anyone on a screen their role hides moves off it.
  useEffect(() => {
    if (!canSee(rolesScreen(screen))) setScreen(isCashier ? "sell" : "dashboard");
  }, [canSee, isCashier, screen]);
  const activeToolSlug = toolSlugOf(screen);
  const activeTool = activeToolSlug ? tools.find((t) => t.slug === activeToolSlug) : undefined;

  // A tool switched off while its tab was open: fall back to the dashboard.
  useEffect(() => {
    if (activeToolSlug && !activeTool) setScreen("dashboard");
  }, [activeToolSlug, activeTool]);
  const [queryRequest, setQueryRequest] = useState<QueryRequest | null>(null);
  const [offline, setOffline] = useState(false);

  // Counter lock. When a PIN is set the POS starts locked, so opening the tab
  // asks for it; it can also be locked by hand or after an idle timeout.
  const hasPin = Boolean(settings.pinHash && settings.pinSalt);
  const [locked, setLocked] = useState(false);
  const unlockedOnceRef = useRef(false);

  // Lock as soon as we learn a PIN exists (settings arrive async on load).
  useEffect(() => {
    if (hasPin && !unlockedOnceRef.current) setLocked(true);
    if (!hasPin) setLocked(false);
  }, [hasPin]);

  const lockNow = () => {
    if (hasPin) setLocked(true);
  };

  // Idle auto-lock. Any real interaction resets the timer.
  const autoLockMinutes = settings.autoLockMinutes ?? 0;
  useEffect(() => {
    if (!hasPin || locked || autoLockMinutes <= 0) return;
    let timer = window.setTimeout(() => setLocked(true), autoLockMinutes * 60_000);
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setLocked(true), autoLockMinutes * 60_000);
    };
    const events: (keyof DocumentEventMap)[] = [
      "pointerdown",
      "keydown",
      "wheel",
      "touchstart",
    ];
    events.forEach((e) => document.addEventListener(e, reset, { passive: true }));
    return () => {
      window.clearTimeout(timer);
      events.forEach((e) => document.removeEventListener(e, reset));
    };
  }, [hasPin, locked, autoLockMinutes]);

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

  // What's new for owners who set up before a feature shipped. "Taken up"
  // means every tool the update introduces is already switched on.
  const connectedTools = settings.connectedTools;
  const isTakenUp = useCallback(
    (update: AppUpdate, feature?: string) => {
      const features = feature ? [feature] : update.features ?? [];
      return features.length > 0 && features.every((slug) => isToolEnabled(connectedTools, slug));
    },
    [connectedTools]
  );
  const whatsNew = useWhatsNew("pos", business?.createdAt, isTakenUp);

  const navigate: NavigateFn = (target, query) => {
    // Leaving a tool tab: the tool saved straight to the database, so re-read
    // it before the POS writes anything from its in-memory copy.
    if (toolSlugOf(screen) && target !== screen) void reload();
    whatsNew.visit(target);
    setScreen(target);
    if (query !== undefined) {
      setQueryRequest((prev) => ({ screen: target, value: query, nonce: (prev?.nonce ?? 0) + 1 }));
    }
  };

  const queryFor = (target: ScreenId) =>
    queryRequest && queryRequest.screen === target ? queryRequest : null;

  return (
    <WhatsNewProvider value={whatsNew}>
    <div>
      <div className="flex flex-col gap-3 border-b border-muted-line/20 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-ink">{business?.name}</h2>
          <TeamChip onOpen={() => navigate("settings")} />
          {offline && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-saffron/15 px-2.5 py-1 text-xs font-semibold text-ink">
              <WifiOff className="h-3.5 w-3.5 text-saffron" />
              Offline — sales still work
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <GlobalSearch onNavigate={navigate} />
          {hasPin && (
            <button
              type="button"
              onClick={lockNow}
              aria-label="Lock the counter"
              title="Lock the counter"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-muted-line/40 bg-white text-muted transition hover:border-indigo/40 hover:text-indigo"
            >
              <Lock className="h-4 w-4" />
            </button>
          )}
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
        {navItems.map((item) => (
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
            {screen !== item.id && whatsNew.hasDot(item.id) && (
              <NewDot label={translate("en", "wnNewOnTab")} />
            )}
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
        {/* Mounted only while open, so each visit reads current data. */}
        {activeTool ? <ToolScreen key={activeTool.slug} tool={activeTool} /> : null}
        <div className={screen === "reports" ? "" : "hidden"}>
          <ReportsScreen />
        </div>
        <div className={screen === "settings" ? "" : "hidden"}>
          <SettingsScreen onLockNow={lockNow} />
        </div>
      </div>

      {locked && (
        <LockScreen
          businessName={business?.name ?? ""}
          pinHash={settings.pinHash ?? ""}
          pinSalt={settings.pinSalt ?? ""}
          onUnlock={() => {
            unlockedOnceRef.current = true;
            setLocked(false);
          }}
        />
      )}
    </div>
    </WhatsNewProvider>
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
  const [joinParam, setJoinParam] = useState<string | null>(null);

  useEffect(() => {
    setJoinParam(new URLSearchParams(window.location.search).get("join"));
  }, []);

  const finishJoin = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("join");
    window.history.replaceState(null, "", url.toString());
    setJoinParam(null);
  };

  if (joinParam !== null && status !== "loading" && status !== "error") {
    return <JoinScreen invite={decodeInvite(joinParam)} onDone={finishJoin} />;
  }

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
        <TeamSyncProvider>
          <PosRouter fullscreen={fullscreen} onToggleFullscreen={toggleFullscreen} />
        </TeamSyncProvider>
      </div>
    </PosProvider>
  );
}
