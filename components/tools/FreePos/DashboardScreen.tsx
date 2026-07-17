"use client";

import { useMemo } from "react";
import {
  AlertTriangle,
  PackagePlus,
  Receipt,
  ShoppingCart,
  UserPlus,
} from "lucide-react";
import { usePos } from "@/lib/pos/store";
import { formatMoney } from "@/lib/pos/types";
import type { NavigateFn } from "./nav";
import { StatCard, secondaryBtnClass } from "./ui";

function isSameDay(iso: string, day: Date): boolean {
  const date = new Date(iso);
  return (
    date.getFullYear() === day.getFullYear() &&
    date.getMonth() === day.getMonth() &&
    date.getDate() === day.getDate()
  );
}

export function DashboardScreen({ onNavigate }: { onNavigate: NavigateFn }) {
  const { business, settings, products, customers, orders, exportBackup } = usePos();
  const currency = business?.currency ?? "INR";

  const today = new Date();
  const stats = useMemo(() => {
    const completed = orders.filter((o) => o.status === "completed");
    const todayOrders = completed.filter((o) => isSameDay(o.date, today));
    return {
      todaySales: todayOrders.reduce((sum, o) => sum + o.total, 0),
      todayOrders: todayOrders.length,
      totalOrders: completed.length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

  const backupOverdue = useMemo(() => {
    if (orders.length === 0) return false;
    if (!settings.lastBackupAt) return true;
    const days = (Date.now() - new Date(settings.lastBackupAt).getTime()) / 86400000;
    return days > 7;
  }, [orders.length, settings.lastBackupAt]);

  const recentOrders = orders.slice(0, 5);

  const quickActions = [
    { label: "New Sale", icon: ShoppingCart, screen: "sell" as const, primary: true },
    { label: "Add Product", icon: PackagePlus, screen: "products" as const },
    { label: "Add Customer", icon: UserPlus, screen: "customers" as const },
    { label: "View Orders", icon: Receipt, screen: "orders" as const },
  ];

  return (
    <div className="space-y-6">
      {backupOverdue && (
        <div className="flex flex-col gap-3 rounded-xl border border-saffron/40 bg-saffron/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-saffron" />
            <p className="text-sm text-ink">
              {settings.lastBackupAt
                ? `Your last backup was on ${new Date(settings.lastBackupAt).toLocaleDateString()}. Export a fresh backup to keep your data safe.`
                : "You haven't exported a backup yet. Your data lives only in this browser — export a backup to keep it safe."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void exportBackup()}
            className={`${secondaryBtnClass} shrink-0`}
          >
            Export backup
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Today's Sales"
          value={formatMoney(stats.todaySales, currency)}
          sub={`${stats.todayOrders} order${stats.todayOrders === 1 ? "" : "s"} today`}
        />
        <StatCard label="Total Orders" value={String(stats.totalOrders)} />
        <StatCard label="Customers" value={String(customers.length)} />
        <StatCard label="Products" value={String(products.length)} />
      </div>

      <div>
        <h3 className="text-sm font-bold uppercase tracking-wide text-muted">Quick actions</h3>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {quickActions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => onNavigate(action.screen)}
              className={`flex flex-col items-center gap-2 rounded-2xl border p-5 text-sm font-semibold transition ${
                action.primary
                  ? "border-indigo bg-indigo text-white hover:bg-ink"
                  : "border-muted-line/30 bg-white text-ink hover:border-indigo/40 hover:text-indigo"
              }`}
            >
              <action.icon className="h-6 w-6" />
              {action.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wide text-muted">Recent orders</h3>
          {orders.length > 0 && (
            <button
              type="button"
              onClick={() => onNavigate("orders")}
              className="text-sm font-semibold text-indigo hover:underline"
            >
              View all
            </button>
          )}
        </div>
        {recentOrders.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-muted-line/40 bg-white/60 px-5 py-8 text-center text-sm text-muted">
            No sales yet. Hit <strong>New Sale</strong> to ring up your first order.
          </p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-2xl border border-muted-line/30 bg-white">
            {recentOrders.map((order) => (
              <button
                key={order.id}
                type="button"
                onClick={() => onNavigate("orders", order.invoiceNumber)}
                className="flex w-full items-center justify-between gap-3 border-b border-muted-line/15 px-5 py-3 text-left transition last:border-b-0 hover:bg-cream-paper"
              >
                <div>
                  <p className="text-sm font-semibold text-ink">{order.invoiceNumber}</p>
                  <p className="text-xs text-muted">
                    {new Date(order.date).toLocaleString()} · {order.customerName || "Walk-in"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-ink">{formatMoney(order.total, currency)}</p>
                  <p
                    className={`text-xs font-semibold ${
                      order.status === "cancelled" ? "text-red-500" : "text-emerald-600"
                    }`}
                  >
                    {order.status === "cancelled" ? "Cancelled" : order.paymentMethodName}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
